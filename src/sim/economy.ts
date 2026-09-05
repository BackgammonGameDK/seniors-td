/**
 * Pension Coins in, Peace & Quiet Points out.
 *
 * Bounties alone would let a bigger round pay for the towers that beat it,
 * which makes wave size useless as a difficulty dial. The round clear bonus is
 * the income that does not scale with how much walked down the street, so it
 * is the dial that actually decides how much board the player owns by the end.
 *
 * That was always the intent, but for a long time the numbers said otherwise:
 * bounties came to about twice the clear bonuses over a campaign, so a round
 * very largely paid for its own answer. Trying to use wave size as the
 * difficulty dial then ran away -- more troublemakers bought more towers,
 * which needed more troublemakers. The clear bonus is now the larger term and
 * bounties are small change, so making a round bigger makes it harder.
 *
 * Lives are 25 rather than 20 for a related reason. A late round can put more
 * than 25 leaks' worth of trouble on the street, so what matters is that a
 * board which handles most of one loses a visible handful of points rather
 * than the whole run -- a bleed the player can see coming and answer.
 */
export const ECONOMY = {
  startGold: 175,
  startLives: 25,
  roundClearBonus: (round: number): number => 34 + round * 4,
} as const;
