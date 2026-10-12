import type { StageId } from "./content.ts";
import { getTowerFloorConfig } from "./tower-config.ts";

export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type QuizOption = { id: string; text: string; isCorrect: boolean; isLucky: boolean; isBomb: boolean; explanation: string; misconception?: string };
export type QuizTypeId = 1 | 2 | 3 | 4 | 6 | 7 | 9 | 10 | 11 | 12 | 13;
export type Quiz = { id: string; stageId: StageId; typeId: QuizTypeId; typeName: string; luckyRule: string; prompt: string; difficulty: Difficulty; options: QuizOption[] };

type Gugudan = { a: number; b: number; result: number; text: string };
type QuizRow = Omit<QuizOption, "id" | "isLucky" | "isBomb"> & { lucky?: boolean; bomb?: boolean };
type QuizDraft = Omit<Quiz, "id" | "stageId" | "options"> & { rows: QuizRow[] };

const gugudanPool: Gugudan[] = Array.from({ length: 8 }, (_, aIndex) => Array.from({ length: 9 }, (_, bIndex) => {
  const a = aIndex + 2;
  const b = bIndex + 1;
  return { a, b, result: a * b, text: `${a} × ${b}` };
})).flat();

const campaignDans: Record<StageId, readonly number[]> = { 1: [2, 5], 2: [3, 6], 3: [4, 8], 4: [7, 9], 5: [0, 1] };
const challengeTypeIds: readonly Exclude<QuizTypeId, 12>[] = [2, 3, 4, 7, 10, 13];

export function makePrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

export function seedForQuiz(stageId: StageId, round: number, session = "multiply-v1"): number {
  let hash = 2166136261;
  for (const char of `${session}:${stageId}:${round}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function int(rng: () => number, min: number, max: number) { return Math.floor(rng() * (max - min + 1)) + min; }
function pick<T>(rng: () => number, values: readonly T[]): T { return values[int(rng, 0, values.length - 1)]; }
function shuffle<T>(rng: () => number, values: readonly T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) { const swapIndex = int(rng, 0, index); [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]; }
  return copy;
}
function take<T>(rng: () => number, values: readonly T[], count: number) { return shuffle(rng, values).slice(0, count); }
function digitSum(value: number) { return String(value).split("").reduce((sum, digit) => sum + Number(digit), 0); }
function expressionRow(expression: Gugudan, isCorrect: boolean, explanation: string, misconception?: string): QuizRow { return { text: expression.text, isCorrect, explanation, misconception }; }

function finalize(stageId: StageId, round: number, draft: QuizDraft, rng: () => number): Quiz {
  const correct = draft.rows.filter((row) => row.isCorrect);
  const wrong = draft.rows.filter((row) => !row.isCorrect);
  if (draft.rows.length !== 5 || correct.length !== 3 || wrong.length !== 2 || new Set(draft.rows.map((row) => row.text)).size !== 5) throw new Error("퀴즈는 서로 다른 보기 5개, 정답 3개, 오답 2개로 구성해야 합니다.");
  if (correct.filter((row) => row.lucky).length !== 1 || wrong.filter((row) => row.bomb).length !== 1) throw new Error("퀴즈에는 럭키 정답 1개와 폭탄 오답 1개가 필요합니다.");
  const options = draft.rows.map((row, index) => ({ id: `s${stageId}-r${round}-o${index}`, text: row.text, isCorrect: row.isCorrect, isLucky: Boolean(row.lucky), isBomb: Boolean(row.bomb), explanation: row.explanation, misconception: row.misconception }));
  return { ...draft, id: `stage-${stageId}-round-${round}`, stageId, options: shuffle(rng, options) };
}

function type1(rng: () => number): QuizDraft {
  const dan = int(rng, 2, 9);
  const answers = take(rng, Array.from({ length: 9 }, (_, index) => dan * (index + 1)), 3).sort((a, b) => a - b);
  const wrongs = take(rng, Array.from({ length: 78 }, (_, index) => index + 4).filter((value) => value % dan !== 0), 2);
  const lucky = Math.max(...answers);
  return { typeId: 1, typeName: "특정 단의 곱", luckyRule: "정답 중 가장 큰 수", difficulty: "EASY", prompt: `다음 중 ${dan}의 단에 나오는 수 하나를 고르세요.`, rows: [
    ...answers.map((value) => ({ text: String(value), isCorrect: true, lucky: value === lucky, explanation: `${dan}씩 뛰어 세면 ${value}에 닿아요.` })),
    ...wrongs.map((value, index) => ({ text: String(value), isCorrect: false, bomb: index === 0, explanation: `${value}은(는) ${dan}씩 뛰어 세어도 나오지 않아요.`, misconception: `${dan}의 단에 없는 수를 골랐어요.` })),
  ] };
}

function type2(rng: () => number): QuizDraft {
  const lower = int(rng, 20, 35);
  const upper = lower + int(rng, 15, 20);
  const answers = take(rng, gugudanPool.filter((item) => item.result >= lower && item.result <= upper), 3);
  const below = gugudanPool.filter((item) => item.result < lower).sort((a, b) => b.result - a.result);
  const above = gugudanPool.filter((item) => item.result > upper).sort((a, b) => a.result - b.result);
  const wrongs = [pick(rng, below.slice(0, 8)), pick(rng, above.slice(0, 8))];
  const middle = (lower + upper) / 2;
  const lucky = [...answers].sort((a, b) => Math.abs(a.result - middle) - Math.abs(b.result - middle))[0];
  return { typeId: 2, typeName: "결과 범위", luckyRule: "범위의 가운데에 가장 가까운 식", difficulty: "NORMAL", prompt: `계산 결과가 ${lower} 이상 ${upper} 이하인 식 하나를 고르세요.`, rows: [
    ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = ${item.result}이므로 ${lower}과 ${upper} 사이예요.`), lucky: item.text === lucky.text })),
    ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}이므로 범위 밖이에요.`, index === 0 ? "결과를 계산한 뒤 범위와 비교해 보세요." : "끝 수를 포함하는지 다시 확인해 보세요."), bomb: index === 0 })),
  ] };
}

function type3(rng: () => number): QuizDraft {
  const target = pick(rng, [12, 16, 18, 24, 36]);
  const answers = take(rng, gugudanPool.filter((item) => item.result === target), 3);
  const wrongs = take(rng, gugudanPool.filter((item) => item.result !== target && Math.abs(item.result - target) <= 6), 2);
  const lucky = [...answers].sort((a, b) => b.a - a.a)[0];
  return { typeId: 3, typeName: "같은 결과가 나오는 식", luckyRule: "첫 번째 수가 가장 큰 식", difficulty: "HARD", prompt: `계산 결과가 ${target}이 되는 곱셈식 하나를 고르세요.`, rows: [
    ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = ${target}이에요.`), lucky: item.text === lucky.text })),
    ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}이므로 ${target}이 아니에요.`, "곱셈 결과를 끝까지 계산해 보세요."), bomb: index === 0 })),
  ] };
}

function type4(rng: () => number): QuizDraft {
  const endDigit = pick(rng, [2, 4, 6, 8]);
  const answers = take(rng, gugudanPool.filter((item) => item.result % 10 === endDigit), 3);
  const wrongs = take(rng, gugudanPool.filter((item) => item.result % 10 !== endDigit), 2);
  const lucky = [...answers].sort((a, b) => b.result - a.result)[0];
  return { typeId: 4, typeName: "일의 자리 규칙", luckyRule: "정답 중 결과가 가장 큰 식", difficulty: "HARD", prompt: `계산 결과의 일의 자리 숫자가 ${endDigit}인 식 하나를 고르세요.`, rows: [
    ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = ${item.result}이고 일의 자리는 ${endDigit}예요.`), lucky: item.text === lucky.text })),
    ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}이므로 일의 자리가 ${endDigit}이 아니에요.`, "계산한 결과의 마지막 숫자를 확인해 보세요."), bomb: index === 0 })),
  ] };
}

function zeroOneQuiz(rng: () => number): QuizDraft {
  const first = int(rng, 2, 9); let second = int(rng, 2, 9); if (second === first) second = second === 9 ? 8 : second + 1;
  const mode = int(rng, 0, 2);
  if (mode === 0) return { typeId: 12, typeName: "0의 곱", luckyRule: "곱하는 수가 더 큰 식", difficulty: "EASY", prompt: "계산 결과가 0이 되는 식 하나를 고르세요.", rows: [
    { text: `0 × ${first}`, isCorrect: true, explanation: `0에 ${first}을(를) 곱하면 0이에요.` },
    { text: `${first} × 0`, isCorrect: true, explanation: `${first}에 0을 곱해도 0이에요.` },
    { text: `0 × ${second}`, isCorrect: true, lucky: true, explanation: `0에 ${second}을(를) 곱하면 0이에요.` },
    { text: `1 × ${first}`, isCorrect: false, bomb: true, explanation: `1에 ${first}을(를) 곱하면 ${first}이에요.`, misconception: "0을 곱한 경우와 1을 곱한 경우를 구분해 보세요." },
    { text: `${second} × 1`, isCorrect: false, explanation: `${second}에 1을 곱하면 ${second}이에요.`, misconception: "0이 곱해진 식인지 확인해 보세요." },
  ] };
  if (mode === 1) return { typeId: 12, typeName: "1의 곱", luckyRule: "곱하는 수가 더 큰 식", difficulty: "EASY", prompt: "곱해도 원래 수와 같은 식 하나를 고르세요.", rows: [
    { text: `${first} × 1 = ${first}`, isCorrect: true, explanation: `${first}에 1을 곱하면 ${first} 그대로예요.` },
    { text: `1 × ${first} = ${first}`, isCorrect: true, explanation: `1에 ${first}을(를) 곱해도 ${first}예요.` },
    { text: `${second} × 1 = ${second}`, isCorrect: true, lucky: true, explanation: `${second}에 1을 곱하면 ${second} 그대로예요.` },
    { text: `${first} × 1 = 1`, isCorrect: false, bomb: true, explanation: `${first}에 1을 곱한 결과는 1이 아니라 ${first}예요.`, misconception: "1을 곱한 뒤 원래 수가 유지되는지 확인해 보세요." },
    { text: `1 × ${second} = ${second + 1}`, isCorrect: false, explanation: `1에 ${second}을(를) 곱한 결과는 ${second}예요.`, misconception: "1을 곱한다고 수가 하나 늘어나지 않아요." },
  ] };
  return { typeId: 12, typeName: "0·1의 곱 비교", luckyRule: "두 수가 더 큰 식", difficulty: "NORMAL", prompt: "알맞게 비교한 식 하나를 고르세요.", rows: [
    { text: `0 × ${first} = ${first} × 0`, isCorrect: true, explanation: `두 식 모두 0을 곱했으므로 결과가 0으로 같아요.` },
    { text: `1 × ${first} = ${first} × 1`, isCorrect: true, explanation: `두 식 모두 결과가 ${first}로 같아요.` },
    { text: `0 × ${second} < 1 × ${first}`, isCorrect: true, lucky: true, explanation: `왼쪽은 0, 오른쪽은 ${first}이므로 왼쪽이 더 작아요.` },
    { text: `0 × ${first} > 1 × ${second}`, isCorrect: false, bomb: true, explanation: `왼쪽은 0, 오른쪽은 ${second}이므로 왼쪽이 더 크지 않아요.`, misconception: "0을 곱한 결과와 1을 곱한 결과를 각각 계산해 보세요." },
    { text: `1 × ${first} = 0 × ${first}`, isCorrect: false, explanation: `왼쪽은 ${first}, 오른쪽은 0이므로 같지 않아요.`, misconception: "0과 1을 곱했을 때의 결과를 비교해 보세요." },
  ] };
}

function type6(rng: () => number): QuizDraft {
  const answers = take(rng, gugudanPool.filter((item) => digitSum(item.result) === 9), 3);
  const wrongs = take(rng, gugudanPool.filter((item) => digitSum(item.result) !== 9 && item.result >= 12), 2);
  const lucky = [...answers].sort((a, b) => b.result - a.result)[0];
  return { typeId: 6, typeName: "자릿수의 합", luckyRule: "정답 중 결과가 가장 큰 식", difficulty: "HARD", prompt: "계산 결과의 각 자리 숫자를 더하면 9가 되는 식 하나를 고르세요.", rows: [
    ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = ${item.result}, ${String(item.result).split("").join(" + ")} = 9예요.`), lucky: item.text === lucky.text })),
    ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}, 각 자리 숫자를 더하면 ${digitSum(item.result)}예요.`, "결과를 계산한 다음 각 자리 숫자를 더해 보세요."), bomb: index === 0 })),
  ] };
}

function type7(rng: () => number): QuizDraft {
  const base = pick(rng, gugudanPool.filter((item) => item.result >= 18 && item.result <= 45));
  const answers = take(rng, gugudanPool.filter((item) => item.result > base.result), 3);
  const wrongs = take(rng, gugudanPool.filter((item) => item.result <= base.result), 2);
  const lucky = [...answers].sort((a, b) => a.result - base.result - (b.result - base.result))[0];
  return { typeId: 7, typeName: "기준값과 크기 비교", luckyRule: "기준값과 차이가 가장 작은 식", difficulty: "NORMAL", prompt: `${base.text}(=${base.result})보다 큰 결과가 나오는 식 하나를 고르세요.`, rows: [
    ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = ${item.result}이고 ${base.result}보다 커요.`), lucky: item.text === lucky.text })),
    ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}이므로 ${base.result}보다 크지 않아요.`, "기준 식의 결과와 나란히 비교해 보세요."), bomb: index === 0 })),
  ] };
}

function type9(rng: () => number): QuizDraft {
  const item = pick(rng, [{ name: "사탕", unit: "개", bundle: 4 }, { name: "연필", unit: "자루", bundle: 3 }, { name: "지우개", unit: "개", bundle: 5 }, { name: "스티커", unit: "장", bundle: 6 }]);
  const answers = [item.bundle * 3, item.bundle * 5, item.bundle * 7];
  const wrongs = [item.bundle * 4 + 1, item.bundle * 6 - 1];
  const lucky = Math.max(...answers);
  return { typeId: 9, typeName: "실생활 묶음 세기", luckyRule: "가장 많은 묶음의 수량", difficulty: "EASY", prompt: `한 묶음에 ${item.bundle}${item.unit}씩 든 ${item.name}을 여러 묶음 샀을 때 가능한 총 개수 하나를 고르세요.`, rows: [
    ...answers.map((value) => ({ text: `${value}${item.unit}`, isCorrect: true, lucky: value === lucky, explanation: `${item.bundle}${item.unit}씩 묶어 세면 ${value}${item.unit}가 될 수 있어요.` })),
    ...wrongs.map((value, index) => ({ text: `${value}${item.unit}`, isCorrect: false, bomb: index === 0, explanation: `${value}${item.unit}는 ${item.bundle}${item.unit}씩 묶으면 남거나 모자라요.`, misconception: "한 묶음의 수만큼씩 늘어나는지 확인해 보세요." })),
  ] };
}

function type10(rng: () => number): QuizDraft {
  const pairs = take(rng, gugudanPool.filter((item) => item.a !== item.b && item.b >= 2), 3);
  const correct = pairs.map((item) => ({ text: `${item.a} × ${item.b} = ${item.b} × ${item.a}`, result: item.result }));
  const wrong = pairs.slice(0, 2).map((item, index) => ({ text: `${item.a} × ${item.b} = ${item.b} × ${item.a + index + 1}` }));
  const lucky = [...correct].sort((a, b) => b.result - a.result)[0];
  return { typeId: 10, typeName: "바꿔 곱하기", luckyRule: "결과가 가장 큰 식", difficulty: "EASY", prompt: "두 수의 순서를 바꿔 곱해도 결과가 같은 식 하나를 고르세요.", rows: [
    ...correct.map((item) => ({ text: item.text, isCorrect: true, lucky: item.text === lucky.text, explanation: `두 수의 순서를 바꿔도 곱은 ${item.result}로 같아요.` })),
    ...wrong.map((item, index) => ({ text: item.text, isCorrect: false, bomb: index === 0, explanation: "등호 양쪽에서 곱하는 수가 달라 결과가 같지 않아요.", misconception: "두 수를 바꿀 때는 숫자만 자리를 바꿔야 해요." })),
  ] };
}

function type11(rng: () => number): QuizDraft {
  const perBox = int(rng, 2, 7);
  let boxes = int(rng, 3, 8);
  if (boxes === perBox) boxes = boxes === 8 ? 7 : boxes + 1;
  const total = perBox * boxes;
  return { typeId: 11, typeName: "그림 묶음-식 연결", luckyRule: "숫자의 순서를 바꾼 식", difficulty: "EASY", prompt: `한 상자에 ${perBox}개씩 든 사탕 상자가 ${boxes}개 있어요. 알맞게 나타낸 것 하나를 고르세요.`, rows: [
    { text: `${perBox} × ${boxes} = ${total}`, isCorrect: true, explanation: `${perBox}개씩 ${boxes}묶음이므로 모두 ${total}개예요.` },
    { text: `${boxes} × ${perBox} = ${total}`, isCorrect: true, lucky: true, explanation: `${boxes} × ${perBox}도 ${total}이므로 같은 수량을 나타내요.` },
    { text: `${perBox} × ${boxes} = ${boxes} × ${perBox} = ${total}`, isCorrect: true, explanation: `곱하는 두 수의 순서를 바꿔도 ${total}으로 같아요.` },
    { text: `${perBox} × ${boxes} = ${total - perBox}`, isCorrect: false, bomb: true, explanation: `${perBox} × ${boxes}의 결과는 ${total}인데 ${total - perBox}로 잘못 계산했어요.`, misconception: "두 수를 찾은 뒤 곱한 결과까지 계산해 보세요." },
    { text: `${boxes} × ${perBox} = ${total + perBox}`, isCorrect: false, explanation: `${boxes} × ${perBox}의 결과도 ${total}인데 ${total + perBox}로 잘못 계산했어요.`, misconception: "곱하는 순서를 바꾸어도 계산 결과를 다시 확인해 보세요." },
  ] };
}

function campaignTableQuiz(stageId: StageId, rng: () => number, danOverride?: number): QuizDraft {
  const dan = danOverride ?? pick(rng, campaignDans[stageId]);
  if (dan === 0) {
    const leading = pick(rng, Array.from({ length: 9 }, (_, index) => ({ a: 0, b: index + 1, result: 0, text: `0 × ${index + 1}` })));
    const trailing = pick(rng, Array.from({ length: 9 }, (_, index) => ({ a: index + 1, b: 0, result: 0, text: `${index + 1} × 0` })));
    const third = pick(rng, [...Array.from({ length: 9 }, (_, index) => ({ a: 0, b: index + 1, result: 0, text: `0 × ${index + 1}` })), ...Array.from({ length: 9 }, (_, index) => ({ a: index + 1, b: 0, result: 0, text: `${index + 1} × 0` }))].filter((item) => item.text !== leading.text && item.text !== trailing.text));
    const answers = [leading, trailing, third];
    const lucky = [...answers].sort((left, right) => Math.max(right.a, right.b) - Math.max(left.a, left.b))[0]!;
    const wrongs = take(rng, gugudanPool.filter((item) => item.result > 0), 2);
    return { typeId: 12, typeName: "0의 곱", luckyRule: "0이 아닌 수가 가장 큰 식", difficulty: "NORMAL", prompt: "계산 결과가 0이 되는 식 하나를 고르세요.", rows: [
      ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = 0이에요. 0을 앞이나 뒤에 곱해도 결과는 0이에요.`), lucky: item.text === lucky.text })),
      ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}이므로 0이 아니에요.`, "0을 곱한 식인지 확인해 보세요."), bomb: index === 0 })),
    ] };
  }
  if (dan === 1) {
    const leading = pick(rng, Array.from({ length: 9 }, (_, index) => ({ a: 1, b: index + 1, result: index + 1, text: `1 × ${index + 1}` })));
    const trailing = pick(rng, Array.from({ length: 9 }, (_, index) => ({ a: index + 1, b: 1, result: index + 1, text: `${index + 1} × 1` })).filter((item) => item.a !== leading.b));
    const third = pick(rng, [...Array.from({ length: 9 }, (_, index) => ({ a: 1, b: index + 1, result: index + 1, text: `1 × ${index + 1}` })), ...Array.from({ length: 9 }, (_, index) => ({ a: index + 1, b: 1, result: index + 1, text: `${index + 1} × 1` }))].filter((item) => item.text !== leading.text && item.text !== trailing.text));
    const answers = [leading, trailing, third];
    const lucky = [...answers].sort((left, right) => right.result - left.result)[0]!;
    const wrongs = take(rng, gugudanPool.filter((item) => item.a !== 1 && item.b !== 1), 2);
    return { typeId: 12, typeName: "1의 곱", luckyRule: "결과가 가장 큰 식", difficulty: "NORMAL", prompt: "곱해도 원래 수와 같은 식 하나를 고르세요.", rows: [
      ...answers.map((item) => ({ ...expressionRow(item, true, `${item.text} = ${item.result}이에요. 1을 앞이나 뒤에 곱해도 원래 수와 같아요.`), lucky: item.text === lucky.text })),
      ...wrongs.map((item, index) => ({ ...expressionRow(item, false, `${item.text} = ${item.result}이에요. 1을 곱한 식이 아니에요.`, "1을 앞이나 뒤에 곱한 식인지 확인해 보세요."), bomb: index === 0 })),
    ] };
  }
  const answers = take(rng, Array.from({ length: 9 }, (_, index) => ({ a: dan, b: index + 1, result: dan * (index + 1), text: `${dan} × ${index + 1}` })), 3);
  const answerBs = new Set(answers.map((item) => item.b));
  const wrongs = take(rng, Array.from({ length: 9 }, (_, index) => index + 1).filter((b) => !answerBs.has(b)), 2).map((b) => ({ b, wrongResult: dan * (b === 9 ? b - 1 : b + 1) }));
  const lucky = Math.max(...answers.map((item) => item.result));
  return { typeId: 12, typeName: `${dan}단 계산하기`, luckyRule: "결과가 가장 큰 식", difficulty: stageId <= 2 ? "EASY" : "NORMAL", prompt: `다음 중 계산이 맞는 ${dan}단 식 하나를 고르세요.`, rows: [
    ...answers.map((item) => ({ text: `${item.text} = ${item.result}`, isCorrect: true, lucky: item.result === lucky, explanation: `${item.text} = ${item.result}이에요.` })),
    ...wrongs.map((item, index) => ({ text: `${dan} × ${item.b} = ${item.wrongResult}`, isCorrect: false, bomb: index === 0, explanation: `${dan} × ${item.b}의 결과는 ${dan * item.b}예요.`, misconception: `${dan}을 ${item.b}번 더해 계산 결과를 확인해 보세요.` })),
  ] };
}

type GroupingScene = { container: string; item: string; unit: "개" | "장" };

const groupingScenes: Record<StageId, GroupingScene[]> = {
  1: [
    { container: "상자", item: "화물", unit: "개" },
    { container: "상자", item: "소포", unit: "개" },
    { container: "상자", item: "탐험 장비", unit: "개" },
    { container: "상자", item: "화물 봉인표", unit: "개" },
    { container: "상자", item: "정비 부품", unit: "개" },
  ],
  2: [
    { container: "상자", item: "빛 신호등", unit: "개" },
    { container: "상자", item: "신호 렌즈", unit: "개" },
    { container: "상자", item: "터널 유도등", unit: "개" },
    { container: "상자", item: "안전 표지판", unit: "개" },
    { container: "꾸러미", item: "신호 카드", unit: "장" },
  ],
  3: [
    { container: "상자", item: "레일 연결핀", unit: "개" },
    { container: "상자", item: "전환 레버", unit: "개" },
    { container: "상자", item: "돌림판 안내 표지", unit: "개" },
    { container: "상자", item: "출발 표지판", unit: "개" },
    { container: "상자", item: "레일 조각", unit: "개" },
  ],
  4: [
    { container: "상자", item: "별빛 표식", unit: "개" },
    { container: "상자", item: "시간표 표시등", unit: "개" },
    { container: "상자", item: "밤열차 표지", unit: "개" },
    { container: "상자", item: "별빛 신호등", unit: "개" },
    { container: "꾸러미", item: "시간표 카드", unit: "장" },
  ],
  5: [
    { container: "상자", item: "관제 스위치", unit: "개" },
    { container: "상자", item: "시간표 패널", unit: "개" },
    { container: "상자", item: "출발 신호판", unit: "개" },
    { container: "상자", item: "관제 버튼", unit: "개" },
    { container: "꾸러미", item: "관제 카드", unit: "장" },
  ],
};

const towerGroupingScenes = Object.values(groupingScenes).flat();

function groupingQuiz(choices: readonly number[], scenes: readonly GroupingScene[], rng: () => number, difficulty: QuizDraft["difficulty"]): QuizDraft {
  const perBox = pick(rng, choices);
  let boxes = int(rng, 3, 8);
  if (boxes === perBox) boxes = boxes === 8 ? 7 : boxes + 1;
  const scene = pick(rng, scenes);
  const amount = `${perBox}${scene.unit}`;
  const bundle = `${scene.item} ${scene.container}`;
  const total = perBox * boxes;
  const thirdCorrect = { text: `${total} = ${perBox} × ${boxes}`, isCorrect: true, explanation: `${amount}씩 ${boxes}묶음은 모두 ${total}${scene.unit}예요.` };
  return { typeId: 13, typeName: "묶음과 식 연결", luckyRule: "곱셈식 카드", difficulty, prompt: `한 ${scene.container}에 ${amount}씩 든 ${bundle}가 ${boxes}개 있어요. 알맞게 나타낸 것 하나를 고르세요.`, rows: [
    { text: `${perBox} × ${boxes} = ${total}`, isCorrect: true, explanation: `${amount}씩 ${boxes}묶음은 모두 ${total}${scene.unit}예요.` },
    { text: `${boxes} × ${perBox} = ${total}`, isCorrect: true, lucky: true, explanation: `묶음 수와 한 묶음 수를 바꿔 곱해도 ${total}${scene.unit}예요.` },
    thirdCorrect,
    { text: `${perBox} × ${boxes} = ${total - perBox}`, isCorrect: false, bomb: true, explanation: `${perBox} × ${boxes}의 결과는 ${total}인데 ${total - perBox}로 잘못 계산했어요.`, misconception: "두 수를 찾은 뒤 곱한 결과까지 계산해 보세요." },
    { text: `${boxes} × ${perBox} = ${total + perBox}`, isCorrect: false, explanation: `${boxes} × ${perBox}의 결과도 ${total}인데 ${total + perBox}로 잘못 계산했어요.`, misconception: "곱하는 순서를 바꾸어도 계산 결과를 다시 확인해 보세요." },
  ] };
}

function campaignGroupingQuiz(stageId: StageId, rng: () => number): QuizDraft {
  const choices = stageId === 5 ? [2, 3, 4, 5, 6, 7, 8, 9] : campaignDans[stageId].filter((dan) => dan > 1);
  return groupingQuiz(choices, groupingScenes[stageId], rng, stageId <= 2 ? "EASY" : "NORMAL");
}

const generators: Record<Exclude<QuizTypeId, 12 | 13>, (rng: () => number) => QuizDraft> = { 1: type1, 2: type2, 3: type3, 4: type4, 6: type6, 7: type7, 9: type9, 10: type10, 11: type11 };

function generateQuizOnce(stageId: StageId, round: number, session: string): Quiz {
  const rng = makePrng(seedForQuiz(stageId, round, session));
  const stageFiveRoll = rng();
  const draft = stageId === 5
    ? stageFiveRoll < 0.6
      ? campaignTableQuiz(stageId, rng)
      : stageFiveRoll < 0.8
        ? campaignTableQuiz(stageId, rng, pick(rng, [2, 3, 4, 5, 6, 7, 8, 9]))
        : campaignGroupingQuiz(stageId, rng)
    : rng() < 0.55 ? campaignTableQuiz(stageId, rng) : campaignGroupingQuiz(stageId, rng);
  return finalize(stageId, round, draft, rng);
}
export function generateQuiz(stageId: StageId, round: number, session = "multiply-v1", excludedPrompt?: string): Quiz {
  let quiz = generateQuizOnce(stageId, round, session);
  for (let attempt = 1; excludedPrompt && quiz.prompt === excludedPrompt && attempt <= 8; attempt += 1) {
    quiz = generateQuizOnce(stageId, round, `${session}:retry-${attempt}`);
  }
  return quiz;
}
export function generateStageQuiz(stageId: StageId, round: number, session = "multiply-v1", excludedPrompt?: string): Quiz { return generateQuiz(stageId, round, session, excludedPrompt); }
export function generateTowerQuiz(floor: number, round: number, session = "tower-v1"): Quiz {
  const rng = makePrng(seedForQuiz(5, floor * 100 + round, session));
  const config = getTowerFloorConfig(floor);
  if (config.quizProfile === "campaign") {
    const quiz = generateQuiz(config.combatStageId, round, `${session}:floor-${floor}`);
    return { ...quiz, id: `tower-${floor}-round-${round}` };
  }
  const profiles: Record<Exclude<typeof config.quizProfile, "campaign" | "zero-one">, readonly Exclude<QuizTypeId, 12>[]> = {
    range: [2], compare: [7], "same-result": [3], commutative: [10], "ones-digit": [4], grouping: [13], "compare-mix": [2, 3, 7], "rule-mix": [3, 4, 10], "core-mix": challengeTypeIds,
  };
  let draft: QuizDraft;
  if (config.quizProfile === "zero-one") draft = zeroOneQuiz(rng);
  else {
    const typeId = pick(rng, profiles[config.quizProfile]);
    draft = typeId === 13 ? groupingQuiz([2, 3, 4, 5, 6, 7, 8, 9], towerGroupingScenes, rng, "NORMAL") : generators[typeId](rng);
  }
  const quiz = finalize(5, floor * 100 + round, draft, rng);
  return { ...quiz, id: `tower-${floor}-round-${round}`, difficulty: floor <= 5 ? "EASY" : floor <= 10 ? "NORMAL" : "HARD" };
}
