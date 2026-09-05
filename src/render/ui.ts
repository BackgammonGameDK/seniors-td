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
  endOverlay,
  enemyReadout,
  panelKey,
  pathCard,
  roundPreview,
  runButton,
  towerCard,
  upgradeCardState,
} from './decisions.ts';
import { towerArtUrl } from './sprites.ts';
import type { Speed } from './clock.ts';

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
      if (btn && !btn.disabled && this.inspected) {
        handlers.onBuyUpgrade(this.inspected, btn.dataset.choice!);
      }
    });
    // Same delegation for hover: only a card whose tier actually changes
    // range carries data-range, so anything else leaves the preview alone.
    this.upgrades.addEventListener('pointerover', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-range]');
      if (btn) this.hoverRange = Number(btn.dataset.range);
    });
    this.upgrades.addEventListener('pointerout', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-range]');
      if (btn && !btn.contains(ev.relatedTarget as Node | null)) this.hoverRange = null;
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

    this.hint.textContent = state.selected
      ? TOWERS[state.selected].mode === 'blocker'
        ? 'Tap the road itself -- Walter stands in the way.'
        : 'Tap a green square beside the road. Tap the card again to change your mind.'
      : world.status === 'idle'
        ? 'Place a neighbour, then start the round.'
        : 'Tap anyone on the board to see what they are.';

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
      if (t) this.refreshUpgradeAffordability(gold);
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
    const rows = describeStats(effectiveDef(t));
    if (TOWERS[t.def].mode === 'blocker') {
      rows.push({ label: 'Still standing', value: `${Math.max(0, Math.ceil(t.hp))}` });
    }
    this.inspectBody.innerHTML = rows
      .map((r) => `<div class="statrow"><i>${r.label}</i><span>${r.value}</span></div>`)
      .join('');
    this.upgrades.innerHTML = this.renderUpgrades(t, gold);
    this.sell.textContent = `Send home (+${refundOf(t.def)})`;
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
    const disabled = state.action !== 'buy' ? 'disabled' : '';
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
      btn.disabled = !affordable;
    }
  }

  /** The read-out for a tapped troublemaker, shown in the same panel. */
  showEnemy(e: Parameters<typeof enemyReadout>[0]): void {
    const r = enemyReadout(e);
    this.lastPanel = `enemy:${r.name}:${r.lines.join('|')}`;
    this.inspected = null;
    this.inspect.hidden = false;
    this.inspectTitle.textContent = r.name;
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
