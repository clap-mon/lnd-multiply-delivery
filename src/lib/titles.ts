import type { StageId } from "./content";
import type { AdventureDifficulty } from "./game";

export type CharacterId = "clover" | "toto" | "pin";

export type AdventureTitle = {
  id: string;
  characterId: CharacterId;
  difficulty: AdventureDifficulty;
  name: string;
  condition: string;
  kind: "campaign" | "score" | "tower";
};

export const titleDifficultyDetails = {
  easy: { label: "쉬움", mark: "◆", color: "#218a70" },
  normal: { label: "보통", mark: "★", color: "#5042ca" },
  hard: { label: "어려움", mark: "✦", color: "#b13878" },
} satisfies Record<AdventureDifficulty, { label: string; mark: string; color: string }>;

const titleNames: Record<CharacterId, Record<AdventureDifficulty, readonly [string, string, string, string, string]>> = {
  clover: {
    easy: ["상자역 견습 기관사", "터널 신호 기관사", "회전교차로 조종사", "야간 노선 기관사", "특급 첫 기관사"],
    normal: ["묶음 화물 기관사", "단 신호 추적사", "정확 운행 대장", "야간 시간표 기관사", "구구단 특급 기관사"],
    hard: ["완전 묶음 운전수", "신호터널 돌파자", "정밀 전환 조종사", "별빛 노선 기관장", "다섯 신호 총기관사"],
  },
  toto: {
    easy: ["상자역 든든이", "터널 신호 지킴이", "회전판 안전 탐험가", "야간 노선 지킴이", "특급 든든 탐험가"],
    normal: ["묶음 화물 수호자", "단 신호 수호자", "정확 운행 지킴이", "시간표 수호자", "구구단 특급 수호자"],
    hard: ["묶음 컨베이어 지킴이", "신호터널 수호자", "정밀 전환 수호자", "별빛 노선 수호자", "다섯 신호 대수호자"],
  },
  pin: {
    easy: ["상자역 마법 탐험가", "터널 신호 마법사", "회전판 빛 탐험가", "야간 노선 별빛술사", "특급 마법 탐험가"],
    normal: ["묶음 빛 해석가", "단 신호 마법사", "정확 운행 별빛술사", "시간표 마법 해석가", "구구단 특급 마법사"],
    hard: ["묶음 마법 수호자", "신호터널 대마법사", "정밀 전환 빛술사", "별빛 노선 대마법사", "다섯 신호 마법 수호자"],
  },
};

const characterIds: CharacterId[] = ["clover", "toto", "pin"];
const difficultyIds: AdventureDifficulty[] = ["easy", "normal", "hard"];

const scoreTitleNames: Record<CharacterId, Record<AdventureDifficulty, string>> = {
  clover: { easy: "새싹 특급 기관사", normal: "정밀 특급 기관사", hard: "전설 특급 기관사" },
  toto: { easy: "든든한 신호 지킴이", normal: "정밀 노선 수호자", hard: "특급 대수호자" },
  pin: { easy: "시간표 견습 마법사", normal: "규칙 노선 마법사", hard: "특급 대마법사" },
};

export const scoreTitleThresholds = { easy: 800, normal: 900, hard: 1000 } satisfies Record<AdventureDifficulty, number>;

const campaignTitles: AdventureTitle[] = characterIds.flatMap((characterId) => difficultyIds.flatMap((difficulty) =>
  titleNames[characterId][difficulty].map((name, index) => ({
    id: `title-${characterId}-${difficulty}-${index + 1}`,
    characterId,
    difficulty,
    name,
    condition: `${titleDifficultyDetails[difficulty].label} 난이도 · 전 스테이지 완주`,
    kind: "campaign" as const,
  })),
));

const scoreTitles: AdventureTitle[] = characterIds.flatMap((characterId) => difficultyIds.map((difficulty) => ({
  id: `score-title-${characterId}-${difficulty}`,
  characterId,
  difficulty,
  name: scoreTitleNames[characterId][difficulty],
  condition: `${titleDifficultyDetails[difficulty].label} 난이도 · 한 전투 ${scoreTitleThresholds[difficulty]}점 이상 승리`,
  kind: "score" as const,
})));

const towerTitles: AdventureTitle[] = [
  { id: "tower-floor-5", characterId: "clover", difficulty: "normal", name: "탑의 첫 발걸음", condition: "도전의 탑 5층 클리어", kind: "tower" },
  { id: "tower-floor-10", characterId: "clover", difficulty: "normal", name: "피코를 넘은 기관사", condition: "도전의 탑 10층 클리어", kind: "tower" },
  { id: "tower-floor-15", characterId: "clover", difficulty: "normal", name: "크라운의 시험 통과", condition: "도전의 탑 15층 클리어", kind: "tower" },
  { id: "tower-floor-20", characterId: "clover", difficulty: "normal", name: "도전의 탑 정복자", condition: "도전의 탑 20층 완주", kind: "tower" },
  { id: "tower-character-clover", characterId: "clover", difficulty: "normal", name: "하루의 철벽", condition: "하루로 도전의 탑 10층 클리어", kind: "tower" },
  { id: "tower-character-toto", characterId: "toto", difficulty: "normal", name: "두리의 균형", condition: "두리로 도전의 탑 10층 클리어", kind: "tower" },
  { id: "tower-character-pin", characterId: "pin", difficulty: "normal", name: "세나의 신호 마법", condition: "세나로 도전의 탑 10층 클리어", kind: "tower" },
  { id: "tower-attack-build", characterId: "clover", difficulty: "normal", name: "전력 강화 기관사", condition: "한 번의 탑 도전에서 공격 강화 2회 선택", kind: "tower" },
  { id: "tower-defense-build", characterId: "clover", difficulty: "normal", name: "단단한 기관사", condition: "한 번의 탑 도전에서 방어 강화 2회 선택", kind: "tower" },
  { id: "tower-maintenance-build", characterId: "clover", difficulty: "normal", name: "정비의 달인", condition: "한 번의 탑 도전에서 최대 HP·전체 회복 강화 2회 선택", kind: "tower" },
  { id: "tower-mixed-mastery", characterId: "clover", difficulty: "normal", name: "규칙 탐험가", condition: "혼합 문제층을 모두 넘어 도전의 탑 완주", kind: "tower" },
];

export const adventureTitles: AdventureTitle[] = [...campaignTitles, ...scoreTitles, ...towerTitles];

const titleStorageKey = "luckypang-lnd-multiply-collected-titles";

export function getTitleDifficulty(difficulty: AdventureDifficulty) { return titleDifficultyDetails[difficulty]; }

export function getCampaignClearTitle(characterId: CharacterId, difficulty: AdventureDifficulty, excludedIds: readonly string[]) {
  const candidates = adventureTitles.filter((title) => title.kind === "campaign" && title.characterId === characterId && title.difficulty === difficulty);
  const excluded = new Set(excludedIds);
  const uncollected = candidates.filter((title) => !excluded.has(title.id));
  const pool = uncollected.length > 0 ? uncollected : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getScoreTitle(characterId: CharacterId, difficulty: AdventureDifficulty) {
  return adventureTitles.find((title) => title.kind === "score" && title.characterId === characterId && title.difficulty === difficulty);
}

export function getTowerTitles(floor: number, characterId: CharacterId, upgrades: readonly string[]) {
  const ids = new Set<string>();
  for (const milestone of [5, 10, 15, 20]) if (floor >= milestone) ids.add(`tower-floor-${milestone}`);
  if (floor >= 10) ids.add(`tower-character-${characterId}`);
  if (upgrades.filter((upgrade) => upgrade === "attack").length >= 2) ids.add("tower-attack-build");
  if (upgrades.filter((upgrade) => upgrade === "defense").length >= 2) ids.add("tower-defense-build");
  if (upgrades.filter((upgrade) => upgrade === "max-hp" || upgrade === "full-heal").length >= 2) ids.add("tower-maintenance-build");
  if (floor >= 20) ids.add("tower-mixed-mastery");
  return towerTitles.filter((title) => ids.has(title.id));
}

export function loadCollectedTitleIds(storage: Storage): string[] {
  try {
    const saved = JSON.parse(storage.getItem(titleStorageKey) ?? "[]") as unknown;
    const validIds = new Set(adventureTitles.map((title) => title.id));
    return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string" && validIds.has(id)))] : [];
  } catch {
    return [];
  }
}

export function saveCollectedTitleId(storage: Storage, titleId: string) {
  const next = [...new Set([...loadCollectedTitleIds(storage), titleId])];
  storage.setItem(titleStorageKey, JSON.stringify(next));
  return next;
}

export function clearCollectedTitles(storage: Storage) { storage.removeItem(titleStorageKey); }

const campaignProgressStorageKey = "luckypang-lnd-multiply-title-campaign-progress";
export type CampaignProgress = Partial<Record<`${CharacterId}-${AdventureDifficulty}`, StageId[]>>;

export function loadTitleCampaignProgress(storage: Storage): CampaignProgress {
  try {
    const saved = JSON.parse(storage.getItem(campaignProgressStorageKey) ?? "{}") as unknown;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, Array.isArray(value) ? value.filter((id): id is StageId => Number.isInteger(id) && id >= 1 && id <= 5) : []])) as CampaignProgress;
  } catch { return {}; }
}

export function saveTitleCampaignStage(storage: Storage, progress: CampaignProgress, characterId: CharacterId, difficulty: AdventureDifficulty, stageId: StageId) {
  const key = `${characterId}-${difficulty}` as const;
  const stored = loadTitleCampaignProgress(storage);
  const completedStages = [...new Set([...(stored[key] ?? []), ...(progress[key] ?? []), stageId])].sort() as StageId[];
  const next = { ...stored, ...progress, [key]: completedStages };
  storage.setItem(campaignProgressStorageKey, JSON.stringify(next));
  return next;
}

export function campaignIsComplete(progress: CampaignProgress, characterId: CharacterId, difficulty: AdventureDifficulty) {
  const completed = new Set(progress[`${characterId}-${difficulty}`]);
  return [1, 2, 3, 4, 5].every((stageId) => completed.has(stageId as StageId));
}

export function clearTitleCampaignProgress(storage: Storage) { storage.removeItem(campaignProgressStorageKey); }
