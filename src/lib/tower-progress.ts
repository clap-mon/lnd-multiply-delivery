const UNLOCK_KEY = "luckypang-lnd-multiply-tower-unlocked";
const HIGH_SCORE_KEY = "luckypang-lnd-multiply-tower-high-score";
const HIGH_FLOOR_KEY = "luckypang-lnd-multiply-tower-high-floor";
const CHECKPOINT_KEY = "luckypang-lnd-multiply-tower-checkpoint";

export type TowerCheckpoint = {
  floor: number;
  score: number;
  characterId: "clover" | "toto" | "pin";
  run: { hp: number; maxHp: number; attackBonus: number; defenseBonus: number; gear: number; upgrades: TowerUpgradeId[] };
};

export type TowerRecord = { unlocked: boolean; highScore: number; highFloor: number };

export function loadTowerRecord(storage: Pick<Storage, "getItem">): TowerRecord {
  return { unlocked: storage.getItem(UNLOCK_KEY) === "true", highScore: Math.max(0, Number(storage.getItem(HIGH_SCORE_KEY)) || 0), highFloor: Math.max(0, Number(storage.getItem(HIGH_FLOOR_KEY)) || 0) };
}
export function unlockTower(storage: Pick<Storage, "setItem">) { storage.setItem(UNLOCK_KEY, "true"); }
export function saveTowerRecord(storage: Pick<Storage, "getItem" | "setItem">, score: number, floor: number) {
  const previous = loadTowerRecord(storage);
  const next = { unlocked: true, highScore: Math.max(previous.highScore, score), highFloor: Math.max(previous.highFloor, floor) };
  storage.setItem(UNLOCK_KEY, "true"); storage.setItem(HIGH_SCORE_KEY, String(next.highScore)); storage.setItem(HIGH_FLOOR_KEY, String(next.highFloor));
  return next;
}
export function loadTowerCheckpoint(storage: Pick<Storage, "getItem">): TowerCheckpoint | null {
  try {
    const saved = JSON.parse(storage.getItem(CHECKPOINT_KEY) ?? "null") as TowerCheckpoint | null;
    if (!saved || !Number.isInteger(saved.floor) || saved.floor < 1 || saved.floor > 20 || !Number.isFinite(saved.score) || !["clover", "toto", "pin"].includes(saved.characterId) || !saved.run) return null;
    const { hp, maxHp, attackBonus, defenseBonus, upgrades } = saved.run;
    const gear = Number.isFinite(saved.run.gear) ? saved.run.gear : 0;
    if (![hp, maxHp, attackBonus, defenseBonus, gear].every(Number.isFinite) || hp < 1 || maxHp < hp || attackBonus < 0 || defenseBonus < 0 || gear < 0 || !Array.isArray(upgrades) || !upgrades.every((upgrade) => ["max-hp", "full-heal", "attack", "defense"].includes(upgrade))) return null;
    // 이전 버전의 상점 대기 기록은 이미 다음 층 번호와 정산된 런 정보를 갖는다.
    // 상점 재개를 없앤 뒤에도 해당 기록을 다음 층 체크포인트로 이어 쓸 수 있다.
    return { floor: saved.floor, score: saved.score, characterId: saved.characterId, run: { ...saved.run, gear } };
  } catch { return null; }
}
export function saveTowerCheckpoint(storage: Pick<Storage, "setItem">, checkpoint: TowerCheckpoint) { storage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint)); }
export function clearTowerCheckpoint(storage: Pick<Storage, "removeItem">) { storage.removeItem(CHECKPOINT_KEY); }
export function clearTowerRecord(storage: Pick<Storage, "removeItem">) { storage.removeItem(UNLOCK_KEY); storage.removeItem(HIGH_SCORE_KEY); storage.removeItem(HIGH_FLOOR_KEY); clearTowerCheckpoint(storage); }
import type { TowerUpgradeId } from "./tower-run.ts";
