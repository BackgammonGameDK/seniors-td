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
import { DEFAULT_PROJECTILE_SPEED, TOWERS } from './towers.ts';
import { effectiveDef, UPGRADES } from './upgrades.ts';
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
  UpgradeChoice,
} from './types.ts';
import { ENEMY_IDS } from './types.ts';
import { AUTHORED_ROUNDS, waveAt } from './waves.ts';

/** How close a projectile must get to its mark to count as arrived. */
const HIT_RADIUS = 9;
const FLASH_TICKS = 8;
/** No amount of glaze stops a troublemaker dead. Stun does that, briefly. */
const MAX_SLOW = 0.7;
/**
 * How much shorter each successive stun on the same troublemaker is.
 *
 * `MAX_SLOW` stops a slow from ever halting someone outright; this is the same
 * guarantee for stun, which needs one because a stun *does* halt them. Clara
 * multiplies how often a tower acts but not how long its stun lasts, so at
 * enough coffee the stuns simply overlapped and the street froze -- measured at
 * 89% of the time for a Pete with no upgrades at all, and 100% with either
 * capstone. Shortening the repeat rather than refusing it keeps Pete's job
 * intact: he still stops people, he just cannot hold them for ever.
 */
const STUN_FALLOFF = 0.8;
/** Fatigue stops here, so a repeated stun never shortens to nothing. */
const MAX_STUN_FATIGUE = 4;
/**
 * Ticks of quiet that shrug off one step of fatigue.
 *
 * Short on purpose, and this is the whole trick: it is shorter than the gap
 * a lone Pete leaves between shouts, so he sheds fatigue as fast as he causes
 * it and is left exactly as he was. A Pete hurried along by coffee never gets
 * a gap this long, so his fatigue stays high -- which is what stops more
 * coffee from adding up to a permanent freeze.
 */
const STUN_RECOVERY_TICKS = 60;
/**
 * Ticks of footing a troublemaker gets after being knocked off it.
 *
 * A second, which is longer than any hose's gap between shots -- so the ground
 * a slip costs is paid once per second however much water is falling on them,
 * and stacking hoses buys more damage and a better chance of the *first* slip
 * rather than an ever-longer push. That is what keeps a defender who sends
 * people backwards from being a way to stop the street outright.
 */
const SLIP_COOLDOWN_TICKS = 60;
/**
 * The most a tower's rate of fire can be multiplied, however much coffee is
 * standing near it.
 *
 * Encouragement stacks by multiplying, so three maxed Claras were 2.0 cubed --
 * an eightfold rate, which drove Norah's cooldown onto its one-tick floor and
 * made stacking coffee the only build worth playing. It measured as the sole
 * build that could finish a campaign, which is the failure this project cares
 * about most. Capped rather than made additive because a cap keeps the first
 * Clara worth her full price and only makes the third one a poor buy, which is
 * the shape support is meant to have: a force multiplier, not a win condition.
 */
export const MAX_RATE_MULT = 2.5;
/**
 * The most a tower's range can be multiplied, for the same reason and by the
 * same shape of stacking.
 *
 * Only Clara's Second Round feeds this, at fifteen percent apiece, so three of
 * them reach 1.52 and the rail sits just under that: no board anyone can
 * afford today touches it, and the sweep it was added after measured no change
 * anywhere. It is here because range multiplied and range added are the same
 * thing at one Clara and very different things at six, and rate has already
 * had to learn that once.
 */
export const MAX_RANGE_MULT = 1.5;
/**
 * The most shield an enemy can be carrying, however many carriers it stands
 * among.
 *
 * The rail the two above already have, arriving on the enemy side of the same
 * system after the same failure. Ben's aura was summed once per Ben with
 * nothing stopping it, and a board that knots the street -- blockades, a wall
 * of glaze -- gathers every carrier in a round into one 90px blob and shields
 * it with all of them at once. Measured in free play at round 57, which sends
 * 46 Bens: a played board reached 92, meaning every single carrier was inside
 * one circle. That is a board being punished for its own crowd control, and it
 * annihilated the cheap fast defenders rather than taxing them.
 *
 * Six is three carriers. A knot of Bens is still three times the protection of
 * one, which keeps the first Ben worth his whole price and only makes the
 * fourth a passenger -- the shape a stacking rail is supposed to have. The
 * harness never saw the runaway because it never bunches a wave that hard: the
 * three played boards peak at 12 to 16 in the same rounds.
 */
export const MAX_SHIELD = 6;
/**
 * The least of itself a hit keeps, however armoured and shielded the target.
 *
 * Armour and shield are flat subtractions, and a flat subtraction has a cliff
 * in it: a defender is not weakened as protection rises, it goes to exactly
 * zero and stays there. Norah pays that first and hardest, because her damage
 * is 7 and no upgrade she owns ever changes it -- her paths buy rate, range
 * and a third shot, and every one of those pays the tax again per hit, so
 * multiShot makes an armoured target worse rather than better.
 *
 * A fifth of the hit always lands, and only against a shield. Armour keeps its
 * cliff untouched, because nothing on the board falls off it: the heaviest
 * armour is Duke's 4 and the lightest hit is Pete's 5. The shield is the only
 * part of the subtraction that can grow without limit, so it is the only part
 * that needs a floor under it, and confining it there measured identically to
 * flooring the whole subtraction while changing far less.
 *
 * Weak hits are still the wrong answer by a wide margin, which is the whole of
 * Ben's identity, but they are a bad answer rather than no answer, and a
 * defender fades instead of switching off.
 */
export const MIN_DAMAGE_FRACTION = 0.2;
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
  /**
   * Whether the player has chosen to carry on past the authored rounds.
   *
   * Free play is opt-in so that holding all twenty-one still ends the game the
   * way it is meant to end. Nothing sets this except `continueEndless`, and
   * only from a won run.
   */
  endless: boolean;
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
    endless: false,
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
    rangeMult: 1,
    disabled: false,
    upgradeA: 0,
    upgradeB: 0,
    capstone: null,
    revivesUsed: 0,
    reviveAt: null,
    targetId: null,
    sentHome: 0,
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
 * Buys the next tier on a path, or a capstone once both paths are maxed.
 *
 * `towerId` rather than a `Tower` reference, the same way `blockedBy` and
 * `targetId` address a tower elsewhere in this file -- a UI panel can hold an
 * id past the tick where the tower it names got knocked down, and this just
 * fails closed rather than needing that panel to know it.
 *
 * A capstone choice cannot be undone: once `capstone` is set, neither
 * capstone id is ever accepted again for that tower.
 */
export function purchaseUpgrade(
  w: World,
  towerId: number,
  choice: UpgradeChoice,
): boolean {
  const t = w.towers.find((x) => x.id === towerId);
  if (!t) return false;
  const tree = UPGRADES[t.def];

  if (choice === 'pathA' || choice === 'pathB') {
    const tier = choice === 'pathA' ? t.upgradeA : t.upgradeB;
    if (tier >= 2) return false;
    const next = tree[choice][tier as 0 | 1];
    if (w.gold < next.cost) return false;
    w.gold -= next.cost;
    if (choice === 'pathA') t.upgradeA = (tier + 1) as 0 | 1 | 2;
    else t.upgradeB = (tier + 1) as 0 | 1 | 2;
    return true;
  }

  if (t.upgradeA < 2 || t.upgradeB < 2 || t.capstone !== null) return false;
  const cap = tree.capstones.find((c) => c.id === choice);
  if (!cap || w.gold < cap.cost) return false;
  w.gold -= cap.cost;
  t.capstone = cap.id;
  return true;
}

/**
 * A tower's cooldown with its neighbours' encouragement folded in.
 *
 * Kept in one exported place so the upgrade panel can show a real number
 * rather than recomputing the fold and drifting from what the sim does.
 */
export function effectiveCooldown(t: Tower): number {
  return cooldownAt(effectiveDef(t).cooldown, t.rateMult);
}

/**
 * The same fold, over loose numbers.
 *
 * The inspect panel knows a cooldown and a rate multiplier but has no Tower to
 * hand, and a second copy of this rounding in the interface is exactly how a
 * panel starts lying about what the sim does.
 */
export function cooldownAt(cooldown: number, rateMult: number): number {
  return Math.max(1, Math.round(cooldown / rateMult));
}

// --- rounds -----------------------------------------------------------------

export function startWave(w: World): boolean {
  if (w.status === 'running' || w.status === 'won' || w.status === 'lost') return false;
  // Past the authored rounds there is always a round to be had, so the refusal
  // has to be the player's choice rather than the absence of a wave.
  if (w.waveIndex >= AUTHORED_ROUNDS && !w.endless) return false;
  const wave = waveAt(w.waveIndex);
  // Second Wind is spent once a round, so a Walter left standing from a round
  // he never fell in gets it back for the next one.
  for (const t of w.towers) t.revivesUsed = 0;
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

/**
 * Carry on past the twenty-one authored rounds.
 *
 * Only from a won run, and only once: free play is the thing a player chooses
 * after the victory rather than instead of it. Returns whether it took, so the
 * interface cannot half-apply it.
 */
export function continueEndless(w: World): boolean {
  if (w.status !== 'won') return false;
  w.endless = true;
  w.status = 'idle';
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
    stunFatigue: 0,
    stunRecovery: 0,
    dropCooldown: d.dropInterval,
    regenCd: d.regenDelayTicks,
    slipCooldown: 0,
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
    t.rangeMult = 1;
    t.disabled = false;
  }
  for (const e of w.enemies) e.shield = 0;

  for (const src of w.towers) {
    const d = effectiveDef(src);
    if (d.mode !== 'support') continue;
    for (const t of w.towers) {
      if (t === src || !within(t.x, t.y, src.x, src.y, d.range)) continue;
      t.rateMult = Math.min(MAX_RATE_MULT, t.rateMult * d.buffRate);
      t.rangeMult = Math.min(MAX_RANGE_MULT, t.rangeMult * (1 + (d.rangeBuffBonus ?? 0)));
    }
  }

  for (const src of w.enemies) {
    const d = ENEMIES[src.def];
    if (d.shieldAura > 0) {
      // Never itself: a carrier that shielded itself could be untouchable by
      // the towers it exists to punish, and the answer to a carrier is meant
      // to be shooting the carrier.
      for (const e of w.enemies) {
        if (e !== src && within(e.x, e.y, src.x, src.y, d.auraRange)) {
          e.shield = Math.min(MAX_SHIELD, e.shield + d.shieldAura);
        }
      }
    }
    if (d.disablesTowers) {
      for (const t of w.towers) {
        if (within(t.x, t.y, src.x, src.y, d.auraRange)) t.disabled = true;
      }
    }
  }
}

/**
 * A living spawner's own clock. Auras above are recomputed from nothing every
 * tick; a drop has to remember how long until the next one, so it gets a
 * counter of its own on the enemy. A no-op for every enemy but Duke.
 */
function advanceDrops(w: World): void {
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d = ENEMIES[e.def];
    if (!d.dropsInto) continue;
    if (e.dropCooldown > 0) {
      e.dropCooldown--;
      continue;
    }
    e.dropCooldown = d.dropInterval;
    emit(w, 'drop', e.x, e.y);
    w.pendingSpawns.push({
      enemy: d.dropsInto,
      dist: Math.max(0, e.dist - 16),
      scale: e.scale,
    });
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
    if (e.slipCooldown > 0) e.slipCooldown--;
    // Only counts while nobody is shouting, so fatigue eases off during a lull
    // rather than during the stun it is already shortening.
    if (e.stunTicks === 0 && e.stunFatigue > 0) {
      e.stunRecovery--;
      if (e.stunRecovery <= 0) {
        e.stunFatigue--;
        e.stunRecovery = STUN_RECOVERY_TICKS;
      }
    }
    e.speedMult = e.stunTicks > 0 ? 0 : 1 - Math.min(MAX_SLOW, e.slowFactor);
  }
}

/**
 * Healing, as flat arithmetic on hit points already lost.
 *
 * It never re-enters `applyHit` -- healing is the same kind of thing a slow
 * ticking down is, a number changed in place -- and it never climbs above what
 * the enemy spawned with, which is the round's toughness multiplier already
 * folded into `scale`. `regenCd` is reset by every hit that lands, so this
 * only ever runs on something nobody has touched for a while.
 */
function advanceRegen(w: World): void {
  for (const e of w.enemies) {
    const d = ENEMIES[e.def];
    if (d.regenPerSec <= 0 || !e.alive) continue;
    if (e.regenCd > 0) {
      e.regenCd--;
      continue;
    }
    e.hp = Math.min(d.hp * e.scale, e.hp + d.regenPerSec / 60);
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
  e.attackCd = ATTACK_COOLDOWN;
  // Already down and waiting on Second Wind -- nothing left to hit until it
  // is back up, and landing another blow here would only push its revive
  // time further out every 30 ticks for as long as something stood over it.
  if (t.hp <= 0 && t.reviveAt !== null) return;
  t.hp -= (ENEMIES[e.def].blockerDps * ATTACK_COOLDOWN) / 60;
  if (t.hp <= 0) {
    if (t.revivesUsed === 0) {
      // Second Wind, once a round: he stays on the board at zero HP until
      // advanceBlockers gets him back up, but he holds nobody while he is
      // down. `blockerStopAhead` already skips hp <= 0, so anyone arriving
      // during the count walks past him; releasing the queue is what makes
      // the troublemakers already behind him behave the same way.
      //
      // Without this they froze -- stuck on a blocker they could not damage
      // (the early return above) and which could not be walked around, for
      // the whole six seconds. Four Mikes stood still for 360 ticks while
      // newer arrivals strolled by them. Second Wind buys the position back,
      // it does not keep holding it in the meantime.
      t.hp = 0;
      t.reviveAt = w.tick + (effectiveDef(t).reviveDelayTicks ?? 0);
      releaseBlocked(w, t.id);
      return;
    }
    w.stats.blockersLost++;
    emit(w, 'blockerDown', t.x, t.y);
    const i = w.towers.indexOf(t);
    if (i >= 0) w.towers.splice(i, 1);
    releaseBlocked(w, t.id);
  }
}

/**
 * A round ending patches the blockers up.
 *
 * Regen is an in-round survivability stat, not a timer the player can farm by
 * taking longer over the upgrade panel -- `step` keeps ticking while the game
 * is idle, so anything that healed between rounds would be paid for in
 * wall-clock time. Clearing `reviveAt` matters too: a blocker felled by the
 * last enemy of a round would otherwise stand at 0 HP counting down to
 * nothing.
 */
function restoreBlockers(w: World): void {
  for (const t of w.towers) {
    if (TOWERS[t.def].mode !== 'blocker') continue;
    t.hp = effectiveDef(t).maxHp;
    t.reviveAt = null;
  }
}

/**
 * A blocker's own upkeep: Second Wind coming back up, and regen while
 * standing. Kept apart from `advanceEffects`, which is enemies-only and
 * never writes a tower's hp.
 */
function advanceBlockers(w: World): void {
  for (const t of w.towers) {
    if (TOWERS[t.def].mode !== 'blocker') continue;
    const d = effectiveDef(t);
    if (t.reviveAt !== null) {
      if (w.tick >= t.reviveAt) {
        t.hp = d.maxHp * (d.reviveHpFrac ?? 0);
        t.reviveAt = null;
        t.revivesUsed++;
      }
      continue;
    }
    if (t.hp > 0 && t.hp < d.maxHp && (d.regen ?? 0) > 0) {
      t.hp = Math.min(d.maxHp, t.hp + (d.regen ?? 0) / 60);
    }
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

    if (!ENEMIES[e.def].ignoresBlockers) {
      const block = blockerStopAhead(w, e.dist);
      if (block !== null && next >= block.stop) {
        next = block.stop;
        e.blockedBy = block.id;
      }
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
 * game, and it is arithmetic rather than a table. Against a shield a fifth of
 * the hit is floored, so that the arithmetic tapers instead of ending -- see
 * MIN_DAMAGE_FRACTION.
 */
/**
 * Everything a hit carries besides its damage.
 *
 * Taken from `TowerDef` rather than written out again so a new rider on a
 * defender cannot reach `applyHit` without also being a real stat somewhere a
 * player can read it. The slip fields are optional there, so a caller that
 * passes a whole `TowerDef` -- which is what a pulse does -- needs no change.
 */
export type HitEffect = Pick<
  TowerDef,
  'slowTicks' | 'slowFactor' | 'stunTicks' | 'slipChance' | 'slipPush'
>;

export function applyHit(
  w: World,
  e: Enemy,
  damage: number,
  effect: HitEffect,
  sourceId?: number,
): void {
  if (!e.alive) return;
  const d = ENEMIES[e.def];

  // Never below a fifth of the hit once a shield is involved: see
  // MIN_DAMAGE_FRACTION for why the one part of the subtraction that stacks is
  // the one part that needs a floor under it.
  const floor = e.shield > 0 ? Math.ceil(damage * MIN_DAMAGE_FRACTION) : 0;
  const dealt = damage <= 0 ? 0 : Math.max(floor, damage - d.armour - e.shield);
  if (dealt > 0) {
    e.hp -= dealt;
    e.flash = FLASH_TICKS;
    emit(w, 'hit', e.x, e.y);
    // Only damage interrupts a healer. A shout that lands no damage leaves him
    // eating, so no one defender is the answer to him.
    e.regenCd = d.regenDelayTicks;
  }
  // The floor means a hit is never wholly eaten any more, so this now marks
  // the hits that the floor is all that is left of: the subtraction alone
  // would have taken the whole thing. The player still needs to see it, and it
  // is still the sign to bring something that hits harder.
  if (damage > 0 && damage - d.armour - e.shield < floor) {
    emit(w, 'hit', e.x, e.y, 'absorbed');
  }

  // Status lands even when the damage does not, so Pete works at zero damage
  // and Barbara's glaze still slows something armoured.
  if (effect.slowTicks > 0) {
    const factor = effect.slowFactor * (1 - d.slowResist);
    if (factor > 0) {
      e.slowTicks = Math.max(e.slowTicks, effect.slowTicks);
      e.slowFactor = Math.max(e.slowFactor, factor);
    }
  }
  if (effect.stunTicks > 0 && !d.stunImmune) {
    const shortened = Math.round(effect.stunTicks * STUN_FALLOFF ** e.stunFatigue);
    e.stunTicks = Math.max(e.stunTicks, shortened);
    e.stunFatigue = Math.min(MAX_STUN_FATIGUE, e.stunFatigue + 1);
    e.stunRecovery = STUN_RECOVERY_TICKS;
  }

  // Losing your footing. Rolled here, with the other things a hit resolves
  // once, so it can never be re-entered by anything ticking down afterwards.
  //
  // The cooldown is the rail. A slip that could land on every hit would let a
  // line of hoses push the street backwards faster than it walks forwards, and
  // nothing would ever arrive; with a second of footing in between, a slip
  // costs ground once and then they walk whatever else lands on them.
  const slipChance = effect.slipChance ?? 0;
  const slipPush = effect.slipPush ?? 0;
  if (slipChance > 0 && slipPush > 0 && e.slipCooldown === 0 && w.rng.next() < slipChance) {
    e.dist = Math.max(0, e.dist - slipPush);
    const p = pointAt(e.dist);
    e.x = p.x;
    e.y = p.y;
    e.slipCooldown = SLIP_COOLDOWN_TICKS;
    // Sliding back can only take them away from whatever they had walked up
    // to, so the blockade they were stopped at is no longer the one ahead.
    e.blockedBy = null;
    emit(w, 'slip', e.x, e.y);
  }

  if (e.hp <= 0) kill(w, e, sourceId);
}

function kill(w: World, e: Enemy, sourceId?: number): void {
  const d = ENEMIES[e.def];
  e.alive = false;
  e.blockedBy = null;
  award(w, d.bounty);
  w.stats.kills++;
  if (sourceId !== undefined) {
    // Nothing if the tower has since been sold or fallen: a shot outlives the
    // senior who fired it, and there is no one left to credit.
    const source = w.towers.find((t) => t.id === sourceId);
    if (source) source.sentHome++;
  }
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

/**
 * Up to `count` distinct enemies in range, furthest-along first -- the same
 * ordering `findTarget` already uses, just not stopping at one. Norah's
 * Triple Knit is the only thing that asks for more than one.
 */
function findTargets(w: World, t: Tower, range: number, count: number): Enemy[] {
  const inRange = w.enemies.filter((e) => e.alive && within(e.x, e.y, t.x, t.y, range));
  inRange.sort((a, b) => b.dist - a.dist);
  return inRange.slice(0, count);
}

/** How far behind a pierced enemy a shot may still reach the next one. */
// The lane is single file, so "behind" reads as a smaller `dist`. The window
// is wide enough to catch the next body queued in a tight column (enemies
// bunch up a few pixels apart behind a blockade or a corner) without also
// reaching past it to a straggler that the shot never actually flew near.
const PIERCE_WINDOW = 40;

function findPierceTarget(w: World, hit: Enemy): Enemy | null {
  let best: Enemy | null = null;
  for (const e of w.enemies) {
    if (!e.alive || e.id === hit.id) continue;
    if (e.dist >= hit.dist || hit.dist - e.dist > PIERCE_WINDOW) continue;
    if (best === null || e.dist > best.dist) best = e;
  }
  return best;
}

/**
 * Whoever a shot that has lost its mark rolls into next.
 *
 * Measured from where the shot is rather than from a place in the queue, since
 * there is no body to be behind: the mark died mid-flight and the ball is out
 * in the street on its own. The same window as a pierce, so a shot that lost
 * its mark reaches exactly as far for a replacement as one that went through
 * somebody.
 */
function findRollOnTarget(w: World, x: number, y: number): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = PIERCE_WINDOW;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > bestDist) continue;
    best = e;
    bestDist = d;
  }
  return best;
}

function fireTowers(w: World): void {
  for (const t of w.towers) {
    const d = effectiveDef(t);
    if (d.mode === 'support' || d.mode === 'blocker') continue;

    // Who this tower is aimed at, kept current even while it is on cooldown or
    // asleep -- the renderer turns the character to face this, and a tower
    // that snapped back to upright between shots would look broken. A pulse
    // tower shouts at everyone at once, so it has no one to face.
    //
    // Nothing here changes what gets shot: the shot still comes from
    // `findTarget` below. The held target is only dropped once it is dead or
    // out of range, so the common case costs a lookup rather than a sweep.
    if (d.mode !== 'pulse') {
      const facingRange = d.range * t.rangeMult;
      const held = t.targetId === null ? undefined : w.enemies.find((e) => e.id === t.targetId);
      const keep = held !== undefined && held.alive && within(held.x, held.y, t.x, t.y, facingRange);
      if (!keep) t.targetId = findTarget(w, t, facingRange)?.id ?? null;
    }
    // A disabled tower does nothing at all, cooldown included, so Tina costs
    // real shots rather than merely delaying them.
    if (t.disabled) continue;
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }
    const range = d.range * t.rangeMult;

    if (d.mode === 'pulse') {
      let shouted = false;
      for (const e of w.enemies) {
        if (!e.alive || !within(e.x, e.y, t.x, t.y, range)) continue;
        shouted = true;
        applyHit(w, e, d.damage, d, t.id);
      }
      if (!shouted) continue;
      emit(w, 'stun', t.x, t.y);
      t.cooldown = effectiveCooldown(t);
      continue;
    }

    const multiShot = d.multiShot ?? 1;
    const targets = multiShot > 1 ? findTargets(w, t, range, multiShot) : [findTarget(w, t, range)];
    const live = targets.filter((e): e is Enemy => e !== null);
    const primary = live[0];
    if (primary === undefined) continue;
    for (const target of live) {
      w.projectiles.push({
        id: w.nextId++,
        x: t.x,
        y: t.y,
        targetId: target.id,
        damage: d.damage,
        speed: d.projectileSpeed ?? DEFAULT_PROJECTILE_SPEED,
        splash: d.splash,
        slowTicks: d.slowTicks,
        slowFactor: d.slowFactor,
        stunTicks: d.stunTicks,
        slipChance: d.slipChance ?? 0,
        slipPush: d.slipPush ?? 0,
        pierceRemaining: d.pierce ?? 0,
        pierceFalloff: d.pierceFalloff ?? 1,
        from: t.def,
        sourceId: t.id,
      });
    }
    // The primary is what the character is turned towards; a multi-shot tower
    // faces the enemy furthest down the street, same as a single-shot one.
    t.targetId = primary.id;
    t.cooldown = effectiveCooldown(t);
  }
}

/**
 * Land a shot. Returns whether it carries on -- a shot that went through
 * somebody and is still owed a body is not finished, and `advanceProjectiles`
 * puts it back on the street rather than deleting it.
 */
function detonate(w: World, p: Projectile, x: number, y: number, direct: Enemy | null): boolean {
  const effect: HitEffect = {
    slowTicks: p.slowTicks,
    slowFactor: p.slowFactor,
    stunTicks: p.stunTicks,
    slipChance: p.slipChance,
    slipPush: p.slipPush,
  };
  if (p.splash > 0) {
    // Snapshot the list: a splash must not reach anything created by the same
    // splash, which is exactly the bug that let one shot cascade through a
    // whole family in the previous project.
    const caught = w.enemies.filter((e) => e.alive && within(e.x, e.y, x, y, p.splash));
    for (const e of caught) applyHit(w, e, p.damage, effect, p.sourceId);
    return false;
  }
  if (!direct) return false;

  applyHit(w, direct, p.damage, effect, p.sourceId);
  if (p.pierceRemaining === 0) return false;

  // Through one body and on to the next. The carried hit is not dealt here:
  // the shot is aimed at whoever is behind, loses the falloff, and has to
  // travel the gap like any other shot, which is the whole of what a player
  // sees when a bowling ball goes down a queue.
  //
  // `findPierceTarget` only ever looks backwards down the lane, so a chain
  // cannot double back, and `pierceRemaining` falls by one every time it hops
  // whether or not anything is found.
  const next = findPierceTarget(w, direct);
  if (!next) return false;
  p.targetId = next.id;
  p.damage = Math.round(p.damage * p.pierceFalloff);
  p.pierceRemaining--;
  return true;
}

function advanceProjectiles(w: World): void {
  const keep: Projectile[] = [];
  for (const p of w.projectiles) {
    let target = w.enemies.find((e) => e.id === p.targetId && e.alive);

    // A shot still owed a body does not care which body. Betty's ball spends
    // most of a second in the street, so its mark dying to somebody else is
    // ordinary rather than unlucky, and a ball that stopped dead at an empty
    // patch of road would make her slowness a punishment for the rest of the
    // board doing its job.
    //
    // It costs a body off the line, which is what keeps this from quietly
    // meaning "a piercing shot is never wasted". Bill carries one, so a dead
    // mark spends it and he lands one whole round on somebody else; Betty
    // carries up to five, so a ball goes on rolling. The falloff is not
    // charged -- the shot has been through nobody -- so what it loses is
    // length rather than weight.
    if (!target && p.pierceRemaining > 0) {
      const next = findRollOnTarget(w, p.x, p.y);
      if (next) {
        p.targetId = next.id;
        p.pierceRemaining--;
        target = next;
      }
    }

    // A shot already in the air keeps going to where its mark was, so a kill
    // half a second earlier does not silently delete a cinnamon roll.
    const tx = target ? target.x : p.x;
    const ty = target ? target.y : p.y;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);

    if (!target || dist <= HIT_RADIUS) {
      p.x = tx;
      p.y = ty;
      if (detonate(w, p, tx, ty, target ?? null)) keep.push(p);
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
  advanceRegen(w);
  advanceBlockers(w);
  advanceEnemies(w);
  advanceDrops(w);
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
    restoreBlockers(w);
    award(w, ECONOMY.roundClearBonus(w.waveIndex + 1));
    w.waveIndex++;
    w.status = !w.endless && w.waveIndex >= AUTHORED_ROUNDS ? 'won' : 'idle';
  }
}
