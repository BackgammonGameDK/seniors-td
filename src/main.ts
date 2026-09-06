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
import {
  boardAction,
  pickEnemy,
  recordingOf,
  runKeyAction,
  stepOf,
  towerForKey,
  armTower,
} from './render/decisions.ts';
import type { Placement } from './sim/loadout.ts';
import { Renderer } from './render/canvas.ts';
import { Ui } from './render/ui.ts';
import type { UiHandlers } from './render/ui.ts';
import { BOARD, isBlockerCell, isBuildableCell } from './sim/path.ts';
import { TOWERS } from './sim/towers.ts';
import type { Tower, TowerId } from './sim/types.ts';
import {
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
/**
 * Everything bought this run, in the order it was bought, so a board that was
 * played can be handed to the harnesses as a loadout. Read by `street.loadout`
 * at the bottom of this file.
 */
const bought: Placement[] = [];
/** Sells, which a loadout cannot express. See `recordingOf`. */
let sold = 0;

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

// Named rather than passed straight in, so the keyboard can reach the same
// handlers the buttons call. A key that repeated their bodies instead would be
// free to drift out of step with them, which is exactly what had happened to
// the old space and `p` bindings.
const handlers: UiHandlers = {
  onSelect(id) {
    selected = armTower(selected, id);
  },
  onStartWave() {
    // Putting the round in motion puts the build menu down. Otherwise a card
    // armed and then thought better of is still armed, and the next tap on the
    // board spends the coins. The inspected tower is deliberately left alone:
    // reading an upgrade panel is not a decision the round starting cancels.
    selected = null;
    startWave(world);
  },
  onRestart() {
    world = createWorld(Date.now() % 100000);
    selected = null;
    inspected = null;
    bought.length = 0;
    sold = 0;
  },
  onCloseInspect() {
    inspected = null;
  },
  onSell(t) {
    if (sellTower(world, t)) sold++;
    inspected = null;
  },
  onBuyUpgrade(t, choice) {
    // The return value decides whether this is recorded, so a purchase the sim
    // refused -- too poor, path already maxed, capstone already chosen -- never
    // reaches the plan.
    if (purchaseUpgrade(world, t.id, choice)) bought.push(stepOf(t));
  },
  onTogglePause() {
    paused = !paused;
  },
  onCycleSpeed() {
    speed = nextSpeed(speed);
  },
};

const ui = new Ui(handlers);

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
    if (placeTower(world, selected, cell.col, cell.row)) {
      // `placeTower` re-runs `canPlace` itself and returns whether it took, so
      // asking first and then placing was checking twice and recording on the
      // wrong answer if the two ever disagreed.
      bought.push(stepOf(world.towers[world.towers.length - 1]!));
    }
  } else if (action === 'inspect') {
    inspected = existing ?? null;
    // Tapping a placed tower means "look at this one", not "place my armed
    // tower here" -- so the build-card selection it interrupted has to go too.
    selected = null;
  } else if (action === 'close') {
    inspected = null;
    selected = null;
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
  const run = runKeyAction(ev.key, { status: world.status, paused });
  if (run) {
    // Space scrolls the page, and activates #run natively whenever that button
    // has focus -- which it does immediately after being clicked. Without this
    // the shortcut would fire twice and a pause would undo itself.
    ev.preventDefault();
    if (run === 'start') handlers.onStartWave();
    else handlers.onTogglePause();
    return;
  }
  if (ev.key === 'Escape') {
    selected = null;
    inspected = null;
  } else if (ev.key.toLowerCase() === 'f') {
    speed = nextSpeed(speed);
  } else if (ev.key.toLowerCase() === 'l') {
    showRecording();
  }
});

/**
 * Puts the board you have played on the clipboard, as a loadout.
 *
 * A key rather than a console command, because reaching this through the
 * browser's developer tools is not a thing to ask of somebody who is here to
 * play the game. The box that opens is the fallback: a clipboard write can be
 * refused, and text sitting in a prompt can always be selected and copied by
 * hand.
 */
function showRecording(): void {
  const recorded = recordingOf(bought, sold);
  if (recorded.loadout === '') {
    window.alert('Nothing bought yet, so there is no board to copy.');
    return;
  }
  // Fire and forget: if the browser refuses, the box below still has the text.
  void navigator.clipboard?.writeText(recorded.loadout).catch(() => {});
  window.prompt(
    (recorded.warning ?? 'Copied. Paste it wherever you need it.') +
      '\n\nYour board so far, as a loadout:',
    recorded.loadout,
  );
}

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
    /**
     * The board you just played, written as a loadout.
     *
     * Paste `loadout` into `src/sim/builds.ts`, or straight at a harness:
     *
     *   npm run campaign -- --loadout "<the string>" --runs 20
     *
     * Check `warning` first. It is null when the recording can be trusted.
     */
    loadout: () => recordingOf(bought, sold),
    plan: () => bought.slice(),
  },
});
