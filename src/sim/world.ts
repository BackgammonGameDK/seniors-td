/**
 * The simulation. Everything that happens, happens here.
 *
 * Pure by rule: no DOM, no wall clock, no `Math.random`, and no import from
 * `src/render/`. `tests/architecture.test.ts` reads this directory and fails if
 * any of that stops being true, because the whole value of running the game
 * headless rests on a seed producing the same run everywhere.
 */
import { ENEMIES } from './enemies.ts';
import { ECONOMY } from './economy.ts';
import {
  cellCentre,
  distanceAlong,
  isBlockerCell,
  isBuildableCell,
  PATH_LENGTH,
  pointAt,
} from './path.ts';
import { Rng } from './rng.ts';
import { TOWERS } from './towers.ts';
import type {
  Enemy,
  EnemyId,
  Projectile,
  SimEvent,
  Stats,
  Status,
  Tower,
  TowerDef,
  TowerId,
} from './types.ts';
import { ENEMY_IDS } from './types.ts';
import { AUTHORED_ROUNDS, WAVES } from './waves.ts';

const PROJECTILE_SPEED = 9;
/** How close a projectile must get to its mark to count as arrived. */
const HIT_RADIUS = 9;
const FLASH_TICKS = 8;
/** No amount of glaze stops a troublemaker dead. Stun does that, briefly. */
const MAX_SLOW = 0.7;
/** How far short of a blockade an enemy halts, so it stands beside it. */
const BLOCKER_STOP_GAP = 14;
/** Ticks between one swing at a blockade and the next. */
const ATTACK_COOLDOWN = 30;
/** Most ticks an arrival can be nudged by. See `startWave`. */
const SPAWN_JITTER = 14;

export interface World {
  tick: number;
  rng: Rng;
  gold: number;
  lives: number;
  status: Status;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  /** Index of the round now running, or the one about to start. */
  waveIndex: number;
  spawnQueue: { at: number; enemy: EnemyId; scale: number }[];
  /**
   * Enemies created during this tick, held back until the end of it.
   *
   * The Gang splits when it dies, and a split that pushed straight onto
   * `enemies` would be walked by the loops still running this tick -- so one
   * cinnamon roll would hit the Gang, then the two runners it had just made,
   * and theirs. Queue, then flush once nothing is iterating.
   */
  pendingSpawns: { enemy: EnemyId; dist: number; scale: number }[];
  stats: Stats;
  /** Cleared at the top of every step. The renderer reads these for feedback. */
  events: SimEvent[];
  nextId: number;
}

function emptyLeaks(): Record<EnemyId, number> {
  const out = {} as Record<EnemyId, number>;
  for (const id of ENEMY_IDS) out[id] = 0;
  return out;
}

export function createWorld(seed = 1): World {
  return {
    tick: 0,
    rng: new Rng(seed),
    gold: ECONOMY.startGold,
    lives: ECONOMY.startLives,
    status: 'idle',
    enemies: [],
    towers: [],
    projectiles: [],
    waveIndex: 0,
    spawnQueue: [],
    pendingSpawns: [],
    stats: {
      kills: 0,
      leaks: 0,
      leaksByEnemy: emptyLeaks(),
      livesLost: 0,
      goldEarned: 0,
      blockersLost: 0,
    },
    events: [],
    nextId: 1,
  };
}

// --- placement --------------------------------------------------------------

export function towerAt(w: World, col: number, row: number): Tower | undefined {
  return w.towers.find((t) => t.col === col && t.row === row);
}

/**
 * Whether this tower may stand on this cell.
 *
 * Walter inverts the clearance test rather than being exempted from it: a
 * blockade must be *on* the road, everything else must be clear of it. One
 * predicate, chosen by mode, so no caller needs to know which tower is special.
 */
export function canPlace(w: World, def: TowerId, col: number, row: number): boolean {
  const cellOk =
    TOWERS[def].mode === 'blocker' ? isBlockerCell(col, row) : isBuildableCell(col, row);
  if (!cellOk) return false;
  if (towerAt(w, col, row)) return false;
  return w.gold >= TOWERS[def].cost;
}

export function placeTower(w: World, def: TowerId, col: number, row: number): boolean {
  if (!canPlace(w, def, col, row)) return false;
  const d = TOWERS[def];
  const p = cellCentre(col, row);
  w.gold -= d.cost;
  w.towers.push({
    id: w.nextId++,
    def,
    col,
    row,
    x: p.x,
    y: p.y,
    cooldown: 0,
    hp: d.maxHp,
    // Walking the polyline is expensive, so it happens once, here, and never
    // again for the life of the tower.
    laneDist: d.mode === 'blocker' ? distanceAlong(p) : -1,
    rateMult: 1,
    disabled: false,
    targetId: null,
  });
  return true;
}

/** Sell price. Deliberately lossy, so a misplacement costs something. */
export function refundOf(def: TowerId): number {
  return Math.floor(TOWERS[def].cost * 0.6);
}

export function sellTower(w: World, t: Tower): boolean {
  const i = w.towers.indexOf(t);
  if (i < 0) return false;
  w.towers.splice(i, 1);
  w.gold += refundOf(t.def);
  releaseBlocked(w, t.id);
  return true;
}

/**
 * A tower's cooldown with its neighbours' encouragement folded in.
 *
 * Kept in one exported place so the upgrade panel can show a real number
 * rather than recomputing the fold and drifting from what the sim does.
 */
export function effectiveCooldown(t: Tower): number {
  return Math.max(1, Math.round(TOWERS[t.def].cooldown / t.rateMult));
}

// --- rounds -----------------------------------------------------------------

export function startWave(w: World): boolean {
  if (w.status === 'running' || w.status === 'won' || w.status === 'lost') return false;
  const wave = WAVES[w.waveIndex];
  if (!wave) return false;
  w.spawnQueue = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      // A few ticks of seeded jitter on every arrival. Without it the whole
      // simulation is deterministic given a board, so a round measured a
      // hundred times returns one answer a hundred times and the harness's
      // sample size is a lie. The jitter is small enough not to change what a
      // round is and large enough that a knife-edge result shows up as one.
      const jitter = w.rng.int(0, SPAWN_JITTER);
      w.spawnQueue.push({
        at: w.tick + group.delay + i * group.gap + jitter,
        enemy: group.enemy,
        scale: wave.scale,
      });
    }
  }
  w.spawnQueue.sort((a, b) => a.at - b.at);
  w.status = 'running';
  return true;
}

export function spawnEnemy(w: World, def: EnemyId, dist: number, scale = 1): Enemy {
  const d = ENEMIES[def];
  const p = pointAt(dist);
  const e: Enemy = {
    id: w.nextId++,
    def,
    dist,
    x: p.x,
    y: p.y,
    hp: Math.round(d.hp * scale),
    scale,
    alive: true,
    flash: 0,
    slowTicks: 0,
    slowFactor: 0,
    stunTicks: 0,
    speedMult: 1,
    shield: 0,
    blockedBy: null,
    attackCd: 0,
  };
  w.enemies.push(e);
  return e;
}

function award(w: World, gold: number): void {
  w.gold += gold;
  w.stats.goldEarned += gold;
}

function emit(w: World, type: SimEvent['type'], x: number, y: number, text?: string): void {
  w.events.push(text === undefined ? { type, x, y } : { type, x, y, text });
}

// --- auras ------------------------------------------------------------------

function within(ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Everything one thing does to another just by standing near it.
 *
 * Clara's rate buff, Ben's shield and Tina's silence are one system with three
 * settings, and all three are recomputed from nothing every tick rather than
 * accumulated. That is what makes them safe: an aura cannot leak, double up,
 * or outlive its source, and removing a tower or killing an enemy needs no
 * unwinding anywhere.
 */
function advanceAuras(w: World): void {
  for (const t of w.towers) {
    t.rateMult = 1;
    t.disabled = false;
  }
  for (const e of w.enemies) e.shield = 0;

  for (const src of w.towers) {
    const d = TOWERS[src.def];
    if (d.mode !== 'support') continue;
    for (const t of w.towers) {
      if (t !== src && within(t.x, t.y, src.x, src.y, d.range)) t.rateMult *= d.buffRate;
    }
  }

  for (const src of w.enemies) {
    const d = ENEMIES[src.def];
    if (d.shieldAura > 0) {
      // Never itself: a carrier that shielded itself could be untouchable by
      // the towers it exists to punish, and the answer to a carrier is meant
      // to be shooting the carrier.
      for (const e of w.enemies) {
        if (e !== src && within(e.x, e.y, src.x, src.y, d.auraRange)) e.shield += d.shieldAura;
      }
    }
    if (d.disablesTowers) {
      for (const t of w.towers) {
        if (within(t.x, t.y, src.x, src.y, d.auraRange)) t.disabled = true;
      }
    }
  }
}

// --- status effects ---------------------------------------------------------

/**
 * Ticks every timer down and derives movement from what is left.
 *
 * `speedMult` is written here and nowhere else, so there is exactly one place
 * that decides how fast anything walks. Nothing in this function may apply
 * damage or re-run a hit: an effect that re-entered hit resolution would
 * re-apply itself and never expire.
 */
function advanceEffects(w: World): void {
  for (const e of w.enemies) {
    if (e.flash > 0) e.flash--;
    if (e.attackCd > 0) e.attackCd--;
    if (e.slowTicks > 0) {
      e.slowTicks--;
      if (e.slowTicks === 0) e.slowFactor = 0;
    }
    if (e.stunTicks > 0) e.stunTicks--;
    e.speedMult = e.stunTicks > 0 ? 0 : 1 - Math.min(MAX_SLOW, e.slowFactor);
  }
}

// --- movement ---------------------------------------------------------------

function blockerStopAhead(w: World, from: number): { id: number; stop: number } | null {
  let best: { id: number; stop: number } | null = null;
  for (const t of w.towers) {
    if (TOWERS[t.def].mode !== 'blocker' || t.hp <= 0) continue;
    const stop = t.laneDist - BLOCKER_STOP_GAP;
    if (stop >= from - 0.001 && (best === null || stop < best.stop)) best = { id: t.id, stop };
  }
  return best;
}

/** Frees anything queued behind a blockade that has just gone. */
function releaseBlocked(w: World, towerId: number): void {
  for (const e of w.enemies) if (e.blockedBy === towerId) e.blockedBy = null;
}

function hitBlocker(w: World, e: Enemy, t: Tower): void {
  t.hp -= (ENEMIES[e.def].blockerDps * ATTACK_COOLDOWN) / 60;
  e.attackCd = ATTACK_COOLDOWN;
  if (t.hp <= 0) {
    w.stats.blockersLost++;
    emit(w, 'blockerDown', t.x, t.y);
    const i = w.towers.indexOf(t);
    if (i >= 0) w.towers.splice(i, 1);
    releaseBlocked(w, t.id);
  }
}

function advanceEnemies(w: World): void {
  for (const e of w.enemies) {
    if (!e.alive) continue;

    if (e.blockedBy !== null) {
      const t = w.towers.find((x) => x.id === e.blockedBy);
      if (!t) {
        e.blockedBy = null;
      } else {
        if (e.attackCd === 0) hitBlocker(w, e, t);
        continue;
      }
    }

    const stepPx = ENEMIES[e.def].speed * e.speedMult;
    if (stepPx <= 0) continue;
    let next = e.dist + stepPx;

    const block = blockerStopAhead(w, e.dist);
    if (block !== null && next >= block.stop) {
      next = block.stop;
      e.blockedBy = block.id;
    }

    e.dist = next;
    const p = pointAt(next);
    e.x = p.x;
    e.y = p.y;

    if (next >= PATH_LENGTH) {
      const d = ENEMIES[e.def];
      e.alive = false;
      w.lives -= d.leakCost;
      w.stats.leaks++;
      w.stats.leaksByEnemy[e.def]++;
      w.stats.livesLost += d.leakCost;
      emit(w, 'leak', e.x, e.y, `-${d.leakCost}`);
    }
  }
}

// --- damage -----------------------------------------------------------------

/**
 * One hit landing, wherever it came from.
 *
 * Armour and shield are flat subtractions taken at the moment of impact, so a
 * single heavy hit gives up far less of itself than the same damage spread
 * over six light ones. That is the whole of the "what beats what" in this
 * game, and it is arithmetic rather than a table.
 */
export function applyHit(
  w: World,
  e: Enemy,
  damage: number,
  effect: Pick<TowerDef, 'slowTicks' | 'slowFactor' | 'stunTicks'>,
): void {
  if (!e.alive) return;
  const d = ENEMIES[e.def];

  const dealt = Math.max(0, damage - d.armour - e.shield);
  if (dealt > 0) {
    e.hp -= dealt;
    e.flash = FLASH_TICKS;
    emit(w, 'hit', e.x, e.y);
  } else if (damage > 0) {
    emit(w, 'hit', e.x, e.y, 'blocked');
  }

  // Status lands even when the damage does not, so Pete works at zero damage
  // and Barbara's glaze still slows something armoured.
  if (effect.slowTicks > 0) {
    e.slowTicks = Math.max(e.slowTicks, effect.slowTicks);
    e.slowFactor = Math.max(e.slowFactor, effect.slowFactor);
  }
  if (effect.stunTicks > 0 && !d.stunImmune) {
    e.stunTicks = Math.max(e.stunTicks, effect.stunTicks);
  }

  if (e.hp <= 0) kill(w, e);
}

function kill(w: World, e: Enemy): void {
  const d = ENEMIES[e.def];
  e.alive = false;
  e.blockedBy = null;
  award(w, d.bounty);
  w.stats.kills++;
  emit(w, 'kill', e.x, e.y, `+${d.bounty}`);

  if (d.splitsInto && d.splitCount > 0) {
    emit(w, 'split', e.x, e.y);
    for (let i = 0; i < d.splitCount; i++) {
      // Nudged apart along the lane so two runners are visibly two, and held
      // back until nothing is iterating the enemy list.
      const offset = (i - (d.splitCount - 1) / 2) * 12;
      w.pendingSpawns.push({
        enemy: d.splitsInto,
        dist: Math.max(0, Math.min(PATH_LENGTH - 1, e.dist + offset)),
        scale: e.scale,
      });
    }
  }
}

function flushSpawns(w: World): void {
  if (w.pendingSpawns.length === 0) return;
  for (const s of w.pendingSpawns) spawnEnemy(w, s.enemy, s.dist, s.scale);
  w.pendingSpawns.length = 0;
}

// --- towers acting ----------------------------------------------------------

/** The enemy furthest down the street, which is the one about to get away. */
function findTarget(w: World, t: Tower, range: number): Enemy | null {
  let best: Enemy | null = null;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    if (!within(e.x, e.y, t.x, t.y, range)) continue;
    if (best === null || e.dist > best.dist) best = e;
  }
  return best;
}

function fireTowers(w: World): void {
  for (const t of w.towers) {
    const d = TOWERS[t.def];
    if (d.mode === 'support' || d.mode === 'blocker') continue;
    // A disabled tower does nothing at all, cooldown included, so Tina costs
    // real shots rather than merely delaying them.
    if (t.disabled) continue;
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }

    if (d.mode === 'pulse') {
      let shouted = false;
      for (const e of w.enemies) {
        if (!e.alive || !within(e.x, e.y, t.x, t.y, d.range)) continue;
        shouted = true;
        applyHit(w, e, d.damage, d);
      }
      if (!shouted) continue;
      emit(w, 'stun', t.x, t.y);
      t.cooldown = effectiveCooldown(t);
      continue;
    }

    const target = findTarget(w, t, d.range);
    if (!target) continue;
    w.projectiles.push({
      id: w.nextId++,
      x: t.x,
      y: t.y,
      targetId: target.id,
      damage: d.damage,
      speed: PROJECTILE_SPEED,
      splash: d.splash,
      slowTicks: d.slowTicks,
      slowFactor: d.slowFactor,
      stunTicks: d.stunTicks,
      from: t.def,
    });
    t.cooldown = effectiveCooldown(t);
  }
}

function detonate(w: World, p: Projectile, x: number, y: number, direct: Enemy | null): void {
  const effect = {
    slowTicks: p.slowTicks,
    slowFactor: p.slowFactor,
    stunTicks: p.stunTicks,
  };
  if (p.splash > 0) {
    // Snapshot the list: a splash must not reach anything created by the same
    // splash, which is exactly the bug that let one shot cascade through a
    // whole family in the previous project.
    const caught = w.enemies.filter((e) => e.alive && within(e.x, e.y, x, y, p.splash));
    for (const e of caught) applyHit(w, e, p.damage, effect);
  } else if (direct) {
    applyHit(w, direct, p.damage, effect);
  }
}

function advanceProjectiles(w: World): void {
  const keep: Projectile[] = [];
  for (const p of w.projectiles) {
    const target = w.enemies.find((e) => e.id === p.targetId && e.alive);
    // A shot already in the air keeps going to where its mark was, so a kill
    // half a second earlier does not silently delete a cinnamon roll.
    const tx = target ? target.x : p.x;
    const ty = target ? target.y : p.y;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);

    if (!target || dist <= HIT_RADIUS) {
      detonate(w, p, tx, ty, target ?? null);
      continue;
    }
    p.x += (dx / dist) * p.speed;
    p.y += (dy / dist) * p.speed;
    keep.push(p);
  }
  w.projectiles = keep;
}

// --- the tick ---------------------------------------------------------------

export function step(w: World): void {
  if (w.status === 'won' || w.status === 'lost') return;
  w.events.length = 0;
  w.tick++;

  while (w.spawnQueue.length > 0 && w.spawnQueue[0]!.at <= w.tick) {
    const next = w.spawnQueue.shift()!;
    spawnEnemy(w, next.enemy, 0, next.scale);
  }

  advanceAuras(w);
  advanceEffects(w);
  advanceEnemies(w);
  fireTowers(w);
  advanceProjectiles(w);
  flushSpawns(w);
  w.enemies = w.enemies.filter((e) => e.alive);

  if (w.lives <= 0) {
    w.lives = 0;
    w.status = 'lost';
    return;
  }

  if (w.status === 'running' && w.spawnQueue.length === 0 && w.enemies.length === 0) {
    award(w, ECONOMY.roundClearBonus(w.waveIndex + 1));
    w.waveIndex++;
    w.status = w.waveIndex >= AUTHORED_ROUNDS ? 'won' : 'idle';
  }
}
