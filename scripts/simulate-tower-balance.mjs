import { advanceBattleRound, beginActionPhase, createBattleState, playCombatCard, resolveEnemyTurn, rewardQuizAnswer } from "../src/lib/battle-engine.ts";
import { characters } from "../src/lib/content.ts";
import { getTowerFloorConfig } from "../src/lib/tower-config.ts";
import { addTowerGear, buyTowerShopItem, carryTowerHp, createTowerRun, getTowerCharacterProfile, isTowerUpgradeFloor, towerBossHp, towerEnemyDamage, towerGearReward, towerWrongAnswerDamage } from "../src/lib/tower-run.ts";

const checkpoints = [5, 10, 15, 20];
const policies = {
  attack: ["attack", "attack", "attack", "attack", "attack"],
  defense: ["defense", "defense", "defense", "defense", "defense"],
  balanced: ["defense", "attack", "full-heal", "attack", "defense"],
  survival: ["full-heal", "defense", "full-heal", "defense", "max-hp"],
};

function pickCard(state) {
  const direct = state.hand.filter((card) => (card.effect === "physical" || card.effect === "magic" || card.effect === "risky") && card.cost <= state.energy);
  const matching = direct.filter((card) => (state.bossArmor > 0 && card.effect === "magic") || (state.bossBarrier > 0 && card.effect === "physical"));
  const attack = [...(matching.length ? matching : direct)].sort((a, b) => b.power - a.power)[0];
  if (attack) return attack;
  return state.hand.find((card) => card.effect === "guard" || card.effect === "dodge") ?? state.hand.find((card) => card.cost <= state.energy);
}

function simulate(character, upgrades, sample) {
  let run = createTowerRun();
  let purchaseIndex = 0;
  const remaining = {};
  for (let floor = 1; floor <= 20; floor += 1) {
    const config = getTowerFloorConfig(floor);
    let state = createBattleState(config.combatStageId, "normal", `balance-${character.id}-${upgrades.join("-")}-${sample}-${floor}`, getTowerCharacterProfile(character), { playerHp: run.hp, maxPlayerHp: run.maxHp, playerAttackBonus: run.attackBonus, playerDefenseBonus: run.defenseBonus, bossHp: towerBossHp(floor), enemyDamage: towerEnemyDamage(floor), wrongAnswerDamage: towerWrongAnswerDamage(floor) });
    for (let turn = 0; turn < 40 && state.playerHp > 0 && state.bossHp > 0; turn += 1) {
      state = rewardQuizAnswer(state, true, (sample + floor + turn) % 5 === 0, false);
      state = beginActionPhase(state);
      for (let action = 0; action < 3 && state.energy > 0 && state.bossHp > 0; action += 1) {
        const card = pickCard(state);
        if (!card) break;
        const next = playCombatCard(state, card.instanceId);
        if (next === state) break;
        state = next;
      }
      state = resolveEnemyTurn(state);
      if (state.playerHp > 0 && state.bossHp > 0) state = advanceBattleRound({ ...state, phase: "enemy" }, config.combatStageId, "normal", `balance-${character.id}-${upgrades.join("-")}-${sample}-${floor}`);
    }
    if (state.playerHp <= 0 || state.bossHp > 0) return { cleared: floor - 1, remaining };
    run = addTowerGear(carryTowerHp(run, state.playerHp), towerGearReward(floor, () => ((sample * 37 + floor * 17) % 100) / 100));
    if (checkpoints.includes(floor)) remaining[floor] = run.hp;
    if (isTowerUpgradeFloor(floor) && purchaseIndex < upgrades.length) {
      const purchased = buyTowerShopItem(run, upgrades[purchaseIndex]);
      if (purchased) {
        run = purchased;
        purchaseIndex += 1;
      }
    }
  }
  return { cleared: 20, remaining };
}

for (const character of characters) {
  for (const [policyName, upgrades] of Object.entries(policies)) {
    const runs = Array.from({ length: 200 }, (_, sample) => simulate(character, upgrades, sample));
    const clearRate = runs.filter((run) => run.cleared === 20).length / runs.length;
    const averageFloor = runs.reduce((sum, run) => sum + run.cleared, 0) / runs.length;
    const hp = Object.fromEntries(checkpoints.map((floor) => {
      const values = runs.map((run) => run.remaining[floor]).filter((value) => Number.isFinite(value));
      return [floor, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0];
    }));
    console.log(JSON.stringify({ character: character.name, policy: policyName, clearRate: Number(clearRate.toFixed(2)), averageFloor: Number(averageFloor.toFixed(1)), hp }));
  }
}
