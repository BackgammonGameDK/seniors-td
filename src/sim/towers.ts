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
/**
 * Pixels a shot covers per tick unless its tower says otherwise.
 *
 * Nine is fast enough that for every defender but one the flight is a flourish
 * rather than a delay, which is what lets the rest of the design talk about
 * cooldowns and ignore travel time.
 */
export const DEFAULT_PROJECTILE_SPEED = 9;

/**
 * How far a carrying shot travels after it stops aiming, when its tower does
 * not say otherwise, in pixels.
 *
 * Forty is roughly one queued body behind another, which is what a rifle round
 * that clips a second person should reach and no further.
 */
export const DEFAULT_ROLL_OUT = 40;

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
    // Slow, and measured into being so. A ball that rolls through a queue
    // multiplies its damage by however long the queue is, so the rate is the
    // only place that multiplication can be paid for.
    //
    // It was 84 while the ball arrived instantly, because at 72 she cleared
    // the campaign with 21.7 of 25 points still in hand -- the one thing this
    // project calls a failure outright, since a board that finishes untouched
    // makes every other board a mistake rather than a choice. Giving the ball
    // its real travel time took that back out again: the same 72 now finishes
    // the campaign on 11 points from 78% of seeds, which is where 84 sat
    // before. The rate did not change its mind; the ball started taking a
    // second to get there.
    cooldown: 72,
    splash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    buffRate: 1,
    maxHp: 0,
    // A heavy thing on the ground, at a bit over a third of everyone else's
    // speed. It is the difference between a hit and a roll: at nine the ball
    // arrived before the eye found it, and a ball nobody watches travel is a
    // ball nobody sees go through anyone.
    projectileSpeed: 3.5,
    // The ball keeps rolling. One body behind the first at baseline, which is
    // deliberately no more than Bill's Piercing Shot buys him -- what differs
    // is the scale each grows to. Bill stays one enormous hit that clips a
    // second person; Betty grows into many modest hits down a queue.
    pierce: 1,
    // Her second range, and the one her upgrades are about. The ball holds the
    // heading it was thrown on and lets the street bend away from it, so this
    // is how much garden it crosses after it stops aiming.
    //
    // Deliberately short of a bought one. Ninety is about two cells, a bit
    // over a third of a second at her ball's speed: enough to see the thing
    // roll on and clip somebody standing right behind, and nowhere near
    // enough to sweep a queue. Sweeping a queue is what The Line is for, and a
    // path is only felt if the tower did not mostly have the thing already --
    // at 220 the first tier was a fifth again of what she came with, and the
    // roll she was bought for was one she already had. What either length is
    // worth still depends entirely on where she stands: a line that happens to
    // run along the street is worth several bodies, and one thrown across it
    // is worth the one it was aimed at. The Line buys this and `pierce`
    // together -- see the note on her tree in upgrades.ts for why neither is
    // worth buying alone.
    rollOut: 90,
    // The ball loses its weight through a crowd. Without this a line shot
    // multiplies instead of adding -- six Betties behind a wall shoot the same
    // queue, so each is worth the whole queue again, and the measured result
    // was a campaign cleared without losing a single point.
    //
    // It was 0.55 while the carry was a lookup that mostly found nobody. Now
    // that the ball is dangerous along the whole of its line it finds somebody
    // almost every time -- 22 of 24 balls knocked down two people on round 14,
    // against 1 of 12 on round 1, where the street is nearly empty -- so what
    // it carries has to be worth less.
    pierceFalloff: 0.3,
  },
};
