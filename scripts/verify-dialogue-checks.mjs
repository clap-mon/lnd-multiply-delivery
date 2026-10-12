import { shuffleDialogueChoices, stages } from "../src/lib/content.ts";

const dialogueText = stages.flatMap((stage) => stage.dialogue.map((node) => node.text)).join("\n");
for (const outdatedPhrase of ["4칸과 8칸의 거리", "빛 점이 7개와 9개씩 움직이고 있어", "중앙 관제 시간표"]) {
  if (dialogueText.includes(outdatedPhrase)) throw new Error(`시나리오에 이전 표현이 남아 있습니다: ${outdatedPhrase}`);
}
for (const requiredPhrase of ["화물 선로", "터널 신호", "회전판의 다음 선로", "별빛 노선", "출발 허가판", "마지막 출발 코드"]) {
  if (!dialogueText.includes(requiredPhrase)) throw new Error(`캠페인 해결 목표가 대사에 없습니다: ${requiredPhrase}`);
}

const expectedChecks = [
  { stage: 2, answers: ["12", "18", "30"] },
  { stage: 4, answers: ["18", "27", "45"] },
  { stage: 5, answers: ["0x4", "0x9", "0x2"] },
];

const checks = stages.flatMap((stage) => stage.dialogue.filter((node) => node.multiCheck).map((node) => ({ stage: stage.id, check: node.multiCheck })));
if (checks.length !== expectedChecks.length) throw new Error(`다중 선택 확인문제 수가 ${checks.length}개입니다.`);

for (const [index, { stage, check }] of checks.entries()) {
  const expectedCheck = expectedChecks[index];
  if (stage !== expectedCheck.stage) throw new Error(`확인문제 ${index + 1}의 스테이지 구성이 올바르지 않습니다.`);
  const answers = check.options.filter((option) => option.isAnswer).map((option) => option.id).sort();
  const expected = [...expectedCheck.answers].sort();
  if (answers.join(",") !== expected.join(",")) throw new Error(`스테이지 ${stage} 정답 구성이 올바르지 않습니다.`);
  if (check.options.length !== 5 || !check.options.every((option) => option.explanation)) throw new Error(`스테이지 ${stage} 선택지 또는 해설 구성이 부족합니다.`);
  if (!check.instruction.includes("모두") || !check.successFeedback) throw new Error(`스테이지 ${stage} 안내 또는 정답 해설이 없습니다.`);
}

const expectedChoiceCounts = { 1: 2, 2: 1, 3: 2, 4: 1, 5: 1 };
for (const stage of stages) {
  const choices = stage.dialogue.filter((node) => node.choices).map((node) => node.choices ?? []);
  if (choices.length !== expectedChoiceCounts[stage.id]) throw new Error(`스테이지 ${stage.id} 단일 선택 확인문제 수가 올바르지 않습니다.`);
  for (const options of choices) {
    const correctPositions = new Set();
    for (let seed = 1; seed <= 30; seed += 1) {
      let value = seed;
      const shuffled = shuffleDialogueChoices(options, () => { value = (value * 1_103_515_245 + 12_345) >>> 0; return value / 0x1_0000_0000; });
      correctPositions.add(shuffled.findIndex((option) => option.correct));
    }
    if (correctPositions.size !== options.length) throw new Error("시나리오 단일 선택 정답 위치가 모든 보기에 배치되지 않습니다.");
    if (options.length < 4 || options.filter((option) => option.correct).length !== 1) throw new Error(`스테이지 ${stage.id} 단일 선택 보기 구성이 올바르지 않습니다.`);
    if (!options.every((option) => option.feedback)) throw new Error(`스테이지 ${stage.id} 단일 선택 해설이 부족합니다.`);
  }
}

console.log(`시나리오 확인문제 검증 완료: 다중 선택 ${checks.length}개, 단일 선택 7개`);
