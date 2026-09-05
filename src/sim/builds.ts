import { nearestCell } from './path.ts';
import type { TowerId } from './types.ts';

/**
 * Six boards a player might actually build, written as spending plans.
 *
 * The question this project keeps asking is not "is the game winnable" but
 * "does more than one build win", and that cannot be answered by a single
 * board. Each entry here is one *shape* the tower set offers -- volume of
 * small hits, few big ones, splash at the corners, holding without killing,
 * a rate buff feeding two hot guns, and the ordinary mixture a new player
 * makes. If four of these six can finish a run, placement and composition are
 * doing the work. If only one can, something is dominant and the numbers are
 * wrong.
 *
 * A build is an *ordered* plan, not a finished board: the campaign harness
 * walks it front to back and buys the next entry when the purse allows, so
 * the order is the player's decision about what to own first. Repeating a
 * cell with a bigger suffix is how a plan says "come back and upgrade this".
 *
 * They are stored as loadout strings rather than as objects because the rule
 * in `loadout.ts` cuts both ways: if a build cannot be typed at the command
 * line, it cannot be reproduced by hand, and a measurement nobody can
 * reproduce is a rumour.
 */

/** Where along the 2120px street each build wants its towers. */
interface Slot {
  def: TowerId;
  /** Distance along the lane, in the same units as `Enemy.dist`. */
  at: number;
}

/** One purchase: a slot, and how upgraded it should be once this step is paid. */
interface Step {
  slot: number;
  a?: 1 | 2;
  b?: 1 | 2;
  capstone?: string;
}

interface BuildSpec {
  blurb: string;
  slots: Slot[];
  order: Step[];
}

/** Resolve a build's slots to real cells, then write it in loadout grammar. */
function render(spec: BuildSpec): string {
  const taken: { col: number; row: number }[] = [];
  const cells = spec.slots.map((s) => {
    const cell = nearestCell(s.at, s.def === 'walter' ? 'blocker' : 'build', taken);
    taken.push(cell);
    return cell;
  });
  return spec.order
    .map((step) => {
      const slot = spec.slots[step.slot];
      const cell = cells[step.slot];
      if (!slot || !cell) throw new Error(`build references missing slot ${step.slot}`);
      const bits =
        (step.a ? `a${step.a}` : '') +
        (step.b ? `b${step.b}` : '') +
        (step.capstone ? `:${step.capstone}` : '');
      return `${slot.def}@${cell.col},${cell.row}${bits ? `+${bits}` : ''}`;
    })
    .join(' ');
}

/** Place every slot in order, then walk back over them upgrading tier by tier. */
function placeThenUpgrade(slots: Slot[], capstones: (string | null)[]): Step[] {
  const order: Step[] = slots.map((_, slot) => ({ slot }));
  for (const tier of [1, 2] as const) {
    for (let slot = 0; slot < slots.length; slot++) {
      order.push({ slot, a: tier });
      order.push({ slot, a: tier, b: tier });
    }
  }
  capstones.forEach((cap, slot) => {
    if (cap) order.push({ slot, a: 2, b: 2, capstone: cap });
  });
  return order;
}

const SPECS: Record<string, BuildSpec> = {
  /** Nine cheap knitters. Lots of small hits, which armour eats. */
  swarm: (() => {
    const slots: Slot[] = [260, 520, 700, 900, 1100, 1300, 1500, 1700, 1900].map((at) => ({
      def: 'norah' as TowerId,
      at,
    }));
    return {
      blurb: 'nine knitters, volume over size',
      slots,
      order: placeThenUpgrade(slots, [
        'tripleKnit',
        null,
        'tripleKnit',
        null,
        'tripleKnit',
        null,
        'tripleKnit',
        null,
        'tripleKnit',
      ]),
    };
  })(),

  /** Three binoculars covering the whole street. Few, enormous hits. */
  sniper: (() => {
    const slots: Slot[] = [
      { def: 'bill', at: 420 },
      { def: 'norah', at: 260 },
      { def: 'bill', at: 1080 },
      { def: 'norah', at: 1400 },
      { def: 'bill', at: 1780 },
      { def: 'clara', at: 1100 },
    ];
    return {
      blurb: 'three binoculars, one coffee, two knitters to hold the gaps',
      slots,
      order: placeThenUpgrade(slots, [
        'piercingShot',
        null,
        'piercingShot',
        null,
        'deadeye',
        'doubleEspresso',
      ]),
    };
  })(),

  /** Cinnamon rolls at the bends, where a crowd bunches up. */
  area: (() => {
    const slots: Slot[] = [
      { def: 'barbara', at: 240 },
      { def: 'barbara', at: 480 },
      { def: 'norah', at: 700 },
      { def: 'barbara', at: 1000 },
      { def: 'barbara', at: 1600 },
      { def: 'norah', at: 1840 },
    ];
    return {
      blurb: 'cinnamon rolls at the four hairpins',
      slots,
      order: placeThenUpgrade(slots, [
        'bigBatch',
        'freshBatch',
        null,
        'bigBatch',
        'freshBatch',
        null,
      ]),
    };
  })(),

  /** Stun and blockades. Buys time rather than dealing damage. */
  control: (() => {
    const slots: Slot[] = [
      { def: 'pete', at: 300 },
      { def: 'walter', at: 420 },
      { def: 'norah', at: 560 },
      { def: 'pete', at: 1000 },
      { def: 'walter', at: 1180 },
      { def: 'pete', at: 1600 },
      { def: 'walter', at: 1720 },
      { def: 'norah', at: 1500 },
    ];
    return {
      blurb: 'megaphones and garden walls, holding rather than killing',
      slots,
      order: placeThenUpgrade(slots, [
        'megaphone',
        'stoneWall',
        null,
        'bullhorn',
        'rally',
        'megaphone',
        'stoneWall',
        null,
      ]),
    };
  })(),

  /** Coffee stacked on a small number of guns run very hot. */
  support: (() => {
    const slots: Slot[] = [
      { def: 'norah', at: 320 },
      { def: 'clara', at: 380 },
      { def: 'norah', at: 1020 },
      { def: 'clara', at: 1080 },
      { def: 'bill', at: 1140 },
      { def: 'clara', at: 1200 },
      { def: 'norah', at: 1700 },
    ];
    return {
      blurb: 'three coffees, everything nearby firing far too fast',
      slots,
      order: placeThenUpgrade(slots, [
        'tripleKnit',
        'doubleEspresso',
        'tripleKnit',
        'doubleEspresso',
        'deadeye',
        'secondRound',
        null,
      ]),
    };
  })(),

  /** One of most things: the board a first-time player ends up with. */
  mixed: (() => {
    const slots: Slot[] = [
      { def: 'norah', at: 260 },
      { def: 'barbara', at: 480 },
      { def: 'walter', at: 700 },
      { def: 'bill', at: 1000 },
      { def: 'pete', at: 1300 },
      { def: 'clara', at: 1360 },
      { def: 'norah', at: 1800 },
    ];
    return {
      blurb: 'one of most things, the obvious first board',
      slots,
      order: placeThenUpgrade(slots, [
        'tripleKnit',
        'bigBatch',
        'stoneWall',
        'deadeye',
        'megaphone',
        'doubleEspresso',
        'tripleKnit',
      ]),
    };
  })(),
};

export interface Build {
  name: string;
  blurb: string;
  /** The plan, in the grammar `parseLoadout` reads. */
  loadout: string;
}

export const BUILDS: Build[] = Object.entries(SPECS).map(([name, spec]) => ({
  name,
  blurb: spec.blurb,
  loadout: render(spec),
}));

export const BUILD_NAMES: string[] = BUILDS.map((b) => b.name);

export function buildNamed(name: string): Build {
  const found = BUILDS.find((b) => b.name === name);
  if (!found) throw new Error(`no build "${name}" -- known: ${BUILD_NAMES.join(', ')}`);
  return found;
}
