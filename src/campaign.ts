/**
 * The campaign harness: twenty-one rounds, one purse, lives that do not come back.
 *
 *   npm run campaign -- --all-builds
 *   npm run campaign -- --build sniper --runs 40
 *   npm run campaign -- --loadout "norah@6,1 norah@6,1+a1" --json
 *
 * `npm run sim` hands out towers free and refills lives every round, which
 * makes it the right tool for "how hard is round 12" and the wrong one for
 * every other balance question. A round is not hard in isolation; it is hard
 * because of what the player could afford by the time it arrived. This harness
 * measures that: it starts with `ECONOMY.startGold`, earns what the rounds
 * pay, spends it on a written plan, and carries its losses forward until
 * either round twenty-one is cleared or the street is lost.
 *
 * The spender is deliberately stupid. It walks the plan front to back, buys
 * the next entry when it can afford the whole of it, and otherwise saves.
 * It never skips ahead to something cheaper, because a spender that reorders
 * the plan is no longer measuring the plan. A build that cannot afford its own
 * ordering is a finding, not a bug in the harness.
 */
import { parseArgs } from 'node:util';
import { BUILDS, buildNamed } from './sim/builds.ts';
import { ECONOMY } from './sim/economy.ts';
import { describePlacement, parseLoadout } from './sim/loadout.ts';
import type { Placement } from './sim/loadout.ts';
import { isBlockerCell, isBuildableCell } from './sim/path.ts';
import { TOWERS } from './sim/towers.ts';
import { UPGRADES } from './sim/upgrades.ts';
import { ENEMY_IDS } from './sim/types.ts';
import type { EnemyId } from './sim/types.ts';
import { AUTHORED_ROUNDS } from './sim/waves.ts';
import { createWorld, placeTower, purchaseUpgrade, startWave, step, towerAt } from './sim/world.ts';

/** A round that cannot finish in four minutes is a stall, not a hard round. */
const MAX_TICKS = 60 * 240;

export interface RoundRecord {
  round: number;
  livesAfter: number;
  goldSpent: number;
  goldBanked: number;
  bought: string[];
  leaks: Record<EnemyId, number>;
}

export interface CampaignRun {
  seed: number;
  /** True if round twenty-one was cleared. */
  cleared: boolean;
  /** Rounds actually finished. Equal to `AUTHORED_ROUNDS` on a clear. */
  reached: number;
  livesLeft: number;
  goldUnspent: number;
  /** How far down the plan the purse got, as a count of entries bought. */
  planBought: number;
  rounds: RoundRecord[];
}

function emptyLeaks(): Record<EnemyId, number> {
  const out = {} as Record<EnemyId, number>;
  for (const id of ENEMY_IDS) out[id] = 0;
  return out;
}

/**
 * What the next entry of a plan would cost, given the board as it stands.
 *
 * An entry is priced as a whole: the tower if it is not there yet, plus every
 * upgrade tier between what it has and what the entry asks for. Buying half an
 * entry would leave the plan in a state it never describes, so the purse
 * either covers the step or the step waits.
 */
function costOf(w: ReturnType<typeof createWorld>, p: Placement): number {
  const existing = towerAt(w, p.col, p.row);
  const tree = UPGRADES[p.def];
  let cost = existing ? 0 : TOWERS[p.def].cost;
  const haveA = existing?.upgradeA ?? 0;
  const haveB = existing?.upgradeB ?? 0;
  for (let t = haveA; t < p.upgradeA; t++) cost += tree.pathA[t as 0 | 1].cost;
  for (let t = haveB; t < p.upgradeB; t++) cost += tree.pathB[t as 0 | 1].cost;
  if (p.capstone && !existing?.capstone) {
    const cap = tree.capstones.find((c) => c.id === p.capstone);
    if (!cap) throw new Error(`unknown capstone "${p.capstone}" for ${p.def}`);
    cost += cap.cost;
  }
  return cost;
}

/** Carry out one entry. Every purchase inside it is already paid for. */
function apply(w: ReturnType<typeof createWorld>, p: Placement): void {
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
}

export function runCampaign(plan: Placement[], seed: number): CampaignRun {
  const w = createWorld(seed);
  const rounds: RoundRecord[] = [];
  let next = 0;

  for (let round = 1; round <= AUTHORED_ROUNDS; round++) {
    let goldSpent = 0;
    const bought: string[] = [];
    for (;;) {
      const entry = plan[next];
      if (!entry) break;
      const price = costOf(w, entry);
      if (price > w.gold) break;
      apply(w, entry);
      goldSpent += price;
      bought.push(describePlacement(entry));
      next++;
    }

    const leaksBefore = { ...w.stats.leaksByEnemy };
    if (!startWave(w)) throw new Error(`round ${round} would not start (status ${w.status})`);
    let ticks = 0;
    while (w.status === 'running' && ticks < MAX_TICKS) {
      step(w);
      ticks++;
    }
    if (ticks >= MAX_TICKS) throw new Error(`round ${round} never finished`);

    const leaks = emptyLeaks();
    for (const id of ENEMY_IDS) leaks[id] = w.stats.leaksByEnemy[id] - leaksBefore[id];
    rounds.push({
      round,
      livesAfter: w.lives,
      goldSpent,
      goldBanked: w.gold,
      bought,
      leaks,
    });

    if (w.status === 'lost') break;
  }

  return {
    seed,
    cleared: w.status === 'won',
    // A lost run reached the round before the one that killed it.
    reached: w.status === 'lost' ? rounds.length - 1 : rounds.length,
    livesLeft: w.lives,
    goldUnspent: w.gold,
    planBought: next,
    rounds,
  };
}


// --- reporting --------------------------------------------------------------

export interface BuildResult {
  name: string;
  blurb: string;
  runs: number;
  /** Fraction of seeds that finished round twenty-one. */
  clearRate: number;
  /** Mean furthest round reached, cleared or not. */
  avgReached: number;
  /** Mean lives remaining, over the runs that cleared. */
  avgLivesOnClear: number;
  /** Mean coins never spent, over every run. */
  avgUnspent: number;
  /** Mean entries of the plan the purse actually paid for. */
  avgPlanBought: number;
  planLength: number;
  /**
   * Mean number of rounds between lives first dropping below half and the run
   * ending. A run the player could see coming has several; a sudden wipe has
   * none. Only losing runs count, so it is `null` when nothing lost.
   */
  avgWarning: number | null;
  /** Mean lives remaining at the end of each round, across seeds. */
  livesCurve: number[];
}

const HALF_LIVES = ECONOMY.startLives / 2;

function warningRounds(run: CampaignRun): number | null {
  if (run.cleared) return null;
  const first = run.rounds.findIndex((r) => r.livesAfter < HALF_LIVES);
  if (first === -1) return 0;
  return run.rounds.length - 1 - first;
}

export function measureBuild(
  name: string,
  blurb: string,
  plan: Placement[],
  runs: number,
): BuildResult {
  const all = Array.from({ length: runs }, (_, i) => runCampaign(plan, i + 1));
  const cleared = all.filter((r) => r.cleared);
  const warnings = all.map(warningRounds).filter((n): n is number => n !== null);
  const curve: number[] = [];
  for (let round = 0; round < AUTHORED_ROUNDS; round++) {
    const seen = all.map((r) => r.rounds[round]?.livesAfter ?? 0);
    curve.push(seen.reduce((a, b) => a + b, 0) / seen.length);
  }
  const mean = (xs: number[]): number =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  return {
    name,
    blurb,
    runs,
    clearRate: cleared.length / runs,
    avgReached: mean(all.map((r) => r.reached)),
    avgLivesOnClear: mean(cleared.map((r) => r.livesLeft)),
    avgUnspent: mean(all.map((r) => r.goldUnspent)),
    avgPlanBought: mean(all.map((r) => r.planBought)),
    planLength: plan.length,
    avgWarning: warnings.length ? mean(warnings) : null,
    livesCurve: curve,
  };
}

function report(results: BuildResult[]): void {
  console.log('build      held 20   reached   lives left   unspent   plan bought   warning');
  console.log('-------    -------   -------   ----------   -------   -----------   -------');
  for (const r of results) {
    console.log(
      r.name.padEnd(10) +
        `   ${(r.clearRate * 100).toFixed(0).padStart(5)}%` +
        `   ${r.avgReached.toFixed(1).padStart(7)}` +
        `   ${(r.clearRate > 0 ? r.avgLivesOnClear.toFixed(1) : '--').padStart(10)}` +
        `   ${r.avgUnspent.toFixed(0).padStart(7)}` +
        `   ${`${r.avgPlanBought.toFixed(0)}/${r.planLength}`.padStart(11)}` +
        `   ${(r.avgWarning === null ? '--' : r.avgWarning.toFixed(1)).padStart(7)}`,
    );
  }
  console.log('\nlives remaining after each round');
  console.log('build      ' + Array.from({ length: AUTHORED_ROUNDS }, (_, i) => String(i + 1).padStart(4)).join(''));
  for (const r of results) {
    console.log(r.name.padEnd(10) + ' ' + r.livesCurve.map((v) => v.toFixed(0).padStart(4)).join(''));
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      build: { type: 'string' },
      'all-builds': { type: 'boolean' },
      loadout: { type: 'string' },
      runs: { type: 'string' },
      json: { type: 'boolean' },
      verbose: { type: 'boolean' },
    },
  });

  const runs = Number(values.runs ?? 20);
  const chosen = values.loadout
    ? [{ name: 'loadout', blurb: 'given on the command line', loadout: values.loadout }]
    : values['all-builds'] || !values.build
      ? BUILDS
      : [buildNamed(values.build)];

  const results = chosen.map((b) => measureBuild(b.name, b.blurb, parseLoadout(b.loadout), runs));

  if (values.json) {
    console.log(JSON.stringify({ runs, results }, null, 2));
    return;
  }

  console.log(`seeds per build: ${runs}   rounds: ${AUTHORED_ROUNDS}   `
    + `start: ${ECONOMY.startGold} coins, ${ECONOMY.startLives} lives\n`);
  report(results);

  if (values.verbose) {
    for (const b of chosen) {
      console.log(`\n${b.name} -- ${b.blurb}\n  ${b.loadout}`);
    }
  }
}

if (process.argv[1]?.endsWith('campaign.ts')) main();
