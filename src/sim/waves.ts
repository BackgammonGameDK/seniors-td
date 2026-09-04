import type { EnemyId } from './types.ts';

/**
 * The twenty authored rounds.
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
  { groups: [g('sam', 6, 55)], scale: 1 },
  { groups: [g('sam', 10, 45)], scale: 1 },
  // 3-4: the Gang, and the fact that killing something can make two things.
  { groups: [g('sam', 8, 45), g('gang', 1, 120, 300)], scale: 1 },
  { groups: [g('sam', 10, 42), g('gang', 2, 120, 260)], scale: 1 },
  // 5-6: Mike, and armour. A board of only fast weak shots feels this.
  { groups: [g('sam', 6, 50), g('mike', 2, 180, 200)], scale: 1 },
  { groups: [g('sam', 8, 40), g('mike', 3, 150, 180)], scale: 1.05 },
  // 7: Tina, alone enough to see which towers go quiet.
  { groups: [g('sam', 10, 38), g('tina', 1, 200, 330)], scale: 1.05 },
  // 8: Skye, and the first thing a glaze cannot hold. Quiet enough that a
  // player can watch her roll straight through it.
  { groups: [g('sam', 8, 45), g('skye', 2, 200, 320)], scale: 1.1 },
  { groups: [g('mike', 4, 130), g('tina', 2, 200, 280)], scale: 1.1 },
  // 10: Ben, and hits that stop landing.
  { groups: [g('sam', 12, 32), g('ben', 2, 200, 150)], scale: 1.15 },
  {
    groups: [
      g('ben', 2, 220),
      g('mike', 3, 140, 180),
      g('skye', 3, 150, 340),
      g('gang', 2, 140, 430),
    ],
    scale: 1.15,
  },
  { groups: [g('gang', 5, 100), g('tina', 2, 240, 220)], scale: 1.2 },
  { groups: [g('mike', 5, 120), g('ben', 2, 260, 200)], scale: 1.2 },
  // 14: a swarm round, to pay a board that never bought anything with splash.
  { groups: [g('sam', 18, 26), g('gang', 3, 130, 300)], scale: 1.25 },
  { groups: [g('tina', 3, 180), g('ben', 3, 190, 120), g('mike', 3, 160, 260)], scale: 1.3 },
  { groups: [g('gang', 5, 95), g('mike', 3, 150, 240), g('skye', 2, 150, 320)], scale: 1.35 },
  { groups: [g('ben', 3, 200), g('mike', 5, 120, 150), g('tina', 2, 260, 320)], scale: 1.4 },
  { groups: [g('mike', 6, 110), g('gang', 5, 95, 200)], scale: 1.5 },
  {
    groups: [g('sam', 20, 24), g('ben', 3, 200, 160), g('gang', 5, 90, 240), g('tina', 2, 280, 400)],
    scale: 1.6,
  },
  // 20: everyone at once, and the run ends.
  {
    groups: [
      g('mike', 8, 90),
      g('ben', 4, 170, 120),
      g('tina', 3, 200, 200),
      g('gang', 6, 85, 300),
      g('skye', 4, 130, 380),
    ],
    scale: 1.9,
  },
];

export const AUTHORED_ROUNDS = WAVES.length;
