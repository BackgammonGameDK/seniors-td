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
  return `${t.id}:${t.def}:${Math.ceil(t.hp)}:${t.upgradeA}:${t.upgradeB}:${t.capstone ?? ''}`;
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
   * A picture that stands just after the number.
   *
   * `null` means the words carry it alone. A name here is a request, not a
   * promise -- the renderer draws the picture if it has one and an emoji if
   * it does not, so naming an icon before the artwork exists is safe.
   */
  icon: 'coin' | 'heart' | null;
}

/**
 * The three numbers along the top of the board, in the order they are read.
 *
 * Here rather than in the drawing code because the phrasing is a decision: a
 * coin count is floored so a tower's price never looks affordable by a
 * fraction, and the two resources are a picture and a number with no words at
 * all. A coin and a heart are read the same way in every language, which
 * "pension coins" and "peace & quiet" are not. The round keeps its word,
 * because 1/20 on its own could be anything.
 */
export function hudReadouts(opts: {
  gold: number;
  lives: number;
  waveIndex: number;
}): Readout[] {
  return [
    { value: String(Math.floor(opts.gold)), label: '', icon: 'coin' },
    { value: String(opts.lives), label: '', icon: 'heart' },
    { value: waveLabel(opts.waveIndex), label: 'round', icon: null },
  ];
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
}

/**
 * What a build card says about a tower.
 *
 * Written for someone meeting the game for the first time, so every row names
 * the effect rather than the jargon: "slows them by 35%", not "slowFactor
 * 0.35". A player should not have to already know a word to read this panel.
 */
export function describeStats(def: TowerDef): StatRow[] {
  const rows: StatRow[] = [{ label: 'Cost', value: `${def.cost} coins` }];
  if (def.mode === 'blocker') {
    rows.push({ label: 'Stands in', value: 'the road itself' });
    rows.push({ label: 'Holds', value: `${def.maxHp} damage before falling` });
    return rows;
  }
  if (def.mode === 'support') {
    rows.push({ label: 'Reach', value: `${def.range} px` });
    rows.push({
      label: 'Neighbours',
      value: `fire ${Math.round((def.buffRate - 1) * 100)}% faster`,
    });
    return rows;
  }
  rows.push({ label: 'Damage', value: def.damage > 0 ? `${def.damage} a hit` : 'none' });
  rows.push({ label: 'Reach', value: `${def.range} px` });
  rows.push({ label: 'Rate', value: rate(def.cooldown) });
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
  return rows;
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
