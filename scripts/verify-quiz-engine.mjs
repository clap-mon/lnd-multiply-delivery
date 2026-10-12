import assert from "node:assert/strict";
import { generateStageQuiz, generateTowerQuiz } from "../src/lib/quiz-engine.ts";
import { getTowerFloorConfig } from "../src/lib/tower-config.ts";

const allowedTypes = { 1: new Set([12, 13]), 2: new Set([12, 13]), 3: new Set([12, 13]), 4: new Set([12, 13]), 5: new Set([12, 13]) };
const seenTypes = new Set();
const signatures = new Set();
const groupingSubjects = new Set();
const towerGroupingSubjects = new Set();
const stageFiveReviewDans = new Set();
const stageFiveSpecialTypes = new Set();

for (let sessionIndex = 0; sessionIndex < 100; sessionIndex += 1) {
  let previousPrompt;
  for (let round = 1; round <= 30; round += 1) {
    const quiz = generateStageQuiz(1, round, `stage-one-repeat-${sessionIndex}`, previousPrompt);
    assert.notEqual(quiz.prompt, previousPrompt, "스테이지 1은 직전 라운드와 같은 문제 문구를 반복하면 안 됩니다.");
    previousPrompt = quiz.prompt;
  }
}

const luckyOptionPositions = new Set();
const bombOptionPositions = new Set();
for (let sessionIndex = 0; sessionIndex < 100; sessionIndex += 1) {
  const quiz = generateStageQuiz(1, 1, `option-order-${sessionIndex}`);
  luckyOptionPositions.add(quiz.options.findIndex((option) => option.isLucky));
  bombOptionPositions.add(quiz.options.findIndex((option) => option.isBomb));
}
assert.ok(luckyOptionPositions.size > 1, "럭키 정답 위치는 고정되면 안 됩니다.");
assert.ok(bombOptionPositions.size > 1, "폭탄 오답 위치는 고정되면 안 됩니다.");

for (let stageId = 1; stageId <= 5; stageId += 1) {
  for (let round = 1; round <= 300; round += 1) {
    for (let sessionIndex = 0; sessionIndex < 4; sessionIndex += 1) {
      const quiz = generateStageQuiz(stageId, round, `verify-${round}-${sessionIndex}`);
      assert.equal(quiz.stageId, stageId);
      assert.ok(allowedTypes[stageId].has(quiz.typeId), `스테이지 ${stageId}에 허용되지 않은 유형 ${quiz.typeId}`);
      assert.equal(quiz.options.length, 5);
      assert.doesNotMatch(quiz.prompt, /원래 수와 결과가 같은 식/, "1의 곱 문제는 원래 수와 결과를 중복해 표현하면 안 됩니다.");
      assert.doesNotMatch(quiz.prompt, /1을 곱해도 원래 수와 같은 식/, "1의 곱 문제는 불필요한 '1을'을 붙이지 않습니다.");
      assert.equal(quiz.options.filter((option) => option.isCorrect).length, 3);
      assert.equal(quiz.options.filter((option) => !option.isCorrect).length, 2);
      assert.equal(quiz.options.filter((option) => option.isLucky).length, 1);
      assert.equal(quiz.options.filter((option) => option.isBomb).length, 1);
      assert.equal(quiz.options.find((option) => option.isLucky)?.isCorrect, true);
      assert.equal(quiz.options.find((option) => option.isBomb)?.isCorrect, false);
      assert.equal(new Set(quiz.options.map((option) => option.text)).size, 5);
      assert.match(quiz.prompt, /하나를 고르세요/);
      assert.doesNotMatch(quiz.prompt, /모두 고르세요/);
      assert.ok(quiz.options.every((option) => option.explanation.length > 10));
      assert.ok(quiz.options.filter((option) => !option.isCorrect).every((option) => option.misconception));
      if (stageId === 5 && quiz.typeId === 12) {
        const reviewMatch = quiz.prompt.match(/계산이 맞는 ([2-9])단/);
        if (reviewMatch) stageFiveReviewDans.add(Number(reviewMatch[1]));
        else {
          stageFiveSpecialTypes.add(quiz.typeName);
          const correctTexts = quiz.options.filter((option) => option.isCorrect).map((option) => option.text);
          if (quiz.typeName === "0의 곱") {
            assert.ok(correctTexts.some((text) => /^0 × [1-9]$/.test(text)), "0의 곱에는 0이 앞에 오는 식이 있어야 합니다.");
            assert.ok(correctTexts.some((text) => /^[1-9] × 0$/.test(text)), "0의 곱에는 0이 뒤에 오는 식이 있어야 합니다.");
          }
          if (quiz.typeName === "1의 곱") {
            assert.ok(correctTexts.some((text) => /^1 × [1-9]$/.test(text)), "1의 곱에는 1이 앞에 오는 식이 있어야 합니다.");
            assert.ok(correctTexts.some((text) => /^[1-9] × 1$/.test(text)), "1의 곱에는 1이 뒤에 오는 식이 있어야 합니다.");
            assert.doesNotMatch(quiz.prompt, /뒤의 수/);
          }
        }
      }
      if (quiz.typeId === 13) {
        const promptMatch = quiz.prompt.match(/한 .+에 (\d+)(개|장|송이)씩 든 (.+)가 (\d+)개/);
        assert.ok(promptMatch, "묶음 문제에서 한 묶음 수와 묶음 수를 읽을 수 있어야 합니다.");
        const [, perBox, , subject, boxes] = promptMatch;
        groupingSubjects.add(subject);
        for (const option of quiz.options.filter((item) => !item.isCorrect)) {
          assert.match(option.text, new RegExp(`\\b${perBox}\\b`));
          assert.match(option.text, new RegExp(`\\b${boxes}\\b`));
        }
        assert.ok(quiz.options.every((option) => !option.text.includes("+")), "묶음 문장제 보기는 반복 덧셈만 보고 고를 수 없어야 합니다.");
        assert.ok(quiz.options.every((option) => !option.text.includes("÷")), "일반 스테이지 묶음 문장제는 곱셈구구 범위를 유지해야 합니다.");
        assert.ok(quiz.options.every((option) => option.text.includes("×")), "묶음 문장제의 모든 보기는 곱셈식을 포함해야 합니다.");
      }
      if (stageId < 5 && quiz.typeId === 12) {
        for (const option of quiz.options) {
          const match = option.text.match(/^(\d+) × (\d+) = (\d+)$/);
          assert.ok(match, `스테이지 ${stageId} 계산식 보기 형식이 올바르지 않습니다.`);
          const [, left, right, result] = match;
          assert.equal(Number(left) * Number(right) === Number(result), option.isCorrect, `스테이지 ${stageId} 계산식 정오답이 올바르지 않습니다.`);
        }
      }
      assert.doesNotMatch(JSON.stringify(quiz), /공배수|나눗셈|나누어/);
      seenTypes.add(quiz.typeId);
      signatures.add(`${quiz.stageId}:${quiz.typeId}:${quiz.prompt}:${quiz.options.map((option) => option.text).join("|")}`);
    }
  }
}

for (const typeId of [12, 13]) assert.ok(seenTypes.has(typeId), `캠페인 유형 ${typeId}가 생성되지 않았습니다.`);
assert.ok(groupingSubjects.size >= 25, `묶음 문장제 소재가 다양하지 않습니다: ${[...groupingSubjects].join(", ")}`);
assert.deepEqual([...stageFiveReviewDans].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9], "스테이지 5는 나머지 구구단 계산식도 복습해야 합니다.");
assert.deepEqual([...stageFiveSpecialTypes].sort(), ["0의 곱", "1의 곱"], "스테이지 5는 0과 1의 곱을 주력으로 다뤄야 합니다.");
const towerTypes = new Set();
const targetFloorTypes = new Map([[14, new Set()], [17, new Set()], [18, new Set()], [19, new Set()], [20, new Set()]]);
for (let floor = 1; floor <= 20; floor += 1) {
  for (let round = 1; round <= 100; round += 1) {
    const quiz = generateTowerQuiz(floor, round, `tower-${floor}-${round}`);
    assert.ok([2, 3, 4, 7, 10, 12, 13].includes(quiz.typeId), `도전의 탑 유형 ${quiz.typeId}`);
    assert.equal(quiz.options.filter((option) => option.isCorrect).length, 3);
    assert.doesNotMatch(quiz.prompt, /원래 수와 결과가 같은 식/, "탑의 1의 곱 문제도 원래 수와 결과를 중복해 표현하면 안 됩니다.");
    assert.doesNotMatch(quiz.prompt, /1을 곱해도 원래 수와 같은 식/, "탑의 1의 곱 문제도 불필요한 '1을'을 붙이지 않습니다.");
    if (quiz.typeId === 13) {
      const promptMatch = quiz.prompt.match(/한 .+에 (\d+)(개|장)씩 든 (.+)가 (\d+)개/);
      assert.ok(promptMatch, "도전의 탑 묶음 문장제에서 수량과 소재를 읽을 수 있어야 합니다.");
      towerGroupingSubjects.add(promptMatch[3]);
      assert.ok(quiz.options.every((option) => !option.text.includes("÷")), "도전의 탑 첫 버전은 곱셈식만 사용해야 합니다.");
      assert.ok(quiz.options.every((option) => option.text.includes("×")), "도전의 탑 묶음 문장제의 모든 보기는 곱셈식을 포함해야 합니다.");
    }
    towerTypes.add(quiz.typeId);
    targetFloorTypes.get(floor)?.add(quiz.typeId);
  }
}
for (const typeId of [2, 3, 4, 7, 10, 12, 13]) assert.ok(towerTypes.has(typeId), `도전의 탑 유형 ${typeId}가 생성되지 않았습니다.`);
assert.ok(towerGroupingSubjects.size >= 25, `도전의 탑 문장제 소재가 제한됩니다: ${[...towerGroupingSubjects].join(", ")}`);
assert.deepEqual([...targetFloorTypes.get(14)].sort((a, b) => a - b), [7], "14층은 기준값 비교 문제만 출제해야 합니다.");
assert.deepEqual([...targetFloorTypes.get(17)].sort((a, b) => a - b), [2], "17층은 범위 속 곱셈 결과 찾기 문제만 출제해야 합니다.");
assert.deepEqual([...targetFloorTypes.get(18)].sort((a, b) => a - b), [13], "18층은 묶음과 식 연결 복습 문제만 출제해야 합니다.");
assert.deepEqual([...targetFloorTypes.get(19)].sort((a, b) => a - b), [2, 3, 4, 7, 10, 13], "19층은 모든 핵심 유형을 종합 출제해야 합니다.");
assert.deepEqual([...targetFloorTypes.get(20)].sort((a, b) => a - b), [2, 3, 4, 7, 10, 13], "20층은 모든 핵심 유형을 최종 종합 출제해야 합니다.");
assert.deepEqual([6, 10, 11, 15, 16, 19, 20].map((floor) => getTowerFloorConfig(floor).bossName), ["문지기 피코", "문지기 피코 EX", "중간 대장 크라운", "중간 대장 크라운 EX", "도전의 탑 간부 코어", "도전의 탑 간부 코어 EX", "도전의 탑 지배자 구구"]);
for (let floor = 6; floor <= 20; floor += 1) {
  const config = getTowerFloorConfig(floor);
  assert.ok(config.bossImage.startsWith("/characters/tower-"), `도전의 탑 ${floor}층은 전용 보스 에셋을 사용해야 합니다.`);
  assert.equal(config.placeholderArt, false, `도전의 탑 ${floor}층의 임시 보스 에셋이 남아 있습니다.`);
}
assert.ok(signatures.size > 3_000, `문제 다양성이 부족합니다: ${signatures.size}`);
console.log(`곱셈구구 퀴즈 검증 완료: 6,000문항, 고유 구성 ${signatures.size}개`);
