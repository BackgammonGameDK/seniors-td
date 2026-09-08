import type { EnemyId } from './types.ts';

/**
 * The twenty-one authored rounds.
 *
 * Composition is the difficulty dial, and it is deliberately not "the same
 * round but more of it". Each new troublemaker arrives in a quiet round of its
 * own before it turns up inside a busy one, so the first time a player meets
 * armour or a shield carrier they can see what it did.
 *
 * `scale` multiplies hit points only. Speed and armour stay where they are, so
 * a late round is tougher without quietly becoming a different game.
 */
export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** Ticks between one arrival and the next within this group. */
  gap: number;
  /** Ticks after the round begins before the first of them appears. */
  delay: number;
}

export interface Wave {
  groups: SpawnGroup[];
  scale: number;
}

const g = (enemy: EnemyId, count: number, gap: number, delay = 60): SpawnGroup => ({
  enemy,
  count,
  gap,
  delay,
});

export const WAVES: Wave[] = [
  // 1-2: just Sam, so the player learns the street before anything else.
  { groups: [g('sam', 8, 91)], scale: 1 },
  { groups: [g('sam', 10, 81)], scale: 1.04 },
  // 3-4: the Gang, and the fact that killing something can make two things.
  { groups: [g('sam', 6, 166), g('gang', 1, 120, 209)], scale: 1.08 },
  { groups: [g('sam', 8, 132), g('gang', 2, 200, 226)], scale: 1.13 },
  // 5-6: Mike, who is slow and armoured, so small hits stop being enough.
  { groups: [g('sam', 7, 170), g('mike', 2, 200, 244)], scale: 1.17 },
  { groups: [g('sam', 9, 140), g('mike', 3, 200, 261)], scale: 1.21 },
  // 7: Tina, who switches off a tower built too close to the kerb.
  { groups: [g('sam', 17, 76), g('tina', 3, 200, 278)], scale: 1.25 },
  // 8: Skye, who is quick and shrugs off most of a slow.
  { groups: [g('sam', 16, 87), g('skye', 3, 200, 295)], scale: 1.29 },
  // 9: armour and interference together, with nothing cheap to soak the guns.
  { groups: [g('mike', 7, 200), g('tina', 4, 200, 313)], scale: 1.34 },
  // 10: Ben, whose shield is armour handed out to everyone standing near him.
  { groups: [g('sam', 25, 63), g('ben', 3, 200, 330)], scale: 1.38 },
  // 11: one of nearly everything, briefly -- a look at the rest of the game.
  {
    groups: [
      g('ben', 3, 200),
      g('mike', 5, 200, 347),
      g('skye', 5, 200, 635),
      g('gang', 3, 200, 922),
    ],
    scale: 1.42,
  },
  // 12: splitting at volume. Every Gang that falls is two more problems.
  { groups: [g('gang', 17, 106), g('tina', 8, 200, 365)], scale: 1.46 },
  // 13: armour behind a shield. The round that asks for real damage per hit.
  { groups: [g('mike', 13, 149), g('ben', 6, 200, 382)], scale: 1.51 },
  // 14: the swarm round. A question about rate of fire, not damage per shot.
  { groups: [g('sam', 63, 30), g('gang', 14, 145, 399)], scale: 1.55 },
  // 15: three awkward things at once, none of them cheap to remove.
  { groups: [g('tina', 15, 141), g('ben', 12, 180, 416), g('mike', 12, 180, 773)], scale: 1.59 },
  // 16: splitters under a shield, with runners threading through them.
  { groups: [g('gang', 19, 115), g('mike', 11, 200, 434), g('skye', 9, 200, 807)], scale: 1.63 },
  // 17: the armour round, with Tinas turning off whatever is handling it.
  { groups: [g('ben', 13, 181), g('mike', 22, 103, 451), g('tina', 10, 200, 842)], scale: 1.67 },
  // 18: Duke, who keeps dropping Runaways for as long as he's up.
  { groups: [g('sam', 14, 110), g('duke', 1, 0, 700)], scale: 1.70 },
  // 19: mass. Mikes and Gangs, arriving for half a minute without a gap.
  { groups: [g('mike', 26, 91), g('gang', 21, 113, 468), g('duke', 1, 0, 1600)], scale: 1.72 },
  // 20: the swarm again, much larger, with everything awkward mixed in.
  {
    groups: [
      g('sam', 88, 27),
      g('ben', 16, 158, 486),
      g('gang', 25, 99, 911),
      g('tina', 12, 200, 1337),
      g('duke', 2, 800, 1900),
    ],
    scale: 1.76,
  },
  // 21: everything, for half a minute. Nothing new -- the last round is the
  // whole game at once rather than a surprise.
  {
    groups: [
      g('mike', 25, 103),
      g('ben', 13, 200, 503),
      g('tina', 10, 200, 946),
      g('gang', 18, 145, 1388),
      g('skye', 13, 200, 1831),
      g('duke', 2, 700, 2400),
    ],
    scale: 1.8,
  },
];

export const AUTHORED_ROUNDS = WAVES.length;

// --- free play --------------------------------------------------------------

/**
 * Rounds after the twenty-first, for a player who wants to carry on.
 *
 * Free play is the score at the end of a won run rather than a second game, so
 * it is meant to end in a loss. That rules out the obvious construction --
 * round twenty-one again with a bigger `scale` -- because hit points are not
 * the lever this game turns. A splash knot at the double-back kills a crowd
 * for a fixed cost no matter how large the crowd or how healthy, so a round
 * that only grows `scale` would never actually arrive. Bodies per second is
 * what gets past a board, so that is what these rounds grow.
 *
 * Each extra round takes one of the three late shapes and inflates it. The
 * three rotate, so consecutive extra rounds are not the same round twice: mass
 * (nineteen), the swarm (twenty), then everything at once (twenty-one).
 *
 * It is a pure function of the round number and uses no randomness, so round
 * thirty is the same round thirty on every seed and a test can assert its
 * shape. That is also what lets `npm run campaign -- --endless` compare one
 * board's free play against another's.
 */
const ENDLESS_THEMES = [18, 19, 20] as const;

/** Growth per extra round, compounded into a single factor rather than per round. */
const ENDLESS_STEP = 0.07;

/**
 * No round is more than four times the shape it grew from.
 *
 * Past this the composition dial has said everything it can, and only `scale`
 * keeps climbing. It is also what keeps a very deep run from putting a
 * thousand sprites on a canvas or running the harness past its tick limit.
 */
const MAX_GROWTH = 4;

/** Ticks between arrivals never falls below this, however dense a round gets. */
const GAP_FLOOR = 12;

/**
 * The spacing to give a group that was authored as a single arrival.
 *
 * Round nineteen sends one Duke with a gap of zero, because the gap between one
 * arrival and nothing means nothing. Once growth turns him into two, they need
 * spacing from somewhere, and round twenty's own pair arrive 800 ticks apart.
 */
const SOLO_GAP = 800;

/** Hit points per extra round, on top of round twenty-one's 1.8. */
const ENDLESS_SCALE_STEP = 0.04;

/**
 * The round at a given index, authored or grown.
 *
 * Below `AUTHORED_ROUNDS` this is exactly `WAVES[index]`. Above it, a free
 * play round -- so callers that must not run past the campaign check the
 * player has opted in, rather than relying on this returning nothing.
 */
export function waveAt(index: number): Wave {
  const authored = WAVES[index];
  if (authored) return authored;

  const n = index - AUTHORED_ROUNDS + 1;
  const theme = WAVES[ENDLESS_THEMES[(n - 1) % ENDLESS_THEMES.length]!]!;
  const f = Math.min(1 + ENDLESS_STEP * n, MAX_GROWTH);

  return {
    groups: theme.groups.map((group) => ({
      enemy: group.enemy,
      count: Math.ceil(group.count * f),
      gap: Math.max(GAP_FLOOR, Math.round((group.gap > 0 ? group.gap : SOLO_GAP) / f)),
      delay: group.delay,
    })),
    scale: WAVES[AUTHORED_ROUNDS - 1]!.scale + ENDLESS_SCALE_STEP * n,
  };
}
