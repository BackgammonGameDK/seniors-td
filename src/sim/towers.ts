import type { TowerDef, TowerId } from './types.ts';

/**
 * Tower stats are data, and the data is the whole design.
 *
 * What separates two defenders here is shape, not matchups: how far they see,
 * how often they act, whether the hit lands on one troublemaker or on a
 * cluster, and whether they act at all or make their neighbours better. There
 * is no table that says a tower is strong against one enemy and useless
 * against another.
 *
 * Two of the six never deal damage. That is intentional -- Pete buys time and
 * Clara buys rate, and both are worth gold only in the company of towers that
 * do. A board of nothing but support loses, which is what stops support from
 * being a free purchase.
 */
export const TOWERS: Record<TowerId, TowerDef> = {
  norah: {
    id: 'norah',
    mode: 'projectile',
    cost: 40,
    damage: 7,
    range: 95,
    cooldown: 26,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1,
    maxHp: 0,
  },
  barbara: {
    id: 'barbara',
    mode: 'projectile',
    cost: 75,
    damage: 9,
    range: 105,
    cooldown: 58,
    splash: 42,
    // The glaze. Weak on its own and strong across a crowd, which is the same
    // thing the splash radius says -- Barbara is paid for density.
    slowTicks: 96,
    slowFactor: 0.35,
    stunTicks: 0,
    buffRate: 1,
    maxHp: 0,
  },
  pete: {
    id: 'pete',
    mode: 'pulse',
    cost: 60,
    damage: 0,
    range: 88,
    cooldown: 132,
    // A pulse splashes over its own range; the field is kept for the renderer
    // and for anything that reads a hit radius without knowing the mode.
    splash: 88,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 48,
    buffRate: 1,
    maxHp: 0,
  },
  bill: {
    id: 'bill',
    mode: 'projectile',
    cost: 110,
    damage: 40,
    range: 225,
    cooldown: 110,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1,
    maxHp: 0,
  },
  walter: {
    id: 'walter',
    mode: 'blocker',
    cost: 55,
    damage: 0,
    range: 0,
    cooldown: 0,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1,
    // Lower than it was, to pay for what every Walter now does for free: he
    // gets back up once a round rather than staying down, so his upgrade
    // paths are what widen the gap between a fresh Walter and a built one.
    maxHp: 180,
    // Second Wind. Baseline on every Walter, not a capstone choice -- see
    // world.ts's hitBlocker.
    reviveDelayTicks: 360,
    reviveHpFrac: 0.4,
  },
  clara: {
    id: 'clara',
    mode: 'support',
    cost: 70,
    damage: 0,
    range: 90,
    cooldown: 0,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1.35,
    maxHp: 0,
  },
};
