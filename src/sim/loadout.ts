import { TOWER_IDS } from './types.ts';
import type { TowerId } from './types.ts';
import { UPGRADES } from './upgrades.ts';

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
  capstone: string | null;
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
      let capstone: string | null = null;
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
          if (!UPGRADES[def].capstones.some((c) => c.id === s[3])) {
            throw new Error(
              `unknown capstone "${s[3]}" for ${def} -- known: ` +
                UPGRADES[def].capstones.map((c) => c.id).join(', '),
            );
          }
          capstone = s[3];
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
