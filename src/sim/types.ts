/**
 * The shapes the simulation runs on.
 *
 * There is deliberately no counter table here -- no element chart, no
 * type matchups. A tower is told apart from another by damage, range, rate,
 * whether it splashes, and whether it multiplies what its neighbours do.
 * Armour and shields soften a hit, but they are stats on an enemy rather than
 * a lookup, so no tower is ever the answer to one troublemaker in particular.
 */

export type TowerId = 'norah' | 'barbara' | 'pete' | 'bill' | 'walter' | 'clara';

export type EnemyId = 'sam' | 'mike' | 'ben' | 'tina' | 'gang' | 'walker';

export const TOWER_IDS: TowerId[] = ['norah', 'barbara', 'pete', 'bill', 'walter', 'clara'];
export const ENEMY_IDS: EnemyId[] = ['sam', 'mike', 'ben', 'tina', 'gang', 'walker'];

/**
 * How a tower acts on its turn.
 *
 * A single field rather than a pile of booleans, so `fireTowers` is one switch
 * and no tower needs a special case anywhere else. Adding a seventh defender
 * means adding a mode or reusing one, not editing the firing loop.
 */
export type TowerMode =
  /** Throws something at one target; splash lands where it hits. */
  | 'projectile'
  /** Hits everything in range around itself, instantly. */
  | 'pulse'
  /** Never fires. Buffs towers near it. */
  | 'support'
  /** Never fires. Stands on the lane and is attacked. */
  | 'blocker';

export interface TowerDef {
  id: TowerId;
  mode: TowerMode;
  cost: number;
  /** Damage per hit, before the target's armour and shield. */
  damage: number;
  /** Pixels. For a support tower this is the reach of its buff. */
  range: number;
  /** Ticks between shots at rateMult 1. The sim runs at 60 ticks/sec. */
  cooldown: number;
  /** Radius the hit also lands in. 0 is single target. */
  splash: number;
  /** Ticks of slow applied on hit. */
  slowTicks: number;
  /** Fraction of speed removed while slowed. */
  slowFactor: number;
  /** Ticks of stun applied on hit. Ignored by stun-immune enemies. */
  stunTicks: number;
  /** Support only: multiplier applied to the fire rate of towers in range. */
  buffRate: number;
  /** Blocker only: how much it can absorb before it goes down. */
  maxHp: number;
}

export interface EnemyDef {
  id: EnemyId;
  hp: number;
  /** Pixels travelled per tick at speedMult 1. */
  speed: number;
  /** Subtracted from every hit. Punishes many weak shots, not one big one. */
  armour: number;
  /** Paid when it dies. */
  bounty: number;
  /** Lives lost if it reaches the end. */
  leakCost: number;
  stunImmune: boolean;
  /**
   * Flat absorption granted to *other* enemies within `auraRange`.
   *
   * Never to itself, deliberately: a shield carrier that shielded itself could
   * be unkillable by the very towers it is meant to punish, and the intended
   * answer to a shield carrier is to shoot the carrier.
   */
  shieldAura: number;
  /** True if towers within `auraRange` stop firing while this is near them. */
  disablesTowers: boolean;
  /** Reach of whichever aura this enemy has. */
  auraRange: number;
  /** What it leaves behind when it dies, and how many. */
  splitsInto: EnemyId | null;
  splitCount: number;
  /** Damage per second dealt to a blocker standing in the way. */
  blockerDps: number;
}

export interface Enemy {
  id: number;
  def: EnemyId;
  /** Distance travelled along the lane, in pixels. */
  dist: number;
  /**
   * Where `dist` puts it. Derived, never a source of truth, but kept because
   * the lane is a polyline that has to be walked to convert one to the other
   * and targeting reads a position several times per tick per tower.
   *
   * Maintained wherever `dist` is written, which is `spawnEnemy` and
   * `advanceEnemies` and nowhere else.
   */
  x: number;
  y: number;
  hp: number;
  /** Toughness multiplier for the round, applied to hp on spawn. */
  scale: number;
  alive: boolean;
  /** Ticks of hit highlight left. Render-only, but deterministic. */
  flash: number;

  /**
   * Status in progress, as flat numbers.
   *
   * Resolved once, when the hit lands, and ticked down as plain arithmetic
   * afterwards. Nothing here may re-enter damage application: an effect that
   * re-ran the hit would re-apply itself and never expire.
   */
  slowTicks: number;
  slowFactor: number;
  stunTicks: number;
  /** Derived from the two above every tick. Never written directly. */
  speedMult: number;
  /** Derived from nearby shield carriers every tick. Never written directly. */
  shield: number;
  /** Id of the blocker it is stuck behind, if any. */
  blockedBy: number | null;
  /** Ticks until it may hit that blocker again. */
  attackCd: number;
}

export interface Tower {
  id: number;
  def: TowerId;
  col: number;
  row: number;
  /** Pixel centre. */
  x: number;
  y: number;
  /** Ticks until it may fire again. */
  cooldown: number;
  /** Blocker only. At zero the tower is removed from the board. */
  hp: number;
  /** Where it sits along the lane. Blockers only; -1 for everything else. */
  laneDist: number;
  /** Derived from nearby support towers every tick. Never written directly. */
  rateMult: number;
  /** Derived from nearby disruptors every tick. Never written directly. */
  disabled: boolean;
  /**
   * Id of the enemy this tower is currently aimed at, or null when it has
   * none in range. Unused for now -- `findTarget` picks a target fresh each
   * tick and discards it once a shot is fired, so nothing currently writes
   * this field. It exists so a future facing/rotation feature (the tower
   * turning to face what it shoots, purely cosmetic -- this game has no aim
   * mechanic) has somewhere to read a target from between shots, without
   * `src/render/` needing to re-run targeting logic itself.
   */
  targetId: number | null;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  /** Copied from the firing tower, so a shot outlives the tower that fired it. */
  damage: number;
  speed: number;
  splash: number;
  slowTicks: number;
  slowFactor: number;
  stunTicks: number;
  /** Only so the renderer can draw the right sprite. Not read by the sim. */
  from: TowerId;
}

export type SimEventType = 'hit' | 'kill' | 'leak' | 'split' | 'blockerDown' | 'stun';

export interface SimEvent {
  type: SimEventType;
  x: number;
  y: number;
  text?: string;
}

export type Status = 'idle' | 'running' | 'won' | 'lost';

export interface Stats {
  kills: number;
  leaks: number;
  /** Which troublemakers got through. The most useful balance diagnostic. */
  leaksByEnemy: Record<EnemyId, number>;
  livesLost: number;
  goldEarned: number;
  blockersLost: number;
}
