import { stages, type StageId } from "./content.ts";

export const TOWER_MAX_FLOOR = 20;
export type TowerQuizProfile = "campaign" | "zero-one" | "range" | "compare" | "same-result" | "commutative" | "ones-digit" | "grouping" | "compare-mix" | "rule-mix" | "core-mix";
export type TowerFloorConfig = { floor: number; combatStageId: StageId; quizProfile: TowerQuizProfile; bossName: string; bossTitle: string; bossShortName: string; color: string; background: string; bossImage: string; guide: string; hint: string; evolved: boolean; introTypeSummary?: string; placeholderArt?: boolean };

const stageFloor = (floor: StageId, guide: string): TowerFloorConfig => {
  const stage = stages[floor - 1];
  return { floor, combatStageId: floor, quizProfile: floor === 5 ? "zero-one" : "campaign", bossName: stage.bossName, bossTitle: stage.bossTitle, bossShortName: stage.bossShortName, color: stage.color, background: stage.background, bossImage: stage.bossImage, guide, hint: floor === 5 ? "0과 1을 곱했을 때 결과가 어떻게 되는지 확인하세요." : "계산 결과와 묶음의 뜻을 차례로 확인하세요.", evolved: floor === 5 };
};
const towerFloor = (floor: number, combatStageId: StageId, quizProfile: TowerQuizProfile, bossName: string, bossTitle: string, bossShortName: string, color: string, fallbackStage: StageId, guide: string, hint: string, evolved = false, bossImage?: string, introTypeSummary?: string): TowerFloorConfig => {
  const fallback = stages[fallbackStage - 1];
  return { floor, combatStageId, quizProfile, bossName, bossTitle, bossShortName, color, background: fallback.background, bossImage: bossImage ?? fallback.bossImage, guide, hint, evolved, introTypeSummary, placeholderArt: !bossImage };
};

export const towerFloors: TowerFloorConfig[] = [
  stageFloor(1, "2단·5단 계산"), stageFloor(2, "3단·6단 계산"), stageFloor(3, "4단·8단 묶음"), stageFloor(4, "7단·9단 계산"), stageFloor(5, "1단·0의 곱 결전"),
  towerFloor(6, 3, "range", "문지기 피코", "도전의 탑 첫 문지기", "피코", "#2cb6a7", 2, "범위 속 곱셈 결과 찾기", "계산한 결과가 범위 안인지 확인하세요.", false, "/characters/tower-piko-v1.webp"),
  towerFloor(7, 3, "compare", "문지기 피코", "도전의 탑 첫 문지기", "피코", "#2cb6a7", 2, "기준값보다 큰 결과", "기준 식의 결과와 비교하세요.", false, "/characters/tower-piko-v1.webp"),
  towerFloor(8, 3, "range", "문지기 피코", "도전의 탑 첫 문지기", "피코", "#2cb6a7", 2, "범위 속 곱셈 결과 찾기", "계산한 결과가 범위 안에 있는지 다시 확인하세요.", false, "/characters/tower-piko-v1.webp"),
  towerFloor(9, 3, "same-result", "문지기 피코", "도전의 탑 첫 문지기", "피코", "#2cb6a7", 2, "같은 결과 찾기", "곱셈 결과를 끝까지 계산하세요.", false, "/characters/tower-piko-v1.webp"),
  towerFloor(10, 3, "compare-mix", "문지기 피코 EX", "도전의 탑 첫 문지기", "피코", "#2cb6a7", 2, "범위·비교 결전", "문제에 나온 기준을 먼저 읽으세요.", true, "/characters/tower-piko-ex-v1.webp"),
  towerFloor(11, 4, "commutative", "중간 대장 크라운", "도전의 탑 중간 대장", "크라운", "#4c66e8", 4, "바꿔 곱하기", "곱하는 순서를 바꿔도 결과는 같아요.", false, "/characters/tower-crown-v2.webp"),
  towerFloor(12, 4, "same-result", "중간 대장 크라운", "도전의 탑 중간 대장", "크라운", "#4c66e8", 4, "같은 결과 찾기", "결과가 같은 식인지 계산하세요.", false, "/characters/tower-crown-v2.webp"),
  towerFloor(13, 4, "ones-digit", "중간 대장 크라운", "도전의 탑 중간 대장", "크라운", "#4c66e8", 4, "일의 자리 규칙", "계산 결과의 마지막 숫자를 보세요.", false, "/characters/tower-crown-v2.webp"),
  towerFloor(14, 4, "compare", "중간 대장 크라운", "도전의 탑 중간 대장", "크라운", "#4c66e8", 4, "기준값 비교", "기준 식의 결과와 비교하세요.", false, "/characters/tower-crown-v2.webp"),
  towerFloor(15, 4, "rule-mix", "중간 대장 크라운 EX", "도전의 탑 중간 대장", "크라운", "#4c66e8", 4, "규칙 결전", "이번 문제의 규칙을 끝까지 적용하세요.", true, "/characters/tower-crown-ex-v2.webp"),
  towerFloor(16, 5, "grouping", "도전의 탑 간부 코어", "도전의 탑 간부", "코어", "#45d879", 3, "묶음과 식 연결", "한 묶음 수와 묶음 수를 찾으세요.", false, "/characters/tower-core-v1.webp"),
  towerFloor(17, 5, "range", "도전의 탑 간부 코어", "도전의 탑 간부", "코어", "#45d879", 3, "범위 속 곱셈 결과 찾기", "계산한 결과가 범위 안인지 확인하세요.", false, "/characters/tower-core-v1.webp"),
  towerFloor(18, 5, "grouping", "도전의 탑 간부 코어", "도전의 탑 간부", "코어", "#45d879", 3, "묶음과 식 연결 복습", "한 묶음 수와 묶음 수를 다시 확인하세요.", false, "/characters/tower-core-v1.webp"),
  towerFloor(19, 5, "core-mix", "도전의 탑 간부 코어 EX", "도전의 탑 간부", "코어", "#45d879", 3, "곱셈 규칙 종합", "문제마다 필요한 규칙 하나를 찾아보세요.", true, "/characters/tower-core-ex-v1.webp"),
  towerFloor(20, 5, "core-mix", "도전의 탑 지배자 구구", "도전의 탑 지배자", "구구", "#f2c34b", 5, "도전의 탑 결전", "계산·비교·묶음 의미를 모두 점검하세요.", false, "/characters/tower-gugu-v1.webp", "모든 곱셈 규칙 활용"),
];
export function getTowerFloorConfig(floor: number) { return towerFloors[Math.min(Math.max(1, floor), TOWER_MAX_FLOOR) - 1]!; }
const mixedQuizTypeLabels: Partial<Record<TowerQuizProfile, readonly string[]>> = {
  "compare-mix": ["범위 속 곱셈 결과 찾기", "같은 결과 찾기", "기준값 비교"],
  "rule-mix": ["같은 결과 찾기", "일의 자리 규칙", "바꿔 곱하기"],
  "core-mix": ["범위 속 곱셈 결과 찾기", "같은 결과 찾기", "일의 자리 규칙", "기준값 비교", "바꿔 곱하기", "묶음과 식 연결"],
};
export function getTowerQuizTypeLabels(profile: TowerQuizProfile) { return mixedQuizTypeLabels[profile] ?? []; }
