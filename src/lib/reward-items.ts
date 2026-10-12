import type { StageId } from "./content.ts";

export type RewardItemId = "gate-guardian-crystal" | "mist-guide-crystal" | "precision-gear-crystal" | "truth-mirror-crystal";
export type RewardItem = {
  id: RewardItemId;
  stageId: 1 | 2 | 3 | 4;
  name: string;
  icon: string;
  color: string;
  description: string;
  timing: "퀴즈 선택 전" | "행동 단계";
};

export const rewardItems: RewardItem[] = [
  { id: "gate-guardian-crystal", stageId: 1, name: "화물 상자역 분류 태그", icon: "▣", color: "#ffb84d", description: "오답 선택지 1개 즉시 봉인", timing: "퀴즈 선택 전" },
  { id: "mist-guide-crystal", stageId: 2, name: "신호 동기화 칩", icon: "⌁", color: "#4fd5ff", description: "보스 방어·결계 해제 · 1턴 혼란", timing: "행동 단계" },
  { id: "precision-gear-crystal", stageId: 3, name: "회전판 기어 키", icon: "⚙", color: "#ff8b45", description: "행동력 +2 · 3/3 초과 가능", timing: "행동 단계" },
  { id: "truth-mirror-crystal", stageId: 4, name: "야간 노선 패스", icon: "▤", color: "#b66dff", description: "2턴 럭키 표시 · 폭탄 봉인", timing: "퀴즈 선택 전" },
];

export function rewardItemForStage(stageId: StageId) { return rewardItems.find((item) => item.stageId === stageId); }
export function rewardItemById(id: RewardItemId) { return rewardItems.find((item) => item.id === id); }
export function canUseRewardItem(id: RewardItemId, phase: "quiz" | "reward" | "action" | "enemy") {
  const item = rewardItemById(id);
  return item?.timing === "퀴즈 선택 전" ? phase === "quiz" : phase === "action";
}
