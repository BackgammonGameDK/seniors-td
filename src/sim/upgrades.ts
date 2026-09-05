import { TOWERS } from './towers.ts';
import type { Tower, TowerDef, TowerId } from './types.ts';

/**
 * The upgrade tree, as flat data -- the same convention `towers.ts` states in
 * its own header: what a tower becomes is a number on a page, not a branch in
 * the firing loop.
 *
 * Every tower gets two independent paths of two tiers each, then, once both
 * paths are maxed, a single expensive fork into two capstones that cannot
 * both be bought. Each `stat` object is the *absolute* value a bought tier
 * sets, not a delta, so folding them is just "apply what was bought, in
 * order" -- see `effectiveDef`.
 */
export interface UpgradeTier {
  cost: number;
  stat: Partial<TowerDef>;
}

export interface CapstoneOption {
  id: string;
  cost: number;
  stat: Partial<TowerDef>;
}

export interface TowerUpgrades {
  pathA: [UpgradeTier, UpgradeTier];
  pathB: [UpgradeTier, UpgradeTier];
  capstones: [CapstoneOption, CapstoneOption];
}

export const UPGRADES: Record<TowerId, TowerUpgrades> = {
  norah: {
    pathA: [
      { cost: 25, stat: { cooldown: 20 } },
      { cost: 40, stat: { cooldown: 15 } },
    ],
    pathB: [
      { cost: 25, stat: { range: 115 } },
      { cost: 40, stat: { range: 140 } },
    ],
    capstones: [
      { id: 'longYarn', cost: 155, stat: { cooldown: 9, range: 175 } },
      { id: 'tripleKnit', cost: 165, stat: { multiShot: 3 } },
    ],
  },
  barbara: {
    pathA: [
      { cost: 35, stat: { splash: 55 } },
      { cost: 55, stat: { splash: 70, slowFactor: 0.45 } },
    ],
    pathB: [
      { cost: 35, stat: { cooldown: 48 } },
      { cost: 55, stat: { cooldown: 40 } },
    ],
    capstones: [
      { id: 'bigBatch', cost: 120, stat: { splash: 95, slowTicks: 150 } },
      { id: 'freshBatch', cost: 100, stat: { cooldown: 28, damage: 13 } },
    ],
  },
  pete: {
    pathA: [
      { cost: 30, stat: { range: 105 } },
      { cost: 50, stat: { range: 125 } },
    ],
    pathB: [
      { cost: 30, stat: { cooldown: 105 } },
      { cost: 50, stat: { cooldown: 85 } },
    ],
    capstones: [
      { id: 'megaphone', cost: 110, stat: { range: 155, stunTicks: 65 } },
      { id: 'bullhorn', cost: 100, stat: { cooldown: 60, stunTicks: 60 } },
    ],
  },
  bill: {
    pathA: [
      { cost: 45, stat: { damage: 58 } },
      { cost: 70, stat: { damage: 74 } },
    ],
    pathB: [
      { cost: 45, stat: { range: 260 } },
      { cost: 70, stat: { range: 300 } },
    ],
    capstones: [
      { id: 'deadeye', cost: 130, stat: { damage: 95, range: 340 } },
      { id: 'piercingShot', cost: 140, stat: { pierce: 1 } },
    ],
  },
  walter: {
    pathA: [
      { cost: 25, stat: { maxHp: 250 } },
      { cost: 40, stat: { maxHp: 330 } },
    ],
    pathB: [
      { cost: 25, stat: { regen: 1.5 } },
      { cost: 40, stat: { regen: 3.5 } },
    ],
    capstones: [
      { id: 'stoneWall', cost: 100, stat: { maxHp: 460 } },
      { id: 'rally', cost: 90, stat: { regen: 6, reviveHpFrac: 0.65 } },
    ],
  },
  clara: {
    pathA: [
      { cost: 30, stat: { buffRate: 1.5 } },
      { cost: 50, stat: { buffRate: 1.7 } },
    ],
    pathB: [
      { cost: 30, stat: { range: 110 } },
      { cost: 50, stat: { range: 130 } },
    ],
    capstones: [
      { id: 'doubleEspresso', cost: 135, stat: { buffRate: 1.8 } },
      { id: 'secondRound', cost: 100, stat: { range: 155, rangeBuffBonus: 0.15 } },
    ],
  },
};

/** Every optional field's no-op value, filled in so nothing downstream reads `undefined`. */
const EXTRAS_DEFAULT = {
  regen: 0,
  reviveDelayTicks: 0,
  reviveHpFrac: 0,
  multiShot: 1,
  pierce: 0,
  rangeBuffBonus: 0,
} satisfies Partial<TowerDef>;

/**
 * A tower's stats with its bought tiers and capstone folded in.
 *
 * Computed on read rather than cached -- the board never holds enough towers
 * for that to matter, and a cache is one more place an upgrade could drift
 * from what actually fired. pathA folds first, then pathB, then the capstone,
 * which is the only ordering that matters since every tier sets an absolute
 * value rather than a delta.
 */
export function effectiveDef(t: Tower): TowerDef {
  const tree = UPGRADES[t.def];
  let def: TowerDef = { ...EXTRAS_DEFAULT, ...TOWERS[t.def] };
  for (const tier of tree.pathA.slice(0, t.upgradeA)) def = { ...def, ...tier.stat };
  for (const tier of tree.pathB.slice(0, t.upgradeB)) def = { ...def, ...tier.stat };
  if (t.capstone) {
    const cap = tree.capstones.find((c) => c.id === t.capstone);
    if (cap) def = { ...def, ...cap.stat };
  }
  return def;
}
