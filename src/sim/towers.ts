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
    // The empty ground: Barbara saw 105 and Bill saw 225, with nothing
    // between. A hundred and thirty-five narrows that band rather than closing
    // it -- she is still the only one who sees between them -- and it is as
    // far in as she can come while the gap remains the reason she exists. What
    // she gives up in throw she is meant to take back in where the ball goes
    // afterwards, which is the only thing her second path buys.
    range: 135,
    // Slow, and measured into being so. A ball that rolls through a queue
    // multiplies its damage by however long the queue is, so the rate is the
    // only place that multiplication can be paid for -- and it is where the
    // capstone fork was paid for. Solid Ball sends the whole hit through both
    // people, which took one ball from 42 and 13 to 42 and 42, and at 72 the
    // bowling board finished the campaign with 22.5 of 25 points in hand. That
    // is the one thing this project calls a failure outright: a board that
    // finishes untouched makes every other board a mistake rather than a
    // choice. Eighty brings it to 15.4, which is where `corner` and `wall`
    // already sit.
    //
    // Handle this number carefully, because the board falls off a cliff just
    // past it: 76 clears on 19.5 points, 80 on 15.4, and 84 clears only 37% of
    // seeds on 8.3. The two obvious alternatives were measured and are not
    // levers at all -- `pierceFalloff` moved the result by about a point
    // across the whole range 0.15 to 0.3, because what carries the board is
    // Solid Ball rather than the extra bodies, and a dearer capstone mostly
    // delays the rest of the plan behind it.
    //
    // (It was 84 once before, while the ball arrived instantly and 72 cleared
    // the campaign untouched. Giving the ball its real travel time took that
    // back out again. The rate has been the answer both times.)
    cooldown: 80,
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
    // One body behind the first, and nothing she buys moves it except one
    // capstone. Two people is what a Betty is worth all the way up: The Line
    // buys her ground, not bodies, so a longer line finds the second person
    // further away rather than finding a third. The Whole Lot is the single
    // purchase that lifts the cap, and lifting it is the whole of what it is
    // for -- see upgrades.ts.
    pierce: 1,
    // Her second range, and the only thing The Line buys. The ball holds the
    // heading it was thrown on and lets the street bend away from it, so this
    // is how much garden it crosses after it stops aiming.
    //
    // Thirty is under a cell: a ball that carries just past the person it hit
    // and stops. That is deliberate, because a path is only felt if the tower
    // did not mostly have the thing already -- at 220 the first tier was a
    // fifth again of what she came with, and the roll she was bought for was
    // one she already had. From here every step of The Line is most of what
    // she has. What either length is worth still depends entirely on where she
    // stands: a line that happens to run along the street is worth the person
    // standing behind, and one thrown across it is worth only the one it was
    // aimed at.
    rollOut: 30,
    // The ball loses its weight the moment it has been through somebody. One
    // step rather than a slope: the first person takes the whole hit and
    // everybody after takes three tenths of it, not three tenths of whoever
    // was in front of them. Compounding was right while the ball stopped after
    // two people and wrong the moment one capstone let it through everybody --
    // at three tenths of the one before, the fourth person in a line took
    // three percent of a hit, so "through the whole lot" would have been a
    // thing to watch rather than a thing to buy.
    //
    // Without a reduction at all a line shot multiplies instead of adding --
    // six Betties behind a wall shoot the same queue, so each is worth the
    // whole queue again, and the measured result was a campaign cleared
    // without losing a single point. Removing it is therefore a purchase, and
    // Solid Ball is the one that sells it: two people, both taking everything.
    pierceFalloff: 0.3,
  },
};
