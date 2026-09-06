import { describe, expect, it } from 'vitest';
import { BUILDS } from '../src/sim/builds.ts';
import { parseLoadout } from '../src/sim/loadout.ts';
import { UPGRADES } from '../src/sim/upgrades.ts';

/**
 * The six boards `npm run campaign` measures, checked for the one thing that
 * cannot be seen by running them.
 *
 * `control` used to name eight capstones belonging to other towers -- a Norah
 * asked for Barbara's Big Batch, a Pete for Walter's Stone Wall -- and nothing
 * failed, because `costOf` in campaign.ts only prices an entry the purse
 * actually reaches and `control` bought 26 of its 80 entries. The mistake was
 * therefore hidden precisely *because* the build was the weakest one: make it
 * richer, or make the economy kinder, and the harness starts throwing
 * mid-campaign instead of reporting.
 *
 * These tests read the plans rather than playing them, so a plan is wrong when
 * it is written rather than on whichever round a purse first gets that far.
 */
describe('the measured builds', () => {
  it('has builds to check, so an empty list cannot pass this suite silently', () => {
    expect(BUILDS.length).toBeGreaterThan(1);
  });

  it('writes every plan in a grammar the harnesses can read back', () => {
    for (const b of BUILDS) {
      expect(() => parseLoadout(b.loadout), `${b.name}`).not.toThrow();
      expect(parseLoadout(b.loadout).length, `${b.name} is empty`).toBeGreaterThan(0);
    }
  });

  it('only ever asks a tower for a capstone that tower actually has', () => {
    for (const b of BUILDS) {
      for (const p of parseLoadout(b.loadout)) {
        if (!p.capstone) continue;
        const known = UPGRADES[p.def].capstones.map((c) => c.id);
        expect(known, `${b.name}: ${p.def}@${p.col},${p.row} asks for "${p.capstone}"`).toContain(
          p.capstone,
        );
      }
    }
  });

  it('finishes both paths before it pays for a capstone', () => {
    // A capstone is only purchasable at a2b2 -- see `purchaseUpgrade`. An
    // entry that asks for one earlier would be refused by the sim and abort
    // the campaign, which is the same class of mistake as the one above.
    for (const b of BUILDS) {
      for (const p of parseLoadout(b.loadout)) {
        if (!p.capstone) continue;
        expect(
          [p.upgradeA, p.upgradeB],
          `${b.name}: ${p.def}@${p.col},${p.row} buys "${p.capstone}" before both paths are maxed`,
        ).toEqual([2, 2]);
      }
    }
  });
});
