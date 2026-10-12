export type StageId = 1 | 2 | 3 | 4 | 5;
export type Speaker = "셈빛" | "주인공" | "보스";
export type DialogueChoice = { text: string; correct: boolean; feedback: string };
export type DialogueMultiOption = { id: string; text: string; isAnswer: boolean; explanation: string };
export type DialogueMultiCheck = { instruction: string; options: DialogueMultiOption[]; successFeedback: string };
export type DialogueNode = { speaker: Speaker; text: string; choices?: DialogueChoice[]; multiCheck?: DialogueMultiCheck };
export type Stage = { id: StageId; title: string; shortTitle: string; concept: string; mission: string; bossName: string; bossTitle: string; bossShortName: string; color: string; background: string; bossImage: string; dialogue: DialogueNode[]; clearMessage: string; nextHook: string; artDirection: string };

const choice = (correctText: string, wrong: string[], feedback: string, wrongFeedback: string): DialogueChoice[] => [{ text: correctText, correct: true, feedback }, ...wrong.map((text) => ({ text, correct: false, feedback: wrongFeedback }))];
export function shuffleDialogueChoices(options: DialogueChoice[], rng: () => number = Math.random): DialogueChoice[] {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex]!, shuffled[index]!];
  }
  return shuffled;
}
const multiCheck = (options: DialogueMultiOption[], successFeedback: string): DialogueMultiCheck => ({ instruction: "조건에 맞는 것을 모두 고르세요. 정답은 2개 이상입니다.", options, successFeedback });

export const stages: Stage[] = [
  { id: 1, title: "화물 상자역", shortTitle: "2단 · 5단", concept: "2씩과 5씩 묶어 세며 곱셈구구 만들기", mission: "첫 번째 출발 시험을 통과하세요.", bossName: "화물 정리 대장 모아", bossTitle: "화물 상자역 정리 대장", bossShortName: "모아", color: "#ffb84d", background: "/story-backgrounds/stage-1-box-station-v1.webp", bossImage: "/characters/boss-stage-1-moa-v2.webp", artDirection: "밝은 아침의 화물 플랫폼. 2개와 5개 묶음 상자가 흐르는 컨베이어와 친근하지만 당당한 화물 대장.", clearMessage: "모아 대장이 첫 출발 도장을 찍어 주었습니다!", nextHook: "구구단 특급이 신호등 터널로 출발합니다.", dialogue: [
    { speaker: "주인공", text: "구구단 특급이 멈췄어. 다섯 구간의 계산 신호를 다시 켜서 열차를 출발시키자!" },
    { speaker: "셈빛", text: "저는 길안내 로봇 셈빛이에요. 첫 시험은 화물 상자역이에요. 2개씩과 5개씩 묶인 화물을 바르게 세어 봐요." },
    { speaker: "셈빛", text: "2씩 뛰어 세면 2, 4, 6…이고 5씩 뛰어 세면 5, 10, 15…예요. 같은 수를 여러 묶음 세면 곱셈식으로 나타낼 수 있어요." },
    { speaker: "셈빛", text: "사탕이 5개씩 든 상자가 4개면 알맞은 식은 무엇일까요?", choices: choice("5 × 4 = 20", ["5 × 3 = 15", "4 × 4 = 16", "5 × 4 = 15"], "맞아요! 5개씩 4묶음이에요.", "한 묶음의 수와 묶음 수, 계산 결과를 다시 확인해 보세요.") },
    { speaker: "셈빛", text: "2개씩 든 상자가 6개면 알맞은 식은 무엇일까요?", choices: choice("2 × 6 = 12", ["2 × 5 = 10", "6 × 2 = 10", "2 × 6 = 10"], "맞아요! 2를 6번 더하면 12예요.", "2개씩 6묶음인지와 계산 결과를 다시 확인해 보세요.") },
    { speaker: "보스", text: "나는 화물 정리 대장 모아! 2개씩과 5개씩 묶인 화물 수량표를 정확히 읽으면 화물 선로와 첫 출발 신호를 열어 주겠다." },
  ] },
  { id: 2, title: "신호등 터널", shortTitle: "3단 · 6단", concept: "3씩과 6씩 묶어 곱셈구구 익히기", mission: "두 번째 출발 시험을 통과하세요.", bossName: "신호등 터널 대장 반디", bossTitle: "신호등 터널 대장", bossShortName: "반디", color: "#4fd5ff", background: "/story-backgrounds/stage-2-signal-tunnel-v1.webp", bossImage: "/characters/boss-stage-2-bandi-v1.webp", artDirection: "청록빛 터널과 3개·6개씩 빛나는 신호등. 작고 빠른 신호 대장이 레일 위를 안내한다.", clearMessage: "반디 대장이 두 번째 출발 도장을 찍어 주었습니다!", nextHook: "열차가 레일 돌림마당으로 달려갑니다.", dialogue: [
    { speaker: "주인공", text: "화물 선로가 열렸어! 다음은 신호등 터널이네. 통과 신호가 3개씩, 6개씩 묶여 있어." },
    { speaker: "셈빛", text: "두 번째 시험은 3단과 6단이에요. 같은 수씩 묶인 신호등의 수를 곱셈으로 계산해 봐요." },
    { speaker: "셈빛", text: "3단은 3, 6, 9…이고 6단은 6, 12, 18…처럼 늘어나요." },
    { speaker: "셈빛", text: "3개씩 든 신호 묶음이 4개면 알맞은 식은 무엇일까요?", choices: choice("3 × 4 = 12", ["3 × 3 = 9", "4 × 3 = 9", "3 × 4 = 9"], "맞아요! 3을 4번 더하면 12예요.", "한 묶음의 수와 묶음 수, 계산 결과를 다시 확인해 보세요.") },
    { speaker: "셈빛", text: "6의 단에 나오는 수를 모두 고르세요.", multiCheck: multiCheck([{ id: "12", text: "12", isAnswer: true, explanation: "6 × 2 = 12예요." }, { id: "18", text: "18", isAnswer: true, explanation: "6 × 3 = 18이에요." }, { id: "25", text: "25", isAnswer: false, explanation: "25는 6의 단에 없어요." }, { id: "30", text: "30", isAnswer: true, explanation: "6 × 5 = 30이에요." }, { id: "35", text: "35", isAnswer: false, explanation: "35는 6의 단에 없어요." }], "맞아요! 12, 18, 30은 6의 단이에요.") },
    { speaker: "보스", text: "나는 신호등 터널 대장 반디! 3개씩과 6개씩 묶인 통과 신호를 정확히 읽으면 터널 신호를 켜 주겠다." },
  ] },
  { id: 3, title: "레일 돌림마당", shortTitle: "4단 · 8단", concept: "4씩과 8씩 묶어 세며 단을 연결하기", mission: "세 번째 출발 시험을 통과하세요.", bossName: "레일 돌림 대장 도리", bossTitle: "레일 돌림마당 대장", bossShortName: "도리", color: "#ff8b45", background: "/story-backgrounds/stage-3-rail-turntable-v1.webp", bossImage: "/characters/boss-stage-3-dori-v1.webp", artDirection: "도심 고가 철도 위의 둥근 레일 돌림판. 4칸·8칸 표시와 튼튼한 전환 장치, 활기찬 레일 대장.", clearMessage: "도리 대장이 세 번째 출발 도장을 찍어 주었습니다!", nextHook: "열차는 별빛 시간표길로 향합니다.", dialogue: [
    { speaker: "주인공", text: "회전판이 다음 선로에 맞춰지지 않아. 4칸·8칸짜리 레일 조각을 몇 묶음 써야 할지 알아보자." },
    { speaker: "셈빛", text: "세 번째 시험은 4단과 8단이에요. 레일 조각 한 묶음의 칸 수와 묶음 수를 곱해 회전판 선로를 맞춰 봐요." },
    { speaker: "셈빛", text: "4단은 4, 8, 12…이고 8단은 8, 16, 24…예요." },
    { speaker: "셈빛", text: "4칸짜리 레일 조각이 6묶음이면 알맞은 식은 무엇일까요?", choices: choice("4 × 6 = 24", ["4 × 5 = 20", "6 × 5 = 30", "4 × 6 = 20"], "맞아요! 4칸씩 6묶음은 24칸이에요.", "레일 조각 한 묶음의 칸 수와 묶음 수를 다시 확인해 보세요.") },
    { speaker: "셈빛", text: "8칸짜리 레일 조각이 3묶음이면 알맞은 식은 무엇일까요?", choices: choice("8 × 3 = 24", ["8 × 2 = 16", "3 × 8 = 16", "8 × 3 = 16"], "맞아요! 8칸씩 3묶음은 24칸이에요.", "레일 조각 한 묶음의 칸 수와 묶음 수를 다시 확인해 보세요.") },
    { speaker: "보스", text: "나는 레일 돌림 대장 도리! 4칸·8칸 레일 조각의 묶음 수를 정확히 세면 회전판의 다음 선로를 열어 주겠다." },
  ] },
  { id: 4, title: "별빛 시간표길", shortTitle: "7단 · 9단", concept: "어려운 7단과 9단을 반복해 익히기", mission: "네 번째 출발 시험을 통과하세요.", bossName: "별빛 시간표 대장 별이", bossTitle: "별빛 시간표길 대장", bossShortName: "별이", color: "#b66dff", background: "/story-backgrounds/stage-4-starlight-railway-v1.webp", bossImage: "/characters/boss-stage-4-byeori-v2.webp", artDirection: "보랏빛 밤하늘을 달리는 고가 철도. 일곱·아홉 개의 빛 점이 있는 시간표와 차분한 밤열차 대장.", clearMessage: "별이 대장이 네 번째 출발 도장을 찍어 주었습니다!", nextHook: "마지막 특급 중앙관제실로 가는 빠른 기차길이 열립니다.", dialogue: [
    { speaker: "주인공", text: "별빛 시간표길에 도착했어. 한 줄에 7개씩·9개씩 켜진 출발 신호를 읽어야 해!" },
    { speaker: "셈빛", text: "네 번째 시험은 7단과 9단이에요. 한 줄의 신호 수와 줄 수를 곱해 출발 순서를 맞춰 봐요." },
    { speaker: "셈빛", text: "7단은 7, 14, 21…이고 9단은 9, 18, 27…이에요." },
    { speaker: "셈빛", text: "한 줄에 7개씩 켜진 별빛 신호가 4줄이면 알맞은 식은 무엇일까요?", choices: choice("7 × 4 = 28", ["7 × 3 = 21", "4 × 7 = 21", "7 × 4 = 21"], "맞아요! 7개씩 4줄은 28개예요.", "한 줄의 신호 수와 줄 수, 계산 결과를 다시 확인해 보세요.") },
    { speaker: "셈빛", text: "9의 단에 나오는 수를 모두 고르세요.", multiCheck: multiCheck([{ id: "18", text: "18", isAnswer: true, explanation: "9 × 2 = 18이에요." }, { id: "27", text: "27", isAnswer: true, explanation: "9 × 3 = 27이에요." }, { id: "28", text: "28", isAnswer: false, explanation: "28은 9의 단에 없어요." }, { id: "45", text: "45", isAnswer: true, explanation: "9 × 5 = 45예요." }, { id: "49", text: "49", isAnswer: false, explanation: "49는 7 × 7이에요." }], "맞아요! 18, 27, 45는 9의 단이에요.") },
    { speaker: "보스", text: "나는 별빛 시간표 대장 별이! 7개씩·9개씩 표시된 출발 신호를 정확히 읽으면 별빛 노선을 통과시켜 주겠다." },
  ] },
  { id: 5, title: "특급 중앙관제실", shortTitle: "1단 · 0의 곱", concept: "1단과 0의 곱을 알고 곱셈표를 완성하기", mission: "마지막 출발 시험을 통과해 특급을 출발시키세요.", bossName: "구구단 특급 총기관사 마루", bossTitle: "특급 중앙관제실 총기관사", bossShortName: "마루", color: "#635bff", background: "/story-backgrounds/stage-5-central-signal-room-v1.webp", bossImage: "/characters/boss-stage-5-maru-v2.webp", artDirection: "밝은 미래형 특급 중앙관제실. 거대한 빛의 곱셈표와 대형 출발판, 믿음직한 총기관사.", clearMessage: "마루 총기관사가 마지막 출발 도장을 찍었습니다!", nextHook: "구구단 특급이 출발하고 도전의 탑 심화 노선이 열립니다.", dialogue: [
    { speaker: "주인공", text: "드디어 중앙 관제실이야! 출발 허가판에 1단과 0의 곱 칸, 그리고 앞에서 확인한 신호가 남아 있어." },
    { speaker: "셈빛", text: "마지막 시험은 1단과 0의 곱이에요. 이 규칙과 앞에서 배운 구구단 점검 신호를 통과하면 출발 허가판을 완성할 수 있어요." },
    { speaker: "셈빛", text: "1을 곱하면 뒤의 수와 같고, 0을 곱하면 결과는 언제나 0이에요." },
    { speaker: "셈빛", text: "1 × 7의 결과는 무엇일까요?", choices: choice("7", ["0", "1", "8"], "맞아요! 1을 곱하면 뒤의 수와 같아요.", "1을 곱한 결과는 뒤의 수와 같은지 확인해 보세요.") },
    { speaker: "셈빛", text: "결과가 0이 되는 식을 모두 고르세요.", multiCheck: multiCheck([{ id: "0x4", text: "0 × 4", isAnswer: true, explanation: "0 × 4 = 0이에요." }, { id: "0x9", text: "0 × 9", isAnswer: true, explanation: "0 × 9 = 0이에요." }, { id: "1x8", text: "1 × 8", isAnswer: false, explanation: "1 × 8 = 8이에요." }, { id: "0x2", text: "0 × 2", isAnswer: true, explanation: "0 × 2 = 0이에요." }, { id: "2x2", text: "2 × 2", isAnswer: false, explanation: "2 × 2 = 4예요." }], "훌륭해요! 0을 곱한 결과는 언제나 0이에요.") },
    { speaker: "보스", text: "나는 구구단 특급 총기관사 마루. 허가판의 0·1 규칙과 구구단 점검 신호를 모두 통과하면 특급의 마지막 출발 코드를 열어 주겠다." },
  ] },
];

export type Character = { id: "clover" | "toto" | "pin"; name: string; role: string; image: string; physicalDefense: number; magicDefense: number };
export const characters: Character[] = [
  { id: "clover", name: "하루", role: "힘센 탐험가 · 물리 방어 4", image: "/characters/haru-express-v2.webp", physicalDefense: 4, magicDefense: 0 },
  { id: "toto", name: "두리", role: "든든한 탐험가 · 물리·마법 방어 2", image: "/characters/duri-express-v2.webp", physicalDefense: 2, magicDefense: 2 },
  { id: "pin", name: "세나", role: "마법 탐험가 · 마법 방어 4", image: "/characters/sena-express-v1.webp", physicalDefense: 0, magicDefense: 4 },
];
