import { describe, expect, it } from 'vitest';
import { measureBuild } from '../src/campaign.ts';
import { BUILDS, REFERENCE_BUILDS } from '../src/sim/builds.ts';
import { ECONOMY } from '../src/sim/economy.ts';
import { parseLoadout } from '../src/sim/loadout.ts';

/**
 * The balance sweep. Slow on purpose, and excluded from `npm run test:fast`.
 *
 * These are not assertions about whether the game is winnable -- `npm run sim`
 * answers that one round at a time. They are assertions about the *shape* of a
 * campaign, which is the thing that quietly rots when a tower's cost changes
 * and nobody replays twenty-one rounds afterwards. Each one is written to a number
 * that was measured, with enough slack that ordinary drift does not trip it and
 * a real regression does.
 *
 * If one of these fails, re-run `npm run campaign -- --all-builds` and look at
 * the lives curve before changing the threshold. The threshold is the cheap
 * thing to change and almost never the right one.
 */

const SEEDS = 8;
const results = BUILDS.map((b) => measureBuild(b.name, b.blurb, parseLoadout(b.loadout), SEEDS));

/**
 * The played boards, measured on their own at more seeds.
 *
 * These outrank the generated ones. `src/sim/builds.ts` says why at length:
 * six of the boards are spending plans nobody has played, and one round of
 * tuning against them produced a curve that suited `corner` and killed
 * `binoculars` -- a board that had actually won. The assertions below are the
 * standard; the whole-cohort ones further down are a net.
 */
const REFERENCE_SEEDS = 16;
const reference = REFERENCE_BUILDS.map((b) =>
  measureBuild(b.name, b.blurb, parseLoadout(b.loadout), REFERENCE_SEEDS),
);

describe('the boards a person played', () => {
  it('finishes the game', () => {
    // Each of these was played to a win by hand. If one stops clearing, the
    // game changed under a board that used to work, and that is a finding
    // about the change rather than about the board.
    for (const r of reference) {
      expect(r.clearRate, `${r.name} clear rate`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('makes the middle rounds cost something', () => {
    // The assertion this file was missing. Nothing here could see that a board
    // sailed through eleven rounds untouched, because every threshold was
    // about the end. Round 14 rather than round 8 because that is where the
    // two played boards agree today: `binoculars` pays at 12 and 14, `corner`
    // at 12. Tightening this toward round 10 is a real improvement and wants a
    // measurement, not a smaller number.
    for (const r of reference) {
      expect(r.livesCurve[13]!, `${r.name} after round 14`).toBeLessThan(ECONOMY.startLives);
    }
  });

  it('is not finished untouched', () => {
    for (const r of reference) {
      expect(r.avgLivesOnClear, `${r.name} lives left on a clear`).toBeLessThanOrEqual(
        ECONOMY.startLives * 0.72,
      );
    }
  });
});

/**
 * Everything, played and generated alike.
 *
 * A net rather than a target. A generated board going red is a question about
 * the board first -- see the long comment at the top of `src/sim/builds.ts`.
 */
describe('the shape of a campaign', () => {
  it('lets every build learn the game before it asks anything of them', () => {
    // Rounds one to eight are the teaching rounds. No board, however odd,
    // should be most of the way to losing before it has met every troublemaker.
    for (const r of results) {
      const atEight = r.livesCurve[7]!;
      expect(atEight, `${r.name} after round 8`).toBeGreaterThanOrEqual(ECONOMY.startLives * 0.6);
    }
  });

  it('carries every build into the back third', () => {
    // Reaching round ten is the floor for calling a build playable at all. A
    // build that dies before it has bought most of its plan is not being
    // beaten by the rounds, it is being starved, and that is a balance bug.
    for (const r of results) {
      expect(r.avgReached, `${r.name} reached`).toBeGreaterThanOrEqual(10);
    }
  });

  it('is finished by more than one shape of board', () => {
    // The whole reason this project measures anything. One build clearing is
    // not a balanced game, it is a solved one.
    //
    // Was 3 until Coffee Clara's fire-rate buff was nerfed (base 1.35 -> 1.25,
    // path tiers -> 1.35/1.45, Double Espresso -> 1.6): the `support` build
    // (four stacked Claras, src/sim/builds.ts) was carried entirely by that
    // buff and dropped from a 95% clear rate to 0%, which was accepted rather
    // than reworking the build around a weaker Clara.
    const clearing = results.filter((r) => r.clearRate >= 0.5);
    expect(clearing.length, `builds clearing at least half the time: ${clearing.map((r) => r.name).join(', ')}`).toBeGreaterThanOrEqual(2);
  });

  it('does not let any single build run away with it', () => {
    // A build that clears untouched has not been challenged, and its existence
    // makes every other build a mistake rather than a choice.
    for (const r of results) {
      if (r.clearRate === 0) continue;
      expect(r.avgLivesOnClear, `${r.name} lives left on a clear`).toBeLessThanOrEqual(
        ECONOMY.startLives * 0.72,
      );
    }
  });

  it('makes the last rounds the hard ones', () => {
    // The wall belongs at the end. If boards are dying in the middle, the ramp
    // has a spike in it rather than a slope.
    for (const r of results) {
      expect(r.livesCurve[10]!, `${r.name} after round 11`).toBeGreaterThan(r.livesCurve[20]!);
      expect(r.livesCurve[10]!, `${r.name} still alive at round 11`).toBeGreaterThan(0);
    }
  });

  it('spends what it earns', () => {
    // A plan that ends with a full purse was not constrained by money, which
    // means the economy was not part of the game for that build.
    for (const r of results) {
      expect(r.avgPlanBought, `${r.name} bought`).toBeGreaterThan(r.planLength * 0.3);
    }
  });
});
