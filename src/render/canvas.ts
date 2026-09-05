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
import { hudReadouts } from './decisions.ts';
import { enemySprite, iconGlyph, iconSprite, towerSprite } from './sprites.ts';

/**
 * How wide a drawn tower is on the board, in pixels.
 *
 * A shade wider than the 40px cell it stands in, so a senior reads as a
 * person on the pavement rather than a tile that has been filled in.
 */
const SPRITE_SIZE = 42;

/** The readout panel on the board: where it sits and how it is spaced. */
const HUD = {
  x: 12,
  y: 12,
  height: 40,
  pad: 14,
  gap: 20,
  icon: 18,
  valueFont: 'bold 22px "Trebuchet MS", "Segoe UI", sans-serif',
  labelFont: '10px "Trebuchet MS", "Segoe UI", sans-serif',
} as const;

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

/**
 * How coarse the lawn's colour variation is, in board pixels.
 *
 * The ground is painted this small and then blown up smoothly, which is what
 * turns a grid of flat greens into soft patches with no visible edges.
 */
const MOTTLE = 16;

/** How much lawn one scattered tuft of grass is given to itself. */
const TUFT_CELL = 26;

/**
 * A fixed hash for the grass, so the field looks the same in every session.
 *
 * The floor is painted once and blitted, so an unseeded `Math.random` would
 * technically work -- but a screenshot of round 7 should show the same lawn
 * tomorrow as it does today, which makes a visual change reviewable.
 */
function grassNoise(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The ground the blades stand in: broad, soft patches of close greens.
 *
 * Painted onto a canvas a sixteenth of the size and then drawn back
 * stretched, so the browser's own smoothing does the blending. Blurring 960
 * pixels' worth of noise directly would be slower and is not supported
 * everywhere; this trick is, and it gives the soft painted ground the
 * characters are drawn on rather than a field of squares.
 */
function paintLawnGround(g: CanvasRenderingContext2D): void {
  const tones = PALETTE.grass;
  const cols = Math.ceil(BOARD.width / MOTTLE) + 1;
  const rows = Math.ceil(BOARD.height / MOTTLE) + 1;

  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sg = small.getContext('2d')!;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // A cell is averaged with its neighbours and with a coarser field, so
      // patches come out broad and related instead of as pure static.
      const n =
        (grassNoise(x, y) +
          grassNoise(x + 1, y) +
          grassNoise(x, y + 1) +
          grassNoise(x >> 1, y >> 1) * 2) /
        5;
      sg.fillStyle = tones[Math.min(tones.length - 1, Math.floor(n * tones.length))]!;
      sg.fillRect(x, y, 1, 1);
    }
  }

  g.imageSmoothingEnabled = true;
  g.drawImage(small, 0, 0, cols * MOTTLE, rows * MOTTLE);
}

/**
 * One blade, as a leaf shape that leans and tapers to a point.
 *
 * The path only: the caller fills and outlines it, because a blade is drawn
 * the way the characters are -- flat colour first, dark line around it after.
 */
function bladePath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  width: number,
  lean: number,
): void {
  g.beginPath();
  g.moveTo(x - width, y);
  g.quadraticCurveTo(x - width * 0.5, y - height * 0.55, x + lean, y - height);
  g.quadraticCurveTo(x + width * 0.85, y - height * 0.45, x + width, y);
  g.closePath();
}

/** Three blades from one root, the middle one tallest. */
function paintTuft(g: CanvasRenderingContext2D, x: number, y: number, height: number): void {
  // Height, how far the tip leans, and how far the root sits from the middle.
  // The tall one in the centre with two shorter ones splaying out is what
  // makes a tuft read as grass rather than as a spiky crown.
  const w = height * 0.2;
  const blades: [number, number, number][] = [
    [height * 0.66, -height * 0.5, -w * 1.4],
    [height, height * 0.04, 0],
    [height * 0.78, height * 0.58, w * 1.4],
  ];

  // Sat on the ground with a soft shadow, the way every character has one
  // under them. Without it a tuft floats above the lawn.
  g.beginPath();
  g.ellipse(x, y, height * 0.5, height * 0.15, 0, 0, Math.PI * 2);
  g.fillStyle = PALETTE.grassShadow;
  g.fill();

  // Mitred rather than rounded, so a blade ends in a point the way a drawn
  // one does. Round joins turned every tip into a blunt stub.
  g.lineJoin = 'miter';
  g.miterLimit = 6;

  for (const [h, lean, root] of blades) {
    // Light at the tip and deeper at the root: the same two-tone shading the
    // painted characters have, rather than one flat green.
    const shade = g.createLinearGradient(x, y, x, y - h);
    shade.addColorStop(0, PALETTE.grassBlade);
    shade.addColorStop(1, PALETTE.grassBladeTip);

    bladePath(g, x + root, y, h, w, lean);
    g.fillStyle = shade;
    g.fill();
    g.strokeStyle = PALETTE.grassLine;
    g.lineWidth = 1.7;
    g.stroke();
  }
}

/** A small daisy: five outlined petals around a warm centre. */
function paintBloom(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.strokeStyle = PALETTE.grassLine;
  g.lineWidth = 1.5;
  g.fillStyle = PALETTE.grassBloom;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.arc(x, y, 1.8, 0, Math.PI * 2);
  g.fillStyle = PALETTE.grassBloomCore;
  g.fill();
  g.stroke();
}

/**
 * The lawn, drawn the way the characters are drawn.
 *
 * They are painted illustrations -- soft shading inside a bold dark outline --
 * and a field of hard 8-bit squares underneath them read as two games at once.
 * So: soft ground first, then outlined blades and flowers scattered over it,
 * every one of them shaded from a deep root to a light tip.
 */
function paintGrass(g: CanvasRenderingContext2D): void {
  paintLawnGround(g);

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  const cols = Math.ceil(BOARD.width / TUFT_CELL);
  const rows = Math.ceil(BOARD.height / TUFT_CELL);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const seed = grassNoise(cx + 911, cy + 733);
      if (seed < 0.56) continue;

      // Jittered inside its own cell, so the scatter is even without the
      // regularity of a grid showing through.
      const x = cx * TUFT_CELL + grassNoise(cx + 17, cy + 53) * TUFT_CELL;
      const y = cy * TUFT_CELL + grassNoise(cx + 71, cy + 29) * TUFT_CELL;

      if (seed > 0.975) paintBloom(g, x, y);
      else paintTuft(g, x, y, 13 + grassNoise(cx + 5, cy + 97) * 9);
    }
  }

  g.restore();
}

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

  /**
   * How many real screen pixels one board pixel is drawn with.
   *
   * The board is 960x600 in its own units, but the page stretches the canvas
   * to the width of the column and a modern phone or laptop packs two or three
   * screen pixels into each of those. Left alone the canvas is drawn at 960
   * wide and then blown up by the browser, which is what made the readout look
   * soft. Everything is drawn at this scale instead and the drawing code goes
   * on speaking in board units.
   */
  private scale = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.g = ctx;
  }

  /**
   * Matches the canvas to the room the page gives it and the sharpness the
   * screen offers.
   *
   * Cheap enough to call every frame: it measures, and only touches the canvas
   * when the answer changed. Resizing a canvas wipes it, so doing this on
   * every frame regardless would clear the board.
   */
  private syncResolution(): void {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const shown = this.canvas.getBoundingClientRect().width || BOARD.width;
    // Three is past the point where more pixels are visible, and it keeps a
    // phone from being asked to fill a needlessly enormous canvas.
    const scale = Math.min(3, Math.max(1, (shown * dpr) / BOARD.width));
    if (Math.abs(scale - this.scale) < 0.01) return;
    this.scale = scale;
    this.canvas.width = Math.round(BOARD.width * scale);
    this.canvas.height = Math.round(BOARD.height * scale);
    // The street was painted for the old scale, so it is painted again.
    this.floor = null;
  }

  /** The street, painted once and blitted every frame. */
  private paintFloor(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(BOARD.width * this.scale);
    c.height = Math.round(BOARD.height * this.scale);
    const g = c.getContext('2d')!;
    g.scale(this.scale, this.scale);

    paintGrass(g);

    /*
     * The cell grid goes down before the street, so the road paints over it.
     * The lines mark where a neighbour can stand, and nobody can stand on the
     * road -- drawn on top they were only a barely visible smudge across it.
     */
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
    this.syncResolution();
    if (!this.floor) this.floor = this.paintFloor();
    const g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.clearRect(0, 0, BOARD.width, BOARD.height);
    g.drawImage(this.floor, 0, 0, BOARD.width, BOARD.height);

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
    this.drawHud(world);
  }

  /**
   * The coin, heart and round numbers, drawn on the board rather than above
   * it.
   *
   * A readout reads number first, then its picture, then any words -- so the
   * count is always in the same place along the row and the eye does not have
   * to step over an icon to find it.
   *
   * The panel is measured rather than fixed, so it grows with a three-digit
   * coin count instead of leaving a gap after a one-digit one. It is drawn
   * last, which is what keeps a senior standing in the top-left corner from
   * covering the numbers.
   */
  private drawHud(world: World): void {
    const g = this.g;
    const rows = hudReadouts(world);
    const label = (r: { label: string }): string => r.label.toUpperCase();

    g.save();
    g.textAlign = 'left';
    g.textBaseline = 'middle';

    // A number is given the room three digits would need even when it is
    // showing one. Gold changes constantly during a round, and without this
    // the two readouts to its right slid sideways every time it crossed 100.
    g.font = HUD.valueFont;
    const floor = g.measureText('000').width;
    const valueWidth = (value: string): number =>
      Math.max(g.measureText(value).width, floor);

    const widths = rows.map((r) => {
      g.font = HUD.valueFont;
      let w = valueWidth(r.value);
      if (r.icon !== null) w += 6 + HUD.icon;
      if (r.label !== '') {
        g.font = HUD.labelFont;
        w += 6 + g.measureText(label(r)).width;
      }
      return w;
    });
    const width =
      HUD.pad * 2 + widths.reduce((a, b) => a + b, 0) + HUD.gap * (rows.length - 1);

    g.beginPath();
    g.roundRect(HUD.x, HUD.y, width, HUD.height, 10);
    g.fillStyle = PALETTE.hudFill;
    g.fill();
    g.strokeStyle = PALETTE.hudLine;
    g.lineWidth = 2;
    g.stroke();

    let x = HUD.x + HUD.pad;
    const y = HUD.y + HUD.height / 2;
    for (const r of rows) {
      g.font = HUD.valueFont;
      g.fillStyle = PALETTE.hudInk;
      g.fillText(r.value, x, y);
      x += valueWidth(r.value);

      if (r.icon !== null) {
        x += 6;
        const picture = iconSprite(r.icon);
        if (picture !== null) {
          g.drawImage(picture, x, y - HUD.icon / 2, HUD.icon, HUD.icon);
        } else {
          // Stands in until the picture arrives, drawn at the size the
          // picture will be, so nothing shifts along when it does.
          g.font = `${HUD.icon}px serif`;
          g.fillText(iconGlyph(r.icon), x, y + 1);
        }
        x += HUD.icon;
      }

      if (r.label !== '') {
        x += 6;
        g.font = HUD.labelFont;
        g.fillStyle = PALETTE.hudLabel;
        g.fillText(label(r), x, y + 1);
        x += g.measureText(label(r)).width;
      }

      x += HUD.gap;
    }

    g.restore();
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

    // A drawn character replaces the coloured disc and its emoji entirely.
    // The picture carries its own outline, so a disc behind it would only
    // read as a plate the senior is standing on.
    //
    // A drawn character gets no selection ring either. The range circle
    // drawn under the board already says which tower is open, so a ring on
    // top of the artwork was saying it twice and covering the picture to do
    // it. The disc below still brightens its own outline, because there the
    // outline is the only thing there is.
    const sprite = towerSprite(t.def);
    if (sprite !== null) {
      g.globalAlpha = t.disabled ? 0.45 : 1;
      g.drawImage(sprite, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
      g.globalAlpha = 1;
    } else {
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
      g.fillText(look.glyph, 0, 1);
    }

    g.textAlign = 'center';
    g.textBaseline = 'middle';

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
    //
    // Only on the plain disc. At radius 19 the ring sits exactly on top of a
    // 42px picture, so on a drawn character it stopped reading as a badge and
    // started reading as a plate the senior was standing in.
    if (sprite === null && (t.upgradeA > 0 || t.upgradeB > 0 || t.capstone)) {
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

    const sprite = enemySprite(e.def);
    // The drawn picture is wider than the hit radius, so the shield and
    // armour rings move out to sit just outside it. Kept as rings rather
    // than folded into the artwork: they say what is true right now, and a
    // shield comes and goes while the picture does not.
    const edge = sprite !== null ? r * 1.5 : r;

    if (sprite !== null) {
      if (e.flash > 0) {
        g.beginPath();
        g.arc(0, 0, edge, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.fill();
      }
      const size = edge * 2;
      g.drawImage(sprite, -edge, -edge, size, size);
    } else {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = e.flash > 0 ? '#ffffff' : look.color;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)';
      g.lineWidth = 2;
      g.stroke();
    }

    if (e.shield > 0) {
      g.beginPath();
      g.arc(0, 0, edge + 4, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(186,104,200,.9)';
      g.lineWidth = 2;
      g.stroke();
    }
    if (d.armour > 0) {
      g.beginPath();
      g.arc(0, 0, edge + 1, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(60,70,80,.9)';
      g.lineWidth = 3;
      g.stroke();
    }

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (sprite === null) {
      g.font = `${Math.round(r * 1.4)}px serif`;
      g.fillText(look.glyph, 0, 1);
    }

    if (e.stunTicks > 0) {
      g.font = '12px serif';
      g.fillText('💫', 0, -edge - 7);
    } else if (e.slowTicks > 0) {
      g.font = '12px serif';
      g.fillText('🍯', 0, -edge - 7);
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
