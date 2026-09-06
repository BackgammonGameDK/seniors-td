/**
 * The DOM chrome.
 *
 * This module writes to elements and calls handlers back. It decides nothing:
 * every question of the form "what should happen if..." is answered by
 * decisions.ts and merely applied here.
 */
import { TOWERS } from '../sim/towers.ts';
import { TOWER_IDS } from '../sim/types.ts';
import type { Tower, TowerId } from '../sim/types.ts';
import { effectiveDef, UPGRADES } from '../sim/upgrades.ts';
import type { World } from '../sim/world.ts';
import { refundOf } from '../sim/world.ts';
import { TOWER_LOOK } from '../shared/display.ts';
import { UPGRADE_LOOK } from '../shared/upgrades.ts';
import {
  capstoneLocked,
  cardState,
  describeStats,
  hintText,
  hoveredStat,
  endOverlay,
  enemyReadout,
  panelKey,
  pathCard,
  previewStats,
  sentHomeRow,
  roundPreview,
  runButton,
  towerCard,
  upgradeCardState,
} from './decisions.ts';
import { towerArtUrl } from './sprites.ts';
import type { Speed } from './clock.ts';

/** How long the absorbed-hit explanation stays up after the last such hit. */
const ABSORB_HINT_TICKS = 180;

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

export interface UiHandlers {
  onSelect(id: TowerId): void;
  onStartWave(): void;
  onRestart(): void;
  onCloseInspect(): void;
  onSell(t: Tower): void;
  onTogglePause(): void;
  onCycleSpeed(): void;
  /** `choice` is `'pathA'`, `'pathB'`, or a capstone id -- see `purchaseUpgrade`. */
  onBuyUpgrade(t: Tower, choice: string): void;
}

export class Ui {
  private hint = el<HTMLElement>('hint');
  /** Frames left showing the absorbed-hit explanation. */
  private absorbTicks = 0;
  private preview = el<HTMLElement>('preview');
  private towerPanel = el<HTMLElement>('towerPanel');
  private towerList = el<HTMLElement>('towerList');
  private inspect = el<HTMLElement>('inspect');
  private inspectTitle = el<HTMLElement>('inspectTitle');
  private inspectBody = el<HTMLElement>('inspectBody');
  private upgrades = el<HTMLElement>('upgrades');
  private sell = el<HTMLButtonElement>('sell');
  private runBtn = el<HTMLButtonElement>('run');
  private speedBtn = el<HTMLButtonElement>('speed');
  private overlay = el<HTMLElement>('overlay');
  private overlayTitle = el<HTMLElement>('overlayTitle');
  private overlayBody = el<HTMLElement>('overlayBody');

  private cards = new Map<TowerId, HTMLButtonElement>();
  /** What the run button was last told, so a click knows what it means. */
  private runState = { status: 'idle', paused: false };
  private lastPanel = '';
  private lastPreview = -1;
  private inspected: Tower | null = null;
  private hoverRange: number | null = null;
  /** Which upgrade card the pointer is on, so the stat rows can show what
   *  buying it would do. `null` whenever the pointer is anywhere else. */
  private hoverChoice: string | null = null;
  /** `panelKey`, the running total and the hovered card: what the stat rows
   *  were last drawn from, so they are rewritten only when one of the three
   *  moves. */
  private lastStats = '';

  /** What the range would become if the tier currently under the pointer
   *  were bought, for the board to draw as a preview -- `null` otherwise. */
  get previewRange(): number | null {
    return this.hoverRange;
  }

  constructor(private handlers: UiHandlers) {
    this.buildTowerMenu();
    this.runBtn.addEventListener('click', () => {
      if (runButton(this.runState).action === 'start') handlers.onStartWave();
      else handlers.onTogglePause();
    });
    this.speedBtn.addEventListener('click', () => handlers.onCycleSpeed());
    el('inspectClose').addEventListener('click', () => handlers.onCloseInspect());
    el('restart').addEventListener('click', () => handlers.onRestart());
    this.sell.addEventListener('click', () => {
      if (this.inspected) handlers.onSell(this.inspected);
    });
    // One delegated listener rather than one per card, since the cards are
    // rebuilt whenever `panelKey` changes.
    this.upgrades.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice]');
      if (btn && btn.getAttribute('aria-disabled') !== 'true' && this.inspected) {
        handlers.onBuyUpgrade(this.inspected, btn.dataset.choice!);
      }
    });
    // Same delegation for hover: any upgrade card previews its stats, and the
    // ones that also move the range carry data-range for the board's circle.
    //
    // A card you cannot afford is marked aria-disabled rather than disabled,
    // because a disabled button fires no pointer events at all -- and "what
    // am I saving up for?" is exactly when this preview earns its keep.
    this.upgrades.addEventListener('pointerover', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice]');
      if (!btn) return;
      this.hoverChoice = btn.dataset.choice ?? null;
      this.hoverRange = btn.dataset.range !== undefined ? Number(btn.dataset.range) : null;
    });
    // Cleared only when the pointer leaves the whole list, never card by
    // card. A preview can make the stat rows above taller, which slides the
    // cards down under a stationary pointer; a per-card pointerout would read
    // that as "the pointer left", drop the preview, slide them back and start
    // again, which is the flicker you get on a card's top edge.
    this.upgrades.addEventListener('pointerleave', () => {
      this.hoverChoice = null;
      this.hoverRange = null;
    });
  }

  private buildTowerMenu(): void {
    for (const id of TOWER_IDS) {
      const card = towerCard(id);
      const art = towerArtUrl(id);
      // The picture is the drawn one where there is one, and the emoji blown
      // up where there is not -- the same fallback the board itself uses, so
      // a neighbour whose portrait has not been painted still folds out.
      const portrait =
        art !== null
          ? `<img src="${art}" alt="${card.name}">`
          : `<span class="big">${TOWER_LOOK[id].glyph}</span>`;
      const rows = card.rows
        .map((r) => `<div class="statrow"><i>${r.label}</i><span>${r.value}</span></div>`)
        .join('');

      const btn = document.createElement('button');
      btn.className = 'card';
      btn.innerHTML =
        `<span class="g">${TOWER_LOOK[id].glyph}</span>` +
        `<span><span class="n">${card.name}</span><br><span class="b">${card.blurb}</span></span>` +
        `<span class="c">${TOWERS[id].cost}</span>` +
        `<span class="fold">${portrait}<span class="rows">${rows}</span></span>`;
      btn.addEventListener('click', () => this.handlers.onSelect(id));
      this.towerList.appendChild(btn);
      this.cards.set(id, btn);
    }
  }

  sync(
    world: World,
    state: { selected: TowerId | null; inspected: Tower | null; paused: boolean; speed: Speed },
  ): void {

    for (const id of TOWER_IDS) {
      const s = cardState({
        gold: world.gold,
        cost: TOWERS[id].cost,
        isSelected: state.selected === id,
      });
      this.cards.get(id)!.className = s.className;
    }

    if (this.lastPreview !== world.waveIndex) {
      this.lastPreview = world.waveIndex;
      const rows = roundPreview(world.waveIndex);
      this.preview.innerHTML = rows.length
        ? rows.map((r) => `<span>${r.glyph} ${r.name} <b>&times;${r.count}</b></span>`).join('')
        : '<span>Nothing left to come.</span>';
    }

    this.runState = { status: world.status, paused: state.paused };
    const run = runButton(this.runState);
    this.runBtn.textContent = run.label;
    this.runBtn.disabled = run.disabled;
    this.speedBtn.innerHTML = `${state.speed || 1}&times;`;

    // Held for a few seconds after the last one: absorbed hits arrive in ones
    // and twos, and a line that blinked out between them would be unreadable.
    if (world.events.some((e) => e.type === 'hit' && e.text === 'absorbed')) {
      this.absorbTicks = ABSORB_HINT_TICKS;
    } else if (this.absorbTicks > 0) {
      this.absorbTicks--;
    }
    this.hint.textContent = hintText({
      selected: state.selected,
      idle: world.status === 'idle',
      absorbing: this.absorbTicks > 0,
    });

    this.syncInspect(state.inspected, world.gold);
    this.syncOverlay(world);
  }

  private syncInspect(t: Tower | null, gold: number): void {
    this.inspected = t;
    // The neighbours list and the inspect/upgrade panel are always exact
    // opposites -- there's nowhere on this layout for both at once.
    this.towerPanel.hidden = t !== null;
    const key = panelKey(t);
    if (key === this.lastPanel) {
      // panelKey doesn't include gold, so an upgrade that was unaffordable
      // when this panel was built can become affordable while it's still
      // open (gold keeps arriving mid-round) without anything else here
      // changing. Refresh just the affordability of what's already on
      // screen instead of skipping the frame outright.
      if (t) {
        this.refreshUpgradeAffordability(gold);
        this.paintStats(t);
      }
      return;
    }
    this.lastPanel = key;

    if (!t) {
      this.inspect.hidden = true;
      return;
    }
    this.inspect.hidden = false;
    const card = towerCard(t.def);
    this.inspectTitle.textContent = card.name;
    this.paintStats(t);
    this.reserveStatHeight(t);
    this.upgrades.innerHTML = this.renderUpgrades(t, gold);
    this.sell.textContent = `Send home (+${refundOf(t.def)})`;
  }

  /**
   * The stat rows, showing the hovered upgrade's numbers where there is one.
   *
   * Only `inspectBody` is written, never the upgrade cards -- rebuilding the
   * card the pointer is sitting on would destroy it mid-hover and the preview
   * would flicker itself off. The key stops a hover-less panel from being
   * rewritten on every frame.
   */
  private paintStats(t: Tower): void {
    // The running total is kept out of `panelKey` on purpose. A changed
    // panelKey rebuilds the whole panel, which would re-measure the reserved
    // height and tear down the upgrade card under the pointer on every kill.
    // Only this key needs it, because only `inspectBody` shows the total.
    const key = `${panelKey(t)}|${t.sentHome}|${this.hoverChoice ?? ''}`;
    if (key === this.lastStats) return;
    this.lastStats = key;
    this.inspectBody.innerHTML = this.statRowsHtml(t, this.hoverChoice);
  }

  /** The stat rows for a tower, as they read with `choice` hovered. */
  private statRowsHtml(t: Tower, choice: string | null): string {
    const buffs = { rateMult: t.rateMult, rangeMult: t.rangeMult };
    const next = hoveredStat(t, choice);
    const rows = next
      ? previewStats(effectiveDef(t), next, buffs)
      : describeStats(effectiveDef(t), buffs);
    if (TOWERS[t.def].mode === 'blocker') {
      rows.push({ label: 'Still standing', value: `${Math.max(0, Math.ceil(t.hp))}` });
    }
    const scored = sentHomeRow(t);
    if (scored) rows.push(scored);
    return rows
      .map((r) => {
        const was = r.was !== undefined ? `<s>${r.was}</s> ` : '';
        return (
          `<div class="statrow${r.changed ? ' changed' : ''}">` +
          `<i>${r.label}</i><span>${was}${r.value}</span></div>`
        );
      })
      .join('');
  }

  /**
   * Hold the stat block at the height of its tallest preview.
   *
   * A preview can add a row the tower did not have (splash on a tower with
   * none) or wrap one that now carries a struck-through old value, and either
   * would push the upgrade cards down the moment the pointer touched one.
   * Measuring every preview once, when the panel is built, means hovering
   * changes the words and never the layout. Done here rather than in CSS
   * because the height depends on which tower is open.
   */
  private reserveStatHeight(t: Tower): void {
    const base = this.inspectBody.innerHTML;
    this.inspectBody.style.minHeight = '';
    let tallest = this.inspectBody.offsetHeight;
    const tree = UPGRADES[t.def];
    for (const choice of ['pathA', 'pathB', ...tree.capstones.map((c) => c.id)]) {
      this.inspectBody.innerHTML = this.statRowsHtml(t, choice);
      tallest = Math.max(tallest, this.inspectBody.offsetHeight);
    }
    this.inspectBody.innerHTML = base;
    this.inspectBody.style.minHeight = `${tallest}px`;
  }

  /** One card per path tier and per capstone, built once per `panelKey`. */
  private renderUpgrades(t: Tower, gold: number): string {
    const tree = UPGRADES[t.def];
    const look = UPGRADE_LOOK[t.def];

    const pathHtml = (
      key: 'pathA' | 'pathB',
      bought: 0 | 1 | 2,
    ): string => {
      const pathLook = look[key];
      const { tierIndex, finished } = pathCard(bought);
      const tier = tree[key][tierIndex];
      const state = upgradeCardState({
        gold,
        cost: tier.cost,
        alreadyBought: finished,
        locked: false,
      });
      const tierLook = pathLook.tiers[tierIndex];
      const card = this.upgradeButton(key, tierLook.name, tierLook.blurb, tier.cost, state, tier.stat.range);
      return `<div class="upath"><h4>${pathLook.name}</h4>${card}</div>`;
    };

    let html = pathHtml('pathA', t.upgradeA) + pathHtml('pathB', t.upgradeB);

    if (!capstoneLocked(t.upgradeA, t.upgradeB) || t.capstone) {
      const capCards = tree.capstones
        .map((cap) => {
          const capLook = look.capstones[cap.id]!;
          const state = upgradeCardState({
            gold,
            cost: cap.cost,
            alreadyBought: t.capstone === cap.id,
            locked: capstoneLocked(t.upgradeA, t.upgradeB),
            otherCapstoneChosen: t.capstone !== null && t.capstone !== cap.id,
          });
          return this.upgradeButton(cap.id, capLook.name, capLook.blurb, cap.cost, state, cap.stat.range);
        })
        .join('');
      html += `<div class="upath"><h4>Capstone</h4>${capCards}</div>`;
    }
    return html;
  }

  private upgradeButton(
    choice: string,
    name: string,
    blurb: string,
    cost: number,
    state: { action: string; className: string },
    range?: number,
  ): string {
    const tag =
      state.action === 'bought'
        ? 'owned'
        : state.action === 'locked' || state.action === 'otherCapstoneChosen'
          ? 'locked'
          : `${cost}`;
    const disabled = state.action !== 'buy' ? 'aria-disabled="true"' : '';
    const rangeAttr = range !== undefined ? ` data-range="${range}"` : '';
    return (
      `<button class="${state.className}" data-choice="${choice}" data-cost="${cost}"${rangeAttr} ${disabled}>` +
      `<span><span class="n">${name}</span><br><span class="b">${blurb}</span></span>` +
      `<span class="c">${tag}</span></button>`
    );
  }

  /**
   * `panelKey` doesn't track gold (see `syncInspect`), so a card's
   * affordability can go stale while the panel stays open. `locked` and
   * `bought` are never about gold, so only a card without either class has
   * its poor/disabled state driven by the current wallet.
   */
  private refreshUpgradeAffordability(gold: number): void {
    for (const btn of Array.from(
      this.upgrades.querySelectorAll<HTMLButtonElement>('button[data-choice]'),
    )) {
      if (btn.classList.contains('locked') || btn.classList.contains('bought')) continue;
      const affordable = gold >= Number(btn.dataset.cost);
      btn.classList.toggle('poor', !affordable);
      if (affordable) btn.removeAttribute('aria-disabled');
      else btn.setAttribute('aria-disabled', 'true');
    }
  }

  /** The read-out for a tapped troublemaker, shown in the same panel. */
  showEnemy(e: Parameters<typeof enemyReadout>[0]): void {
    const r = enemyReadout(e);
    this.lastPanel = `enemy:${r.name}:${r.lines.join('|')}`;
    this.inspected = null;
    this.inspect.hidden = false;
    this.inspectTitle.textContent = r.name;
    // An enemy has no upgrades to preview, so it drops the height a tower
    // panel reserved -- otherwise a two-line troublemaker sits in the blank
    // space the last defender's stat block needed.
    this.inspectBody.style.minHeight = '';
    this.inspectBody.innerHTML = r.lines
      .map((line) => `<div class="statrow"><span>${line}</span></div>`)
      .join('');
    this.upgrades.innerHTML = '';
    this.sell.textContent = 'Close';
  }

  private syncOverlay(world: World): void {
    const o = endOverlay({
      status: world.status,
      waveIndex: world.waveIndex,
      stats: world.stats,
    });
    this.overlay.hidden = !o.show;
    if (o.show) {
      this.overlayTitle.textContent = o.title;
      this.overlayBody.textContent = o.body;
    }
  }
}
