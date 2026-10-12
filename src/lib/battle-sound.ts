export type BattleSound = "correct" | "wrong" | "physical" | "magic" | "guard" | "dodge" | "enemy" | "stance" | "confusion";

export function playBattleSound(kind: BattleSound) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const settings: Record<BattleSound, [OscillatorType, number, number, number]> = {
    correct: ["triangle", 620, 880, 0.16], wrong: ["square", 180, 100, 0.22],
    physical: ["sawtooth", 180, 90, 0.12], magic: ["sine", 420, 720, 0.18],
    guard: ["triangle", 220, 360, 0.15], dodge: ["sine", 680, 980, 0.14],
    enemy: ["sawtooth", 130, 70, 0.18], stance: ["square", 300, 440, 0.16], confusion: ["square", 480, 190, 0.24],
  };
  const [type, start, end, duration] = settings[kind];
  oscillator.type = type; oscillator.frequency.setValueAtTime(start, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + duration);
  gain.gain.setValueAtTime(0.06, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
  oscillator.addEventListener("ended", () => context.close());
}
