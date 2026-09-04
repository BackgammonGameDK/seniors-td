/**
 * The playtest harness.
 *
 * Runs rounds with no renderer and no clock, then reports what happened. This
 * is the agent-facing surface of the project: "is round 12 survivable with
 * three towers?" becomes a measurement instead of an opinion.
 *
 *   npm run sim -- --all-waves
 *   npm run sim -- --wave 7 --loadout "norah@5,4 bill@9,2" --runs 200
 *   npm run sim -- --all-waves --json
 *
 * Towers are placed free of charge and lives are refreshed each round, so this
 * measures the pressure of one round in isolation. What a player could
 * actually afford is `npm run campaign`.
 */
import { parseArgs } from 'node:util';
import { ECONOMY } from './sim/economy.ts';
import { describePlacement, parseLoadout } from './sim/loadout.ts';
import type { Placement } from './sim/loadout.ts';
import { BOARD, cellCentre, isBlockerCell, isBuildableCell, pointAt } from './sim/path.ts';
import { TOWERS } from './sim/towers.ts';
import { ENEMY_IDS } from './sim/types.ts';
import type { EnemyId } from './sim/types.ts';
import { WAVES } from './sim/waves.ts';
import { createWorld, placeTower, startWave, step } from './sim/world.ts';

/** Rounds cannot run forever: a stalled sim must fail loudly, not hang. */
const MAX_TICKS = 60 * 240;

interface WaveResult {
  wave: number;
  runs: number;
  winRate: number;
  avgLivesLost: number;
  avgGold: number;
  leaks: Record<EnemyId, number>;
}

function emptyLeaks(): Record<EnemyId, number> {
  const out = {} as Record<EnemyId, number>;
  for (const id of ENEMY_IDS) out[id] = 0;
  return out;
}

/**
 * A default board, so `--all-waves` says something without a loadout.
 *
 * Deliberately mixed rather than good: three cheap shooters spread along the
 * street, one of them with reach. A default that was a strong build would make
 * every round look easy.
 */
function defaultPlan(): Placement[] {
  const spots = [200, 700, 1200, 1700].map((d) => nearestBuildCell(d));
  return [
    { def: 'norah', ...spots[0]! },
    { def: 'bill', ...spots[1]! },
    { def: 'barbara', ...spots[2]! },
    { def: 'norah', ...spots[3]! },
  ];
}

function nearestBuildCell(dist: number): { col: number; row: number } {
  const p = pointAt(dist);
  let best = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let col = 0; col < BOARD.cols; col++) {
    for (let row = 0; row < BOARD.rows; row++) {
      if (!isBuildableCell(col, row)) continue;
      const c = cellCentre(col, row);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  }
  return best;
}

function runWave(waveIndex: number, plan: Placement[], seed: number) {
  const w = createWorld(seed);
  w.gold = 1e9;
  w.waveIndex = waveIndex;
  for (const p of plan) {
    const ok =
      TOWERS[p.def].mode === 'blocker' ? isBlockerCell(p.col, p.row) : isBuildableCell(p.col, p.row);
    if (!ok) throw new Error(`illegal placement ${describePlacement(p)} for ${p.def}`);
    placeTower(w, p.def, p.col, p.row);
  }
  w.gold = 0;
  w.lives = ECONOMY.startLives;
  startWave(w);

  let ticks = 0;
  while (w.status === 'running' && ticks < MAX_TICKS) {
    step(w);
    ticks++;
  }
  if (ticks >= MAX_TICKS) throw new Error(`round ${waveIndex + 1} never finished`);
  return w;
}

function measure(waveIndex: number, plan: Placement[], runs: number): WaveResult {
  const leaks = emptyLeaks();
  let wins = 0;
  let livesLost = 0;
  let gold = 0;
  for (let i = 0; i < runs; i++) {
    const w = runWave(waveIndex, plan, i + 1);
    if (w.status !== 'lost') wins++;
    livesLost += w.stats.livesLost;
    gold += w.stats.goldEarned;
    for (const id of ENEMY_IDS) leaks[id] += w.stats.leaksByEnemy[id];
  }
  return {
    wave: waveIndex + 1,
    runs,
    winRate: wins / runs,
    avgLivesLost: livesLost / runs,
    avgGold: gold / runs,
    leaks,
  };
}

function leakSummary(leaks: Record<EnemyId, number>, runs: number): string {
  const parts = ENEMY_IDS.filter((id) => leaks[id] > 0).map(
    (id) => `${id} ${(leaks[id] / runs).toFixed(1)}`,
  );
  return parts.length ? parts.join(', ') : '--';
}

function main(): void {
  const { values } = parseArgs({
    options: {
      wave: { type: 'string' },
      'all-waves': { type: 'boolean' },
      runs: { type: 'string' },
      loadout: { type: 'string' },
      json: { type: 'boolean' },
    },
  });

  const runs = Number(values.runs ?? 20);
  const plan = values.loadout ? parseLoadout(values.loadout) : defaultPlan();
  const waves = values['all-waves']
    ? WAVES.map((_, i) => i)
    : [Number(values.wave ?? 1) - 1];

  for (const i of waves) {
    if (!WAVES[i]) throw new Error(`no round ${i + 1}; there are ${WAVES.length}`);
  }

  const results = waves.map((i) => measure(i, plan, runs));

  if (values.json) {
    console.log(JSON.stringify({ plan: plan.map(describePlacement), runs, results }, null, 2));
    return;
  }

  console.log(`board: ${plan.map(describePlacement).join(' ')}`);
  console.log(`runs per round: ${runs}\n`);
  console.log('round   held   lives lost   gold   what got through');
  console.log('-----   ----   ----------   ----   ----------------');
  for (const r of results) {
    console.log(
      String(r.wave).padStart(5) +
        `   ${(r.winRate * 100).toFixed(0).padStart(3)}%` +
        `   ${r.avgLivesLost.toFixed(1).padStart(10)}` +
        `   ${r.avgGold.toFixed(0).padStart(4)}` +
        `   ${leakSummary(r.leaks, r.runs)}`,
    );
  }
}

main();
