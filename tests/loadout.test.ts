import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../src/sim/builds.ts';
import { applyPlacement, describePlacement, parseLoadout } from '../src/sim/loadout.ts';
import type { Placement } from '../src/sim/loadout.ts';
import { createWorld, towerAt } from '../src/sim/world.ts';

describe('the loadout grammar', () => {
  it('reads a board written as a string', () => {
    expect(parseLoadout('norah@5,4 bill@11,9')).toEqual([
      { def: 'norah', col: 5, row: 4, upgradeA: 0, upgradeB: 0, capstone: null },
      { def: 'bill', col: 11, row: 9, upgradeA: 0, upgradeB: 0, capstone: null },
    ]);
  });

  it('reads a pre-upgraded tower from the +suffix', () => {
    expect(parseLoadout('norah@5,4+a2b2:tripleKnit')).toEqual([
      { def: 'norah', col: 5, row: 4, upgradeA: 2, upgradeB: 2, capstone: 'tripleKnit' },
    ]);
  });

  it('accepts a partial suffix -- one path, or a path with no capstone yet', () => {
    expect(parseLoadout('norah@5,4+a1')).toEqual([
      { def: 'norah', col: 5, row: 4, upgradeA: 1, upgradeB: 0, capstone: null },
    ]);
    expect(parseLoadout('norah@5,4+a2b2')).toEqual([
      { def: 'norah', col: 5, row: 4, upgradeA: 2, upgradeB: 2, capstone: null },
    ]);
  });

  it('rejects a malformed upgrade suffix', () => {
    expect(() => parseLoadout('norah@5,4+a9')).toThrow(/bad upgrade suffix/);
  });

  it('accepts semicolons and stray whitespace, because shells add both', () => {
    expect(parseLoadout('  norah@1,1 ;\n bill@2,2  ')).toHaveLength(2);
  });

  it('is empty for an empty string rather than throwing', () => {
    expect(parseLoadout('   ')).toEqual([]);
  });

  it('names the unknown tower instead of failing quietly', () => {
    expect(() => parseLoadout('norma@1,1')).toThrow(/unknown tower "norma"/);
  });

  it('rejects a malformed entry', () => {
    expect(() => parseLoadout('norah@1')).toThrow(/bad loadout entry/);
  });

  it('round-trips through its own description', () => {
    const one = parseLoadout('barbara@7,3')[0]!;
    expect(describePlacement(one)).toBe('barbara@7,3');
  });
});

describe('carrying out a loadout', () => {
  /** A purse no entry can outspend, as `npm run sim` gives its boards. */
  function rich() {
    const w = createWorld(1);
    w.gold = 1e9;
    return w;
  }

  it('reads a cell written twice as one tower, not as a second one that upgrades the last', () => {
    // The shape `npm run sim` got wrong: a cell repeated after another tower
    // was built. Its tier used to land on norah@7,6, the tower built last.
    const w = rich();
    for (const p of parseLoadout('norah@3,4 norah@7,6 norah@3,4+a1')) applyPlacement(w, p);
    expect(w.towers).toHaveLength(2);
    expect(towerAt(w, 3, 4)!.upgradeA).toBe(1);
    expect(towerAt(w, 7, 6)!.upgradeA).toBe(0);
  });

  it('rebuilds every played board exactly as the last entry for each cell says', () => {
    // A saved board writes a cell once per purchase, so these are the boards
    // that repeat cells the most -- and the ones every measurement is aimed at.
    for (const build of REFERENCE_BUILDS) {
      const plan = parseLoadout(build.loadout);
      const last = new Map<string, Placement>();
      for (const p of plan) last.set(`${p.col},${p.row}`, p);

      const w = rich();
      for (const p of plan) applyPlacement(w, p);

      expect(w.towers, build.name).toHaveLength(last.size);
      for (const t of w.towers) {
        const p = last.get(`${t.col},${t.row}`)!;
        expect(
          { def: t.def, upgradeA: t.upgradeA, upgradeB: t.upgradeB, capstone: t.capstone },
          `${build.name}: ${describePlacement(p)}`,
        ).toEqual({ def: p.def, upgradeA: p.upgradeA, upgradeB: p.upgradeB, capstone: p.capstone });
      }
    }
  });

  it('refuses a plan that puts a different defender on a cell already taken', () => {
    const w = rich();
    applyPlacement(w, parseLoadout('norah@3,4')[0]!);
    expect(() => applyPlacement(w, parseLoadout('barbara@3,4')[0]!)).toThrow(/already holding norah/);
  });
});
