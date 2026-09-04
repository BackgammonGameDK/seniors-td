/**
 * Pension Coins in, Peace & Quiet Points out.
 *
 * Bounties alone would let a bigger round pay for the towers that beat it,
 * which makes wave size useless as a difficulty dial. The round clear bonus is
 * the income that does not scale with how much walked down the street, so it
 * is the dial that actually decides how much board the player owns by the end.
 */
export const ECONOMY = {
  startGold: 120,
  startLives: 20,
  roundClearBonus: (round: number): number => 16 + round * 4,
} as const;
