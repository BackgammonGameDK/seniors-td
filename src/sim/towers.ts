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
 * Two of the eight never deal damage. That is intentional -- Pete buys time
 * and Clara buys rate, and both are worth gold only in the company of towers
 * that do. A board of nothing but support loses, which is what stops support
 * from being a free purchase.
 *
 * Harold and Betty fill the two holes the first six left. Everything cheap
 * saw about 95 px and everything that saw further cost 95 coins, so there was
 * no mid-range purchase to make; Betty is that purchase, and she is paid for a
 * queue the way Barbara is paid for a clump. Harold goes the other way -- he
 * sees less than Norah does -- and is the only defender who sends anyone
 * *backwards*, which is worth gold in proportion to how much street sits
 * behind him.
 */
export const TOWERS: Record<TowerId, TowerDef> = {
  norah: {
    id: 'norah',
    mode: 'projectile',
    cost: 50,
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
    // A shout that does nothing but stun is a tower that can never finish
    // anything, and a board made of them measured as unable to reach round
    // eight -- it stalls the street and then starves, because nothing dies and
    // nothing pays. Five is deliberately small: Pete is still bought for the
    // pause he causes, not the damage, but a crowd standing in his shout now
    // wears down instead of merely waiting.
    damage: 5,
    range: 88,
    cooldown: 132,
    // A pulse splashes over its own range; the field is kept for the renderer
    // and for anything that reads a hit radius without knowing the mode.
    splash: 88,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 24,
    buffRate: 1,
    maxHp: 0,
  },
  bill: {
    id: 'bill',
    mode: 'projectile',
    cost: 95,
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
    buffRate: 1.25,
    maxHp: 0,
  },
  harold: {
    id: 'harold',
    mode: 'projectile',
    cost: 65,
    damage: 10,
    // Shorter than Norah's 95 on purpose. He is the close-in one, and the
    // short sight is what he pays with for an effect no one else has.
    range: 75,
    cooldown: 34,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1,
    maxHp: 0,
    // One hit in five puts them on the floor and slides them back down the
    // street. The value of that is not in the pixels: it is that everything
    // standing behind Harold gets another go at someone it had already lost,
    // so a Harold in front of a gun line is worth more than a Harold alone.
    slipChance: 0.2,
    slipPush: 45,
  },
  betty: {
    id: 'betty',
    mode: 'projectile',
    cost: 75,
    damage: 18,
    // The empty ground: Barbara saw 105 and Bill saw 225, with nothing between.
    range: 155,
    // Slow, and measured into being so. At 72 she cleared the campaign with
    // 21.7 of 25 points still in hand, which is the one thing this project
    // calls a failure outright -- a board that finishes untouched makes every
    // other board a mistake rather than a choice. A ball that rolls through a
    // queue multiplies its damage by however long the queue is, so the rate is
    // the only place that multiplication can be paid for.
    cooldown: 84,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1,
    maxHp: 0,
    // The ball keeps rolling. One body behind the first at baseline, which is
    // deliberately no more than Bill's Piercing Shot buys him -- what differs
    // is the scale each grows to. Bill stays one enormous hit that clips a
    // second person; Betty grows into many modest hits down a queue.
    pierce: 1,
    // The ball loses its weight through a crowd. Without this a line shot
    // multiplies instead of adding -- six Betties behind a wall shoot the same
    // queue, so each is worth the whole queue again, and the measured result
    // was a campaign cleared without losing a single point.
    pierceFalloff: 0.55,
  },
};
