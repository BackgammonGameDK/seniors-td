/**
 * The shapes the simulation runs on.
 *
 * There is deliberately no counter table here -- no element chart, no
 * type matchups. A tower is told apart from another by damage, range, rate,
 * whether it splashes, and whether it multiplies what its neighbours do.
 * Armour and shields soften a hit, but they are stats on an enemy rather than
 * a lookup, so no tower is ever the answer to one troublemaker in particular.
 */

export type TowerId =
  | 'norah'
  | 'barbara'
  | 'pete'
  | 'bill'
  | 'walter'
  | 'clara'
  | 'harold'
  | 'betty';

export type EnemyId =
  | 'sam'
  | 'mike'
  | 'ben'
  | 'tina'
  | 'gang'
  | 'skye'
  | 'duke'
  | 'walker'
  | 'paul';

/**
 * Every defender, in the order the shop lists them and the number keys select
 * them. This is the one entry in the whole registry a compiler cannot check:
 * it is a hand-written array, so a defender left out of it still exists in the
 * simulation and in a loadout string while never appearing in the shop at all.
 * `tests/towers.test.ts` holds it against `TOWERS` for exactly that reason.
 */
export const TOWER_IDS: TowerId[] = [
  'norah',
  'barbara',
  'pete',
  'bill',
  'walter',
  'clara',
  'harold',
  'betty',
];

/**
 * Which capstone belongs to which defender.
 *
 * Written down as a type because a capstone coming adrift from its tower has
 * happened: eight entries in `builds.ts` once asked a Knitting Norah for
 * Barbara's Big Batch and a Protest Pete for Walter's Stone Wall, and nothing
 * complained, because the id was a bare string all the way from the build to
 * the fold. Runtime checks caught it in the end. This is what would have
 * caught it while it was being written.
 *
 * `src/sim/upgrades.ts` holds the capstones themselves and is checked against
 * this table, so the two cannot drift; the ids live here rather than there so
 * that `src/shared/upgrades.ts` can name them without reaching into the
 * simulation's data.
 */
export interface CapstoneIds {
  norah: 'longYarn' | 'tripleKnit';
  barbara: 'bigBatch' | 'freshBatch';
  pete: 'megaphone' | 'bullhorn';
  bill: 'deadeye' | 'piercingShot';
  walter: 'stoneWall' | 'rally';
  clara: 'doubleEspresso' | 'secondRound';
  harold: 'fullMains' | 'soapyWater';
  betty: 'solidBall' | 'theWholeLot';
}

/** Any capstone, whoever it belongs to. */
export type CapstoneId = CapstoneIds[TowerId];

/** What can be bought on a tower that already has one: a tier, or the fork. */
export type UpgradeChoice = 'pathA' | 'pathB' | CapstoneId;
export const ENEMY_IDS: EnemyId[] = [
  'sam',
  'mike',
  'ben',
  'tina',
  'gang',
  'skye',
  'duke',
  'walker',
  'paul',
];

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
   * Pixels a shot of this tower's covers per tick, if not the default nine.
   *
   * Only Betty sets it, and only downwards: a bowling ball that arrived as
   * fast as a knitting needle was a dot that blinked out on contact, which is
   * the one thing she is not. Nothing in the upgrade tree buys it, so it is
   * the same number for a bought Betty as for a fresh one.
   */
  projectileSpeed?: number;

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
  /**
   * What fraction of the hit is left for each further body a pierce passes
   * through. 1 carries the whole hit all the way down the line.
   *
   * The rail under a line shot, and it exists because a line shot multiplies
   * rather than adds: every body in the queue is another copy of the same
   * damage, so a second tower shooting the same queue is not twice as good but
   * twice as good *again*. Six bowling balls through one queue behind a
   * blockade cleared the whole campaign without losing a single point.
   *
   * A stat rather than a rule for all pierce, so the two towers that own a
   * line can mean different things by it: a bowling ball loses its weight
   * through a crowd, while Bill's one carried shot does not.
   */
  pierceFalloff?: number;
  /**
   * How far a carrying shot travels after it stops aiming, in pixels. Only
   * read when `pierce` is above zero.
   *
   * This is the difference between a rifle round and a bowling ball, said as a
   * number rather than as a branch. Bill's round carries a little past the
   * body it went through; Betty's ball holds its heading across the garden,
   * whether or not anybody is standing in the way. The stretch of it left
   * after the bodies run out is a spent ball rolling to a stop, which exists
   * because a ball that vanished the moment it ran out of people to knock
   * down was the thing a player could see was wrong.
   */
  rollOut?: number;
  /** Support only: extra range fraction granted to buffed neighbours. */
  rangeBuffBonus?: number;
  /**
   * Chance, from 0 to 1, that a hit knocks the target off their feet and sends
   * them back down the street. 0 never does.
   *
   * A roll rather than a flat effect on purpose: a certainty would let a row of
   * these hold the street still, whereas a chance makes a defender who pushes
   * people backwards a matter of how long they stand in the water.
   */
  slipChance?: number;
  /** Pixels back along the lane a slip sends them. 0 moves nobody. */
  slipPush?: number;
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
  /** What this spawns while it's still alive, or null if it never does. */
  dropsInto: EnemyId | null;
  /** Ticks between one drop and the next while alive. Ignored when `dropsInto` is null. */
  dropInterval: number;
  /** Damage per second dealt to a blocker standing in the way. */
  blockerDps: number;
  /** True if it walks straight through a blockade instead of stopping at it. */
  ignoresBlockers: boolean;
  /**
   * Hit points won back each second while nothing is hurting it. 0 never heals.
   *
   * Capped at what it spawned with, so a round's toughness multiplier is the
   * ceiling too and nothing ever climbs above the health it arrived on.
   */
  regenPerSec: number;
  /**
   * Ticks after the last hit that *landed* before healing resumes.
   *
   * Damage interrupts it and nothing else does: a shout that lands no damage
   * leaves it eating, so no single defender is the answer to a healer.
   */
  regenDelayTicks: number;
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
   * Maintained wherever `dist` is written, which is `spawnEnemy`,
   * `advanceEnemies` and `applyHit` -- the last of those only to send someone
   * who has slipped back down the street -- and nowhere else.
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
  /**
   * How used to being shouted at this troublemaker has got.
   *
   * Every stun that lands raises it, and each step of it shortens the *next*
   * stun. Without this, a tower whose stun lasts as long as its own cooldown
   * freezes the street outright -- and because Clara multiplies how often a
   * tower acts but not how long its stun lasts, enough coffee did that to any
   * Pete, capstone or not. It fades again while nobody is shouting, so it
   * wears a stun down rather than granting immunity to one.
   */
  stunFatigue: number;
  /** Ticks until `stunFatigue` eases by one. */
  stunRecovery: number;
  /**
   * Countdown to this enemy's next drop, for whichever enemy has one.
   *
   * Maintained wherever `dropCooldown` is written, which is `spawnEnemy` and
   * `advanceDrops` and nowhere else -- the same discipline `dist` gets above,
   * kept on a field that only Duke ever uses.
   */
  dropCooldown: number;
  /**
   * Ticks until this enemy starts healing again, for whichever enemy heals.
   *
   * Maintained wherever `regenCd` is written, which is `spawnEnemy`,
   * `applyHit` and `advanceRegen` and nowhere else -- the same discipline
   * `dropCooldown` gets above, kept on a field that only Paul ever uses.
   */
  regenCd: number;
  /**
   * Ticks before this troublemaker can be knocked off their feet again.
   *
   * The rail under the slip. Without it a line of hoses would push someone
   * backwards on every hit and the street would never advance -- with it, a
   * slip costs them ground once and then they walk for a second whatever else
   * lands. Maintained wherever it is written, which is `spawnEnemy`,
   * `applyHit` and `advanceEffects` and nowhere else.
   */
  slipCooldown: number;
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
  capstone: CapstoneId | null;
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
  /**
   * Whether this hurts everybody along its line rather than only its mark.
   * True for a shot whose tower carries; false for a bun or a needle.
   */
  carries: boolean;
  /** People this can still knock down, the first one included. */
  bodiesLeft: number;
/**
   * Whether this has stopped aiming at anybody. A shot that has hit something,
   * or lost its mark, becomes a thing travelling in a straight line.
   */
  rolling: boolean;
  /**
   * The way it is going, as a unit vector, kept current while it is still
   * flying so that the roll can carry on along it.
   *
   * A rolling ball holds its heading and lets the street bend away from it,
   * which is why this is a direction and not a place in the lane: it was
   * following the road around corners, and a ball that is steered is a ball
   * nobody believes.
   */
  dirX: number;
  dirY: number;
  /** Pixels of roll left after it stopped aiming. Zero on a shot that cannot carry. */
  rollLeft: number;
  /** Everyone already knocked down by this one, so a roll cannot hit twice. */
  hitIds: number[];
  /** What each further body in the line keeps of the hit. See `TowerDef`. */
  pierceFalloff: number;
  slipChance: number;
  slipPush: number;
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

export type SimEventType =
  | 'hit'
  | 'kill'
  | 'leak'
  | 'split'
  | 'drop'
  | 'blockerDown'
  | 'stun'
  | 'slip';

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
