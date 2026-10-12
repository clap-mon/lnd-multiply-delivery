import assert from "node:assert/strict";
import {
  advanceBattleRound, applyRewardItem, battleFinished, battleWon, beginActionPhase, createBattleState, playCombatCard, recoverComboHp, redrawHand, replaceOldestCardForCombo, resolveEnemyTurn, retryQuizAfterWrong, rewardQuizAnswer,
} from "../src/lib/battle-engine.ts";
import { characters } from "../src/lib/content.ts";
import { drawCards, drawOpeningHand, riskyBetBalance } from "../src/lib/card-draw.ts";
import { getCombatCardPreview } from "../src/lib/card-preview.ts";

function card(overrides) {
  return { instanceId: "test-card", key: "strike", name: "출발 펀치", cost: 1, effect: "physical", power: 6, symbol: "✦", role: "attack", description: "물리 피해 6", rarity: "normal", bonusPower: 0, ...overrides };
}

const ordinaryDrawCounts = { attack: 0, magic: 0, defense: 0, dodge: 0, heal: 0, strategy: 0, boost: 0 };
for (let seed = 1; seed <= 10000; seed += 1) ordinaryDrawCounts[drawCards([], seed, 1, 0)[0].role] += 1;
for (const [role, expected] of Object.entries({ attack: 35, magic: 25, defense: 10, dodge: 5, heal: 10, strategy: 10, boost: 5 })) {
  assert.ok(Math.abs(ordinaryDrawCounts[role] / 100 - expected) < 2, `${role} 일반 드로우 비율이 가중치에서 벗어났습니다.`);
}
for (let seed = 1; seed <= 1000; seed += 1) {
  const openingHand = drawOpeningHand(seed);
  const attackCount = openingHand.filter((item) => item.role === "attack").length;
  assert.ok(attackCount >= 1 && attackCount <= 2, "시작 손패는 공격 카드를 1~2장 보장해야 합니다.");
  assert.ok(openingHand.every((item) => item.rarity === "normal" && item.bonusPower === 0), "시작 손패은 기본 카드만 제공해야 합니다.");
}
const upgradedDraws = { eligible: 0, pangup: 0, pangmax: 0 };
for (let seed = 1; seed <= 10_000; seed += 1) {
  const drawn = drawCards([], seed, 1, 1)[0];
  assert.ok(drawn.rarity === "normal" || drawn.effect === "physical" || drawn.effect === "magic", "팡업·팡맥스는 공격·마법 카드에만 적용해야 합니다.");
  if (drawn.rarity === "pangup") { assert.match(drawn.description, /팡업 2 = \d+/); assert.doesNotMatch(drawn.description, /팡업 \+2/); }
  if (drawn.rarity === "pangmax") { assert.match(drawn.description, /팡맥스 3 = \d+/); assert.doesNotMatch(drawn.description, /팡맥스 \+3/); }
  if (drawn.effect === "physical" || drawn.effect === "magic") { upgradedDraws.eligible += 1; if (drawn.rarity === "pangup") upgradedDraws.pangup += 1; if (drawn.rarity === "pangmax") upgradedDraws.pangmax += 1; }
}
assert.ok(Math.abs(upgradedDraws.pangup / upgradedDraws.eligible - 0.2) < 0.025, "팡업 확률은 약 20%여야 합니다.");
assert.ok(Math.abs(upgradedDraws.pangmax / upgradedDraws.eligible - 0.05) < 0.015, "팡맥스 확률은 약 5%여야 합니다.");
let riskyCard;
for (let seed = 1; seed <= 10_000 && !riskyCard; seed += 1) riskyCard = drawCards([], seed, 1, 0).find((item) => item.effect === "risky");
assert.ok(riskyCard, "복불복 급행 카드는 카드풀에서 생성되어야 합니다.");
assert.match(riskyCard.description, /0~7/, "복불복 급행은 피해 범위를 0~7로 표시해야 합니다.");
assert.doesNotMatch(riskyCard.description, /7~7/, "복불복 급행의 피해 범위를 단일 값으로 표시하면 안 됩니다.");
for (let seed = 1; seed <= 1000; seed += 1) {
  const hand = drawCards(drawOpeningHand(seed, 5), seed + 10_000, 5, 1);
  assert.ok(hand.filter((item) => item.role === "attack").length <= 2, "전투 손패에는 공격 카드가 최대 2장만 있어야 합니다.");
}
const utilityHand = [card({ instanceId: "guard-a", key: "guard", effect: "guard", role: "defense" }), card({ instanceId: "heal-a", key: "heal", effect: "heal", role: "heal" })];
for (let seed = 1; seed <= 1000; seed += 1) {
  const safetyDraw = drawCards(utilityHand, seed, 1, 0, { ensureDirectAttack: true });
  assert.ok(["attack", "magic"].includes(safetyDraw.at(-1).role), "안전망은 직접 공격 카드가 없을 때 공격 또는 마법을 보장해야 합니다.");
}

for (const difficulty of ["easy", "normal", "hard"]) {
  for (let stageId = 1; stageId <= 5; stageId += 1) {
    const state = createBattleState(stageId, difficulty, `verify-${difficulty}-${stageId}`);
    assert.equal(state.phase, "quiz"); assert.equal(state.hand.length, 4);
    assert.ok(state.hand.some((item) => item.role === "attack"));
    assert.ok(state.hand.some((item) => item.role === "magic" || item.role === "strategy"));
    assert.ok(state.hand.some((item) => ["defense", "dodge", "heal", "boost"].includes(item.role)));
    assert.ok(state.hand.every((item) => state.hand.filter((other) => other.key === item.key).length <= 1));
  }
}

const easy = createBattleState(1, "easy", "difficulty-easy");
const normal = createBattleState(1, "normal", "difficulty-normal");
const hard = createBattleState(1, "hard", "difficulty-hard");
const towerFloorThree = createBattleState(3, "normal", "tower-floor-three", undefined, 1);
const towerFloorTwenty = createBattleState(5, "normal", "tower-floor-twenty", undefined, 9);
const easyMagic = createBattleState(2, "easy", "difficulty-easy-magic");
const normalMagic = createBattleState(2, "normal", "difficulty-normal-magic");
const hardMagic = createBattleState(2, "hard", "difficulty-hard-magic");
assert.equal(easy.playerHp, normal.playerHp + 8); assert.equal(hard.playerHp, normal.playerHp - 8);
assert.equal(easy.bossHp, normal.bossHp); assert.equal(hard.bossHp, normal.bossHp);
assert.equal(easy.bossArmor, normal.bossArmor - 2); assert.equal(hard.bossArmor, normal.bossArmor + 2);
assert.equal(easyMagic.bossBarrier, normalMagic.bossBarrier - 2); assert.equal(hardMagic.bossBarrier, normalMagic.bossBarrier + 2);
assert.equal(easy.intent.damage, normal.intent.damage - 2); assert.equal(hard.intent.damage, normal.intent.damage + 2);
assert.equal(towerFloorThree.intent.damage, 8); assert.equal(towerFloorTwenty.intent.damage, 17);
assert.equal(advanceBattleRound({ ...towerFloorTwenty, phase: "enemy" }, 5, "normal", "tower-floor-twenty").intent.damage, 17);
let intentBalance = createBattleState(1, "normal", "intent-balance-flow"); const intentTypes = [intentBalance.intent.type];
for (let round = 2; round <= 8; round += 1) { intentBalance = advanceBattleRound({ ...intentBalance, phase: "enemy" }, 1, "normal", "intent-balance-flow"); intentTypes.push(intentBalance.intent.type); }
assert.equal(intentTypes.filter((type) => type === "physical").length, 4); assert.equal(intentTypes.filter((type) => type === "magic").length, 4);

const ongoingBattle = { ...createBattleState(1, "normal", "no-round-limit-flow"), round: 99, bossHp: 10, playerHp: 10 };
assert.equal(battleFinished(ongoingBattle), false); assert.equal(battleWon(ongoingBattle), false); assert.equal(advanceBattleRound({ ...ongoingBattle, phase: "enemy" }, 1, "normal", "no-round-limit-flow").round, 100);

const clover = characters.find((item) => item.id === "clover"); const toto = characters.find((item) => item.id === "toto"); const pin = characters.find((item) => item.id === "pin");
assert.ok(clover && toto && pin); assert.ok(characters.every((character) => character.image.endsWith(".webp"))); assert.equal(createBattleState(1, "normal", "clover-stats", clover).basePhysicalDefense, 4); assert.equal(createBattleState(1, "normal", "toto-stats", toto).baseMagicDefense, 2); assert.equal(createBattleState(1, "normal", "pin-stats", pin).baseMagicDefense, 4);

let state = createBattleState(1, "normal", "answer-flow");
state = rewardQuizAnswer(state, true, false, false);
assert.equal(state.energy, 2); assert.equal(state.hand.length, 5);
state = beginActionPhase(state);
const attack = state.hand.find((item) => item.effect === "physical") ?? card({ instanceId: "fallback" });
if (!state.hand.some((item) => item.instanceId === attack.instanceId)) state = { ...state, hand: [...state.hand, attack] };
const beforeAttack = state.bossHp; const beforeShield = state.bossArmor; state = playCombatCard(state, attack.instanceId);
assert.ok(state.bossHp < beforeAttack || state.bossArmor < beforeShield); assert.equal(state.attackBoost, 0); assert.match(state.message, new RegExp(`${state.playerName}의`));

const previewState = { ...beginActionPhase(createBattleState(1, "easy", "preview-flow")), bossArmor: 0, bossBarrier: 0, playerHp: 20, maxPlayerHp: 34 };
assert.equal(getCombatCardPreview(previewState, card({ key: "strike", effect: "physical", power: 6 })), "보스 HP 48 → 42");
assert.equal(getCombatCardPreview({ ...previewState, bossBarrier: 3 }, card({ key: "spark", effect: "magic", role: "magic", power: 3, burn: 2 })), "마법 결계 3 → 0 · 보스 혼란 1턴 · 턴 종료 화상 2");
assert.equal(getCombatCardPreview(previewState, card({ key: "risky-bet", name: "복불복 급행", effect: "risky", power: 7 })), "보스 피해 0~7 · 집중력 -2~-6");

let riskyWins = 0;
let riskyDamageTotal = 0;
let riskySelfDamageTotal = 0;
for (let damage = riskyBetBalance.damageMin; damage <= riskyBetBalance.damageMax; damage += 1) {
  for (let selfDamage = riskyBetBalance.selfDamageMin; selfDamage <= riskyBetBalance.selfDamageMax; selfDamage += 1) {
    if (damage > selfDamage) riskyWins += 1;
    riskyDamageTotal += damage;
    riskySelfDamageTotal += selfDamage;
  }
}
const riskyOutcomeCount = (riskyBetBalance.damageMax - riskyBetBalance.damageMin + 1) * (riskyBetBalance.selfDamageMax - riskyBetBalance.selfDamageMin + 1);
assert.equal(riskyWins / riskyOutcomeCount, 0.375, "복불복 급행의 피해 우위 확률은 약 40%여야 합니다.");
assert.ok(riskyDamageTotal < riskySelfDamageTotal, "복불복 급행은 기대값이 낮은 위험 카드여야 합니다.");
assert.equal(getCombatCardPreview(previewState, card({ key: "focus-shield", name: "기관실 방벽", effect: "focus-guard", role: "defense", power: 2 })), "다음 물리 공격 무효 · 집중력 20 → 22");
assert.equal(getCombatCardPreview({ ...previewState, bossArmor: 3, bossBarrier: 5 }, card({ key: "analyze", name: "노선 분석", effect: "analyze", role: "strategy", power: 3 })), "물리 방어 3 → 0 · 마법 결계 5 → 2 · 보스 혼란 1턴");
assert.equal(getCombatCardPreview({ ...previewState, intent: { type: "magic", damage: 7, label: "마법 공격 7" } }, card({ key: "magic-ward", effect: "magic-ward", role: "defense", power: 4 })), "다음 마법 피해 3");
assert.equal(getCombatCardPreview({ ...previewState, attackBoost: 2 }, card({ key: "chain", effect: "boost", role: "boost", power: 3 })), "다음 직접 공격 +2 → +5");

let safetyReward = createBattleState(1, "normal", "safety-reward-flow");
safetyReward = { ...safetyReward, hand: [...utilityHand, card({ instanceId: "boost-a", key: "chain", effect: "boost", role: "boost" })] };
safetyReward = rewardQuizAnswer(safetyReward, true, false, false); assert.ok(["attack", "magic"].includes(safetyReward.hand.at(-1).role));

let wrong = createBattleState(1, "normal", "wrong-flow"); wrong = { ...wrong, combo: 3, attackBoost: 3 };
const beforeWrong = wrong.playerHp; wrong = rewardQuizAnswer(wrong, false, false, false);
assert.ok(beforeWrong - wrong.playerHp >= 2 && beforeWrong - wrong.playerHp <= 5); assert.equal(wrong.combo, 1); assert.equal(wrong.attackBoost, 0);
assert.equal(retryQuizAfterWrong(wrong).phase, "quiz");

let gateCrystal = createBattleState(1, "normal", "gate-crystal-flow");
gateCrystal = applyRewardItem(gateCrystal, "gate-guardian-crystal"); assert.equal(gateCrystal.quizHint, true);
gateCrystal = rewardQuizAnswer(gateCrystal, false, false, false); assert.equal(gateCrystal.quizHint, false);

let gearCrystal = beginActionPhase(createBattleState(3, "normal", "gear-crystal-flow"));
gearCrystal = { ...gearCrystal, energy: 3 }; gearCrystal = applyRewardItem(gearCrystal, "precision-gear-crystal"); assert.equal(gearCrystal.energy, 5);

let mistCrystal = beginActionPhase(createBattleState(2, "normal", "mist-crystal-flow"));
mistCrystal = { ...mistCrystal, bossArmor: 5, bossBarrier: 5 }; mistCrystal = applyRewardItem(mistCrystal, "mist-guide-crystal"); assert.equal(mistCrystal.bossArmor, 0); assert.equal(mistCrystal.bossBarrier, 0); assert.equal(mistCrystal.confusedTurns, 1);
const mistCrystalOnOpening = applyRewardItem(beginActionPhase(createBattleState(2, "normal", "mist-crystal-opening-flow")), "mist-guide-crystal"); assert.equal(mistCrystalOnOpening.confusedTurns, 1);

let mirrorCrystal = createBattleState(4, "normal", "mirror-crystal-flow");
mirrorCrystal = applyRewardItem(mirrorCrystal, "truth-mirror-crystal"); assert.equal(mirrorCrystal.mirrorTurns, 2); mirrorCrystal = rewardQuizAnswer(mirrorCrystal, true, true, false); assert.equal(mirrorCrystal.mirrorTurns, 1); mirrorCrystal = rewardQuizAnswer({ ...mirrorCrystal, phase: "quiz" }, true, false, false); assert.equal(mirrorCrystal.mirrorTurns, 0);

const comboReady = { ...createBattleState(1, "normal", "combo-flow"), playerHp: 20, combo: 3 };
const recovered = recoverComboHp(comboReady, 4); assert.equal(recovered.playerHp, 24); assert.equal(recovered.combo, 0);
assert.equal(recoverComboHp({ ...comboReady, combo: 2 }, 4).playerHp, 20);

const towerComboReady = { ...createBattleState(3, "normal", "tower-combo-flow", undefined, { playerHp: 30, maxPlayerHp: 30, playerAttackBonus: 0, playerDefenseBonus: 0, bossHp: 40, enemyDamage: 5, wrongAnswerDamage: 3 }), combo: 3, hand: drawOpeningHand(44, 5), drawCount: 2 };
const replacedComboCard = replaceOldestCardForCombo(towerComboReady, 3, "tower-combo-flow");
assert.equal(replacedComboCard.combo, 0); assert.equal(replacedComboCard.hand.length, 5); assert.equal(replacedComboCard.discardCount, towerComboReady.discardCount + 1); assert.equal(replacedComboCard.drawCount, 3);
assert.ok(!replacedComboCard.hand.some((item) => item.key === towerComboReady.hand[0].key), "연쇄 보상은 가장 오래된 카드와 다른 새 카드를 뽑아야 합니다.");
const towerComboNotReady = { ...towerComboReady, combo: 2 };
assert.equal(replaceOldestCardForCombo(towerComboNotReady, 3, "tower-combo-flow"), towerComboNotReady);

let exposed = beginActionPhase(createBattleState(1, "normal", "exposed-flow"));
exposed = { ...exposed, energy: 1, bossArmor: 0, bossBarrier: 0, hand: [card({ key: "jab", name: "빈틈 급행", power: 4, exposedBonus: 3 })] };
exposed = playCombatCard(exposed, "test-card"); assert.equal(exposed.attackNotice?.damage, 7); assert.equal(exposed.impactSequence, 1); assert.equal(exposed.attackNotice?.sequence, 1);
const secondImpact = playCombatCard({ ...exposed, energy: 1, hand: [card({ instanceId: "test-card-2", key: "strike-2" })] }, "test-card-2"); assert.equal(secondImpact.impactSequence, 2); assert.equal(secondImpact.attackNotice?.sequence, 2);

let analyzed = beginActionPhase(createBattleState(1, "normal", "analyze-flow"));
analyzed = { ...analyzed, energy: 1, bossArmor: 3, bossBarrier: 0, hand: [card({ key: "analyze", name: "약점 분석", effect: "analyze", role: "strategy", power: 3 })] };
analyzed = playCombatCard(analyzed, "test-card"); assert.equal(analyzed.bossArmor, 0); assert.equal(analyzed.confusedTurns, 1);
const skipped = resolveEnemyTurn(analyzed); assert.equal(skipped.confusedTurns, 0); assert.equal(skipped.enemyAttackNotice, undefined);

let physicalShield = beginActionPhase(createBattleState(1, "normal", "physical-shield-flow"));
physicalShield = { ...physicalShield, energy: 1, bossStance: "물리 방어", bossArmor: 8, bossBarrier: 0, hand: [card({ power: 6 })] };
const hpBeforeShieldHit = physicalShield.bossHp; physicalShield = playCombatCard(physicalShield, "test-card");
assert.equal(physicalShield.bossHp, hpBeforeShieldHit); assert.equal(physicalShield.bossArmor, 2); assert.equal(physicalShield.attackNotice?.shieldDamage, 6);
physicalShield = { ...resolveEnemyTurn(physicalShield), round: 1 }; physicalShield = advanceBattleRound(physicalShield, 1, "normal", "physical-shield-flow");
assert.ok(["물리 방어", "마법 결계", "빈틈"].includes(physicalShield.bossStance));
assert.equal(physicalShield.bossArmor, physicalShield.bossStance === "물리 방어" ? 8 : 0);
assert.equal(physicalShield.bossBarrier, physicalShield.bossStance === "마법 결계" ? 8 : 0);

let stanceFlow = createBattleState(1, "normal", "stance-limit-flow");
let previousStance = stanceFlow.bossStance;
let stanceStreak = 1;
for (let round = 2; round <= 40; round += 1) {
  stanceFlow = advanceBattleRound({ ...stanceFlow, phase: "enemy" }, 1, "normal", "stance-limit-flow");
  stanceStreak = stanceFlow.bossStance === previousStance ? stanceStreak + 1 : 1;
  assert.ok(stanceStreak <= 2, "같은 보스 태세는 3회 연속 선택되면 안 됩니다.");
  assert.equal(stanceFlow.bossStanceStreak, stanceStreak);
  previousStance = stanceFlow.bossStance;
}

let bypassShield = beginActionPhase(createBattleState(1, "normal", "bypass-shield-flow"));
bypassShield = { ...bypassShield, energy: 1, bossStance: "물리 방어", bossArmor: 8, bossBarrier: 0, hand: [card({ key: "rounding-wave", name: "시간표 파동", effect: "magic", role: "magic", power: 5 })] };
const hpBeforeBypass = bypassShield.bossHp; bypassShield = playCombatCard(bypassShield, "test-card");
assert.equal(bypassShield.bossHp, hpBeforeBypass - 5); assert.equal(bypassShield.bossArmor, 8);

let brokenShield = beginActionPhase(createBattleState(1, "normal", "broken-shield-flow"));
brokenShield = { ...brokenShield, energy: 2, bossStance: "물리 방어", bossArmor: 6, bossBarrier: 0, hand: [card({ power: 6 }), card({ instanceId: "follow-up", key: "strike-follow-up", power: 6 })] };
brokenShield = playCombatCard(brokenShield, "test-card"); assert.equal(brokenShield.bossArmor, 0); assert.equal(brokenShield.confusedTurns, 1); assert.equal(brokenShield.attackNotice?.brokeShield, true);
brokenShield = playCombatCard(brokenShield, "follow-up"); assert.equal(brokenShield.attackNotice?.damage, 12); assert.equal(brokenShield.confusedTurns, 1);
brokenShield = resolveEnemyTurn(brokenShield); assert.equal(brokenShield.confusedTurns, 0); assert.equal(brokenShield.enemyAttackNotice, undefined);

let shield = beginActionPhase(createBattleState(1, "normal", "shield-flow"));
shield = { ...shield, energy: 1, intent: { type: "physical", damage: 9, label: "물리 공격 9" }, hand: [card({ key: "guard", name: "정비 방패", effect: "guard", role: "defense", power: 1 })] };
shield = resolveEnemyTurn(playCombatCard(shield, "test-card")); assert.equal(shield.enemyAttackNotice?.damage, 0); assert.equal(shield.attackBoost, 2);

let magicAgainstShield = beginActionPhase(createBattleState(1, "normal", "magic-shield-flow"));
magicAgainstShield = { ...magicAgainstShield, physicalShield: true, physicalGuard: 1, intent: { type: "magic", damage: 9, label: "마법 공격 9" } };
magicAgainstShield = resolveEnemyTurn(magicAgainstShield); assert.equal(magicAgainstShield.physicalShield, true); assert.equal(magicAgainstShield.physicalGuard, 1);

let magicWard = beginActionPhase(createBattleState(1, "normal", "magic-ward-flow"));
magicWard = { ...magicWard, baseMagicDefense: 0, energy: 1, intent: { type: "magic", damage: 9, label: "마법 공격 9" }, hand: [card({ key: "magic-ward", name: "신호 결계", effect: "magic-ward", role: "defense", power: 4 })] };
magicWard = resolveEnemyTurn(playCombatCard(magicWard, "test-card")); assert.equal(magicWard.enemyAttackNotice?.damage, 5); assert.equal(magicWard.magicGuard, 0);

let defenseLog = beginActionPhase(createBattleState(1, "normal", "defense-log-flow", pin));
defenseLog = { ...defenseLog, baseMagicDefense: 4, intent: { type: "magic", damage: 7, label: "마법 공격 7" } };
defenseLog = resolveEnemyTurn(defenseLog); assert.equal(defenseLog.enemyAttackNotice?.damage, 3); assert.match(defenseLog.message, /보스의 마법 공격 7! 세나의 마법 방어 4로 4 막음 · 세나의 집중력 3 감소\./);

let wardAgainstPhysical = beginActionPhase(createBattleState(1, "normal", "magic-ward-physical-flow"));
wardAgainstPhysical = { ...wardAgainstPhysical, basePhysicalDefense: 0, energy: 1, intent: { type: "physical", damage: 9, label: "물리 공격 9" }, hand: [card({ key: "magic-ward", name: "신호 결계", effect: "magic-ward", role: "defense", power: 3 })] };
wardAgainstPhysical = resolveEnemyTurn(playCombatCard(wardAgainstPhysical, "test-card")); assert.equal(wardAgainstPhysical.enemyAttackNotice?.damage, 9); assert.equal(wardAgainstPhysical.magicGuard, 3);

let pierced = beginActionPhase(createBattleState(1, "normal", "armor-pierce-flow"));
pierced = { ...pierced, energy: 1, bossArmor: 3, hand: [card({ key: "armor-pierce", name: "레일 관통", power: 5, pierce: 2 })] };
pierced = playCombatCard(pierced, "test-card"); assert.equal(pierced.attackNotice?.damage, 2); assert.equal(pierced.attackNotice?.defense, 3); assert.equal(pierced.attackNotice?.shieldRemaining, 0);

let roundingWave = beginActionPhase(createBattleState(1, "normal", "rounding-wave-flow"));
roundingWave = { ...roundingWave, energy: 1, bossBarrier: 2, hand: [card({ key: "rounding-wave", name: "시간표 파동", effect: "magic", role: "magic", power: 5 })] };
roundingWave = playCombatCard(roundingWave, "test-card"); assert.equal(roundingWave.attackNotice?.damage, 3); assert.equal(roundingWave.bossBarrier, 0);

let burn = beginActionPhase(createBattleState(1, "normal", "burn-flow"));
burn = { ...burn, energy: 1, bossHp: 2, bossArmor: 0, bossBarrier: 0, hand: [card({ key: "spark", name: "신호탄 불꽃", effect: "magic", role: "magic", power: 3, burn: 2 })] };
burn = resolveEnemyTurn(playCombatCard(burn, "test-card")); assert.equal(burn.bossHp, 0);

let blockedSpark = beginActionPhase(createBattleState(1, "normal", "blocked-spark-flow"));
blockedSpark = { ...blockedSpark, energy: 1, bossBarrier: 8, hand: [card({ key: "spark", name: "신호탄 불꽃", effect: "magic", role: "magic", power: 3, burn: 2 })] };
blockedSpark = playCombatCard(blockedSpark, "test-card"); assert.equal(blockedSpark.bossBarrier, 5); assert.equal(blockedSpark.burnTurns, 0);

let redraw = beginActionPhase(rewardQuizAnswer(createBattleState(3, "normal", "redraw-flow"), true, false, false));
redraw = redrawHand(redraw, 3, "redraw-flow"); assert.equal(redraw.energy, 0); assert.equal(redraw.hand.length, 5);
let nextRound = { ...redraw, phase: "enemy", hand: redraw.hand.slice(0, 3), round: 1 };
nextRound = advanceBattleRound(nextRound, 3, "normal", "redraw-flow"); assert.equal(nextRound.hand.length, 4);
let safetyRound = { ...redraw, phase: "enemy", hand: utilityHand, round: 1 };
safetyRound = advanceBattleRound(safetyRound, 3, "normal", "safety-round-flow"); assert.ok(safetyRound.hand.some((item) => item.role === "attack" || item.role === "magic"));

console.log("전투 엔진 검증 완료: 카드풀·상성·드로우·오답·혼란·화상·손패 규칙");
