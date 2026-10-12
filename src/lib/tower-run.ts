import type { Character } from "./content.ts";

export type TowerUpgradeId = "max-hp" | "full-heal" | "attack" | "defense";

export type TowerRunState = {
  hp: number;
  maxHp: number;
  attackBonus: number;
  defenseBonus: number;
  gear: number;
  upgrades: TowerUpgradeId[];
};

export const towerShopItems: ReadonlyArray<{ id: TowerUpgradeId; name: string; description: string; icon: string; cost: number }> = [
  { id: "max-hp", name: "튼튼한 객실", description: "최대 HP와 현재 HP가 20 늘어요.", icon: "♥", cost: 6 },
  { id: "full-heal", name: "정비 완료", description: "HP를 최대로 모두 회복해요.", icon: "✚", cost: 5 },
  { id: "attack", name: "출력 강화", description: "모든 직접 공격 피해가 1 늘어요.", icon: "⚔", cost: 6 },
  { id: "defense", name: "방벽 보강", description: "물리·마법 방어가 각각 1 늘어요.", icon: "▣", cost: 5 },
];

export function createTowerRun(): TowerRunState {
  return { hp: 100, maxHp: 100, attackBonus: 0, defenseBonus: 0, gear: 0, upgrades: [] };
}

export function carryTowerHp(run: TowerRunState, hp: number): TowerRunState {
  return { ...run, hp: Math.min(run.maxHp, Math.max(0, hp)) };
}

export function applyTowerUpgrade(run: TowerRunState, upgrade: TowerUpgradeId): TowerRunState {
  if (upgrade === "max-hp") return { ...run, hp: run.hp + 20, maxHp: run.maxHp + 20, upgrades: [...run.upgrades, upgrade] };
  if (upgrade === "full-heal") return { ...run, hp: run.maxHp, upgrades: [...run.upgrades, upgrade] };
  if (upgrade === "attack") return { ...run, attackBonus: run.attackBonus + 1, upgrades: [...run.upgrades, upgrade] };
  return { ...run, defenseBonus: run.defenseBonus + 1, upgrades: [...run.upgrades, upgrade] };
}

export function towerGearReward(floor: number, rng: () => number = Math.random) {
  if (floor >= 20) return 0;
  const base = isTowerUpgradeFloor(floor) ? 2 : 1;
  return base + (rng() < 0.25 ? 1 : 0);
}

export function addTowerGear(run: TowerRunState, amount: number): TowerRunState {
  return { ...run, gear: run.gear + Math.max(0, Math.floor(amount)) };
}

export function buyTowerShopItem(run: TowerRunState, itemId: TowerUpgradeId): TowerRunState | null {
  const item = towerShopItems.find((candidate) => candidate.id === itemId);
  if (!item || run.gear < item.cost) return null;
  return { ...applyTowerUpgrade(run, item.id), gear: run.gear - item.cost };
}

export function getTowerShopRecommendation(itemId: TowerUpgradeId) {
  if (itemId === "max-hp") return "HP가 넉넉할 때 다음 구간을 대비해요.";
  if (itemId === "full-heal") return "HP가 절반 이하일 때 추천해요.";
  if (itemId === "attack") return "공격 카드로 빠르게 끝내고 싶을 때 좋아요.";
  return "다음 구간의 피해를 줄이고 싶을 때 좋아요.";
}

export function getTowerCharacterProfile(character: Character): Character {
  if (character.id === "clover") return { ...character, magicDefense: character.magicDefense + 1 };
  if (character.id === "pin") return { ...character, physicalDefense: character.physicalDefense + 1 };
  return character;
}

export function getTowerCharacterProfileDescription(character: Character) {
  if (character.id === "clover") return "탑 적응 · 마법 방어 +1";
  if (character.id === "toto") return "탑 적응 · 균형 방어";
  if (character.id === "pin") return "탑 적응 · 물리 방어 +1";
  return "탑 적응 · 균형 방어";
}

export function towerWrongAnswerDamage(floor: number) {
  return Math.min(5, Math.max(2, Math.ceil(floor / 5) + 1));
}

export function towerBossHp(floor: number) {
  return 26 + floor * 2 + Math.floor(floor / 5) * 2;
}

export function towerEnemyDamage(floor: number) {
  return 3 + Math.floor((floor - 1) / 5);
}

export function isTowerUpgradeFloor(floor: number) {
  return [5, 10, 15, 19].includes(floor);
}
