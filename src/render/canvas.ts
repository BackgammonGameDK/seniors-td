/**
 * All the drawing, and none of the deciding.
 *
 * Read-only over the simulation: this module never writes to a World. Anything
 * that works out *what should happen* belongs in decisions.ts, where a test can
 * reach it.
 */
import { ENEMIES } from '../sim/enemies.ts';
import {
  BOARD,
  cellCentre,
  isBlockerCell,
  isBuildableCell,
  PATH_POINTS,
} from '../sim/path.ts';
import { TOWERS } from '../sim/towers.ts';
import type { Enemy, SimEvent, Tower, TowerId } from '../sim/types.ts';
import { effectiveDef } from '../sim/upgrades.ts';
import type { World } from '../sim/world.ts';
import { ENEMY_LOOK, PALETTE, TOWER_LOOK } from '../shared/display.ts';

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Burst {
  x: number;
  y: number;
  color: string;
  life: number;
  max: number;
}

const FLOATER_LIFE = 46;
const BURST_LIFE = 18;
const ROAD_WIDTH = 46;

const EVENT_COLOR: Record<SimEvent['type'], string> = {
  hit: '#ffffff',
  kill: '#ffd54f',
  leak: '#e53935',
  split: '#ffb300',
  blockerDown: '#8d6e63',
  stun: '#7986cb',
};

export class Renderer {
  private g: CanvasRenderingContext2D;
  private floaters: Floater[] = [];
  private bursts: Burst[] = [];
  /**
   * Last tick's cooldown per tower, so firing can be spotted without the
   * simulation announcing it.
   *
   * Deliberate: an event per shot would be thousands of throwaway objects in
   * every headless campaign, and the harnesses run hundreds of campaigns. The
   * renderer can see a cooldown jump back up for free.
   */
  private lastCooldown = new Map<number, number>();
  private recoil = new Map<number, number>();
  private floor: HTMLCanvasElement | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.g = ctx;
  }

  /** The street, painted once and blitted every frame. */
  private paintFloor(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = BOARD.width;
    c.height = BOARD.height;
    const g = c.getContext('2d')!;

    for (let row = 0; row < BOARD.rows; row++) {
      for (let col = 0; col < BOARD.cols; col++) {
        g.fillStyle = (col + row) % 2 === 0 ? PALETTE.grass : PALETTE.grassAlt;
        g.fillRect(col * BOARD.cell, row * BOARD.cell, BOARD.cell, BOARD.cell);
      }
    }

    g.lineCap = 'round';
    g.lineJoin = 'round';
    this.tracePathOn(g);
    g.strokeStyle = PALETTE.kerb;
    g.lineWidth = ROAD_WIDTH + 8;
    g.stroke();
    this.tracePathOn(g);
    g.strokeStyle = PALETTE.road;
    g.lineWidth = ROAD_WIDTH;
    g.stroke();

    this.tracePathOn(g);
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 2;
    g.setLineDash([14, 18]);
    g.stroke();
    g.setLineDash([]);

    g.strokeStyle = PALETTE.grid;
    g.lineWidth = 1;
    for (let col = 1; col < BOARD.cols; col++) {
      g.beginPath();
      g.moveTo(col * BOARD.cell + 0.5, 0);
      g.lineTo(col * BOARD.cell + 0.5, BOARD.height);
      g.stroke();
    }
    for (let row = 1; row < BOARD.rows; row++) {
      g.beginPath();
      g.moveTo(0, row * BOARD.cell + 0.5);
      g.lineTo(BOARD.width, row * BOARD.cell + 0.5);
      g.stroke();
    }
    return c;
  }

  private tracePathOn(g: CanvasRenderingContext2D): void {
    g.beginPath();
    g.moveTo(PATH_POINTS[0]!.x, PATH_POINTS[0]!.y);
    for (let i = 1; i < PATH_POINTS.length; i++) g.lineTo(PATH_POINTS[i]!.x, PATH_POINTS[i]!.y);
  }

  /** Turns this tick's simulation events into things that fade. */
  ingest(events: SimEvent[]): void {
    for (const e of events) {
      const color = EVENT_COLOR[e.type];
      if (e.type !== 'hit') {
        this.bursts.push({ x: e.x, y: e.y, color, life: BURST_LIFE, max: BURST_LIFE });
      }
      if (e.text) {
        this.floaters.push({ x: e.x, y: e.y, text: e.text, color, life: FLOATER_LIFE });
      }
    }
  }

  draw(
    world: World,
    opts: {
      selected: TowerId | null;
      hover: { col: number; row: number } | null;
      inspected: Tower | null;
      previewRange: number | null;
    },
  ): void {
    if (!this.floor) this.floor = this.paintFloor();
    const g = this.g;
    g.clearRect(0, 0, BOARD.width, BOARD.height);
    g.drawImage(this.floor, 0, 0);

    if (opts.selected && opts.hover) this.drawPlacementPreview(world, opts.hover, opts.selected);
    if (opts.inspected) this.drawRange(opts.inspected);
    if (opts.inspected && opts.previewRange !== null) {
      this.drawPreviewRange(opts.inspected, opts.previewRange);
    }

    this.drawAuras(world);
    for (const t of world.towers) this.drawTower(t, opts.inspected?.id === t.id);
    for (const e of world.enemies) this.drawEnemy(e);
    this.drawProjectiles(world);
    this.drawEffects();
  }

  private drawRange(t: Tower): void {
    const d = effectiveDef(t);
    const range = d.range * t.rangeMult;
    if (range <= 0) return;
    const g = this.g;
    g.beginPath();
    g.arc(t.x, t.y, range, 0, Math.PI * 2);
    g.fillStyle = PALETTE.rangeFill;
    g.fill();
    g.strokeStyle = PALETTE.rangeLine;
    g.lineWidth = 2;
    g.setLineDash([6, 6]);
    g.stroke();
    g.setLineDash([]);
  }

  /**
   * What the range would become if the hovered upgrade were bought --
   * unfilled and in the same gold used for a bought capstone's ring, so it
   * reads as "not real yet" next to the solid current-range circle.
   */
  private drawPreviewRange(t: Tower, range: number): void {
    if (range <= 0) return;
    const g = this.g;
    g.beginPath();
    g.arc(t.x, t.y, range, 0, Math.PI * 2);
    g.strokeStyle = '#ffd54f';
    g.lineWidth = 2;
    g.setLineDash([3, 3]);
    g.stroke();
    g.setLineDash([]);
  }

  /** Faint rings so a support or disruptive aura is visible while it is on. */
  private drawAuras(world: World): void {
    const g = this.g;
    for (const t of world.towers) {
      const d = TOWERS[t.def];
      if (d.mode !== 'support') continue;
      g.beginPath();
      g.arc(t.x, t.y, d.range, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(141,110,99,.35)';
      g.lineWidth = 2;
      g.stroke();
    }
    for (const e of world.enemies) {
      const d = ENEMIES[e.def];
      if (d.auraRange <= 0) continue;
      g.beginPath();
      g.arc(e.x, e.y, d.auraRange, 0, Math.PI * 2);
      g.strokeStyle = d.disablesTowers ? 'rgba(240,98,146,.35)' : 'rgba(186,104,200,.35)';
      g.lineWidth = 2;
      g.stroke();
    }
  }

  private drawPlacementPreview(
    world: World,
    hover: { col: number; row: number },
    selected: TowerId,
  ): void {
    const g = this.g;
    const mode = TOWERS[selected].mode;
    const legal =
      (mode === 'blocker' ? isBlockerCell(hover.col, hover.row) : isBuildableCell(hover.col, hover.row)) &&
      !world.towers.some((t) => t.col === hover.col && t.row === hover.row);
    const p = cellCentre(hover.col, hover.row);

    g.fillStyle = legal ? PALETTE.buildable : PALETTE.blocked;
    g.fillRect(hover.col * BOARD.cell, hover.row * BOARD.cell, BOARD.cell, BOARD.cell);

    if (legal && TOWERS[selected].range > 0) {
      g.beginPath();
      g.arc(p.x, p.y, TOWERS[selected].range, 0, Math.PI * 2);
      g.fillStyle = PALETTE.rangeFill;
      g.fill();
      g.strokeStyle = PALETTE.rangeLine;
      g.lineWidth = 1.5;
      g.setLineDash([5, 5]);
      g.stroke();
      g.setLineDash([]);
    }
  }

  private drawTower(t: Tower, isInspected: boolean): void {
    const g = this.g;
    const d = TOWERS[t.def];
    const look = TOWER_LOOK[t.def];

    const prev = this.lastCooldown.get(t.id) ?? 0;
    if (t.cooldown > prev) this.recoil.set(t.id, 6);
    this.lastCooldown.set(t.id, t.cooldown);
    const kick = this.recoil.get(t.id) ?? 0;
    if (kick > 0) this.recoil.set(t.id, kick - 1);
    const lift = kick * 0.5;

    g.save();
    g.translate(t.x, t.y - lift);

    g.beginPath();
    g.ellipse(0, 15, 15, 5, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fill();

    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.fillStyle = look.color;
    g.fill();
    g.strokeStyle = isInspected ? '#fff' : 'rgba(0,0,0,.25)';
    g.lineWidth = isInspected ? 3 : 2;
    g.stroke();

    if (t.disabled) {
      g.globalAlpha = 0.45;
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(0, 0, 16, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    g.font = '18px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(look.glyph, 0, 1);

    if (t.rateMult > 1) {
      g.font = '11px serif';
      g.fillText('☕', 12, -12);
    }
    if (t.disabled) {
      g.font = '13px serif';
      g.fillText('💤', 12, -12);
    }
    // A ring for anything bought on the upgrade tree, gold once a capstone
    // is chosen -- a glance should tell a built tower from a fresh one.
    if (t.upgradeA > 0 || t.upgradeB > 0 || t.capstone) {
      g.beginPath();
      g.arc(0, 0, 19, 0, Math.PI * 2);
      g.strokeStyle = t.capstone ? '#ffd54f' : 'rgba(255,255,255,.8)';
      g.lineWidth = t.capstone ? 3 : 2;
      g.stroke();
    }
    g.restore();

    if (d.mode === 'blocker' && d.maxHp > 0) {
      this.drawBar(t.x, t.y + 22, t.hp / d.maxHp, '#8d6e63');
    }
  }

  private drawBar(x: number, y: number, frac: number, color: string): void {
    const g = this.g;
    const w = 26;
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(x - w / 2, y, w, 4);
    g.fillStyle = color;
    g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
  }

  private drawEnemy(e: Enemy): void {
    const g = this.g;
    const d = ENEMIES[e.def];
    const look = ENEMY_LOOK[e.def];
    const r = look.radius;

    g.save();
    g.translate(e.x, e.y);

    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = e.flash > 0 ? '#ffffff' : look.color;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)';
    g.lineWidth = 2;
    g.stroke();

    if (e.shield > 0) {
      g.beginPath();
      g.arc(0, 0, r + 4, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(186,104,200,.9)';
      g.lineWidth = 2;
      g.stroke();
    }
    if (d.armour > 0) {
      g.beginPath();
      g.arc(0, 0, r + 1, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(60,70,80,.9)';
      g.lineWidth = 3;
      g.stroke();
    }

    g.font = `${Math.round(r * 1.4)}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(look.glyph, 0, 1);

    if (e.stunTicks > 0) {
      g.font = '12px serif';
      g.fillText('💫', 0, -r - 7);
    } else if (e.slowTicks > 0) {
      g.font = '12px serif';
      g.fillText('🍯', 0, -r - 7);
    }
    g.restore();

    const max = Math.round(d.hp * e.scale);
    if (e.hp < max) this.drawBar(e.x, e.y + r + 4, e.hp / max, '#4d9d74');
  }

  /**
   * Shots, told apart by shape rather than only by colour.
   *
   * Four defenders throwing four identically-shaped dots in four hues is no
   * distinction at all for a colour-blind player, and reads as sameness to
   * everybody else.
   */
  private drawProjectiles(world: World): void {
    const g = this.g;
    for (const p of world.projectiles) {
      const color = TOWER_LOOK[p.from].color;
      if (p.from === 'norah') {
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p.x - 5, p.y - 2);
        g.lineTo(p.x + 5, p.y + 2);
        g.stroke();
      } else if (p.from === 'barbara') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate((world.tick % 60) * 0.1);
        g.fillStyle = color;
        g.beginPath();
        g.arc(0, 0, 5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(120,72,20,.85)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(0, 0, 2.5, 0, Math.PI * 1.6);
        g.stroke();
        g.restore();
      } else {
        g.fillStyle = color;
        g.beginPath();
        g.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  private drawEffects(): void {
    const g = this.g;
    for (const b of this.bursts) {
      const t = 1 - b.life / b.max;
      g.beginPath();
      g.arc(b.x, b.y, 6 + t * 24, 0, Math.PI * 2);
      g.strokeStyle = b.color;
      g.globalAlpha = 1 - t;
      g.lineWidth = 3;
      g.stroke();
      g.globalAlpha = 1;
      b.life--;
    }
    this.bursts = this.bursts.filter((b) => b.life > 0);

    g.font = 'bold 14px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    for (const f of this.floaters) {
      const t = 1 - f.life / FLOATER_LIFE;
      g.globalAlpha = 1 - t;
      g.fillStyle = f.color;
      g.strokeStyle = 'rgba(0,0,0,.5)';
      g.lineWidth = 3;
      g.strokeText(f.text, f.x, f.y - 14 - t * 20);
      g.fillText(f.text, f.x, f.y - 14 - t * 20);
      g.globalAlpha = 1;
      f.life--;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  /**
   * Board coordinates for a pointer event.
   *
   * Takes the event it is given rather than remembering the last move, which
   * is the whole reason touch works: a tap produces no `mousemove`, so a board
   * that read its target cell from one ignored every tap on a phone.
   */
  toBoard(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * BOARD.width,
      y: ((ev.clientY - r.top) / r.height) * BOARD.height,
    };
  }
}
