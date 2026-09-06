import { describe, expect, it } from 'vitest';
import { measureBuild } from '../src/campaign.ts';
import { BUILDS } from '../src/sim/builds.ts';
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
