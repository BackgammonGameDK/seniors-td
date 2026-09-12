import { isBlockerCell, isBuildableCell } from './path.ts';
import { TOWERS } from './towers.ts';
import { TOWER_IDS } from './types.ts';
import type { CapstoneId, Tower, TowerId } from './types.ts';
import { UPGRADES } from './upgrades.ts';
import { placeTower, purchaseUpgrade, towerAt } from './world.ts';
import type { World } from './world.ts';

/**
 * The loadout grammar shared by every harness.
 *
 *   towerId@col,row               e.g. norah@5,4 bill@11,9
 *   towerId@col,row+a2b2:capstone e.g. norah@5,4+a2b2:tripleKnit
 *
 * One parser rather than one per harness, because a grammar that drifts
 * between two harnesses silently measures two different games.
 *
 * The rule this exists to serve: anything that affects balance has to be
 * expressible here. A mechanic that can only be reached by clicking in the
 * browser cannot be measured, and balance that cannot be measured is guessed.
 * The `+a2b2:capstone` suffix is upgrades keeping that promise: any part not
 * bought is simply left out (`+a1` alone is legal), and leaving the whole
 * suffix off is the plain, pre-upgrade placement every existing loadout uses.
 */
export interface Placement {
  def: TowerId;
  col: number;
  row: number;
  /** Tier bought on each path, 0 if the suffix said nothing about it. */
  upgradeA: 0 | 1 | 2;
  upgradeB: 0 | 1 | 2;
  /** Capstone id, or none. */
  capstone: CapstoneId | null;
}

const ENTRY = /^([a-z]+)@(\d+),(\d+)(\+[a-zA-Z0-9:]+)?$/;
const SUFFIX = /^\+(?:a([0-2]))?(?:b([0-2]))?(?::([a-zA-Z]+))?$/;

export function parseLoadout(raw: string): Placement[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[;\s]+/)
    .filter(Boolean)
    .map((entry) => {
      const m = ENTRY.exec(entry.trim());
      if (!m) throw new Error(`bad loadout entry "${entry}" -- expected e.g. norah@6,1`);
      const def = m[1] as TowerId;
      if (!TOWER_IDS.includes(def)) {
        throw new Error(`unknown tower "${def}" -- known: ${TOWER_IDS.join(', ')}`);
      }
      let upgradeA: 0 | 1 | 2 = 0;
      let upgradeB: 0 | 1 | 2 = 0;
      let capstone: CapstoneId | null = null;
      if (m[4]) {
        const s = SUFFIX.exec(m[4]);
        if (!s) {
          throw new Error(`bad upgrade suffix "${m[4]}" -- expected e.g. +a2b2:tripleKnit`);
        }
        if (s[1]) upgradeA = Number(s[1]) as 0 | 1 | 2;
        if (s[2]) upgradeB = Number(s[2]) as 0 | 1 | 2;
        if (s[3]) {
          // Checked here rather than left to `costOf`, which only prices an
          // entry the purse actually reaches -- so a capstone belonging to
          // some other tower would sit unnoticed in a plan until the build
          // got rich enough to buy it, and then throw mid-campaign. The
          // grammar is where a name is either known or it is not.
          // Looked up rather than merely checked, so the id the placement
          // carries away is the tree's own and is typed as one.
          const cap = UPGRADES[def].capstones.find((c) => c.id === s[3]);
          if (!cap) {
            throw new Error(
              `unknown capstone "${s[3]}" for ${def} -- known: ` +
                UPGRADES[def].capstones.map((c) => c.id).join(', '),
            );
          }
          capstone = cap.id;
        }
      }
      return { def, col: Number(m[2]), row: Number(m[3]), upgradeA, upgradeB, capstone };
    });
}

/** How a placement reads back in a report. */
export function describePlacement(p: Placement): string {
  const base = `${p.def}@${p.col},${p.row}`;
  const bits = [
    p.upgradeA > 0 ? `a${p.upgradeA}` : '',
    p.upgradeB > 0 ? `b${p.upgradeB}` : '',
    p.capstone ? `:${p.capstone}` : '',
  ].join('');
  return bits ? `${base}+${bits}` : base;
}

/**
 * Carries out one entry on a world, and returns the tower it describes.
 *
 * An entry is the state of its cell, not a purchase: `norah@3,4+a1` means a
 * Norah on 3,4 with one tier of path A, whether or not she is already
 * standing there. A cell written twice is therefore one tower written down
 * twice -- which is exactly what a board saved with `L` looks like, one entry
 * per purchase, each carrying everything bought on that cell so far.
 *
 * Both harnesses call this rather than keeping a loop each. They used to, and
 * `npm run sim` read a repeated cell as a second tower that failed to place,
 * then handed its upgrades to whichever tower had been built last: 5 of
 * `corner`'s 13 towers, 3 of `binoculars`' 10 and 4 of `wall`'s 15 ended with
 * the wrong upgrades, and nothing said so. That is the drift the header warns
 * about, in what an entry means rather than in how it is spelled.
 *
 * Every purchase must already be affordable -- the campaign prices an entry
 * before carrying it out, and `npm run sim` hands the world a bottomless
 * purse. Anything refused throws, because a plan that cannot be carried out is
 * not the plan being measured.
 */
export function applyPlacement(w: World, p: Placement): Tower {
  let t = towerAt(w, p.col, p.row);
  if (!t) {
    const legal =
      TOWERS[p.def].mode === 'blocker' ? isBlockerCell(p.col, p.row) : isBuildableCell(p.col, p.row);
    if (!legal) throw new Error(`illegal placement ${describePlacement(p)} for ${p.def}`);
    if (!placeTower(w, p.def, p.col, p.row)) {
      throw new Error(`could not place ${describePlacement(p)}`);
    }
    t = w.towers[w.towers.length - 1]!;
  } else if (t.def !== p.def) {
    throw new Error(`plan puts ${p.def} on cell ${p.col},${p.row} already holding ${t.def}`);
  }
  while (t.upgradeA < p.upgradeA) {
    if (!purchaseUpgrade(w, t.id, 'pathA')) throw new Error(`pathA refused for ${p.def}`);
  }
  while (t.upgradeB < p.upgradeB) {
    if (!purchaseUpgrade(w, t.id, 'pathB')) throw new Error(`pathB refused for ${p.def}`);
  }
  if (p.capstone && !t.capstone) {
    if (!purchaseUpgrade(w, t.id, p.capstone)) {
      throw new Error(`capstone ${p.capstone} refused for ${p.def}`);
    }
  }
  return t;
}
