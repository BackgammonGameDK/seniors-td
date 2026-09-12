import { DEFAULT_PROJECTILE_SPEED, TOWERS } from './towers.ts';
import type { CapstoneId, CapstoneIds, Tower, TowerDef, TowerId } from './types.ts';

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

export interface CapstoneOption<Id extends CapstoneId = CapstoneId> {
  id: Id;
  cost: number;
  stat: Partial<TowerDef>;
}

export interface TowerUpgrades<T extends TowerId = TowerId> {
  pathA: [UpgradeTier, UpgradeTier];
  pathB: [UpgradeTier, UpgradeTier];
  capstones: [CapstoneOption<CapstoneIds[T]>, CapstoneOption<CapstoneIds[T]>];
}

/**
 * Written as a map from tower to its own tree rather than
 * `Record<TowerId, TowerUpgrades>`, so that each entry is checked against the
 * two capstones `CapstoneIds` says that tower has. A capstone written under
 * the wrong tower, or misspelt, is a compile error in the data itself.
 */
export const UPGRADES: { [T in TowerId]: TowerUpgrades<T> } = {
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
      { id: 'megaphone', cost: 110, stat: { range: 155, stunTicks: 36 } },
      // The cooldown must stay clear of the stun it grants, so it can never
      // shout exactly as often as the stun lasts -- see the comment on
      // STUN_FALLOFF in world.ts for what happens when it does. 80 leaves a
      // 44-tick margin on the fresh hit, while still shouting faster than a
      // maxed pathB Pete (85).
      { id: 'bullhorn', cost: 100, stat: { cooldown: 80, stunTicks: 36 } },
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
      { cost: 30, stat: { buffRate: 1.35 } },
      { cost: 50, stat: { buffRate: 1.45 } },
    ],
    pathB: [
      { cost: 30, stat: { range: 110 } },
      { cost: 50, stat: { range: 130 } },
    ],
    capstones: [
      { id: 'doubleEspresso', cost: 135, stat: { buffRate: 1.6 } },
      { id: 'secondRound', cost: 100, stat: { range: 155, rangeBuffBonus: 0.15 } },
    ],
  },
  harold: {
    // Pressure makes him a short-range gun; Wet Road makes him the thing that
    // hands the rest of the board its second go. A Harold built down both is
    // neither, which is the point of the fork existing at all.
    pathA: [
      { cost: 30, stat: { damage: 14 } },
      { cost: 50, stat: { damage: 19 } },
    ],
    pathB: [
      { cost: 30, stat: { slipChance: 0.32 } },
      { cost: 50, stat: { slipChance: 0.45 } },
    ],
    capstones: [
      { id: 'fullMains', cost: 140, stat: { damage: 28, cooldown: 24 } },
      { id: 'soapyWater', cost: 130, stat: { slipChance: 0.75, slipPush: 90 } },
    ],
  },
  betty: {
    // Weight is hers all the way up; The Line is ground and nothing else. The
    // two used to be the same number wearing two hats -- damage is paid once
    // per body, so a tier that bought a body bought damage -- and the fork at
    // the end was two ways of saying "more". Splitting them is what makes the
    // fork a decision: everything before it is how far the ball goes, and the
    // capstone decides what the line is worth when it gets there.
    pathA: [
      { cost: 30, stat: { damage: 22 } },
      { cost: 50, stat: { damage: 27 } },
    ],
    // Distance only. No tier here moves `pierce`, so two people is what a
    // Betty is worth however much road she buys: a longer line finds the
    // second one further away rather than finding a third. Seventy and a
    // hundred and ten against a baseline of thirty, so each step is most of
    // what she had -- and the capstones deliberately leave the length alone,
    // which makes the second tier her longest line.
    pathB: [
      { cost: 30, stat: { rollOut: 70 } },
      { cost: 50, stat: { rollOut: 110 } },
    ],
    // The fork, and the only place the two-person cap is ever discussed.
    //
    // Solid Ball keeps the cap and removes the penalty behind it: two people,
    // both taking the whole hit. The Whole Lot keeps the penalty and removes
    // the cap: everybody the ball touches, each one after the first at three
    // tenths. One is two big hits, the other is many small ones, and neither
    // is a larger version of the other -- which is the point, since what they
    // replaced was 42 damage against five bodies, both of which read as "more
    // damage" to anybody adding it up.
    //
    // Which one wins is a question about the board rather than about the
    // numbers. Solid Ball's gain is certain and arrives on every single ball;
    // The Whole Lot's needs a queue standing in a line to collect, which is
    // what a blockade is for.
    capstones: [
      { id: 'solidBall', cost: 145, stat: { damage: 42, pierceFalloff: 1 } },
      { id: 'theWholeLot', cost: 135, stat: { pierce: Infinity } },
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
  pierceFalloff: 1,
  projectileSpeed: DEFAULT_PROJECTILE_SPEED,
  rangeBuffBonus: 0,
  slipChance: 0,
  slipPush: 0,
} satisfies Partial<TowerDef>;

/**
 * Every fold that has been asked for, kept by the four things it depends on.
 *
 * This function used to say it was computed on read because "the board never
 * holds enough towers for that to matter". A CPU profile of round twenty says
 * otherwise: it was a quarter of all simulation time, being called about seven
 * times a tick from world.ts alone and allocating three or four objects each
 * time. Memoising it took the balance sweep from 22.5s to 6.6s, which is
 * essentially the whole of `npm test`.
 *
 * The other half of that old comment -- that a cache is one more place an
 * upgrade could drift from what actually fired -- is answered by the key
 * rather than dismissed. A fold depends on exactly the tower kind and the
 * three things bought on it, and the key is exactly those four, so there is no
 * state an entry could be stale with respect to. At eight towers and three
 * possible values each it holds at most 216 entries.
 */
const folded = new Map<string, TowerDef>();

/**
 * A tower's stats with its bought tiers and capstone folded in.
 *
 * pathA folds first, then pathB, then the capstone, which is the only ordering
 * that matters since every tier sets an absolute value rather than a delta.
 *
 * The result is shared between every tower with the same upgrades, so it is
 * frozen: all ten callers only read it today, and freezing is what keeps that
 * true rather than leaving it as something to remember.
 */
export function effectiveDef(t: Tower): TowerDef {
  const key = `${t.def}:${t.upgradeA}:${t.upgradeB}:${t.capstone ?? ''}`;
  const hit = folded.get(key);
  if (hit !== undefined) return hit;

  const tree = UPGRADES[t.def];
  let def: TowerDef = { ...EXTRAS_DEFAULT, ...TOWERS[t.def] };
  for (const tier of tree.pathA.slice(0, t.upgradeA)) def = { ...def, ...tier.stat };
  for (const tier of tree.pathB.slice(0, t.upgradeB)) def = { ...def, ...tier.stat };
  if (t.capstone) {
    const cap = tree.capstones.find((c) => c.id === t.capstone);
    if (cap) def = { ...def, ...cap.stat };
  }

  const shared = Object.freeze(def);
  folded.set(key, shared);
  return shared;
}
