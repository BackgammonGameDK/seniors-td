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
import { UPGRADES } from '../sim/upgrades.ts';
import type { World } from '../sim/world.ts';
import { refundOf } from '../sim/world.ts';
import { TOWER_LOOK } from '../shared/display.ts';
import { UPGRADE_LOOK } from '../shared/upgrades.ts';
import {
  capstoneLocked,
  cardState,
  endOverlay,
  enemyReadout,
  panelKey,
  pathTierLocked,
  roundPreview,
  towerCard,
  upgradeCardState,
  waveLabel,
} from './decisions.ts';
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
  private gold = el<HTMLElement>('gold');
  private lives = el<HTMLElement>('lives');
  private wave = el<HTMLElement>('wave');
  private hint = el<HTMLElement>('hint');
  private preview = el<HTMLElement>('preview');
  private towerList = el<HTMLElement>('towerList');
  private inspect = el<HTMLElement>('inspect');
  private inspectTitle = el<HTMLElement>('inspectTitle');
  private inspectBody = el<HTMLElement>('inspectBody');
  private upgrades = el<HTMLElement>('upgrades');
  private sell = el<HTMLButtonElement>('sell');
  private startBtn = el<HTMLButtonElement>('startWave');
  private pauseBtn = el<HTMLButtonElement>('pause');
  private speedBtn = el<HTMLButtonElement>('speed');
  private overlay = el<HTMLElement>('overlay');
  private overlayTitle = el<HTMLElement>('overlayTitle');
  private overlayBody = el<HTMLElement>('overlayBody');

  private cards = new Map<TowerId, HTMLButtonElement>();
  private lastPanel = '';
  private lastPreview = -1;
  private inspected: Tower | null = null;

  constructor(private handlers: UiHandlers) {
    this.buildTowerMenu();
    this.startBtn.addEventListener('click', () => handlers.onStartWave());
    this.pauseBtn.addEventListener('click', () => handlers.onTogglePause());
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
  }

  private buildTowerMenu(): void {
    for (const id of TOWER_IDS) {
      const card = towerCard(id);
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.innerHTML =
        `<span class="g">${TOWER_LOOK[id].glyph}</span>` +
        `<span><span class="n">${card.name}</span><br><span class="b">${card.blurb}</span></span>` +
        `<span class="c">${TOWERS[id].cost}</span>`;
      btn.addEventListener('click', () => this.handlers.onSelect(id));
      this.towerList.appendChild(btn);
      this.cards.set(id, btn);
    }
  }

  sync(
    world: World,
    state: { selected: TowerId | null; inspected: Tower | null; paused: boolean; speed: Speed },
  ): void {
    this.gold.textContent = String(Math.floor(world.gold));
    this.lives.textContent = String(world.lives);
    this.wave.textContent = waveLabel(world.waveIndex);

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

    this.startBtn.disabled = world.status !== 'idle';
    this.startBtn.textContent = world.status === 'running' ? 'Round running' : 'Start round';
    this.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
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
    const key = panelKey(t);
    if (key === this.lastPanel) return;
    this.lastPanel = key;

    if (!t) {
      this.inspect.hidden = true;
      return;
    }
    this.inspect.hidden = false;
    const card = towerCard(t.def);
    this.inspectTitle.textContent = card.name;
    const rows = [...card.rows];
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
      const cards = tree[key]
        .map((tier, i) => {
          const tierIndex = i as 0 | 1;
          const state = upgradeCardState({
            gold,
            cost: tier.cost,
            alreadyBought: bought > tierIndex,
            locked: pathTierLocked(tierIndex, bought),
          });
          const tierLook = pathLook.tiers[tierIndex];
          return this.upgradeButton(key, tierLook.name, tierLook.blurb, tier.cost, state);
        })
        .join('');
      return `<div class="upath"><h4>${pathLook.name}</h4>${cards}</div>`;
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
          return this.upgradeButton(cap.id, capLook.name, capLook.blurb, cap.cost, state);
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
  ): string {
    const tag =
      state.action === 'bought'
        ? 'owned'
        : state.action === 'locked' || state.action === 'otherCapstoneChosen'
          ? 'locked'
          : `${cost}`;
    const disabled = state.action !== 'buy' ? 'disabled' : '';
    return (
      `<button class="${state.className}" data-choice="${choice}" ${disabled}>` +
      `<span><span class="n">${name}</span><br><span class="b">${blurb}</span></span>` +
      `<span class="c">${tag}</span></button>`
    );
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
