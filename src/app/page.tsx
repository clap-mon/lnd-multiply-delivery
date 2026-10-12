"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { advanceBattleRound, applyRewardItem, battleFinished, battleWon, beginActionPhase, createBattleState, playCombatCard, recoverComboHp, redrawHand, replaceOldestCardForCombo, resolveEnemyTurn, retryQuizAfterWrong, rewardQuizAnswer, type BattleState } from "@/lib/battle-engine";
import { clearAdventureProgress, loadRewardItems, loadUnlockedStage, loadUsedRewardItems, saveRewardItems, saveUnlockedStage, saveUsedRewardItems } from "@/lib/adventure-progress";
import { clearTowerCheckpoint, clearTowerRecord, loadTowerCheckpoint, loadTowerRecord, saveTowerCheckpoint, saveTowerRecord, unlockTower, type TowerCheckpoint, type TowerRecord } from "@/lib/tower-progress";
import type { CombatCard } from "@/lib/card-draw";
import { characters, shuffleDialogueChoices, stages, type DialogueChoice, type DialogueMultiCheck as DialogueMultiCheckData, type StageId } from "@/lib/content";
import { difficulties, getDifficulty, type AdventureDifficulty } from "@/lib/game";
import { generateStageQuiz, generateTowerQuiz, type Quiz, type QuizOption } from "@/lib/quiz-engine";
import { playBattleSound, type BattleSound } from "@/lib/battle-sound";
import { canUseRewardItem, rewardItemForStage, rewardItems, type RewardItem, type RewardItemId } from "@/lib/reward-items";
import { getCombatCardPreview } from "@/lib/card-preview";
import { adventureTitles, campaignIsComplete, clearCollectedTitles, clearTitleCampaignProgress, getCampaignClearTitle, getScoreTitle, getTitleDifficulty, getTowerTitles, loadCollectedTitleIds, loadTitleCampaignProgress, saveCollectedTitleId, saveTitleCampaignStage, scoreTitleThresholds, type AdventureTitle, type CampaignProgress } from "@/lib/titles";
import { getTowerFloorConfig, getTowerQuizTypeLabels, TOWER_MAX_FLOOR, type TowerFloorConfig } from "@/lib/tower-config";
import { addTowerGear, buyTowerShopItem, carryTowerHp, createTowerRun, getTowerCharacterProfile, getTowerShopRecommendation, isTowerUpgradeFloor, towerBossHp, towerEnemyDamage, towerGearReward, towerShopItems, towerWrongAnswerDamage, type TowerRunState, type TowerUpgradeId } from "@/lib/tower-run";

type Screen = "landing" | "setup" | "dialogue" | "battle" | "result" | "ending" | "tower-shop";
type PlayMode = "campaign" | "tower";
type BattleLogKind = "quiz" | "card" | "enemy" | "item" | "draw" | "system";
type BattleLogEntry = { id: number; round: number; kind: BattleLogKind; actor: string; text: string; detail?: string };

const showTowerDeveloperTools = process.env.NODE_ENV === "development";
const battleLogKindLabel: Record<BattleLogKind, string> = { quiz: "퀴즈", card: "카드", enemy: "적", item: "아이템", draw: "드로우", system: "전투" };

function describeAttackNotice(notice: BattleState["attackNotice"]) {
  if (!notice) return undefined;
  const damageLabel = notice.kind === "physical" ? "물리" : "마법";
  if (notice.defense === 0) return `${damageLabel} 피해 ${notice.damage}`;
  if (notice.brokeShield) return `${damageLabel} 방어막 파괴${notice.damage ? ` · 남은 피해 ${notice.damage}` : ""}`;
  return `${damageLabel} 방어막 -${notice.shieldDamage} · 내구도 ${notice.shieldRemaining}`;
}

function describeEnemyAttack(battle: BattleState, notice: NonNullable<BattleState["enemyAttackNotice"]>) {
  if (notice.outcome === "dodge") return "완전 회피 · 빈틈 포착 +2";
  if (notice.outcome === "shield") return `시험 방패로 ${battle.intent.damage} 막음 · 반격 준비 +2`;

  const isPhysical = battle.intent.type === "physical";
  const defense = isPhysical
    ? battle.basePhysicalDefense + battle.physicalGuard
    : battle.baseMagicDefense + battle.magicGuard;
  const defenseBlocked = Math.min(battle.intent.damage, defense);
  const afterDefense = Math.max(0, battle.intent.damage - defense);
  const crystalBlocked = Math.min(afterDefense, battle.enemyDamageShield);
  const details = [];

  if (defenseBlocked > 0) details.push(`${isPhysical ? "물리" : "마법"} 방어 ${defense}로 ${defenseBlocked} 막음`);
  if (crystalBlocked > 0) details.push(`안개길 길잡이 수정으로 ${crystalBlocked} 막음`);
  details.push(notice.damage > 0 ? `집중력 -${notice.damage}` : "방어 성공");
  return details.join(" · ");
}

function describeEnemyTurnLog(battle: BattleState, next: BattleState) {
  const burn = battle.burnTurns > 0 && battle.burnDamage > 0
    ? `${battle.burnSource ?? "화상"} 피해 ${battle.burnDamage}`
    : undefined;
  const withBurn = (text: string) => burn ? `${burn} → ${text}` : text;

  if (next.bossHp <= 0) {
    const detail = burn ? `보스 HP -${Math.min(battle.burnDamage, battle.bossHp)}` : next.message;
    return { detail, text: withBurn("보스 격파") };
  }
  if (next.enemyAttackNotice) {
    return { detail: describeEnemyAttack(battle, next.enemyAttackNotice), text: withBurn(battle.intent.label) };
  }
  if (battle.confusedTurns > 0) return { detail: "혼란으로 공격을 건너뜀", text: withBurn("행동 불가") };
  if (battle.intent.type === "prepare") return { detail: "공격을 준비함", text: withBurn("행동 준비") };
  return { detail: next.message, text: withBurn("보스 행동") };
}

function formatBattleLogMeta(log: BattleLogEntry) { return `${log.round}R · ${battleLogKindLabel[log.kind]}${log.kind === "quiz" ? "" : ` · ${log.actor}`}`; }

function describeRoundStart(battle: BattleState, difficulty: AdventureDifficulty) {
  return difficulty === "easy" ? `${battle.bossStance} 태세 · ${battle.intent.label} 예정` : `${battle.bossStance} 태세`;
}

function useDialogKeyboard(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const getDialog = () => dialogRef.current ?? document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => getDialog()?.querySelector<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
    const timer = window.setTimeout(focusFirst, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      const dialog = getDialog();
      if (event.key !== "Tab" || !dialog) return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusables.length) return;
      const current = document.activeElement;
      const index = focusables.indexOf(current as HTMLElement);
      if (event.shiftKey && (index <= 0 || current === dialog)) { event.preventDefault(); focusables.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKeyDown); window.setTimeout(() => returnFocusRef.current?.focus(), 0); };
  }, [open]);
  return dialogRef;
}

function useTowerShopConfirmKeyboard() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let returnFocus: HTMLElement | null = null;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getDialog = () => document.querySelector<HTMLElement>(".tower-shop-confirm");
    const focusFirst = () => getDialog()?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const syncDialog = () => {
      const dialog = getDialog();
      if (dialog && activeDialog !== dialog) {
        activeDialog = dialog;
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.setTimeout(focusFirst, 0);
      } else if (!dialog && activeDialog) {
        activeDialog = null;
        window.setTimeout(() => returnFocus?.focus(), 0);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = getDialog();
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.querySelector<HTMLButtonElement>("button:not([disabled])")?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusables.length) return;
      const index = focusables.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusables.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0]?.focus(); }
    };
    const observer = new MutationObserver(syncDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKeyDown);
    syncDialog();
    return () => { observer.disconnect(); document.removeEventListener("keydown", onKeyDown); };
  }, []);
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [stageId, setStageId] = useState<StageId>(1);
  const [characterId, setCharacterId] = useState<(typeof characters)[number]["id"]>("clover");
  const [difficulty, setDifficulty] = useState<AdventureDifficulty>("normal");
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [resolvedChoice, setResolvedChoice] = useState<number | null>(null);
  const [choiceFeedback, setChoiceFeedback] = useState("");
  const [unlocked, setUnlocked] = useState<StageId>(1);
  const [resetOpen, setResetOpen] = useState(false);
  const [session, setSession] = useState("multiply-v1");
  const [previousQuizPrompt, setPreviousQuizPrompt] = useState<string>();
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([]);
  const battleLogId = useRef(0);
  const [answered, setAnswered] = useState<QuizOption | null>(null);
  const [quizHit, setQuizHit] = useState(false);
  const [ownedItems, setOwnedItems] = useState<RewardItemId[]>([]);
  const [usedItems, setUsedItems] = useState<RewardItemId[]>([]);
  const [earnedItem, setEarnedItem] = useState<RewardItem | null>(null);
  const [earnedTitles, setEarnedTitles] = useState<AdventureTitle[]>([]);
  const [collectedTitleIds, setCollectedTitleIds] = useState<string[]>([]);
  const [titleCampaignProgress, setTitleCampaignProgress] = useState<CampaignProgress>({});
  const [playMode, setPlayMode] = useState<PlayMode>("campaign");
  const [towerFloor, setTowerFloor] = useState(1);
  const [towerRunScore, setTowerRunScore] = useState(0);
  const [towerGearRewardAmount, setTowerGearRewardAmount] = useState(0);
  const [towerIntroOpen, setTowerIntroOpen] = useState(false);
  const [towerRecord, setTowerRecord] = useState<TowerRecord>({ unlocked: false, highScore: 0, highFloor: 0 });
  const [towerRun, setTowerRun] = useState<TowerRunState | null>(null);
  const [towerCheckpoint, setTowerCheckpoint] = useState<TowerCheckpoint | null>(null);
  useTowerShopConfirmKeyboard();
  const stage = stages[stageId - 1];
  const towerConfig = getTowerFloorConfig(towerFloor);
  const character = characters.find((item) => item.id === characterId) ?? characters[0];
  const node = stage.dialogue[dialogueIndex];
  const quiz = useMemo<Quiz>(() => playMode === "tower" ? generateTowerQuiz(towerFloor, battle?.round ?? 1, session) : generateStageQuiz(stageId, battle?.round ?? 1, session, stageId === 1 ? previousQuizPrompt : undefined), [battle?.round, playMode, previousQuizPrompt, session, stageId, towerFloor]);

  useEffect(() => { const timer = window.setTimeout(() => { setUnlocked(loadUnlockedStage(localStorage)); setOwnedItems(loadRewardItems(localStorage)); setUsedItems(loadUsedRewardItems(localStorage)); setCollectedTitleIds(loadCollectedTitleIds(localStorage)); setTitleCampaignProgress(loadTitleCampaignProgress(localStorage)); setTowerRecord(loadTowerRecord(localStorage)); setTowerCheckpoint(loadTowerCheckpoint(localStorage)); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const replaceCard = () => { if (playMode !== "tower" || screen !== "battle" || !battle) return; const next = replaceOldestCardForCombo(battle, stageId, session); setBattle(next); if (next !== battle) addBattleLog({ actor: "정답 연쇄", detail: "가장 오래된 카드 1장 교체", kind: "draw", round: battle.round, text: "연쇄 보상 드로우" }); }; window.addEventListener("tower-combo-refresh", replaceCard); return () => window.removeEventListener("tower-combo-refresh", replaceCard); }, [battle, playMode, screen, session, stageId]);
  useEffect(() => { document.documentElement.classList.toggle("quiz-hit", quizHit); return () => document.documentElement.classList.remove("quiz-hit"); }, [quizHit]);
  useEffect(() => { if (!quizHit) return; const timer = window.setTimeout(() => setQuizHit(false), 820); return () => window.clearTimeout(timer); }, [quizHit]);
  useEffect(() => { const enemyTurn = screen === "battle" && battle?.phase === "enemy" && !battleFinished(battle); document.documentElement.classList.toggle("enemy-turn", enemyTurn); return () => document.documentElement.classList.remove("enemy-turn"); }, [battle, screen]);
  useEffect(() => { const recover = (event: Event) => { const amount = event instanceof CustomEvent ? event.detail : 0; if (playMode !== "tower" && screen === "battle" && battle) { const next = recoverComboHp(battle, amount); setBattle(next); if (next !== battle) addBattleLog({ actor: "정답 연쇄", detail: `집중력 +${amount}`, kind: "system", round: battle.round, text: "연쇄 보상 회복" }); } }; window.addEventListener("combo-recover", recover); return () => window.removeEventListener("combo-recover", recover); }, [battle, playMode, screen]);
  useEffect(() => { if (screen !== "battle" || !battle || battle.phase !== "enemy" || battleFinished(battle)) return; const timer = window.setTimeout(() => { triggerBattleEffect("stance"); const next = advanceBattleRound(battle, stageId, difficulty, session); if (playMode === "campaign" && stageId === 1) setPreviousQuizPrompt(quiz.prompt); setBattle(next); addBattleLog({ actor: "시스템", detail: describeRoundStart(next, difficulty), kind: "system", round: next.round, text: `${next.round}라운드 시작` }); setAnswered(null); }, 1100); return () => window.clearTimeout(timer); }, [battle, difficulty, playMode, quiz.prompt, screen, session, stageId]);
  useEffect(() => {
    if (screen !== "battle" || battle?.phase !== "reward") return;
    const timer = window.setTimeout(() => {
      if (battle.playerHp <= 0) setScreen("result");
      else if (answered?.isCorrect) setBattle(beginActionPhase(battle));
      else { setBattle(retryQuizAfterWrong(battle)); setAnswered(null); }
    }, answered?.isCorrect ? 1000 : 1650);
    return () => window.clearTimeout(timer);
  }, [answered, battle, screen]);
  function beginStage() { setPlayMode("campaign"); setDialogueIndex(0); setResolvedChoice(null); setChoiceFeedback(""); setScreen("dialogue"); }
  function chooseDialogue(choice: DialogueChoice, index: number) { setResolvedChoice(choice.correct ? index : -1); setChoiceFeedback(choice.feedback); }
  function nextDialogue() { if ((node.choices || node.multiCheck) && (resolvedChoice === null || resolvedChoice === -1)) return; if (dialogueIndex < stage.dialogue.length - 1) { setDialogueIndex((value) => value + 1); setResolvedChoice(null); setChoiceFeedback(""); return; } startBattle(); }
  function addBattleLog(entry: Omit<BattleLogEntry, "id">) { battleLogId.current += 1; setBattleLogs((logs) => [...logs, { ...entry, id: battleLogId.current }].slice(-10)); }
  function startBattle() { const nextSession = `${Date.now()}-${Math.random()}`; const nextBattle = createBattleState(stageId, difficulty, nextSession, character); setSession(nextSession); setPreviousQuizPrompt(undefined); battleLogId.current = 0; setBattleLogs([]); setBattle(nextBattle); addBattleLog({ actor: "시스템", detail: describeRoundStart(nextBattle, difficulty), kind: "system", round: 1, text: "전투 시작" }); setAnswered(null); setQuizHit(false); setEarnedItem(null); setEarnedTitles([]); setScreen("battle"); }
  function startTower(floor = 1, carriedScore = 0, continuingRun?: TowerRunState, towerCharacter = character) {
    const config = getTowerFloorConfig(floor); const run = continuingRun ?? createTowerRun(); const nextSession = `tower-${Date.now()}-${Math.random()}`;
    const nextBattle = createBattleState(config.combatStageId, difficulty, nextSession, getTowerCharacterProfile(towerCharacter), { playerHp: run.hp, maxPlayerHp: run.maxHp, playerAttackBonus: run.attackBonus, playerDefenseBonus: run.defenseBonus, bossHp: towerBossHp(config.floor), enemyDamage: towerEnemyDamage(config.floor), wrongAnswerDamage: towerWrongAnswerDamage(config.floor) });
    setStageId(config.combatStageId); setPlayMode("tower"); setTowerFloor(config.floor); setTowerRunScore(carriedScore); setTowerGearRewardAmount(0); setTowerRun(run); setSession(nextSession); setPreviousQuizPrompt(undefined); battleLogId.current = 0; setBattleLogs([]); setBattle(nextBattle);
    addBattleLog({ actor: "도전의 탑", detail: `${config.floor}층 · ${config.guide} · 보스 HP ${towerBossHp(config.floor)} · 보스 공격 ${towerEnemyDamage(config.floor)} · 오답 피해 ${towerWrongAnswerDamage(config.floor)}`, kind: "system", round: 1, text: "탑 도전 시작" }); setAnswered(null); setQuizHit(false); setTowerIntroOpen(true); setScreen("battle");
  }
  function resumeTower(checkpoint: TowerCheckpoint) {
    const savedCharacter = characters.find((item) => item.id === checkpoint.characterId);
    if (savedCharacter) setCharacterId(savedCharacter.id);
    const run = checkpoint.run as TowerRunState;
    startTower(checkpoint.floor, checkpoint.score, run, savedCharacter ?? character);
  }
  function triggerBattleEffect(effect: BattleSound) { playBattleSound(effect); }
  function answerQuiz(option: QuizOption) { if (!battle || answered || battle.phase !== "quiz") return; triggerBattleEffect(option.isCorrect ? "correct" : "wrong"); const next = rewardQuizAnswer(battle, option.isCorrect, option.isLucky, option.isBomb); setAnswered(option); setQuizHit(!option.isCorrect); setBattle(next); addBattleLog({ actor: "퀴즈", detail: option.isCorrect ? `행동력 +${next.energy}${option.isLucky ? " · 럭키 정답" : ""}` : `집중력 -${battle.playerHp - next.playerHp}${option.isBomb ? " · 폭탄 오답" : ""}`, kind: "quiz", round: battle.round, text: option.isCorrect ? "정답 선택" : "오답 선택" }); }
  function continueToAction() { if (!battle || battle.phase !== "reward" || !answered?.isCorrect) return; setBattle(beginActionPhase(battle)); }
  function playCard(card: CombatCard) { if (!battle) return; triggerBattleEffect(card.effect === "magic" ? "magic" : card.effect === "guard" || card.effect === "focus-guard" || card.effect === "magic-ward" || card.effect === "heal" ? "guard" : card.effect === "dodge" ? "dodge" : "physical"); const next = playCombatCard(battle, card.instanceId); setBattle(next); const supportDetails: Partial<Record<CombatCard["effect"], string>> = { guard: "다음 물리 공격 무효", "focus-guard": "물리 무효 · 집중력 +2", "magic-ward": `마법 피해 ${card.power} 감소`, dodge: "다음 공격 완전 회피", heal: `집중력 +${card.power}`, boost: `다음 직접 공격 +${card.power}`, analyze: `방어·결계 -${card.power}`, accelerate: "오래된 카드 버림 · 2장 드로우" }; addBattleLog({ actor: battle.playerName, detail: describeAttackNotice(next.attackNotice) ?? supportDetails[card.effect] ?? next.message, kind: "card", round: battle.round, text: `${card.name} 사용` }); }
  function redraw() { if (!battle) return; const next = redrawHand(battle, stageId, session); setBattle(next); addBattleLog({ actor: battle.playerName, detail: `카드 ${battle.hand.length}장 교체 · 행동력 -2`, kind: "draw", round: battle.round, text: "새로 뽑기" }); }
  function useItem(itemId: RewardItemId) {
    if (!battle || !ownedItems.includes(itemId) || usedItems.includes(itemId) || !canUseRewardItem(itemId, battle.phase)) return;
    const next = applyRewardItem(battle, itemId); setBattle(next); addBattleLog({ actor: "가방", detail: next.message, kind: "item", round: battle.round, text: rewardItems.find((item) => item.id === itemId)?.name ?? "고유 수정 사용" });
    const nextUsed = [...usedItems, itemId]; setUsedItems(nextUsed); saveUsedRewardItems(localStorage, nextUsed);
  }
  function endTurn() { if (!battle) return; triggerBattleEffect("enemy"); const next = resolveEnemyTurn(battle); setBattle(next); const log = describeEnemyTurnLog(battle, next); addBattleLog({ actor: playMode === "tower" ? towerConfig.bossShortName : stage.bossShortName, detail: log.detail, kind: "enemy", round: battle.round, text: log.text }); }
  function continueAfterEnemy() { if (!battle) return; if (battleFinished(battle)) { finishBattle(battle); return; } triggerBattleEffect("stance"); if (playMode === "campaign" && stageId === 1) setPreviousQuizPrompt(quiz.prompt); setBattle(advanceBattleRound(battle, stageId, difficulty, session)); setAnswered(null); }
  function finishBattle(finalState: BattleState) { setBattle(finalState); if (playMode === "tower") { const score = towerRunScore + finalState.score; const won = battleWon(finalState); const record = saveTowerRecord(localStorage, score, won ? towerFloor : Math.max(0, towerFloor - 1)); setTowerRunScore(score); setTowerRecord(record); const carriedRun = towerRun ? carryTowerHp(towerRun, finalState.playerHp) : null; const gearReward = won ? towerGearReward(towerFloor) : 0; const rewardedRun = carriedRun && won ? addTowerGear(carriedRun, gearReward) : carriedRun; setTowerGearRewardAmount(gearReward); if (rewardedRun) setTowerRun(rewardedRun); if (won) { let nextCollectedIds = collectedTitleIds; const newlyEarned = getTowerTitles(towerFloor, characterId, rewardedRun?.upgrades ?? []).filter((title) => !nextCollectedIds.includes(title.id)); for (const title of newlyEarned) nextCollectedIds = saveCollectedTitleId(localStorage, title.id); if (newlyEarned.length > 0) { setCollectedTitleIds(nextCollectedIds); setEarnedTitles(newlyEarned); } } if (won && rewardedRun && rewardedRun.hp > 0 && towerFloor < TOWER_MAX_FLOOR) { const checkpoint = { characterId, floor: towerFloor + 1, score, run: rewardedRun }; saveTowerCheckpoint(localStorage, checkpoint); setTowerCheckpoint(checkpoint); } else if (won) { clearTowerCheckpoint(localStorage); setTowerCheckpoint(null); } setScreen("result"); return; } if (battleWon(finalState)) { const nextUnlocked = Math.min(5, Math.max(unlocked, stageId + 1)) as StageId; setUnlocked(nextUnlocked); saveUnlockedStage(localStorage, nextUnlocked); const reward = rewardItemForStage(stageId); if (reward && !ownedItems.includes(reward.id)) { const nextItems = [...ownedItems, reward.id]; setOwnedItems(nextItems); saveRewardItems(localStorage, nextItems); setEarnedItem(reward); } const campaignProgress = saveTitleCampaignStage(localStorage, titleCampaignProgress, characterId, difficulty, stageId); setTitleCampaignProgress(campaignProgress); let nextCollectedIds = collectedTitleIds; const newlyEarned: AdventureTitle[] = []; const collectTitle = (title: AdventureTitle | undefined) => { if (!title || nextCollectedIds.includes(title.id)) return; nextCollectedIds = saveCollectedTitleId(localStorage, title.id); newlyEarned.push(title); }; const scoreTitle = getScoreTitle(characterId, difficulty); if (finalState.score >= scoreTitleThresholds[difficulty]) collectTitle(scoreTitle); if (stageId === 5 && campaignIsComplete(campaignProgress, characterId, difficulty)) { collectTitle(getCampaignClearTitle(characterId, difficulty, nextCollectedIds)); unlockTower(localStorage); setTowerRecord(loadTowerRecord(localStorage)); } if (newlyEarned.length > 0) { setCollectedTitleIds(nextCollectedIds); setEarnedTitles(newlyEarned); } } setScreen("result"); }
  function resetProgress() { clearAdventureProgress(localStorage); clearTowerRecord(localStorage); clearCollectedTitles(localStorage); clearTitleCampaignProgress(localStorage); setUnlocked(1); setStageId(1); setOwnedItems([]); setUsedItems([]); setEarnedItem(null); setEarnedTitles([]); setCollectedTitleIds([]); setTitleCampaignProgress({}); setTowerRecord({ unlocked: false, highScore: 0, highFloor: 0 }); setTowerCheckpoint(null); setResetOpen(false); }

  if (screen === "landing") return <Landing collectedTitleIds={collectedTitleIds} onStart={() => setScreen("setup")} />;
  if (screen === "setup" && towerCheckpoint) return <TowerResume checkpoint={towerCheckpoint} onRestart={() => { clearTowerCheckpoint(localStorage); setTowerCheckpoint(null); }} onResume={() => resumeTower(towerCheckpoint)} />;
  if (screen === "setup") return <Setup characterId={characterId} difficulty={difficulty} onBack={() => setScreen("landing")} onCancelReset={() => setResetOpen(false)} onCharacter={setCharacterId} onConfirmReset={resetProgress} onDifficulty={setDifficulty} onOpenReset={() => setResetOpen(true)} onStage={setStageId} onStart={beginStage} onStartTower={() => startTower()} resetOpen={resetOpen} selectedStage={stageId} towerRecord={towerRecord} unlocked={unlocked} />;
  if (screen === "dialogue") return <Dialogue character={character} choiceFeedback={choiceFeedback} node={node} nodeIndex={dialogueIndex} onBack={() => setScreen("setup")} onChoice={chooseDialogue} onMultiResolved={() => setResolvedChoice(0)} onNext={nextDialogue} onSkip={startBattle} resolvedChoice={resolvedChoice} stage={stage} />;
  if (screen === "battle" && battle) return <Battle answered={answered} battle={battle} character={character} difficulty={difficulty} logs={battleLogs} onAnswer={answerQuiz} onContinueEnemy={continueAfterEnemy} onContinueToAction={continueToAction} onDevNextFloor={showTowerDeveloperTools && playMode === "tower" && towerFloor < TOWER_MAX_FLOOR && towerRun ? () => finishBattle({ ...battle, bossHp: 0, message: "개발 도구로 전투 승리 처리" }) : undefined} onEndTurn={endTurn} onExit={() => { setTowerRun(null); setScreen("setup"); }} onPlayCard={playCard} onRedraw={redraw} onUseItem={useItem} ownedItems={playMode === "tower" ? [] : ownedItems} quiz={quiz} stage={stage} towerCanResume={playMode === "tower" && Boolean(towerCheckpoint)} towerConfig={playMode === "tower" ? towerConfig : undefined} towerFloor={playMode === "tower" ? towerFloor : undefined} towerGear={playMode === "tower" ? towerRun?.gear ?? 0 : undefined} towerIntroOpen={playMode === "tower" && towerIntroOpen} onCloseTowerIntro={() => setTowerIntroOpen(false)} usedItems={usedItems} />;
  if (screen === "result" && battle) return <Result earnedItem={earnedItem} earnedTitles={earnedTitles} onNext={() => { if (playMode === "tower") { if (!battleWon(battle) || towerFloor === TOWER_MAX_FLOOR) { setTowerRun(null); setScreen("setup"); } else if (isTowerUpgradeFloor(towerFloor)) setScreen("tower-shop"); else if (towerRun) startTower(towerFloor + 1, towerRunScore, towerRun); } else if (battleWon(battle) && stageId < 5) { setStageId((stageId + 1) as StageId); setDialogueIndex(0); setResolvedChoice(null); setChoiceFeedback(""); setScreen("dialogue"); } else if (battleWon(battle)) setScreen("ending"); else startBattle(); }} onSetup={() => { setTowerRun(null); setScreen("setup"); }} score={playMode === "tower" ? towerRunScore : battle.score} stage={stage} towerCanClimb={playMode === "tower" ? battleWon(battle) && towerFloor < TOWER_MAX_FLOOR : undefined} towerFloor={playMode === "tower" ? towerFloor : undefined} towerGearReward={playMode === "tower" ? towerGearRewardAmount : 0} towerHasCheckpoint={playMode === "tower" && Boolean(towerCheckpoint)} won={battleWon(battle)} />;
  if (screen === "tower-shop" && towerRun) return <TowerShop run={towerRun} floor={towerFloor} onBuy={(itemId) => { const nextRun = buyTowerShopItem(towerRun, itemId); if (!nextRun) return; const checkpoint = { characterId, floor: towerFloor + 1, score: towerRunScore, run: nextRun }; saveTowerCheckpoint(localStorage, checkpoint); setTowerCheckpoint(checkpoint); setTowerRun(nextRun); }} onContinue={() => { const checkpoint = { characterId, floor: towerFloor + 1, score: towerRunScore, run: towerRun }; saveTowerCheckpoint(localStorage, checkpoint); setTowerCheckpoint(checkpoint); startTower(towerFloor + 1, towerRunScore, towerRun); }} />;
  return <Ending character={character} onMain={() => setScreen("landing")} score={battle?.score ?? 0} stage={stage} />;
}

function Landing({ collectedTitleIds, onStart }: { collectedTitleIds: string[]; onStart: () => void }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [titleCollectionOpen, setTitleCollectionOpen] = useState(false);
  return <main className="landing-page"><div className="pixel-grid" /><section aria-label="럭키팡 숫자던전: 구구단특급" className="landing-shell"><div className="landing-art-card"><img alt="하루, 두리, 세나와 셈빛이 구구단특급을 타고 도전의 탑으로 향하는 모습" className="landing-art" src="/luckypang-multiply-landing.webp" /></div><div className="landing-actions"><button className="landing-button start" onClick={onStart}>시작하기! <span aria-hidden="true">🏰</span></button><div className="landing-action-row"><button className="landing-button help" onClick={() => setGuideOpen(true)}>사용 안내 <span aria-hidden="true">📖</span></button><button aria-label={`칭호 도감, ${collectedTitleIds.length}개 획득`} className="title-cabinet-button" onClick={() => setTitleCollectionOpen(true)} type="button"><i aria-hidden="true">🏅</i><b>칭호 도감</b><span>{collectedTitleIds.length} / {adventureTitles.length}</span></button></div></div></section>{guideOpen && <LandingGuide onClose={() => setGuideOpen(false)} />}{titleCollectionOpen && <TitleCollection collectedTitleIds={collectedTitleIds} onClose={() => setTitleCollectionOpen(false)} />}</main>;
}

function TitleCollection({ collectedTitleIds, onClose }: { collectedTitleIds: string[]; onClose: () => void }) {
  const [characterId, setCharacterId] = useState<(typeof characters)[number]["id"]>("clover");
  const [difficulty, setDifficulty] = useState<AdventureDifficulty>("easy");
  const [category, setCategory] = useState<"campaign" | "tower">("campaign");
  const [storedTitleIds] = useState(() => typeof window === "undefined" ? collectedTitleIds : loadCollectedTitleIds(localStorage));
  useDialogKeyboard(true, onClose);
  const collected = new Set(storedTitleIds);
  const titles = category === "tower" ? adventureTitles.filter((title) => title.kind === "tower") : adventureTitles.filter((title) => title.kind !== "tower" && title.characterId === characterId && title.difficulty === difficulty);
  const detail = getTitleDifficulty(category === "tower" ? "normal" : difficulty);
  return <div className="title-collection-backdrop" onMouseDown={onClose}><section aria-labelledby="title-collection-title" aria-modal="true" className="title-collection-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="칭호 도감 닫기" className="title-collection-close" onClick={onClose} type="button">×</button><header className="title-collection-header"><span aria-hidden="true">🏅</span><div><h2 id="title-collection-title">칭호 도감 <b>{collectedTitleIds.length} / {adventureTitles.length}</b></h2><p>{category === "tower" ? "도전의 탑 도달·전략 기록으로 칭호를 얻어요." : "전 스테이지 완주 또는 점수 도전으로 칭호를 얻어요."}</p></div></header><div className="title-difficulty-tabs" aria-label="칭호 종류"><button aria-pressed={category === "campaign"} className={category === "campaign" ? "selected" : ""} onClick={() => setCategory("campaign")} type="button">캠페인 칭호</button><button aria-pressed={category === "tower"} className={category === "tower" ? "selected" : ""} onClick={() => setCategory("tower")} type="button">도전의 탑 <small>{adventureTitles.filter((title) => title.kind === "tower" && collected.has(title.id)).length} / {adventureTitles.filter((title) => title.kind === "tower").length}</small></button></div>{category === "campaign" && <><div aria-label="캐릭터 선택" className="title-character-tabs">{characters.map((character) => <button aria-pressed={characterId === character.id} className={characterId === character.id ? "selected" : ""} key={character.id} onClick={() => setCharacterId(character.id)} type="button"><img alt="" src={character.image} />{character.name}</button>)}</div><div aria-label="난이도 선택" className="title-difficulty-tabs">{difficulties.map((item) => <button aria-pressed={difficulty === item.id} className={`${item.id} ${difficulty === item.id ? "selected" : ""}`} key={item.id} onClick={() => setDifficulty(item.id)} type="button"><i>{getTitleDifficulty(item.id).mark}</i>{item.name}<small>{adventureTitles.filter((title) => title.kind !== "tower" && title.characterId === characterId && title.difficulty === item.id && collected.has(title.id)).length} / 6</small></button>)}</div></>}<div aria-label={category === "tower" ? "도전의 탑 칭호 목록" : `${characters.find((character) => character.id === characterId)?.name} ${detail.label} 칭호 목록`} className="title-badge-grid">{titles.map((title) => { const isCollected = collected.has(title.id); return <article className={`title-badge ${isCollected ? "collected" : "locked"}`} key={title.id} style={{ "--title-color": detail.color } as React.CSSProperties}><i>{title.kind === "score" ? "✹" : title.kind === "tower" ? "♜" : detail.mark}</i><small>{title.condition}</small><strong>{isCollected ? title.name : "???"}</strong><em>{isCollected ? "획득함" : title.kind === "tower" ? "탑 도전" : title.kind === "score" ? "점수 도전" : "미획득"}</em></article>; })}</div></section></div>;
}

function LandingGuide({ onClose }: { onClose: () => void }) {
  useDialogKeyboard(true, onClose);
  return <div className="landing-guide-backdrop" onMouseDown={onClose}><section aria-labelledby="landing-guide-title" aria-modal="true" className="landing-guide" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="사용 안내 닫기" className="guide-close" onClick={onClose} type="button">×</button><p className="eyebrow">HOW TO PLAY</p><h2 id="landing-guide-title">수의 던전 모험 안내</h2>
    <section className="guide-section"><h3>이렇게 모험해요</h3><ol><li><b>1</b><span><strong>탐험을 준비해요.</strong>캐릭터, 난이도, 도전할 스테이지를 고릅니다.</span></li><li><b>2</b><span><strong>이야기와 확인문제를 풀어요.</strong>대화를 읽고 곱셈구구의 원리를 확인해요.</span></li><li><b>3</b><span><strong>전투 퀴즈를 맞혀요.</strong>정답 카드로 이번 턴 행동력을 얻어요.</span></li><li><b>4</b><span><strong>카드를 내고 보스를 물리쳐요.</strong>보스의 HP를 0으로 만들면 다음 모험이 열려요.</span></li></ol></section>
    <section className="guide-section"><h3>전투는 이렇게 해요</h3><ol><li><b>1</b><span><strong>퀴즈 카드 5장 중 정답은 3장이에요.</strong>일반 정답은 행동력 2, 럭키 정답은 행동력 3을 줘요. 폭탄 카드는 오답이니 조심하세요.</span></li><li><b>2</b><span><strong>행동력만큼 카드를 조합해요.</strong>카드 왼쪽 위 숫자만큼 행동력이 필요하며, 남은 행동력 안에서 여러 장을 낼 수 있어요.</span></li><li><b>3</b><span><strong>보스 태세를 살펴봐요.</strong>물리 방어에는 마법 카드, 마법 결계에는 공격 카드가 도움이 돼요.</span></li><li><b>4</b><span><strong>내 턴 뒤에는 보스가 공격해요.</strong>수비·회피·회복 카드로 다음 공격에 대비하세요.</span></li></ol></section>
    <section className="guide-section"><h3>캐릭터와 난이도</h3><p><b>클로버</b>는 물리 방어 4의 수호기사, <b>토토</b>는 물리·마법 방어 2의 균형형, <b>핀</b>은 마법 방어 4의 마도사예요.</p><p><b>쉬움</b>은 집중력이 높고 보스가 약하며, <b>보통</b>은 기본 난이도, <b>어려움</b>은 보스가 강하지만 같은 수학 개념을 배워요.</p></section>
    <section className="guide-section"><h3>고유 수정 보상</h3><p>스테이지 1~4 보스를 처음 물리치면 고유 수정을 얻어요. 전투 중 가방에서 사용할 수 있지만, <b>한 게임 진행 전체에서 수정별로 한 번만</b> 사용할 수 있어요.</p></section>
    <section className="guide-section"><h3>스테이지 순서</h3><p>1 2단·5단 → 2 3단·6단 → 3 4단·8단 → 4 7단·9단 → 5 1단·0의 곱과 곱셈표 순서로 곱셈구구를 익혀요. 캠페인을 모두 마치면 도전의 탑에서 심화 문제를 풀 수 있어요.</p></section>
    <section className="guide-section"><h3>이미지 안내</h3><p><b>게임 속 일부 캐릭터와 배경 이미지는 AI 이미지 생성 도구를 활용해 제작했습니다.</b></p></section>
    <button className="guide-confirm" onClick={onClose} type="button">모험 준비 완료</button>
  </section></div>;
}

function Setup({ characterId, difficulty, onBack, onCancelReset, onCharacter, onConfirmReset, onDifficulty, onOpenReset, onStage, onStart, onStartTower, resetOpen, selectedStage, towerRecord, unlocked }: { characterId: string; difficulty: AdventureDifficulty; onBack: () => void; onCancelReset: () => void; onCharacter: (id: (typeof characters)[number]["id"]) => void; onConfirmReset: () => void; onDifficulty: (id: AdventureDifficulty) => void; onOpenReset: () => void; onStage: (id: StageId) => void; onStart: () => void; onStartTower: () => void; resetOpen: boolean; selectedStage: StageId; towerRecord: TowerRecord; unlocked: StageId }) {
  const selected = stages[selectedStage - 1]; const selectedCharacter = characters.find((item) => item.id === characterId) ?? characters[0]; const selectedDifficulty = getDifficulty(difficulty);
  useDialogKeyboard(resetOpen, onCancelReset);
  return <main className="setup-page"><section className="setup-shell"><header className="topbar"><button onClick={onBack}>← 처음으로</button><div><span>ADVENTURE READY</span><h1>모험 준비</h1></div><button onClick={onOpenReset}>진행 기록 초기화</button></header><section className="setup-block"><SectionTitle number="01" title="캐릭터 고르기" subtitle="함께 모험할 탐험가를 고르세요" /><div className="character-grid">{characters.map((item) => <button aria-pressed={characterId === item.id} className={characterId === item.id ? "selected" : ""} key={item.id} onClick={() => onCharacter(item.id)}><img alt="" src={item.image} /><span><strong>{item.name}</strong><small>{item.role}</small></span></button>)}</div></section><section className="setup-block"><SectionTitle number="02" title="난이도 고르기" subtitle="도전할 모험 난이도를 고르세요" /><div className="difficulty-grid">{difficulties.map((item) => <button aria-pressed={difficulty === item.id} className={difficulty === item.id ? "selected" : ""} key={item.id} onClick={() => onDifficulty(item.id)}><strong>{item.name}</strong></button>)}</div></section><section className="setup-block"><SectionTitle number="03" title="스테이지 선택" subtitle="교과서 단별 순서로 곱셈구구를 배워요" /><div className="stage-grid">{stages.map((item) => { const locked = item.id > unlocked; return <button className={`${selectedStage === item.id ? "selected" : ""} ${locked ? "locked" : ""}`} disabled={locked} key={item.id} onClick={() => onStage(item.id)}><span>{locked ? "🔒" : item.id}</span><strong>{item.shortTitle}</strong><small>{item.title}</small></button>; })}</div></section><section className="setup-block"><SectionTitle number="04" title="도전의 탑" subtitle="메인 캠페인을 완주하면 심화 문제에 도전할 수 있어요" /><button className="tower-start" disabled={!towerRecord.unlocked} onClick={onStartTower} type="button"><b>{towerRecord.unlocked ? "🏯 도전의 탑 입장" : "🔒 캠페인 완주 후 해금"}</b><small>{towerRecord.unlocked ? `최고 ${towerRecord.highFloor}층 · 최고 점수 ${towerRecord.highScore}` : "결과 비교·규칙 탐색형 문제로 탑을 오릅니다."}</small></button></section><footer className="setup-summary"><div><img alt="" src={selectedCharacter.image} /><p><small>선택 완료</small><strong>{selectedCharacter.name} · {selectedDifficulty.name} 난이도</strong><em>STAGE {selected.id}. {selected.title}</em></p></div><button onClick={onStart}>이야기 시작 →</button></footer></section>{resetOpen && <ConfirmReset onCancel={onCancelReset} onConfirm={onConfirmReset} />}</main>;
}
function SectionTitle({ number, subtitle, title }: { number: string; subtitle: string; title: string }) { return <div className="section-title"><b>{number}</b><div><h2>{title}</h2><p>{subtitle}</p></div></div>; }
function TowerResume({ checkpoint, onRestart, onResume }: { checkpoint: TowerCheckpoint; onRestart: () => void; onResume: () => void }) { return <main className="setup-page"><section className="setup-shell"><header className="topbar"><button onClick={onRestart}>기록 삭제 후 새 도전</button><div><span>AUTO CHECKPOINT</span><h1>도전 기록 발견</h1></div><span /></header><section className="setup-block"><SectionTitle number="!" title={`${checkpoint.floor}층부터 이어하기`} subtitle="매 층 승리 후 저장된 HP·기어·구매 효과를 이어가요" /><div className="tower-run-summary"><span>현재 HP <b>{checkpoint.run.hp} / {checkpoint.run.maxHp}</b></span><span>공격 <b>+{checkpoint.run.attackBonus}</b></span><span>방어 <b>+{checkpoint.run.defenseBonus}</b></span><span>기어 <b>{checkpoint.run.gear}</b></span></div><p>자동 저장 지점입니다. {checkpoint.floor}층 보스에게 바로 도전합니다.</p><div className="result-actions"><button onClick={onResume}>이어하기 →</button><button className="secondary" onClick={onRestart}>기록 버리고 새 도전</button></div></section></section></main>; }
function ConfirmReset({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) { return <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><span>↻</span><p className="eyebrow">PROGRESS RESET</p><h2 id="reset-title">진행 기록을 지울까요?</h2><p>이 기기에 저장된 스테이지 완료 기록이 사라집니다.</p><div><button onClick={onCancel}>아니요</button><button onClick={onConfirm}>초기화할게요</button></div></section></div>; }

function Dialogue({ character, choiceFeedback, node, nodeIndex, onBack, onChoice, onMultiResolved, onNext, onSkip, resolvedChoice, stage }: { character: (typeof characters)[number]; choiceFeedback: string; node: (typeof stages)[number]["dialogue"][number]; nodeIndex: number; onBack: () => void; onChoice: (choice: DialogueChoice, index: number) => void; onMultiResolved: () => void; onNext: () => void; onSkip: () => void; resolvedChoice: number | null; stage: (typeof stages)[number] }) {
  const isHero = node.speaker === "주인공"; const isBoss = node.speaker === "보스"; const speakerName = isHero ? character.name : isBoss ? stage.bossShortName : node.speaker; const portrait = isHero ? character.image : isBoss ? stage.bossImage : "/characters/sembit-guide-v1.webp"; const canNext = (!node.choices && !node.multiCheck) || (resolvedChoice !== null && resolvedChoice >= 0);
  const displayedChoices = useMemo(() => shuffleDialogueChoices(node.choices ?? []), [node.choices]);
  useEffect(() => {
    document.querySelector(".concept-banner small")?.replaceChildren("스테이지 핵심개념");
    function handleDialogueClick(event: MouseEvent) {
      if (!canNext || !(event.target instanceof Element)) return;
      const dialogueBox = event.target.closest(".dialogue-box");
      if (dialogueBox && !event.target.closest("button")) onNext();
    }
    document.addEventListener("click", handleDialogueClick);
    return () => document.removeEventListener("click", handleDialogueClick);
  }, [canNext, onNext]);
  return <main className="dialogue-page" onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && canNext) onNext(); }} style={{ "--stage": stage.color } as React.CSSProperties} tabIndex={0}><header className="dialogue-bar"><button onClick={onBack}>← 메인</button><div><span>STAGE {stage.id}</span><strong>{stage.title}</strong></div><button onClick={onSkip}>대화 건너뛰기</button></header><section className="dialogue-world" style={{ backgroundImage: `linear-gradient(180deg,transparent 35%,#08091ddd 83%),url(${stage.background})` }}><img className={`world-hero ${isHero ? "speaking" : "dim"}`} alt="" src={character.image} /><img className={`world-guide ${node.speaker === "셈빛" ? "speaking" : "dim"}`} alt="" src="/characters/sembit-guide-v1.webp" /><img className={`world-boss ${isBoss ? "speaking" : "dim"}`} alt="" src={stage.bossImage} /><div className="concept-banner"><small>오늘의 핵심</small><strong>{stage.concept}</strong></div></section><section className="dialogue-box"><img alt={`${speakerName} 초상`} src={portrait} /><div className="dialogue-copy"><header>{isBoss ? <div className="dialogue-boss-name"><small>{stage.bossTitle}</small><strong>{stage.bossShortName}</strong></div> : <strong>{speakerName}</strong>}<span>{node.choices || node.multiCheck ? "CONCEPT CHECK" : "STORY"}</span><i>{nodeIndex + 1} / {stage.dialogue.length}</i></header><p>{node.text}</p>{node.choices && <div className="dialogue-choices">{displayedChoices.map((choice, index) => <button className={resolvedChoice === index ? "correct" : ""} disabled={resolvedChoice !== null && resolvedChoice >= 0} key={choice.text} onClick={() => onChoice(choice, index)}>{choice.text}</button>)}</div>}{node.multiCheck && <DialogueMultiCheck key={`multi-${nodeIndex}`} check={node.multiCheck} onResolved={onMultiResolved} />}{choiceFeedback && <div className={`feedback ${resolvedChoice === -1 ? "wrong" : "correct"}`}>{resolvedChoice === -1 ? "다시 생각해 봐요. " : "정답! "}{choiceFeedback}</div>}</div><button className="next-button" disabled={!canNext} onClick={onNext}>{nodeIndex === stage.dialogue.length - 1 ? "전투 시작" : "다음"} →</button></section><p className="dialogue-hint">대화창을 선택한 뒤 Enter / Space로 진행할 수 있어요</p></main>;
}

function DialogueMultiCheck({ check, onResolved }: { check: DialogueMultiCheckData; onResolved: () => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [passed, setPassed] = useState(false);
  const toggleOption = (id: string) => { if (passed) return; setFeedback([]); setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); };
  const submit = () => {
    const selected = new Set(selectedIds); const missed = check.options.filter((option) => option.isAnswer && !selected.has(option.id)); const incorrect = check.options.filter((option) => !option.isAnswer && selected.has(option.id));
    if (!missed.length && !incorrect.length) { setPassed(true); setFeedback([check.successFeedback]); onResolved(); return; }
    const messages = [...incorrect.map((option) => `${option.text}: ${option.explanation}`), ...missed.map((option) => `${option.text}도 골라야 해요: ${option.explanation}`)];
    setFeedback(messages);
  };
  const retry = () => { setSelectedIds([]); setFeedback([]); };
  return <section className="dialogue-multi-check" aria-label="여러 개 선택 확인문제"><small>{check.instruction}</small><div className="dialogue-multi-options">{check.options.map((option) => <button aria-pressed={selectedIds.includes(option.id)} className={`${selectedIds.includes(option.id) ? "selected" : ""} ${passed && option.isAnswer ? "answer" : ""}`} disabled={passed} key={option.id} onClick={() => toggleOption(option.id)} type="button"><b>{selectedIds.includes(option.id) ? "✓" : "+"}</b>{option.text}</button>)}</div><div className="dialogue-multi-actions"><button disabled={!selectedIds.length || passed} onClick={submit} type="button">선택 완료</button>{feedback.length > 0 && !passed && <button className="retry" onClick={retry} type="button">다시 고르기</button>}</div>{feedback.length > 0 && <div className={`multi-feedback ${passed ? "correct" : "wrong"}`} role="status"><strong>{passed ? "정답!" : "다시 확인해 봐요."}</strong><ul>{feedback.map((message) => <li key={message}>{message}</li>)}</ul></div>}</section>;
}

function Battle({ answered, battle, character, difficulty, logs, onAnswer, onContinueEnemy, onContinueToAction, onDevNextFloor, onEndTurn, onExit, onPlayCard, onRedraw, onUseItem, ownedItems, quiz, stage, towerCanResume, towerConfig, towerFloor, towerGear, towerIntroOpen, onCloseTowerIntro, usedItems }: { answered: QuizOption | null; battle: BattleState; character: (typeof characters)[number]; difficulty: AdventureDifficulty; logs: BattleLogEntry[]; onAnswer: (option: QuizOption) => void; onContinueEnemy: () => void; onContinueToAction: () => void; onDevNextFloor?: () => void; onEndTurn: () => void; onExit: () => void; onPlayCard: (card: CombatCard) => void; onRedraw: () => void; onUseItem: (itemId: RewardItemId) => void; ownedItems: RewardItemId[]; quiz: Quiz; stage: (typeof stages)[number]; towerCanResume?: boolean; towerConfig?: TowerFloorConfig; towerFloor?: number; towerGear?: number; towerIntroOpen: boolean; onCloseTowerIntro: () => void; usedItems: RewardItemId[] }) {
  const [logOpen, setLogOpen] = useState(false);
  const [minimizedQuizRound, setMinimizedQuizRound] = useState<number | null>(null);
  const quizMinimized = battle.phase === "quiz" && minimizedQuizRound === battle.round;
  const latestCombatLog = logs.at(-1);
  const logDialogRef = useDialogKeyboard(logOpen, () => setLogOpen(false));
  const presentation = towerConfig ?? stage;
  return <main className={`battle-page ${towerFloor ? "tower-battle" : ""}`} style={{ "--stage": presentation.color, backgroundImage: `linear-gradient(#070a1baa,#070a1bee),url(${presentation.background})` } as React.CSSProperties}>
    <header className="combat-header"><strong>{towerFloor ? "도전의 탑" : "럭키팡 숫자던전: 구구단특급"}</strong><span>{towerFloor ? `${towerFloor}층 · ${quiz.typeName}` : `STAGE ${stage.id} · ${stage.shortTitle} / ${getDifficulty(difficulty).badge}`}</span><div className="combat-header-actions">{onDevNextFloor && <button onClick={onDevNextFloor} type="button">개발: 다음 층</button>}<button aria-expanded={logOpen} onClick={() => setLogOpen(true)} type="button">전투 로그</button><button onClick={onExit}>{towerFloor ? towerCanResume ? "저장 지점으로 나가기" : "이번 도전 포기하고 나가기" : "메뉴로 나가기"}</button></div></header>
    <section className="combat-stats"><Stat label={`${character.name} HP`} value={`${battle.playerHp} / ${battle.maxPlayerHp}`} /><Stat label={battle.physicalShield ? "물리 방패" : "물리 방어"} value={battle.physicalShield ? `${battle.basePhysicalDefense} · 준비` : battle.basePhysicalDefense + battle.physicalGuard} /><Stat label="마법 방어" value={battle.baseMagicDefense + battle.magicGuard} /><ComboStat combo={battle.combo} disabled={Boolean(towerFloor)} />{towerFloor ? <Stat label="기어" value={`⚙ ${towerGear ?? 0}`} /> : <BagStat battle={battle} onUseItem={onUseItem} ownedItems={ownedItems} usedItems={usedItems} />}<Stat label="보스 방어" value={`물리 ${battle.bossArmor} · 마법 ${battle.bossBarrier}`} /><Stat label="BOSS HP" value={`${battle.bossHp} / ${battle.maxBossHp}`} /></section>
    <section className="battlefield"><Fighter battle={battle} image={character.image} label={character.name} side="hero" /><div className={`turn-energy ${battle.phase === "action" ? "active" : ""}`}><small>이번 턴 행동력</small><strong>{battle.energy}<i>/3</i></strong><span>{battle.phase === "action" ? "카드를 낼 수 있어요" : battle.phase.toUpperCase()}</span></div><Fighter battle={battle} image={presentation.bossImage} label={presentation.bossName} showIntent={!towerFloor && difficulty === "easy"} side="boss" /></section>
    <p aria-atomic="true" aria-live="polite" className="sr-only">{battle.message}</p><button aria-haspopup="dialog" className="battle-message" onClick={() => setLogOpen(true)} type="button">{battle.message}</button>
    {logOpen && <div className="battle-log-backdrop" onMouseDown={() => setLogOpen(false)}><section aria-labelledby="battle-log-title" aria-modal="true" className="battle-log-modal" onMouseDown={(event) => event.stopPropagation()} ref={logDialogRef} role="dialog"><header><div><p>RECENT BATTLE LOG</p><h2 id="battle-log-title">최근 전투 기록 <span>{logs.length} / 10</span></h2></div><button aria-label="전투 로그 닫기" onClick={() => setLogOpen(false)} type="button">×</button></header>{logs.length === 0 ? <p className="empty-battle-log">아직 전투 기록이 없어요. 문제를 풀거나 카드를 사용하면 여기에 표시됩니다.</p> : <ol>{[...logs].reverse().map((log, index) => <li key={log.id}><b>{logs.length - index}</b><div><span className="battle-log-meta">{formatBattleLogMeta(log)}</span><strong>{log.text}</strong>{log.detail && <small>{log.detail}</small>}</div></li>)}</ol>}<small>최근 10개까지 기록됩니다.</small></section></div>}
    {quizMinimized && <button className="quiz-reopen" onClick={() => setMinimizedQuizRound(null)} type="button">문제 보기</button>}
    {(battle.phase === "action" || quizMinimized) && <ActionPanel battle={battle} onEndTurn={onEndTurn} onPlayCard={onPlayCard} onRedraw={onRedraw} readOnly={quizMinimized} showPreview={!towerFloor && difficulty === "easy"} />}
    {(battle.phase === "quiz" || battle.phase === "reward") && !quizMinimized && <QuizModal answered={answered} battle={battle} battleLog={latestCombatLog} difficulty={towerFloor ? "normal" : difficulty} onAnswer={onAnswer} onContinueToAction={onContinueToAction} onMinimize={() => setMinimizedQuizRound(battle.round)} quiz={quiz} />}
    {battle.phase === "enemy" && <div className="phase-banner"><p>ENEMY TURN</p><h2>{battle.message}</h2><button onClick={onContinueEnemy}>{battleFinished(battle) ? "전투 결과" : "다음 문제"} →</button></div>}{towerIntroOpen && towerConfig && <TowerFloorIntro bossImage={presentation.bossImage} character={character} config={towerConfig} onClose={onCloseTowerIntro} />}
  </main>;
}
function TowerFloorIntro({ bossImage, character, config, onClose }: { bossImage: string; character: (typeof characters)[number]; config: TowerFloorConfig; onClose: () => void }) {
  const [step, setStep] = useState(0);
  useDialogKeyboard(true, onClose);
  const mixedTypes = getTowerQuizTypeLabels(config.quizProfile);
  const quizTypes = config.introTypeSummary ? [config.introTypeSummary] : mixedTypes.length > 0 ? mixedTypes : [config.guide];
  const typeLabel = quizTypes.join(" · ");
  const lines = [
    { image: "/characters/sembit-guide-v1.webp", name: "셈빛", role: "길안내 로봇", text: config.introTypeSummary ? `${config.guide} 층이에요. 이번에는 ${config.introTypeSummary} 최종 결전이에요.` : mixedTypes.length > 0 ? `${config.guide} 층이에요. 이번에는 ${mixedTypes.join(", ")} 문제가 섞여 나와요.` : `${config.guide} 시험이에요. ${config.hint}` },
    { image: character.image, name: character.name, role: character.role.split(" · ")[0] ?? character.role, text: mixedTypes.length > 0 ? "알겠어! 문제를 읽고 어떤 규칙을 써야 하는지 먼저 찾을게." : "알겠어! 문제의 조건을 먼저 확인하고 차근차근 풀어 볼게." },
    { image: bossImage, name: config.bossShortName, role: config.bossTitle, text: mixedTypes.length > 0 ? `좋다. ${typeLabel} 문제를 모두 넘겨 봐라!` : `좋다. ${config.guide} 문제를 맞혀 봐라!` },
  ][step]!;
  return <div className="tower-intro-backdrop"><section aria-labelledby="tower-intro-title" aria-modal="true" className="tower-intro" role="dialog"><p className="tower-floor-label"><span>도전의 탑</span><b>{config.floor}층</b></p><header><img alt="" src={lines.image} /><div><small>{lines.role}</small><h2 id="tower-intro-title">{lines.name}</h2></div></header><div className="tower-intro-quiz-types"><strong>이번 층 문제</strong><div aria-label="이번 층 문제 유형">{quizTypes.map((type) => <span key={type}>{type}</span>)}</div></div><p>{lines.text}</p><button onClick={() => step === 2 ? onClose() : setStep((value) => value + 1)} type="button">{step === 2 ? "시험 시작" : "다음"} →</button></section></div>;
}
function TowerShop({ floor, onBuy, onContinue, run }: { floor: number; onBuy: (itemId: TowerUpgradeId) => void; onContinue: () => void; run: TowerRunState }) { const [lastPurchase, setLastPurchase] = useState<string | null>(null); const [pendingItemId, setPendingItemId] = useState<TowerUpgradeId | null>(null); const finalTuneUp = floor === 19; const pendingItem = towerShopItems.find((item) => item.id === pendingItemId); const purchased = Boolean(lastPurchase); function confirmPurchase() { if (!pendingItem || purchased) return; onBuy(pendingItem.id); setLastPurchase(pendingItem.name); setPendingItemId(null); } return <main className={`tower-upgrade-page ${finalTuneUp ? "final-tune-up" : ""}`}><section aria-labelledby="tower-upgrade-title"><div className="tower-shop-scene"><div aria-hidden="true" className="tower-gear-chest"><i>⚙</i><span /><span /></div><img alt="" src="/characters/sembit-guide-v1.webp" /><div><p className="eyebrow">{finalTuneUp ? "FINAL TUNE-UP" : `TOWER SHOP · ${floor}F CLEAR`}</p><h1 id="tower-upgrade-title">{finalTuneUp ? "결전 정비소" : "셈빛의 탑 상점"}</h1><small>{finalTuneUp ? "구구와의 마지막 승부를 앞두고 장비를 점검해요." : "셈빛이 다음 구간을 위한 장비를 정비해요."}</small></div>{finalTuneUp && <img alt="도전의 탑 지배자 구구" className="tower-final-boss" src="/characters/tower-gugu-v1.webp" />}</div><p>이번 정비에서는 기어 상품을 하나만 고를 수 있어요. 선택을 확정하면 다음 층 저장 지점에 반영됩니다.</p><div className="tower-run-summary"><span>현재 HP <b>{run.hp} / {run.maxHp}</b></span><span>공격 <b>+{run.attackBonus}</b></span><span>방어 <b>+{run.defenseBonus}</b></span><span>기어 <b>{run.gear}</b></span></div>{lastPurchase && <p aria-live="polite" className="tower-shop-feedback">{lastPurchase} 구매 완료 · 다음 층 저장 지점에 반영됐어요.</p>}<div className="tower-upgrade-grid">{towerShopItems.map((item) => <button data-upgrade={item.id} disabled={purchased || run.gear < item.cost} key={item.id} onClick={() => setPendingItemId(item.id)} type="button"><i aria-hidden="true" /><strong>{item.name} <em>기어 {item.cost}</em></strong><small>{item.description}</small><em className="tower-shop-recommendation">{getTowerShopRecommendation(item.id)}</em></button>)}</div><button className="tower-shop-continue" onClick={onContinue} type="button">다음 층 도전 →</button>{pendingItem && <div className="tower-shop-confirm-backdrop"><section aria-modal="true" className="tower-shop-confirm" role="dialog"><p>기어 {pendingItem.cost} 사용</p><h2>{pendingItem.name}을 구매할까요?</h2><span>이번 정비에서는 하나만 고를 수 있어요.</span><div><button onClick={() => setPendingItemId(null)} type="button">다시 고르기</button><button onClick={confirmPurchase} type="button">구매하기 →</button></div></section></div>}</section></main>; }
function Stat({ label, value }: { label: string; value: number | string }) { if (label === "정답 연쇄") return <ComboStat combo={Number(String(value).split("/")[0].trim())} />; const detail = ["물리 방어", "물리 방패", "마법 방어", "보스 방어"].includes(label); return <div className={detail ? "detail-stat" : "primary-stat"}><span>{label}</span><strong>{value}</strong></div>; }
function ComboStat({ combo, disabled = false }: { combo: number; disabled?: boolean }) { const ready = combo >= 3; function recover() { window.dispatchEvent(new CustomEvent("combo-recover", { detail: Math.floor(Math.random() * 5) + 1 })); } function refreshTowerCard() { window.dispatchEvent(new Event("tower-combo-refresh")); } return <div className="combo-stat primary-stat"><span>정답 연쇄</span><strong>{combo} / 3</strong>{disabled ? ready ? <button onClick={refreshTowerCard}>오래된 카드 교체</button> : <small>3연속 정답 시 카드 교체</small> : ready ? <button onClick={recover}>HP 회복</button> : <small>오답 시 절반으로 감소</small>}</div>; }
function BagStat({ battle, onUseItem, ownedItems, usedItems }: { battle: BattleState; onUseItem: (itemId: RewardItemId) => void; ownedItems: RewardItemId[]; usedItems: RewardItemId[] }) {
  const [open, setOpen] = useState(false);
  const usableCount = ownedItems.filter((id) => !usedItems.includes(id)).length;
  const bagDialogRef = useDialogKeyboard(open, () => setOpen(false));
  return <div className="bag-stat"><button aria-expanded={open} onClick={() => setOpen(true)} type="button"><span>ITEMS</span><strong>가방 <b>{usableCount}</b></strong></button>{open && <div className="bag-modal-backdrop" onMouseDown={() => setOpen(false)}><section aria-labelledby="bag-title" aria-modal="true" className="bag-modal" onMouseDown={(event) => event.stopPropagation()} ref={bagDialogRef} role="dialog"><span>🎒</span><p className="eyebrow">RELIC BAG</p><h2 id="bag-title">고유 수정 가방</h2><p>한 게임에서 각 수정은 한 번만 사용할 수 있어요.</p><div className="reward-item-list">{rewardItems.map((item) => { const owned = ownedItems.includes(item.id); const used = usedItems.includes(item.id); const usable = owned && !used && canUseRewardItem(item.id, battle.phase); return <article className={`${owned ? "owned" : "locked"} ${used ? "used" : ""}`} key={item.id} style={{ "--item": item.color } as React.CSSProperties}><i>{owned ? item.icon : "?"}</i><div><strong>{item.name}</strong><small>{owned ? item.description : `스테이지 ${item.stageId} 보스 격파 보상`}</small><em>{used ? "사용 완료" : usable ? "지금 사용 가능" : owned ? item.timing : "미획득"}</em></div>{owned && !used && <button disabled={!usable} onClick={() => onUseItem(item.id)} type="button">사용하기</button>}</article>; })}</div><button onClick={() => setOpen(false)} type="button">닫기</button></section></div>}</div>;
}
function Fighter({ battle, image, label, showIntent = false, side }: { battle: BattleState; image: string; label: string; showIntent?: boolean; side: "hero" | "boss" }) {
  const bossIdentity = stages.find((stage) => stage.bossName === label);
  const displayTitle = side === "hero" ? (characters.find((character) => character.name === label)?.role.split(" · ")[0] ?? "탐험가") : bossIdentity?.bossTitle ?? "던전 보스";
  const displayName = side === "hero" ? label : bossIdentity?.bossShortName ?? label;
  const hp = side === "hero" ? battle.playerHp : battle.bossHp;
  const max = side === "hero" ? battle.maxPlayerHp : battle.maxBossHp;
  const attackNotice = side === "boss" ? battle.attackNotice : undefined;
  const enemyAttack = side === "hero" ? battle.enemyAttackNotice : undefined;
  const bossAttack = side === "boss" ? battle.enemyAttackNotice : undefined;
  const quizDamage = side === "hero" ? battle.quizDamageNotice : undefined;
  const selfDamage = side === "hero" ? battle.selfDamageNotice : undefined;
  const wrongAnswer = side === "hero" && battle.phase === "reward" && battle.message.includes("오답");
  const bossConfused = side === "boss" && battle.bossEffect === "confusion";
  const confusionBurst = bossConfused && battle.phase === "action";
  const heroStance = battle.dodge ? "회피 준비" : battle.physicalShield ? "물리 방패 준비" : battle.magicGuard > 0 ? `마법 결계 +${battle.magicGuard}` : battle.attackBoost > 0 ? `공격 강화 +${battle.attackBoost}` : null;
  const bossStance = bossConfused ? "혼란" : battle.bossArmor > 0 ? `물리 방어 ${battle.bossArmor}` : battle.bossBarrier > 0 ? `마법 결계 ${battle.bossBarrier}` : battle.bossStance;
  return <article className={`fighter ${side} ${attackNotice ? `impact ${attackNotice.kind}-impact` : ""} ${side === "boss" && bossAttack ? `enemy-attacking ${bossAttack.kind}` : ""} ${side === "hero" && battle.playerEffect ? `player-effect ${battle.playerEffect}` : ""} ${wrongAnswer ? "wrong-answer" : ""} ${bossConfused ? "boss-confused" : ""} ${confusionBurst ? "confusion-burst" : ""}`}>
    <div className="fighter-art"><img alt={displayName} key={side === "boss" ? `boss-impact-${attackNotice?.sequence ?? 0}` : "hero"} src={image} />{side === "hero" && heroStance && <span className="fighter-stance fighter-overlay-status hero-stance-overlay">{heroStance}</span>}{side === "boss" && <span className="fighter-stance fighter-overlay-status boss-stance-overlay">{bossStance}</span>}</div>
    {attackNotice && <><span aria-hidden="true" className={`boss-impact-flash ${attackNotice.kind}`} key={`flash-${attackNotice.sequence}`} /><div className={`battle-damage-pop ${attackNotice.kind}`} key={attackNotice.sequence}><strong>{attackNotice.defense > 0 ? attackNotice.brokeShield ? `${attackNotice.kind === "physical" ? "물리 방어막" : "마법 결계"} 파괴!` : `${attackNotice.kind === "physical" ? "물리 방어막" : "마법 결계"} -${attackNotice.shieldDamage}` : `${attackNotice.kind === "physical" ? "물리" : "마법"} 피해 ${attackNotice.damage}`}</strong>{attackNotice.defense > 0 && <small>{attackNotice.brokeShield ? `남은 피해 ${attackNotice.damage}` : `남은 내구도 ${attackNotice.shieldRemaining}`}</small>}</div></>}
    {enemyAttack && <div className={`battle-damage-pop ${enemyAttack.damage > 0 ? "player-hit" : "player-defense"} ${enemyAttack.kind}`} key={`${battle.round}-${enemyAttack.damage}-${enemyAttack.outcome ?? "hit"}`}><strong>{enemyAttack.damage > 0 ? `피해 ${enemyAttack.damage}` : enemyAttack.outcome === "dodge" ? "회피 성공!" : enemyAttack.outcome === "shield" ? "방패 방어!" : "방어 성공!"}</strong></div>}
    {quizDamage && <div className="battle-damage-pop player-hit physical" key={`quiz-${quizDamage}-${battle.score}`}><strong>피해 {quizDamage}</strong></div>}
    {selfDamage && <div className="battle-damage-pop self-hit" key={`self-${battle.round}-${selfDamage}-${battle.impactSequence}`}><strong>반동 피해 {selfDamage}</strong></div>}
    {wrongAnswer && <div className="wrong-pop">? ? ?</div>}
    {bossConfused && <div className="confusion-questions"><b>?</b><b>?</b><b>?</b></div>}
    <div className="fighter-name"><span className="fighter-title">{displayTitle}</span><div className="fighter-name-row"><strong>{displayName}</strong></div>{side === "boss" && showIntent && <small className="boss-next-intent">다음 공격 · {battle.intent.label}</small>}<div className="hp-bar"><i style={{ width: `${Math.max(0, hp / max * 100)}%` }} /></div><div className="fighter-hp-row"><small>{hp} / {max}</small></div></div>
  </article>;
}
function QuizModal({ answered, battle, battleLog, difficulty, onAnswer, onContinueToAction, onMinimize, quiz }: { answered: QuizOption | null; battle: BattleState; battleLog: BattleLogEntry | undefined; difficulty: AdventureDifficulty; onAnswer: (option: QuizOption) => void; onContinueToAction: () => void; onMinimize: () => void; quiz: ReturnType<typeof generateStageQuiz> }) {
  const optionLayout = quiz.options.some((option) => option.text.length > 18) ? "long" : "short";
  const hasEquationOptions = optionLayout === "short" && quiz.options.every((option) => /[=<>]/.test(option.text));
  const mirrorActive = battle.mirrorTurns > 0;
  const sealedHintId = battle.quizHint ? quiz.options.find((option) => !option.isCorrect)?.id : undefined;
  const quizDialogRef = useDialogKeyboard(true, onMinimize);
  return <div className="quiz-modal-backdrop"><section className={`quiz-modal ${optionLayout}`} role="dialog" aria-modal="true" aria-labelledby="quiz-title" ref={quizDialogRef}><header><p className="eyebrow">{getDifficulty(difficulty).badge} · QUIZ GATE</p><div><strong>정답 3 · 오답 2</strong>{!answered && <button className="quiz-minimize" onClick={onMinimize} type="button">전장 보기</button>}</div></header><h1 id="quiz-title">{quiz.prompt}</h1><p>{mirrorActive ? `진실의 거울 수정 효과 · 남은 ${battle.mirrorTurns}턴` : battle.quizHint ? "관문 수호의 수정 효과 · 오답 선택지 1개를 봉인했어요." : "일반 정답은 행동력 2, 숨겨진 럭키 정답은 행동력 3을 줍니다."}</p><div className={`quiz-options ${optionLayout} ${hasEquationOptions ? "equation" : ""}`}>{quiz.options.map((option) => { const hintSealed = option.id === sealedHintId; const sealed = (mirrorActive && option.isBomb) || hintSealed; const luckyMarked = mirrorActive && option.isLucky; return <button className={`${answered?.id === option.id ? option.isCorrect ? "correct" : "wrong" : ""} ${luckyMarked ? "lucky-revealed" : ""} ${sealed ? "bomb-sealed" : ""}`} disabled={Boolean(answered) || sealed} key={option.id} onClick={() => onAnswer(option)}>{luckyMarked && <small>🍀 럭키</small>}{hintSealed ? <small>🔒 제외</small> : sealed && <small>🔒 봉인</small>}{option.text}</button>; })}</div>{answered ? <div aria-live="polite" className={`quiz-feedback ${answered.isCorrect ? "correct" : "wrong"}`} role="status"><strong>{answered.isLucky ? "🍀 럭키팡 정답!" : answered.isCorrect ? "✓ 정답이에요!" : answered.isBomb ? "💣 폭탄 오답!" : "다시 확인해 봐요."}</strong><p>{answered.explanation}</p>{answered.misconception && <small>오개념 진단: {answered.misconception}</small>}{answered.isCorrect ? <button className="quiz-continue" onClick={onContinueToAction} type="button">전투로 이동 →</button> : <em>같은 문제를 다시 풀어 보세요…</em>}</div> : <aside className="quiz-rule" aria-label="최근 전투 기록"><b>최근 전투 기록</b>{battleLog ? <div><small>{formatBattleLogMeta(battleLog)}</small><strong>{battleLog.text}</strong>{battleLog.detail && <span>{battleLog.detail}</span>}</div> : <span>전투 기록이 아직 없습니다.</span>}</aside>}</section></div>;
}
function getCardRole(card: CombatCard) { return ({ attack: "공격", magic: "마법", defense: "수비", dodge: "회피", heal: "회복", strategy: "전략", boost: "강화" } as const)[card.role]; }
function getCardRoleColor(card: CombatCard) { return ({ attack: "coral", magic: "violet", defense: "cyan", dodge: "mint", heal: "cyan", strategy: "amber", boost: "coral" } as const)[card.role]; }
function ActionPanel({ battle, onEndTurn, onPlayCard, onRedraw, readOnly = false, showPreview = false }: { battle: BattleState; onEndTurn: () => void; onPlayCard: (card: CombatCard) => void; onRedraw: () => void; readOnly?: boolean; showPreview?: boolean }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesDialogRef = useDialogKeyboard(rulesOpen, () => setRulesOpen(false));
  return <section className={`action-panel ${readOnly ? "preview" : ""}`}><header><div className="hand-heading"><p>YOUR HAND · {battle.hand.length}/5 · 버림 {battle.discardCount}</p><strong>{readOnly ? "문제를 푸는 동안에는 손패를 확인만 할 수 있어요." : "행동력 안에서 공격·방어·회피·마법 카드를 조합하세요."}</strong></div><div className="action-controls"><button aria-haspopup="dialog" className="card-draw-rules" onClick={() => setRulesOpen(true)} type="button">☷ 카드 뽑기 규칙</button>{!readOnly && <><button className="redraw-button" disabled={battle.energy < 2} onClick={onRedraw}>↻ 새로 뽑기 <b>2</b></button><button onClick={onEndTurn}>{battle.bossHp <= 0 ? "승리 확인" : "턴 종료"} →</button></>}</div></header><div className="combat-hand">{battle.hand.map((card) => { const cardPreview = showPreview ? getCombatCardPreview(battle, card) : undefined; return <button aria-label={`${card.name}: 비용 ${card.cost}, ${getCardRole(card)}, ${card.description}${cardPreview ? `. 예상 결과: ${cardPreview}` : ""}`} className={getCardRoleColor(card)} disabled={readOnly || card.cost > battle.energy || battle.bossHp <= 0} key={card.instanceId} onClick={() => onPlayCard(card)}><span className="card-cost">{card.cost}</span><small className="card-role">{getCardRole(card)}</small><i aria-hidden="true">{card.symbol}</i><strong className="card-name">{card.name}</strong><em>{card.description}</em>{cardPreview && <small className="card-preview">{cardPreview}</small>}</button>; })}</div>{rulesOpen && <div className="card-rules-backdrop" onMouseDown={() => setRulesOpen(false)}><section aria-labelledby="card-rules-title" aria-modal="true" className="card-rules-modal" onMouseDown={(event) => event.stopPropagation()} ref={rulesDialogRef} role="dialog"><header><div><p>CARD DRAW RULES</p><h2 id="card-rules-title">카드 뽑기 규칙</h2></div><button aria-label="카드 뽑기 규칙 닫기" onClick={() => setRulesOpen(false)} type="button">×</button></header><ol><li><b>1</b><div><strong>시작 손패 공격 보장</strong><span>시작할 때 공격 카드는 1~2장만 들어와요.</span></div></li><li><b>2</b><div><strong>정답 보상 드로우</strong><span>정답을 맞히면 빈 손패 자리에 카드 1장을 뽑아요.</span></div></li><li><b>3</b><div><strong>턴 시작 드로우</strong><span>턴이 시작될 때 손패가 3장 이하라면 카드 1장을 뽑아요.</span></div></li><li><b>4</b><div><strong>같은 카드 중복 제한</strong><span>같은 이름의 카드는 손에 1장만 뽑아요.</span></div></li></ol><button className="card-rules-close" onClick={() => setRulesOpen(false)} type="button">확인했어요</button></section></div>}</section>;
}
function Result({ earnedItem, earnedTitles, onNext, onSetup, score, stage, towerCanClimb, towerFloor, towerGearReward, towerHasCheckpoint, won }: { earnedItem: RewardItem | null; earnedTitles: AdventureTitle[]; onNext: () => void; onSetup: () => void; score: number; stage: (typeof stages)[number]; towerCanClimb?: boolean; towerFloor?: number; towerGearReward: number; towerHasCheckpoint?: boolean; won: boolean }) {
  const tower = Boolean(towerFloor);
  const gearClaimRequired = tower && won && towerGearReward > 0;
  const [gearOpened, setGearOpened] = useState(!gearClaimRequired);
  const towerComplete = tower && won && towerFloor === TOWER_MAX_FLOOR;
  const towerShop = tower && won && isTowerUpgradeFloor(towerFloor ?? 0);
  const towerShopMessage = towerFloor === 19 ? "기어 상자를 열었어요. 결전 정비소에서 구구와의 마지막 승부를 준비하세요." : "기어 상자를 열었어요. 탑 상점에서 다음 5층을 준비하세요.";
  const nextLabel = tower ? towerCanClimb ? towerShop ? "탑 상점" : "다음 층" : "탑 나가기" : won ? stage.id === 5 ? "엔딩 보기" : "다음 구역" : towerHasCheckpoint ? "저장 지점으로 돌아가기" : "새 도전";
  return <main className="result-page"><section><span className="result-icon">{won ? "✦" : "↻"}</span><p className="eyebrow">{tower ? "TOWER RUN RESULT" : "BOSS BATTLE RESULT"}</p><h1>{towerComplete ? "도전의 탑 완주!" : won ? tower ? `${towerFloor}층 보스 격파!` : `${stage.bossName} 격파!` : "집중력이 모두 소진됐어요"}</h1><p>{towerComplete ? "20층의 모든 곱셈 시험을 통과했어요. 최고 기록이 저장되었습니다." : tower ? won ? towerShop ? towerShopMessage : "다음 층 시작 지점이 자동 저장됐어요. 기어 상자를 열고 계속 도전하세요." : towerHasCheckpoint ? "이번 전투는 여기까지예요. 마지막 자동 저장 지점에서 다시 이어할 수 있어요." : "이번 탑 도전은 여기까지예요. 저장 지점이 없어 새 도전은 1층, HP 100에서 시작합니다." : won ? `${stage.clearMessage} ${stage.nextHook}` : "개념 설명을 다시 확인하고 방어·회피 카드로 보스 행동에 대비해 보세요."}</p>{gearClaimRequired && <section aria-live="polite" className={`tower-gear-reveal ${gearOpened ? "opened" : ""}`}><i aria-hidden="true">⚙</i><div>{gearOpened ? <><small>기어 상자 개봉</small><strong>기어 +{towerGearReward}</strong><em>탑 상점에서 사용할 수 있어요.</em></> : <><small>기어 상자 획득</small><strong>보상을 확인하세요</strong><em>상자를 열면 기어 보상이 공개됩니다.</em></>}</div>{!gearOpened && <button onClick={() => setGearOpened(true)} type="button">기어 상자 열기</button>}</section>}{earnedItem && <div className="reward-item-earned" style={{ "--item": earnedItem.color } as React.CSSProperties}><i>{earnedItem.icon}</i><span><small>새 고유 수정 획득</small><strong>{earnedItem.name}</strong><em>{earnedItem.description}</em></span></div>}{earnedTitles.map((title) => { const titleDetail = getTitleDifficulty(title.difficulty); return <div className="earned-title" key={title.id} style={{ "--title-color": titleDetail.color } as React.CSSProperties}><i>{title.kind === "score" ? "✹" : titleDetail.mark}</i><span><small>새 칭호 획득 · {titleDetail.label}</small><strong>{title.name}</strong><em>{title.condition}</em></span></div>; })}<div className="result-score"><span>{tower ? "누적 점수" : "획득 점수"}</span><strong>{score}</strong></div><div className="result-actions"><button disabled={!gearOpened} onClick={onNext}>{nextLabel} →</button><button className="secondary" onClick={onSetup}>{tower ? "탑 나가기" : "구역 선택"}</button></div></section></main>;
}
function Ending({ character, onMain, score, stage }: { character: (typeof characters)[number]; onMain: () => void; score: number; stage: (typeof stages)[number] }) {
  const [step, setStep] = useState(0);
  const epilogue = [
    { image: stage.bossImage, name: stage.bossShortName, role: stage.bossTitle, text: "훌륭하다, 탐험가. 다섯 구간의 계산 신호가 모여 출발 허가판이 완성됐다." },
    { image: character.image, name: character.name, role: "구구단 특급 탐험가", text: "화물 선로부터 중앙 관제실까지, 배운 규칙을 하나씩 연결하니 특급이 다시 출발할 수 있었어!" },
    { image: "/characters/sembit-guide-v1.webp", name: "셈빛", role: "구구단 특급 길안내 로봇", text: "최종 출발 코드를 확인했어요! 배운 곱셈 규칙을 모두 활용한 탐험가님께 도전의 탑 노선을 개방합니다." },
  ];
  const line = epilogue[step];
  if (line) return <main className="ending-page"><section className="ending-dialogue"><div className="ending-dialogue-art"><img alt={`${stage.bossShortName}의 모습`} className={line.name === stage.bossShortName ? "speaking" : ""} src={stage.bossImage} /><img alt={`${character.name}의 모습`} className={line.name === character.name ? "speaking" : ""} src={character.image} /><img alt="셈빛의 모습" className={line.name === "셈빛" ? "speaking" : ""} src="/characters/sembit-guide-v1.webp" /></div><p className="eyebrow">FINAL PLATFORM · {step + 1} / {epilogue.length}</p><header><img alt="" src={line.image} /><div><small>{line.role}</small><h1>{line.name}</h1></div></header><p>{line.text}</p><button onClick={() => setStep((value) => value + 1)}>{step === epilogue.length - 1 ? "출발식으로 →" : "다음 멘트 →"}</button></section></main>;
  return <main className="ending-page"><section><div className="ending-party"><img alt={character.name} src={character.image} /><img alt="셈빛" src="/characters/sembit-guide-v1.webp" /></div><p className="eyebrow">ADVENTURE COMPLETE</p><h1>구구단 특급이 다시 출발합니다!</h1><p>다섯 대장의 출발 시험을 모두 통과했어요. 2단부터 9단, 1단과 0의 곱까지 배운 규칙으로 이제 심화 구역, 도전의 탑을 탐험할 수 있어요.</p><strong className="ending-title">칭호 · 구구단 특급 탐험가</strong><small>마지막 전투 점수 {score}</small><button onClick={onMain}>메인 화면으로</button></section></main>;
}
