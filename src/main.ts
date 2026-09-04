/**
 * Wiring, and nothing else.
 *
 * Pointer handlers here translate a DOM event into a call; what the call means
 * is decided in decisions.ts. The one rule this file must keep: a tap's target
 * cell is read from the tap's own coordinates. Reading it from the last
 * `mousemove` works on a desktop and silently ignores every touch.
 */
import { createClock, nextSpeed, ticksFor, TICK_MS } from './render/clock.ts';
import type { Speed } from './render/clock.ts';
import { boardAction, pickEnemy, towerForKey, armTower } from './render/decisions.ts';
import { Renderer } from './render/canvas.ts';
import { Ui } from './render/ui.ts';
import { BOARD, isBlockerCell, isBuildableCell } from './sim/path.ts';
import { TOWERS } from './sim/towers.ts';
import type { Tower, TowerId } from './sim/types.ts';
import {
  canPlace,
  createWorld,
  placeTower,
  purchaseUpgrade,
  sellTower,
  startWave,
  step,
  towerAt,
} from './sim/world.ts';
import { ENEMY_LOOK } from './shared/display.ts';

const canvas = document.getElementById('board') as HTMLCanvasElement | null;
if (!canvas) throw new Error('no #board');
const renderer = new Renderer(canvas);

let world = createWorld(Date.now() % 100000);
let selected: TowerId | null = null;
let inspected: Tower | null = null;
let hover: { col: number; row: number } | null = null;
let paused = false;
let speed: Speed = 1;

function cellFrom(ev: { clientX: number; clientY: number }): { col: number; row: number } {
  const p = renderer.toBoard(ev);
  return {
    col: Math.floor(p.x / BOARD.cell),
    row: Math.floor(p.y / BOARD.cell),
  };
}

function legalFor(def: TowerId, col: number, row: number): boolean {
  return TOWERS[def].mode === 'blocker' ? isBlockerCell(col, row) : isBuildableCell(col, row);
}

const ui = new Ui({
  onSelect(id) {
    selected = armTower(selected, id);
  },
  onStartWave() {
    startWave(world);
  },
  onRestart() {
    world = createWorld(Date.now() % 100000);
    selected = null;
    inspected = null;
  },
  onCloseInspect() {
    inspected = null;
  },
  onSell(t) {
    sellTower(world, t);
    inspected = null;
  },
  onBuyUpgrade(t, choice) {
    purchaseUpgrade(world, t.id, choice);
  },
  onTogglePause() {
    paused = !paused;
  },
  onCycleSpeed() {
    speed = nextSpeed(speed);
  },
});

canvas.addEventListener('pointermove', (ev) => {
  hover = cellFrom(ev);
});
canvas.addEventListener('pointerleave', () => {
  hover = null;
});

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  // Read the cell from THIS event. See the note at the top of the file.
  const point = renderer.toBoard(ev);
  const cell = cellFrom(ev);
  hover = cell;

  const hitEnemy = pickEnemy(
    world.enemies.map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      radius: ENEMY_LOOK[e.def].radius,
    })),
    point,
  );
  if (hitEnemy !== null) {
    const e = world.enemies.find((x) => x.id === hitEnemy);
    if (e) {
      inspected = null;
      ui.showEnemy(e);
      return;
    }
  }

  const existing = towerAt(world, cell.col, cell.row);
  const action = boardAction({
    selected,
    occupied: existing !== undefined,
    legal: selected ? legalFor(selected, cell.col, cell.row) : false,
    inspectingSame: existing !== undefined && inspected?.id === existing.id,
    hasInspected: inspected !== null,
  });

  if (action === 'place' && selected) {
    if (canPlace(world, selected, cell.col, cell.row)) {
      placeTower(world, selected, cell.col, cell.row);
    }
  } else if (action === 'inspect') {
    inspected = existing ?? null;
  } else if (action === 'close') {
    inspected = null;
  } else if (action === 'unarm') {
    selected = null;
  }
});

window.addEventListener('keydown', (ev) => {
  const t = towerForKey(ev.key);
  if (t) {
    selected = armTower(selected, t);
    return;
  }
  if (ev.key === 'Escape') {
    selected = null;
    inspected = null;
  } else if (ev.key.toLowerCase() === 'p') {
    paused = !paused;
  } else if (ev.key.toLowerCase() === 'f') {
    speed = nextSpeed(speed);
  } else if (ev.key === ' ') {
    ev.preventDefault();
    startWave(world);
  }
});

const clock = createClock();
let last = 0;

function frame(now: number): void {
  const elapsed = last === 0 ? TICK_MS : now - last;
  last = now;
  const ticks = ticksFor(clock, elapsed, paused ? 0 : speed);
  for (let i = 0; i < ticks; i++) {
    step(world);
    renderer.ingest(world.events);
    // A tower can be knocked down mid-round, so the inspected reference has to
    // be dropped rather than left pointing at something off the board.
    if (inspected && !world.towers.includes(inspected)) inspected = null;
  }
  renderer.draw(world, { selected, hover, inspected, previewRange: ui.previewRange });
  ui.sync(world, { selected, inspected, paused, speed });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for driving the game from the console, and for poking at it in a
// hidden tab where requestAnimationFrame stops.
Object.defineProperty(window, 'street', {
  value: {
    world: () => world,
    place: (id: TowerId, col: number, row: number) => placeTower(world, id, col, row),
    start: () => startWave(world),
    advance: (n: number) => {
      for (let i = 0; i < n; i++) step(world);
    },
    tickMs: TICK_MS,
  },
});
