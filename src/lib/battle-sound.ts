export type BattleSound = "correct" | "wrong" | "physical" | "magic" | "guard" | "dodge" | "enemy" | "stance" | "confusion";

let sharedContext: AudioContext | null = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new AudioContextClass();
  return sharedContext;
}

/** 효과음은 보조 기능이므로, 모바일 브라우저가 재생을 제한해도 전투 진행을 막지 않는다. */
export function playBattleSound(kind: BattleSound) {
  if (typeof window === "undefined") return;

  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const settings: Record<BattleSound, [OscillatorType, number, number, number]> = {
      correct: ["triangle", 620, 880, 0.16], wrong: ["square", 180, 100, 0.22],
      physical: ["sawtooth", 180, 90, 0.12], magic: ["sine", 420, 720, 0.18],
      guard: ["triangle", 220, 360, 0.15], dodge: ["sine", 680, 980, 0.14],
      enemy: ["sawtooth", 130, 70, 0.18], stance: ["square", 300, 440, 0.16], confusion: ["square", 480, 190, 0.24],
    };
    const [type, start, end, duration] = settings[kind];
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + duration);
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch {
    // 효과음이 지원되지 않거나 재생이 제한되어도 전투 상태와 시각 효과는 계속 진행한다.
  }
}
