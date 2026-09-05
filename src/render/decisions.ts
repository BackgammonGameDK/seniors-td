/**
 * What the interface decides, without the interface.
 *
 * Everything here is a pure function over plain data, and everything here
 * could otherwise have lived inside an event handler where no test can reach
 * it. That is not a hypothetical tidiness argument: in the previous project
 * every single interface bug came from exactly that -- a selected tower that
 * could not be deselected, a panel showing the tower clicked before this one,
 * and a board that read its target cell from a `mousemove`, which made the
 * game completely unplayable by touch.
 *
 * The rule: if a change is a *decision*, it belongs in this file with a test
 * named after what it protects. If it is a *drawing*, it belongs in canvas.ts.
 */
import { ENEMIES } from '../sim/enemies.ts';
import { TOWERS } from '../sim/towers.ts';
import { TOWER_IDS } from '../sim/types.ts';
import type { Enemy, EnemyId, Stats, Tower, TowerDef, TowerId } from '../sim/types.ts';
import { AUTHORED_ROUNDS, WAVES } from '../sim/waves.ts';
import { UPGRADES } from '../sim/upgrades.ts';
import { cooldownAt } from '../sim/world.ts';
import { ENEMY_LOOK, TOWER_LOOK } from '../shared/display.ts';

/** What a tap on the board means, given what is already going on. */
export type BoardAction = 'place' | 'inspect' | 'close' | 'unarm' | 'nothing';

export function boardAction(opts: {
  /** The tower armed on the build menu, if any. */
  selected: TowerId | null;
  /** Whether a tower already stands on the tapped cell. */
  occupied: boolean;
  /** Whether the tapped cell is legal for the armed tower. */
  legal: boolean;
  /** Whether the inspect panel is currently open on that same tower. */
  inspectingSame: boolean;
  /** Whether the inspect panel is open on anything at all. */
  hasInspected: boolean;
}): BoardAction {
  if (opts.occupied) return opts.inspectingSame ? 'close' : 'inspect';
  if (opts.selected) return opts.legal ? 'place' : 'unarm';
  // An empty, unarmed tap elsewhere on the board reads as "done looking at
  // that one" -- the same as tapping it again or pressing Escape.
  if (opts.hasInspected) return 'close';
  return 'nothing';
}

/**
 * Number keys arm a tower. Returns null for anything else, so a handler can
 * pass every keystroke through without knowing which ones matter.
 */
export function towerForKey(key: string): TowerId | null {
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1 || n > TOWER_IDS.length) return null;
  return TOWER_IDS[n - 1]!;
}

/**
 * Arming a tower is a toggle.
 *
 * Tapping the armed tower again disarms it. Without this there is no way back
 * out of a mis-tap on a touch screen, where there is no Escape key -- which is
 * the bug this function exists to have a test for.
 */
export function armTower(current: TowerId | null, clicked: TowerId): TowerId | null {
  return current === clicked ? null : clicked;
}

export interface CardState {
  affordable: boolean;
  selected: boolean;
  className: string;
}

export function cardState(opts: { gold: number; cost: number; isSelected: boolean }): CardState {
  const affordable = opts.gold >= opts.cost;
  const classes = ['card'];
  if (!affordable) classes.push('poor');
  if (opts.isSelected) classes.push('on');
  return { affordable, selected: opts.isSelected, className: classes.join(' ') };
}

/**
 * A key that changes whenever the inspect panel would need redrawing.
 *
 * The panel is rebuilt only when this changes, which is what stops it showing
 * the tower that was clicked before this one.
 */
export function panelKey(t: Tower | null): string {
  if (!t) return 'none';
  // The multipliers belong in the key too: a Clara put down or sent home next
  // door changes what this panel should say without touching the tower itself.
  return [
    t.id,
    t.def,
    Math.ceil(t.hp),
    t.upgradeA,
    t.upgradeB,
    t.capstone ?? '',
    t.rateMult,
    t.rangeMult,
  ].join(':');
}

export function waveLabel(waveIndex: number): string {
  return `${Math.min(waveIndex + 1, AUTHORED_ROUNDS)}/${AUTHORED_ROUNDS}`;
}

export interface Readout {
  /** The number, already formatted for reading. */
  value: string;
  /**
   * What the number means, in words. Empty when the picture says it alone.
   */
  label: string;
  /**
   * A picture that stands in front of the number.
   *
   * `null` means the words carry it alone. A name here is a request, not a
   * promise -- the renderer draws the picture if it has one and an emoji if
   * it does not, so naming an icon before the artwork exists is safe.
   */
  icon: 'coin' | 'heart' | null;
}

/**
 * What the player owns: coins to spend and lives to lose, in that order.
 *
 * Here rather than in the drawing code because the phrasing is a decision: a
 * coin count is floored so a tower's price never looks affordable by a
 * fraction, and each is a picture and a number with no words at all. A coin
 * and a heart are read the same way in every language, which "pension coins"
 * and "peace & quiet" are not.
 */
export function hudReadouts(opts: { gold: number; lives: number }): Readout[] {
  return [
    { value: String(Math.floor(opts.gold)), label: '', icon: 'coin' },
    { value: String(opts.lives), label: '', icon: 'heart' },
  ];
}

/**
 * How far through the campaign the player is.
 *
 * Apart from the resources, because it is not one: coins and lives change
 * from second to second and belong together under the eye, where the round
 * changes once a round and sits out of the way in the far corner. It keeps
 * its word, since 1/20 on its own could be anything.
 */
export function roundReadout(waveIndex: number): Readout {
  return { value: waveLabel(waveIndex), label: 'round', icon: null };
}

export interface RunButton {
  label: string;
  /** `start` begins the round; `toggle` pauses or resumes the one running. */
  action: 'start' | 'toggle';
  disabled: boolean;
}

/**
 * The one button that runs the game.
 *
 * There used to be two, and one of them was always disabled: "Start round"
 * greyed out for the whole round, "Pause" greyed out between rounds. They are
 * the same question -- should time be passing? -- so they are one button that
 * says what it will do next.
 *
 * Speed stays its own control. Folding it in here would hide which speed is
 * set and put it out of reach while paused.
 */
export function runButton(opts: { status: string; paused: boolean }): RunButton {
  if (opts.status === 'idle') {
    return { label: 'Start round', action: 'start', disabled: false };
  }
  if (opts.status === 'running') {
    return {
      label: opts.paused ? 'Resume' : 'Pause',
      action: 'toggle',
      disabled: false,
    };
  }
  // Won or lost: the overlay is up and there is nothing left to run.
  return { label: 'Start round', action: 'start', disabled: true };
}

export interface PreviewRow {
  enemy: EnemyId;
  name: string;
  count: number;
  glyph: string;
}

/** Who is coming next round, so the player can spend before it starts. */
export function roundPreview(waveIndex: number): PreviewRow[] {
  const wave = WAVES[waveIndex];
  if (!wave) return [];
  const totals = new Map<EnemyId, number>();
  for (const g of wave.groups) totals.set(g.enemy, (totals.get(g.enemy) ?? 0) + g.count);
  return [...totals.entries()].map(([enemy, count]) => ({
    enemy,
    count,
    name: ENEMY_LOOK[enemy].name,
    glyph: ENEMY_LOOK[enemy].glyph,
  }));
}

export function endOverlay(opts: { status: string; waveIndex: number; stats: Stats }): {
  show: boolean;
  title: string;
  body: string;
} {
  if (opts.status === 'won') {
    return {
      show: true,
      title: 'Peace and quiet',
      body: `All ${AUTHORED_ROUNDS} rounds held. ${opts.stats.kills} troublemakers sent home.`,
    };
  }
  if (opts.status === 'lost') {
    return {
      show: true,
      title: 'The neighbourhood gave up',
      body: `They got through on round ${opts.waveIndex + 1}. ${opts.stats.leaks} slipped past in all.`,
    };
  }
  return { show: false, title: '', body: '' };
}

/**
 * Which enemy a tap landed on, if any.
 *
 * Nearest first, so overlapping sprites resolve to the one on top rather than
 * to whichever happens to come first in the list.
 */
export function pickEnemy(
  targets: { id: number; x: number; y: number; radius: number }[],
  point: { x: number; y: number },
): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - point.x, t.y - point.y);
    if (d <= t.radius + 4 && d < bestD) {
      best = t.id;
      bestD = d;
    }
  }
  return best;
}

/** Shots per second, for a build card. Rate reads better than a tick count. */
export function rate(cooldownTicks: number): string {
  if (cooldownTicks <= 0) return '--';
  return `${(60 / cooldownTicks).toFixed(1)}/s`;
}

export interface StatRow {
  label: string;
  value: string;
  /**
   * What this row said before the upgrade being previewed. Only ever set by
   * `previewStats`, so an ordinary panel row carries neither field.
   */
  was?: string;
  /** True for a row the upgrade changes, including one it adds outright. */
  changed?: boolean;
}

/**
 * What a neighbour standing nearby is doing to this tower, right now.
 *
 * Both come straight off the tower the panel is showing, which is the only
 * place they are ever true -- a build card has no neighbours yet, so it leaves
 * them out and gets the plain numbers.
 */
export interface Buffs {
  rateMult?: number;
  rangeMult?: number;
}

/**
 * What a build card says about a tower.
 *
 * Written for someone meeting the game for the first time, so every row names
 * the effect rather than the jargon: "slows them by 35%", not "slowFactor
 * 0.35". A player should not have to already know a word to read this panel.
 */
export function describeStats(def: TowerDef, buffs: Buffs = {}): StatRow[] {
  const rateMult = buffs.rateMult ?? 1;
  const rangeMult = buffs.rangeMult ?? 1;
  const range = Math.round(def.range * rangeMult);
  const reach = rangeMult > 1 ? `${range} px, up from ${def.range}` : `${def.range} px`;
  const rows: StatRow[] = [{ label: 'Cost', value: `${def.cost} coins` }];
  if (def.mode === 'blocker') {
    rows.push({ label: 'Stands in', value: 'the road itself' });
    rows.push({ label: 'Holds', value: `${def.maxHp} damage before falling` });
    if ((def.regen ?? 0) > 0) {
      rows.push({ label: 'Patches himself up', value: `${def.regen} damage a second` });
    }
    if ((def.reviveHpFrac ?? 0) > 0) {
      rows.push({
        label: 'Gets back up with',
        value: `${Math.round((def.reviveHpFrac ?? 0) * 100)}% of himself`,
      });
    }
    return rows;
  }
  if (def.mode === 'support') {
    rows.push({ label: 'Reach', value: reach });
    rows.push({
      label: 'Neighbours',
      value: `fire ${Math.round((def.buffRate - 1) * 100)}% faster`,
    });
    return rows;
  }
  rows.push({ label: 'Damage', value: def.damage > 0 ? `${def.damage} a hit` : 'none' });
  rows.push({ label: 'Reach', value: reach });
  rows.push({
    label: 'Rate',
    value:
      rateMult > 1
        ? `${rate(cooldownAt(def.cooldown, rateMult))}, up from ${rate(def.cooldown)}`
        : rate(def.cooldown),
  });
  if (def.splash > 0) {
    rows.push({
      label: 'Area',
      value: def.mode === 'pulse' ? 'everyone around him' : `${def.splash} px burst`,
    });
  }
  if (def.slowTicks > 0) {
    rows.push({
      label: 'Slow',
      value: `${Math.round(def.slowFactor * 100)}% slower for ${(def.slowTicks / 60).toFixed(1)}s`,
    });
  }
  if (def.stunTicks > 0) {
    rows.push({ label: 'Stops them', value: `${(def.stunTicks / 60).toFixed(1)}s` });
  }
  if ((def.multiShot ?? 1) > 1) {
    rows.push({ label: 'Picks', value: `${def.multiShot} of them at once` });
  }
  if ((def.pierce ?? 0) > 0) {
    rows.push({
      label: 'Carries on through',
      value: `${def.pierce} more behind the first`,
    });
  }
  return rows;
}

/**
 * The same rows, as they would read after buying one upgrade.
 *
 * The formatting is not repeated here: both sides go through `describeStats`,
 * so a preview cannot word a stat differently from the panel it sits in, and
 * a row that appears only after the upgrade (splash on a tower that had none)
 * comes out marked as new rather than silently missing.
 */
export function previewStats(
  def: TowerDef,
  next: Partial<TowerDef>,
  buffs: Buffs = {},
): StatRow[] {
  const before = describeStats(def, buffs);
  const after = describeStats({ ...def, ...next }, buffs);
  return after.map((row) => {
    const was = before.find((r) => r.label === row.label);
    if (!was) return { ...row, changed: true };
    if (was.value === row.value) return row;
    return { ...row, was: was.value, changed: true };
  });
}

/**
 * What a hovered upgrade card would actually apply.
 *
 * The card carries only its `data-choice`, the same string the buy handler
 * sends, so the stat object is looked up here rather than written into the
 * DOM -- one place decides what a choice means. `null` for a path with
 * nothing left to buy, or an id that is not a capstone of this tower.
 */
export function hoveredStat(t: Tower, choice: string | null): Partial<TowerDef> | null {
  if (!choice) return null;
  const tree = UPGRADES[t.def];
  if (choice === 'pathA' || choice === 'pathB') {
    const { tierIndex, finished } = pathCard(choice === 'pathA' ? t.upgradeA : t.upgradeB);
    return finished ? null : (tree[choice][tierIndex]?.stat ?? null);
  }
  return tree.capstones.find((c) => c.id === choice)?.stat ?? null;
}

export interface EnemyReadout {
  name: string;
  lines: string[];
}

/** What an enemy is, in words a first-time player can act on. */
export function enemyReadout(e: Pick<Enemy, 'def' | 'hp' | 'scale'>): EnemyReadout {
  const d = ENEMIES[e.def];
  const lines: string[] = [`${Math.max(0, Math.ceil(e.hp))} health left`];
  if (d.armour > 0) lines.push(`Armour ${d.armour}: every hit lands ${d.armour} lighter.`);
  if (d.stunImmune) lines.push('Cannot be stopped by shouting.');
  if (d.slowResist > 0) {
    lines.push(`Rolls on: slowing works ${Math.round(d.slowResist * 100)}% less on her.`);
  }
  if (d.shieldAura > 0) lines.push(`Shields nearby troublemakers by ${d.shieldAura} a hit.`);
  if (d.disablesTowers) lines.push('Nearby defenders stop working.');
  if (d.splitsInto) lines.push(`Breaks into ${d.splitCount} on the way down.`);
  return { name: ENEMY_LOOK[e.def].name, lines };
}

/** Build-card copy, kept beside the stats it belongs with. */
export function towerCard(id: TowerId): { name: string; blurb: string; rows: StatRow[] } {
  return {
    name: TOWER_LOOK[id].name,
    blurb: TOWER_LOOK[id].blurb,
    rows: describeStats(TOWERS[id]),
  };
}

// --- upgrades -----------------------------------------------------------

/**
 * What tapping an upgrade card means, before any DOM is involved.
 *
 * `bought` beats everything else -- a card that is both bought and (say)
 * unaffordable to re-buy should read as owned, not as poor. A capstone that
 * lost to its sibling reads as its own case rather than plain `locked`, so
 * the panel can say *why* it is closed rather than just that it is.
 */
export type UpgradeAction =
  | 'buy'
  | 'bought'
  | 'locked'
  | 'unaffordable'
  | 'otherCapstoneChosen';

export function upgradeAction(opts: {
  gold: number;
  cost: number;
  alreadyBought: boolean;
  /** True when a prerequisite is missing: the tier before this one, or (for
   * a capstone) either path short of its last tier. */
  locked: boolean;
  /** Capstone only: a *different* capstone has already been chosen. */
  otherCapstoneChosen?: boolean;
}): UpgradeAction {
  if (opts.alreadyBought) return 'bought';
  if (opts.otherCapstoneChosen) return 'otherCapstoneChosen';
  if (opts.locked) return 'locked';
  if (opts.gold < opts.cost) return 'unaffordable';
  return 'buy';
}

export interface UpgradeCardState {
  action: UpgradeAction;
  className: string;
}

/** A build-card-shaped read-out for one tier or capstone row. */
export function upgradeCardState(opts: Parameters<typeof upgradeAction>[0]): UpgradeCardState {
  const action = upgradeAction(opts);
  const classes = ['card'];
  if (action === 'bought') classes.push('bought');
  if (action === 'locked' || action === 'otherCapstoneChosen') classes.push('locked');
  if (action === 'unaffordable') classes.push('poor');
  return { action, className: classes.join(' ') };
}

/**
 * Whether the tier just past `tierIndex` on a path has already been bought.
 *
 * `boughtTier` is `tower.upgradeA`/`upgradeB`: how many of the path's two
 * tiers are owned. Tier 0 (the first) is locked by nothing; tier 1 (the
 * second) is locked until tier 0 is bought.
 */
export interface PathCard {
  /** Which of the path's two tiers the card should describe. */
  tierIndex: 0 | 1;
  /** True when both tiers are bought, so the card reads as owned. */
  finished: boolean;
}

/**
 * Which single card a path shows, given how much of it has been bought.
 *
 * A path shows only its next tier, so there is never more than one card open
 * on a path at a time. A finished path keeps its last tier on show, marked
 * owned, rather than disappearing: both paths staying put is what lets the
 * panel be read as a choice between two routes. With one of them gone, a
 * tower that had gone all the way down speed looked like a tower with no
 * speed upgrades at all.
 */
export function pathCard(bought: 0 | 1 | 2): PathCard {
  return bought === 2 ? { tierIndex: 1, finished: true } : { tierIndex: bought, finished: false };
}

export function pathTierLocked(tierIndex: 0 | 1, boughtTier: 0 | 1 | 2): boolean {
  return tierIndex > boughtTier;
}

/** A capstone is reachable only once both paths are fully bought. */
export function capstoneLocked(upgradeA: 0 | 1 | 2, upgradeB: 0 | 1 | 2): boolean {
  return upgradeA < 2 || upgradeB < 2;
}

/**
 * How much of a turn to add so a sprite drawn head-on ends up looking at the
 * thing it is aimed at.
 *
 * The character pictures are drawn facing the viewer, which on the board is
 * straight down the screen -- the `+y` direction, an angle of `PI / 2`. So an
 * angle measured with `atan2` has to be turned back by that much before it can
 * be handed to `rotate`. Naming it means that if the artwork is ever redrawn
 * facing some other way, this one number is the whole fix.
 */
export const SPRITE_FRONT = Math.PI / 2;

/**
 * The angle to rotate a tower by so its front points at (`toX`, `toY`).
 *
 * Purely cosmetic: this game has no aim mechanic, and a tower hits whatever
 * `findTarget` picked whichever way it happens to be facing.
 */
export function facingAngle(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.atan2(toY - fromY, toX - fromX) - SPRITE_FRONT;
}

/**
 * A step of `current` towards `desired`, taking whichever way round is
 * shorter.
 *
 * Without the wrap, a tower whose target crossed from just under `PI` to just
 * over `-PI` would spin almost the whole way round to travel a couple of
 * degrees. `rate` is the fraction of the remaining turn covered per frame, so
 * the turn starts quickly and settles.
 */
export function easeAngle(current: number, desired: number, rate: number): number {
  let diff = desired - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * rate;
}
