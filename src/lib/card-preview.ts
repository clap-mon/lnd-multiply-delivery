import { calculateDirectAttack, type BattleState } from "./battle-engine.ts";
import { riskyBetBalance, type CombatCard } from "./card-draw.ts";

function directAttackPreview(battle: BattleState, card: CombatCard, rawPower: number, kind: "physical" | "magic") {
  const result = calculateDirectAttack(battle, card, rawPower, kind);
  const bossHp = Math.max(0, battle.bossHp - result.damage);
  const burnApplies = Boolean(card.burn) && (kind !== "magic" || result.defense === 0 || result.brokeShield) && bossHp > 0;
  const followUp = `${result.brokeShield ? " · 보스 혼란 1턴" : ""}${burnApplies ? ` · 턴 종료 화상 ${card.burn}` : ""}`;
  if (result.defense <= 0) return `보스 HP ${battle.bossHp} → ${bossHp}${followUp}`;
  const label = kind === "physical" ? "물리 방어" : "마법 결계";
  return `${label} ${result.defense} → ${result.shieldRemaining}${result.damage ? ` · 보스 HP ${battle.bossHp} → ${bossHp}` : ""}${followUp}`;
}

function incomingMagicDamagePreview(battle: BattleState, addedGuard: number) {
  const guard = battle.baseMagicDefense + battle.magicGuard + addedGuard;
  return Math.max(0, battle.intent.damage - guard - battle.enemyDamageShield);
}

export function getCombatCardPreview(battle: BattleState, card: CombatCard) {
  if (card.effect === "physical") return directAttackPreview(battle, card, card.power, "physical");
  if (card.effect === "magic") return directAttackPreview(battle, card, card.power, "magic");
  if (card.effect === "risky") {
    const minimum = calculateDirectAttack(battle, card, 0, "physical");
    const maximum = calculateDirectAttack(battle, card, card.power, "physical");
    const selfDamageRange = `-${riskyBetBalance.selfDamageMin}~-${riskyBetBalance.selfDamageMax}`;
    if (minimum.defense <= 0) return `보스 피해 ${minimum.damage}~${maximum.damage} · 집중력 ${selfDamageRange}`;
    return `물리 방어 ${minimum.defense} → ${minimum.shieldRemaining}~${maximum.shieldRemaining} · 피해 ${minimum.damage}~${maximum.damage} · 집중력 ${selfDamageRange}`;
  }
  if (card.effect === "heal") return `집중력 ${battle.playerHp} → ${Math.min(battle.maxPlayerHp, battle.playerHp + card.power)}`;
  if (card.effect === "analyze") {
    const armor = Math.max(0, battle.bossArmor - card.power);
    const barrier = Math.max(0, battle.bossBarrier - card.power);
    const confused = (battle.bossArmor > 0 && armor === 0) || (battle.bossBarrier > 0 && barrier === 0);
    return `물리 방어 ${battle.bossArmor} → ${armor} · 마법 결계 ${battle.bossBarrier} → ${barrier}${confused ? " · 보스 혼란 1턴" : ""}`;
  }
  if (card.effect === "guard") return battle.intent.type === "physical" ? "다음 물리 공격 피해 0 · 반격 +2" : "다음 물리 공격 무효";
  if (card.effect === "focus-guard") return `다음 물리 공격 무효 · 집중력 ${battle.playerHp} → ${Math.min(battle.maxPlayerHp, battle.playerHp + card.power)}`;
  if (card.effect === "dodge") return "다음 보스 공격 완전 회피";
  if (card.effect === "magic-ward") return battle.intent.type === "magic" ? `다음 마법 피해 ${incomingMagicDamagePreview(battle, card.power)}` : `다음 마법 피해 -${card.power}`;
  if (card.effect === "boost") return `다음 직접 공격 +${battle.attackBoost} → +${battle.attackBoost + card.power}`;
  return "오래된 카드 1장 버림 · 2장 뽑기";
}
