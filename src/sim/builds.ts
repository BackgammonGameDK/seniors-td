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

/**
 * Spend wide and deep by turns: put a tower down, improve the least improved
 * one already standing, repeat, and once the board is full keep improving.
 *
 * Placing everything before upgrading anything is what a plan does when it has
 * no opinion, and it is a bad opinion -- five unimproved binoculars cost more
 * than two good ones and shoot worse. Alternating is roughly what a player
 * does, and more to the point it keeps every build spending steadily instead
 * of running out of plan with a full purse.
 */
function grow(slots: Slot[], capstones: (string | null)[]): Step[] {
  const order: Step[] = [];
  const tiers = slots.map(() => ({ a: 0 as 0 | 1 | 2, b: 0 as 0 | 1 | 2 }));
  const placed: number[] = [];

  const improve = (): boolean => {
    // Least improved first, so no one tower runs away with the whole purse.
    const next = [...placed].sort(
      (x, y) => tiers[x]!.a + tiers[x]!.b - (tiers[y]!.a + tiers[y]!.b) || x - y,
    );
    for (const slot of next) {
      const t = tiers[slot]!;
      if (t.a <= t.b && t.a < 2) t.a = (t.a + 1) as 1 | 2;
      else if (t.b < 2) t.b = (t.b + 1) as 1 | 2;
      else continue;
      order.push({ slot, a: t.a || undefined, b: t.b || undefined });
      return true;
    }
    return false;
  };

  for (let slot = 0; slot < slots.length; slot++) {
    order.push({ slot });
    placed.push(slot);
    improve();
  }
  while (improve());
  capstones.forEach((cap, slot) => {
    if (cap) order.push({ slot, a: 2, b: 2, capstone: cap });
  });
  return order;
}

const SPECS: Record<string, BuildSpec> = {
  /** Nine cheap knitters. Lots of small hits, which armour eats. */
  swarm: (() => {
    const slots: Slot[] = [
      260, 520, 700, 900, 1100, 1300, 1500, 1700, 1900, 340, 620, 820, 1020, 1220,
    ].map((at) => ({ def: 'norah' as TowerId, at }));
    return {
      blurb: 'nine knitters, volume over size',
      slots,
      order: grow(
        slots,
        slots.map((_, i) => (i % 2 === 0 ? 'tripleKnit' : null)),
      ),
    };
  })(),

  /** Three binoculars covering the whole street. Few, enormous hits. */
  sniper: (() => {
    const slots: Slot[] = [
      { def: 'norah', at: 260 },
      { def: 'bill', at: 420 },
      { def: 'norah', at: 700 },
      { def: 'bill', at: 1080 },
      { def: 'clara', at: 1100 },
      { def: 'bill', at: 1400 },
      { def: 'norah', at: 1600 },
      { def: 'bill', at: 1780 },
      { def: 'bill', at: 960 },
    ];
    return {
      blurb: 'three binoculars, one coffee, two knitters to hold the gaps',
      slots,
      order: grow(slots, [
        null,
        'piercingShot',
        null,
        'piercingShot',
        'doubleEspresso',
        'deadeye',
        null,
        'deadeye',
        'piercingShot',
      ]),
    };
  })(),

  /** Cinnamon rolls at the bends, where a crowd bunches up. */
  area: (() => {
    const slots: Slot[] = [
      { def: 'norah', at: 240 },
      { def: 'barbara', at: 480 },
      { def: 'norah', at: 700 },
      { def: 'barbara', at: 1000 },
      { def: 'barbara', at: 1300 },
      { def: 'norah', at: 1600 },
      { def: 'barbara', at: 1840 },
      { def: 'barbara', at: 380 },
      { def: 'barbara', at: 1120 },
      { def: 'norah', at: 1450 },
    ];
    return {
      blurb: 'cinnamon rolls at the four hairpins',
      slots,
      order: grow(slots, [
        null,
        'bigBatch',
        null,
        'freshBatch',
        'bigBatch',
        null,
        'freshBatch',
        'bigBatch',
        'freshBatch',
        null,
      ]),
    };
  })(),

  /** Stun and blockades. Buys time rather than dealing damage. */
  control: (() => {
    const slots: Slot[] = [
      // Spread along the whole street before doubling up anywhere. An earlier
      // version of this build put its first four towers within 120px of each
      // other and starved: it covered one corner beautifully and let the rest
      // of the road walk past, which cost it the kills it needed to pay for
      // the rest of itself. Coverage first is most of what a plan decides.
      { def: 'barbara', at: 300 },
      { def: 'norah', at: 800 },
      { def: 'barbara', at: 1300 },
      { def: 'pete', at: 450 },
      { def: 'norah', at: 1750 },
      { def: 'walter', at: 700 },
      { def: 'barbara', at: 1000 },
      { def: 'pete', at: 1450 },
      { def: 'norah', at: 550 },
      { def: 'walter', at: 1300 },
      { def: 'barbara', at: 1600 },
      { def: 'pete', at: 1900 },
      { def: 'barbara', at: 900 },
      { def: 'norah', at: 1150 },
    ];
    return {
      blurb: 'megaphones and garden walls, holding while a thin gun line works',
      slots,
      order: grow(slots, [
        null,
        'bigBatch',
        'megaphone',
        'stoneWall',
        'freshBatch',
        null,
        'bullhorn',
        'rally',
        'bigBatch',
        null,
        'megaphone',
        'bullhorn',
        'freshBatch',
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
      { def: 'norah', at: 260 },
      { def: 'bill', at: 1260 },
      { def: 'clara', at: 1740 },
      { def: 'norah', at: 1640 },
    ];
    return {
      blurb: 'three coffees, everything nearby firing far too fast',
      slots,
      order: grow(slots, [
        'tripleKnit',
        'doubleEspresso',
        'tripleKnit',
        'doubleEspresso',
        'deadeye',
        'secondRound',
        null,
        'tripleKnit',
        'piercingShot',
        'doubleEspresso',
        'tripleKnit',
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
      { def: 'barbara', at: 900 },
      { def: 'norah', at: 620 },
      { def: 'bill', at: 1560 },
    ];
    return {
      blurb: 'one of most things, the obvious first board',
      slots,
      order: grow(slots, [
        'tripleKnit',
        'bigBatch',
        'stoneWall',
        'deadeye',
        'megaphone',
        'doubleEspresso',
        'tripleKnit',
        'freshBatch',
        'tripleKnit',
        'piercingShot',
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
