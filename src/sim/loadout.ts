import { TOWER_IDS } from './types.ts';
import type { TowerId } from './types.ts';

/**
 * The loadout grammar shared by every harness.
 *
 *   towerId@col,row     e.g. norah@5,4 bill@11,9
 *
 * One parser rather than one per harness, because a grammar that drifts
 * between two harnesses silently measures two different games.
 *
 * The rule this exists to serve: anything that affects balance has to be
 * expressible here. A mechanic that can only be reached by clicking in the
 * browser cannot be measured, and balance that cannot be measured is guessed.
 * When upgrades arrive they extend this grammar rather than going around it.
 */
export interface Placement {
  def: TowerId;
  col: number;
  row: number;
}

const ENTRY = /^([a-z]+)@(\d+),(\d+)$/;

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
      return { def, col: Number(m[2]), row: Number(m[3]) };
    });
}

/** How a placement reads back in a report. */
export function describePlacement(p: Placement): string {
  return `${p.def}@${p.col},${p.row}`;
}
