import assert from "node:assert/strict";
import { advanceBattleRound, beginActionPhase, createBattleState, playCombatCard, rewardQuizAnswer } from "../src/lib/battle-engine.ts";
import { generateTowerQuiz } from "../src/lib/quiz-engine.ts";
import { getTowerFloorConfig, getTowerQuizTypeLabels } from "../src/lib/tower-config.ts";
import { addTowerGear, applyTowerUpgrade, buyTowerShopItem, carryTowerHp, createTowerRun, getTowerCharacterProfile, isTowerUpgradeFloor, towerBossHp, towerEnemyDamage, towerGearReward, towerWrongAnswerDamage } from "../src/lib/tower-run.ts";
import { characters } from "../src/lib/content.ts";
import { clearTowerCheckpoint, loadTowerCheckpoint, saveTowerCheckpoint } from "../src/lib/tower-progress.ts";
import { getTowerTitles } from "../src/lib/titles.ts";

let run = createTowerRun();
assert.deepEqual(run, { hp: 100, maxHp: 100, attackBonus: 0, defenseBonus: 0, gear: 0, upgrades: [] });
run = carryTowerHp(run, 63);
run = applyTowerUpgrade(run, "max-hp");
assert.equal(run.hp, 83); assert.equal(run.maxHp, 120);
run = applyTowerUpgrade(run, "attack"); run = applyTowerUpgrade(run, "defense");
assert.equal(run.attackBonus, 1); assert.equal(run.defenseBonus, 1);
run = applyTowerUpgrade(run, "full-heal");
assert.equal(run.hp, 120);
assert.equal(towerGearReward(1, () => 0.3), 1); assert.equal(towerGearReward(1, () => 0.2), 2);
assert.equal(towerGearReward(5, () => 0.3), 2); assert.equal(towerGearReward(5, () => 0.2), 3);
assert.equal(towerGearReward(19, () => 0.3), 2); assert.equal(towerGearReward(19, () => 0.2), 3);
assert.equal(towerGearReward(20, () => 0), 0);
run = addTowerGear(run, 6);
const purchased = buyTowerShopItem(run, "defense");
assert.equal(purchased?.gear, 1); assert.equal(purchased?.defenseBonus, 2);
assert.equal(buyTowerShopItem({ ...run, gear: 4 }, "defense"), null);
assert.equal(towerWrongAnswerDamage(1), 2); assert.equal(towerWrongAnswerDamage(5), 2); assert.equal(towerWrongAnswerDamage(6), 3); assert.equal(towerWrongAnswerDamage(20), 5);
assert.equal(towerBossHp(1), 28); assert.equal(towerBossHp(5), 38); assert.equal(towerBossHp(10), 50); assert.equal(towerBossHp(15), 62); assert.equal(towerBossHp(20), 74);
assert.equal(towerEnemyDamage(1), 3); assert.equal(towerEnemyDamage(5), 3); assert.equal(towerEnemyDamage(6), 4); assert.equal(towerEnemyDamage(15), 5); assert.equal(towerEnemyDamage(20), 6);
assert.deepEqual(getTowerCharacterProfile(characters[0]), { ...characters[0], magicDefense: 1 });
assert.deepEqual(getTowerCharacterProfile(characters[1]), characters[1]);
assert.deepEqual(getTowerCharacterProfile(characters[2]), { ...characters[2], physicalDefense: 1 });
assert.equal(isTowerUpgradeFloor(5), true); assert.equal(isTowerUpgradeFloor(10), true); assert.equal(isTowerUpgradeFloor(19), true); assert.equal(isTowerUpgradeFloor(20), false);
assert.equal(getTowerFloorConfig(14).quizProfile, "compare");
assert.equal(getTowerFloorConfig(17).quizProfile, "range");
assert.equal(getTowerFloorConfig(18).quizProfile, "grouping");
assert.equal(getTowerFloorConfig(20).introTypeSummary, "모든 곱셈 규칙 활용");
assert.equal(getTowerFloorConfig(8).guide, "범위 속 곱셈 결과 찾기");
assert.deepEqual(getTowerQuizTypeLabels("compare-mix"), ["범위 속 곱셈 결과 찾기", "같은 결과 찾기", "기준값 비교"]);

const tower = createBattleState(1, "normal", "tower-profile", undefined, { playerHp: 63, maxPlayerHp: 120, playerAttackBonus: 1, playerDefenseBonus: 2, bossHp: towerBossHp(6), enemyDamage: towerEnemyDamage(6), wrongAnswerDamage: towerWrongAnswerDamage(6) });
assert.equal(tower.playerHp, 63); assert.equal(tower.maxPlayerHp, 120); assert.equal(tower.bossHp, towerBossHp(6)); assert.equal(tower.intent.damage, towerEnemyDamage(6)); assert.equal(tower.basePhysicalDefense, 6); assert.equal(tower.baseMagicDefense, 2);
const wrong = rewardQuizAnswer(tower, false, false, false);
assert.equal(tower.playerHp - wrong.playerHp, 3);
const attackCard = { instanceId: "tower-hit", key: "tower-hit", name: "탑 공격", cost: 1, effect: "physical", power: 5, symbol: "!", role: "attack", description: "", rarity: "normal", bonusPower: 0 };
const hit = playCombatCard({ ...beginActionPhase(tower), bossArmor: 0, bossBarrier: 0, energy: 1, hand: [attackCard] }, "tower-hit");
assert.equal(hit.attackNotice?.damage, 6);

const towerEasy = createBattleState(1, "easy", "tower-fixed-easy", undefined, { playerHp: 100, maxPlayerHp: 100, playerAttackBonus: 0, playerDefenseBonus: 0, bossHp: 50, enemyDamage: 5, wrongAnswerDamage: 2 });
const towerHard = createBattleState(1, "hard", "tower-fixed-hard", undefined, { playerHp: 100, maxPlayerHp: 100, playerAttackBonus: 0, playerDefenseBonus: 0, bossHp: 50, enemyDamage: 5, wrongAnswerDamage: 2 });
assert.equal(towerEasy.isTowerBattle, true); assert.equal(towerHard.isTowerBattle, true);
assert.equal(towerEasy.bossArmor, towerHard.bossArmor); assert.equal(towerEasy.bossBarrier, towerHard.bossBarrier);
const towerEasyNext = advanceBattleRound({ ...towerEasy, phase: "enemy" }, 1, "easy", "tower-fixed-next");
const towerHardNext = advanceBattleRound({ ...towerHard, phase: "enemy" }, 1, "hard", "tower-fixed-next");
assert.equal(towerEasyNext.bossArmor, towerHardNext.bossArmor); assert.equal(towerEasyNext.bossBarrier, towerHardNext.bossBarrier);

const storage = new Map();
const memoryStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const checkpoint = { floor: 6, score: 900, characterId: "toto", run: { hp: 74, maxHp: 100, attackBonus: 1, defenseBonus: 2, gear: 3, upgrades: ["attack"] } };
saveTowerCheckpoint(memoryStorage, checkpoint);
assert.deepEqual(loadTowerCheckpoint(memoryStorage), checkpoint);
clearTowerCheckpoint(memoryStorage); assert.equal(loadTowerCheckpoint(memoryStorage), null);
memoryStorage.setItem("luckypang-lnd-multiply-tower-checkpoint", JSON.stringify({ ...checkpoint, characterId: "unknown" }));
assert.equal(loadTowerCheckpoint(memoryStorage), null);
memoryStorage.setItem("luckypang-lnd-multiply-tower-checkpoint", JSON.stringify({ ...checkpoint, pendingShopFloor: 5, shopPurchaseMade: true }));
assert.deepEqual(loadTowerCheckpoint(memoryStorage), checkpoint, "기존 상점 대기 기록은 다음 층 체크포인트로 정리한다");
memoryStorage.setItem("luckypang-lnd-multiply-tower-checkpoint", JSON.stringify({ ...checkpoint, floor: 20, pendingShopFloor: 19, shopPurchaseMade: true }));
assert.deepEqual(loadTowerCheckpoint(memoryStorage), { ...checkpoint, floor: 20 }, "기존 결전 정비소 기록도 20층 체크포인트로 이어진다");
memoryStorage.setItem("luckypang-lnd-multiply-tower-checkpoint", JSON.stringify({ ...checkpoint, run: { ...checkpoint.run, gear: undefined } }));
assert.equal(loadTowerCheckpoint(memoryStorage)?.run.gear, 0);
clearTowerCheckpoint(memoryStorage);

assert.deepEqual(getTowerTitles(5, "clover", []).map((title) => title.id), ["tower-floor-5"]);
assert.ok(getTowerTitles(10, "toto", ["defense", "defense"]).some((title) => title.id === "tower-defense-build"));
const finalTitles = getTowerTitles(20, "pin", ["attack", "attack", "full-heal"]);
assert.ok(finalTitles.some((title) => title.id === "tower-mixed-mastery")); assert.ok(finalTitles.some((title) => title.id === "tower-character-pin"));

const zeroOneTypes = new Set();
for (let round = 1; round <= 60; round += 1) {
  const quiz = generateTowerQuiz(5, round, `zero-one-${round}`);
  assert.ok(["0의 곱", "1의 곱", "0·1의 곱 비교"].includes(quiz.typeName), "5층은 0·1의 곱 전용 문제만 출제해야 합니다.");
  zeroOneTypes.add(quiz.typeName);
}
assert.deepEqual([...zeroOneTypes].sort(), ["0·1의 곱 비교", "0의 곱", "1의 곱"].sort());

console.log("tower run verification passed");
