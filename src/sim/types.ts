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

export type EnemyId = 'sam' | 'mike' | 'ben' | 'tina' | 'gang' | 'skye' | 'walker';

export const TOWER_IDS: TowerId[] = ['norah', 'barbara', 'pete', 'bill', 'walter', 'clara'];
export const ENEMY_IDS: EnemyId[] = ['sam', 'mike', 'ben', 'tina', 'gang', 'skye', 'walker'];

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

  /**
   * The upgrade tree's own fields. Every one of these is a no-op at its
   * default, so the towers that never touch them are unaffected -- the same
   * "flat data, zero means absent" convention the fields above already use.
   */
  /** Blocker only: HP/sec regained while still standing. */
  regen?: number;
  /** Blocker only: ticks before Second Wind gets it back up, once a round. */
  reviveDelayTicks?: number;
  /** Blocker only: fraction of max HP it comes back with. */
  reviveHpFrac?: number;
  /** Simultaneous targets a projectile tower fires at. 1 is one shot, one mark. */
  multiShot?: number;
  /** Extra enemies a projectile hits in a line behind the first. 0 stops at one. */
  pierce?: number;
  /** Support only: extra range fraction granted to buffed neighbours. */
  rangeBuffBonus?: number;
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
   * Fraction of an incoming slow ignored. 0 takes a slow in full, 1 shrugs it
   * off entirely.
   *
   * A stat rather than an immunity flag, for the same reason armour is not a
   * table: it scales what a slow is worth instead of switching it off, so a
   * heavy slow is still worth something against a resistant target.
   */
  slowResist: number;
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
  /**
   * Derived from nearby support towers every tick, same as `rateMult` and by
   * the same function -- Clara's Second Round is the only source of this, but
   * it is reset and recomputed for everyone so no tower needs a special case.
   */
  rangeMult: number;
  /** Derived from nearby disruptors every tick. Never written directly. */
  disabled: boolean;
  /** Tiers bought on each of the two upgrade paths, 0 to 2. */
  upgradeA: 0 | 1 | 2;
  upgradeB: 0 | 1 | 2;
  /** Which capstone was chosen, or none yet. Cannot be changed once set. */
  capstone: string | null;
  /** Blocker only: how many times Second Wind has already brought it back. */
  revivesUsed: number;
  /** Blocker only: the tick Second Wind gets it back up, or none pending. */
  reviveAt: number | null;
  /**
   * Id of the enemy this tower is currently aimed at, or null when it has none
   * in range. Written by `fireTowers` every tick, including ticks where the
   * tower is on cooldown or disabled, and held until the enemy dies or leaves
   * range.
   *
   * Purely cosmetic: it exists so `src/render/` can turn the character to face
   * what it is shooting without re-running the targeting logic itself. This
   * game has no aim mechanic, and nothing in the simulation reads this field.
   * Always null for support, blocker and pulse towers, which have no single
   * enemy to face.
   */
  targetId: number | null;
  /**
   * How many troublemakers this tower has finished off since it was placed.
   * Counts the hit that took an enemy to zero, so a splash that clears four
   * at once scores four. Never reset: selling the tower is what clears it,
   * and ids are never reused, so a replacement starts from nothing.
   *
   * Leaks are not counted -- an enemy that reaches the end never goes through
   * `kill` -- and support and blocker towers can never score, since neither
   * ever deals damage.
   */
  sentHome: number;
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
  /** Extra enemies still owed a hit behind whichever one this lands on. */
  pierceRemaining: number;
  /** Only so the renderer can draw the right sprite. Not read by the sim. */
  from: TowerId;
  /**
   * Id of the `Tower` that fired this, as opposed to `from`, which is the
   * kind of tower it was. Only this one identifies the piece on the board,
   * and it is what a kill is credited to. The tower may be gone by the time
   * the shot lands, in which case nothing is credited.
   */
  sourceId: number;
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
