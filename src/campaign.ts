/**
 * The campaign harness: twenty-one rounds, one purse, lives that do not come back.
 *
 *   npm run campaign -- --all-builds
 *   npm run campaign -- --build sniper --runs 40
 *   npm run campaign -- --loadout "norah@6,1 norah@6,1+a1" --json
 *   npm run campaign -- --loadout-file loadout.txt
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
import { loadoutText, run, wholeNumberArg } from './harness-args.ts';
import { BUILDS, buildNamed } from './sim/builds.ts';
import { ECONOMY } from './sim/economy.ts';
import { applyPlacement, describePlacement, parseLoadout } from './sim/loadout.ts';
import type { Placement } from './sim/loadout.ts';
import { TOWERS } from './sim/towers.ts';
import { UPGRADES } from './sim/upgrades.ts';
import { ENEMY_IDS } from './sim/types.ts';
import type { EnemyId } from './sim/types.ts';
import { AUTHORED_ROUNDS } from './sim/waves.ts';
import { continueEndless, createWorld, startWave, step, towerAt } from './sim/world.ts';

/** A round that cannot finish in four minutes is a stall, not a hard round. */
const MAX_TICKS = 60 * 240;

/**
 * How far free play is played before the harness gives up on it.
 *
 * Free play is meant to end in a loss, so a run that reaches this cap is a
 * finding rather than a result: the ramp in `waveAt` is too soft.
 */
const ENDLESS_CAP = 60;

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

export function runCampaign(plan: Placement[], seed: number, endless = false): CampaignRun {
  const w = createWorld(seed);
  const rounds: RoundRecord[] = [];
  let next = 0;
  let cleared = false;

  for (let round = 1; round <= (endless ? ENDLESS_CAP : AUTHORED_ROUNDS); round++) {
    let goldSpent = 0;
    const bought: string[] = [];
    for (;;) {
      const entry = plan[next];
      if (!entry) break;
      const price = costOf(w, entry);
      if (price > w.gold) break;
      applyPlacement(w, entry);
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
    // Round twenty-one is still the thing that counts as clearing the game.
    // In free play the win never lands as a status, so it is recorded here and
    // the run is put into free play to carry on from.
    if (round === AUTHORED_ROUNDS) {
      cleared = true;
      if (endless && !continueEndless(w)) throw new Error('free play would not start');
    }
  }

  return {
    seed,
    cleared,
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
  /** The furthest any one seed got. Only interesting in free play. */
  bestReached: number;
  /** Mean lives remaining at the end of round twenty-one, over the runs that got there. */
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
  endless = false,
): BuildResult {
  const all = Array.from({ length: runs }, (_, i) => runCampaign(plan, i + 1, endless));
  const cleared = all.filter((r) => r.cleared);
  const warnings = all.map(warningRounds).filter((n): n is number => n !== null);
  const curve: number[] = [];
  // The curve runs as far as the deepest seed got, so free play does not get
  // cut off at twenty-one. A seed that ended earlier counts as no lives left.
  const depth = Math.max(AUTHORED_ROUNDS, ...all.map((r) => r.rounds.length));
  for (let round = 0; round < depth; round++) {
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
    bestReached: Math.max(...all.map((r) => r.reached)),
    // Lives as they stood when round twenty-one was held, not at the very end.
    // The two are the same in the campaign, where twenty-one is the last round,
    // and different in free play, which always ends on nothing left.
    avgLivesOnClear: mean(cleared.map((r) => r.rounds[AUTHORED_ROUNDS - 1]?.livesAfter ?? 0)),
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
  const depth = results[0]?.livesCurve.length ?? AUTHORED_ROUNDS;
  console.log('build      ' + Array.from({ length: depth }, (_, i) => String(i + 1).padStart(4)).join(''));
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
      'loadout-file': { type: 'string' },
      runs: { type: 'string' },
      json: { type: 'boolean' },
      endless: { type: 'boolean' },
      verbose: { type: 'boolean' },
    },
  });

  const runs = wholeNumberArg('--runs', values.runs, 20);
  const written = loadoutText(values);
  const chosen =
    written !== null
      ? [
          {
            name: 'loadout',
            blurb: values['loadout-file']
              ? `read from ${values['loadout-file']}`
              : 'given on the command line',
            loadout: written,
          },
        ]
      : values['all-builds'] || !values.build
        ? BUILDS
        : [buildNamed(values.build)];

  const endless = Boolean(values.endless);
  const results = chosen.map((b) =>
    measureBuild(b.name, b.blurb, parseLoadout(b.loadout), runs, endless),
  );

  if (values.json) {
    console.log(JSON.stringify({ runs, results }, null, 2));
    return;
  }

  console.log(`seeds per build: ${runs}   `
    + `rounds: ${endless ? `${AUTHORED_ROUNDS} then free play to ${ENDLESS_CAP}` : AUTHORED_ROUNDS}   `
    + `start: ${ECONOMY.startGold} coins, ${ECONOMY.startLives} lives\n`);
  report(results);

  if (endless) {
    console.log('\nfree play: how far past round twenty-one');
    for (const r of results) {
      // A build that never held round twenty-one never saw free play at all,
      // and reporting it as negative rounds past the end would be nonsense.
      if (r.clearRate === 0) {
        console.log(r.name.padEnd(10) + '   never got there');
        continue;
      }
      const past = r.avgReached - AUTHORED_ROUNDS;
      console.log(
        r.name.padEnd(10) +
          `   mean ${past.toFixed(1).padStart(5)} rounds past` +
          `   best round ${String(r.bestReached).padStart(3)}` +
          (r.bestReached >= ENDLESS_CAP ? '   -- hit the cap, the ramp is too soft' : ''),
      );
    }
  }

  if (values.verbose) {
    for (const b of chosen) {
      console.log(`\n${b.name} -- ${b.blurb}\n  ${b.loadout}`);
    }
  }
}

if (process.argv[1]?.endsWith('campaign.ts')) run(main);
