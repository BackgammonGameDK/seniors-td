import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/sim/enemies.ts';
import {
  BOARD,
  cellCentre,
  distanceAlong,
  isBlockerCell,
  isBuildableCell,
  PATH_LENGTH,
  pointAt,
} from '../src/sim/path.ts';
import { TOWERS } from '../src/sim/towers.ts';
import type { EnemyId, TowerId } from '../src/sim/types.ts';
import { WAVES } from '../src/sim/waves.ts';
import {
  applyHit,
  canPlace,
  createWorld,
  placeTower,
  spawnEnemy,
  startWave,
  step,
} from '../src/sim/world.ts';
import type { World } from '../src/sim/world.ts';

/** A cell a normal tower may stand on, nearest to the given lane distance. */
function buildCellNear(dist: number): { col: number; row: number } {
  const p = pointAt(dist);
  let best = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let col = 0; col < BOARD.cols; col++) {
    for (let row = 0; row < BOARD.rows; row++) {
      if (!isBuildableCell(col, row)) continue;
      const c = cellCentre(col, row);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  }
  return best;
}

function roadCellNear(dist: number): { col: number; row: number } {
  const p = pointAt(dist);
  let best = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let col = 0; col < BOARD.cols; col++) {
    for (let row = 0; row < BOARD.rows; row++) {
      if (!isBlockerCell(col, row)) continue;
      const c = cellCentre(col, row);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  }
  return best;
}

function rich(seed = 1): World {
  const w = createWorld(seed);
  w.gold = 100000;
  return w;
}

function put(w: World, def: TowerId, at: { col: number; row: number }) {
  expect(placeTower(w, def, at.col, at.row)).toBe(true);
  return w.towers[w.towers.length - 1]!;
}

const NO_EFFECT = { slowTicks: 0, slowFactor: 0, stunTicks: 0 };

describe('placement', () => {
  it('keeps ordinary towers off the road and blockades on it', () => {
    const w = rich();
    const road = roadCellNear(400);
    const verge = buildCellNear(400);

    expect(canPlace(w, 'norah', road.col, road.row)).toBe(false);
    expect(canPlace(w, 'walter', road.col, road.row)).toBe(true);
    expect(canPlace(w, 'norah', verge.col, verge.row)).toBe(true);
    expect(canPlace(w, 'walter', verge.col, verge.row)).toBe(false);
  });

  it('refuses a cell that is already taken, and charges for the one it takes', () => {
    const w = createWorld(1);
    const at = buildCellNear(300);
    const before = w.gold;
    expect(placeTower(w, 'norah', at.col, at.row)).toBe(true);
    expect(w.gold).toBe(before - TOWERS.norah.cost);
    expect(placeTower(w, 'norah', at.col, at.row)).toBe(false);
  });

  it('refuses a tower the wallet cannot cover', () => {
    const w = createWorld(1);
    w.gold = 10;
    const at = buildCellNear(300);
    expect(placeTower(w, 'bill', at.col, at.row)).toBe(false);
  });
});

describe('armour and shields', () => {
  it('armour comes off every hit, so many weak hits give up more than one big one', () => {
    const w = rich();
    const mike = spawnEnemy(w, 'mike', 100);
    const start = mike.hp;

    // Six hits of 7 against armour 3 land 24, not 42.
    for (let i = 0; i < 6; i++) applyHit(w, mike, 7, NO_EFFECT);
    expect(start - mike.hp).toBe(6 * (7 - ENEMIES.mike.armour));

    const other = spawnEnemy(w, 'mike', 100);
    applyHit(w, other, 42, NO_EFFECT);
    expect(other.hp).toBe(start - (42 - ENEMIES.mike.armour));
  });

  it('never lets a hit heal, however heavy the armour', () => {
    const w = rich();
    const mike = spawnEnemy(w, 'mike', 100);
    const start = mike.hp;
    applyHit(w, mike, 1, NO_EFFECT);
    expect(mike.hp).toBe(start);
  });

  it('a shield carrier shields its neighbours but never itself', () => {
    const w = rich();
    const ben = spawnEnemy(w, 'ben', 100);
    const sam = spawnEnemy(w, 'sam', 100);
    step(w);

    expect(ben.shield).toBe(0);
    expect(sam.shield).toBe(ENEMIES.ben.shieldAura);
  });

  it('drops the shield as soon as the carrier is out of range', () => {
    const w = rich();
    spawnEnemy(w, 'ben', 100);
    const sam = spawnEnemy(w, 'sam', 100 + ENEMIES.ben.auraRange * 4);
    step(w);
    expect(sam.shield).toBe(0);
  });
});

describe('status effects', () => {
  it('stops a troublemaker that can be stopped', () => {
    const w = rich();
    const sam = spawnEnemy(w, 'sam', 100);
    applyHit(w, sam, 0, { slowTicks: 0, slowFactor: 0, stunTicks: 30 });
    step(w);
    expect(sam.speedMult).toBe(0);
  });

  it('leaves a stun-immune troublemaker walking', () => {
    const w = rich();
    const mike = spawnEnemy(w, 'mike', 100);
    applyHit(w, mike, 0, { slowTicks: 0, slowFactor: 0, stunTicks: 30 });
    step(w);
    expect(mike.stunTicks).toBe(0);
    expect(mike.speedMult).toBe(1);
  });

  it('slows without ever stopping, and lets the slow expire', () => {
    const w = rich();
    const sam = spawnEnemy(w, 'sam', 100);
    applyHit(w, sam, 0, { slowTicks: 4, slowFactor: 0.99, stunTicks: 0 });
    step(w);
    expect(sam.speedMult).toBeGreaterThan(0);
    expect(sam.speedMult).toBeLessThan(1);
    for (let i = 0; i < 8; i++) step(w);
    expect(sam.speedMult).toBe(1);
  });

  it('applies status even when the damage is entirely absorbed', () => {
    const w = rich();
    const mike = spawnEnemy(w, 'mike', 100);
    applyHit(w, mike, 1, { slowTicks: 60, slowFactor: 0.5, stunTicks: 0 });
    expect(mike.slowTicks).toBe(60);
  });
});

describe('splitting', () => {
  it('leaves two runners behind, and not before the tick is over', () => {
    const w = rich();
    const gang = spawnEnemy(w, 'gang', 200);
    applyHit(w, gang, 9999, NO_EFFECT);

    // Queued, not yet on the board -- this is what stops a splash from
    // reaching the very enemies it just created.
    expect(w.enemies.filter((e) => e.def === 'walker')).toHaveLength(0);
    expect(w.pendingSpawns).toHaveLength(ENEMIES.gang.splitCount);

    step(w);
    expect(w.enemies.filter((e) => e.def === 'walker')).toHaveLength(
      ENEMIES.gang.splitCount,
    );
  });

  it('does not let one splash cascade through a family', () => {
    const w = rich();
    for (let i = 0; i < 3; i++) spawnEnemy(w, 'gang', 200 + i * 4);
    const before = w.enemies.length;
    // A single enormous burst on top of the clump.
    const at = pointAt(202);
    for (const e of w.enemies.filter((x) => Math.hypot(x.x - at.x, x.y - at.y) < 60)) {
      applyHit(w, e, 9999, NO_EFFECT);
    }
    step(w);
    // Three gangs became six runners. Not more.
    expect(w.enemies).toHaveLength(before * ENEMIES.gang.splitCount);
    expect(w.enemies.every((e) => e.def === 'walker')).toBe(true);
  });
});

describe('blockades', () => {
  it('stops the street until it is knocked down, then lets it move again', () => {
    const w = rich();
    const at = roadCellNear(300);
    const walter = put(w, 'walter', at);
    const sam = spawnEnemy(w, 'sam', walter.laneDist - 60);

    for (let i = 0; i < 200; i++) step(w);
    expect(sam.blockedBy).toBe(walter.id);
    expect(sam.dist).toBeLessThan(walter.laneDist);
    expect(walter.hp).toBeLessThan(TOWERS.walter.maxHp);

    // Knock him down by hand and the queue moves off again.
    walter.hp = 0.01;
    const held = sam.dist;
    for (let i = 0; i < 120; i++) step(w);
    expect(w.towers).toHaveLength(0);
    expect(w.stats.blockersLost).toBe(1);
    expect(sam.dist).toBeGreaterThan(held);
  });
});

describe('auras', () => {
  it('Clara speeds her neighbours up and leaves herself alone', () => {
    const w = rich();
    const clara = put(w, 'clara', buildCellNear(300));
    const near = w.towers.find((t) => t.def === 'clara')!;
    const spot = buildCellNear(300 + 40);
    const norah = spot.col === near.col && spot.row === near.row ? buildCellNear(360) : spot;
    const n = put(w, 'norah', norah);
    // Put them within reach of each other for the sake of the assertion.
    n.x = clara.x + 10;
    n.y = clara.y;
    step(w);
    expect(n.rateMult).toBeCloseTo(TOWERS.clara.buffRate);
    expect(clara.rateMult).toBe(1);
  });

  it('Tina silences a tower while she is beside it, and not after', () => {
    const w = rich();
    const norah = put(w, 'norah', buildCellNear(300));
    const tina = spawnEnemy(w, 'tina', 100);
    tina.x = norah.x;
    tina.y = norah.y;
    step(w);
    expect(norah.disabled).toBe(true);

    tina.alive = false;
    step(w);
    expect(norah.disabled).toBe(false);
  });
});

describe('the round', () => {
  it('costs lives when someone gets through, and ends the run at zero', () => {
    const w = rich();
    w.lives = 2;
    const sam = spawnEnemy(w, 'sam', PATH_LENGTH - 1);
    w.status = 'running';
    for (let i = 0; i < 5; i++) step(w);
    expect(sam.alive).toBe(false);
    expect(w.stats.leaksByEnemy.sam).toBe(1);
    expect(w.lives).toBe(1);

    const mike = spawnEnemy(w, 'mike', PATH_LENGTH - 1);
    expect(mike.def).toBe('mike');
    for (let i = 0; i < 5; i++) step(w);
    expect(w.status).toBe('lost');
  });

  it('pays a clear bonus and moves to the next round', () => {
    const w = rich();
    expect(startWave(w)).toBe(true);
    expect(w.status).toBe('running');
    const before = w.waveIndex;
    // Nothing to fight it, but nothing spawned either once the queue is empty.
    w.spawnQueue = [];
    step(w);
    expect(w.waveIndex).toBe(before + 1);
    expect(w.status).toBe('idle');
    expect(w.stats.goldEarned).toBeGreaterThan(0);
  });
});

describe('the simulation is reproducible', () => {
  it('gives the same run for the same seed and the same board', () => {
    const plan: [TowerId, number][] = [
      ['norah', 200],
      ['bill', 500],
      ['barbara', 800],
    ];
    const run = (seed: number) => {
      const w = rich(seed);
      for (const [def, at] of plan) {
        const cell = buildCellNear(at);
        if (canPlace(w, def, cell.col, cell.row)) placeTower(w, def, cell.col, cell.row);
      }
      startWave(w);
      for (let i = 0; i < 3000; i++) step(w);
      return JSON.stringify(w.stats);
    };
    expect(run(7)).toBe(run(7));
  });

  it('keeps every enemy position in step with its distance along the lane', () => {
    const w = rich();
    startWave(w);
    for (let i = 0; i < 1200; i++) {
      step(w);
      for (const e of w.enemies) {
        const p = pointAt(e.dist);
        expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(0.001);
      }
    }
  });
});

describe('the lane', () => {
  it('never calls a cell both buildable and a blockade spot', () => {
    for (let col = 0; col < BOARD.cols; col++) {
      for (let row = 0; row < BOARD.rows; row++) {
        expect(isBuildableCell(col, row) && isBlockerCell(col, row)).toBe(false);
      }
    }
  });

  it('has somewhere to put a blockade at all', () => {
    let count = 0;
    for (let col = 0; col < BOARD.cols; col++) {
      for (let row = 0; row < BOARD.rows; row++) if (isBlockerCell(col, row)) count++;
    }
    expect(count).toBeGreaterThan(10);
  });

  it('turns a point back into the distance that produced it', () => {
    for (const d of [0, 120, 640, 1500, PATH_LENGTH - 5]) {
      expect(Math.abs(distanceAlong(pointAt(d)) - d)).toBeLessThan(1);
    }
  });
});

describe('the authored rounds', () => {
  it('introduce every troublemaker that is not a leftover', () => {
    const seen = new Set<EnemyId>();
    for (const wave of WAVES) for (const g of wave.groups) seen.add(g.enemy);
    // `walker` only ever arrives by splitting, so it is never in the table.
    expect([...seen].sort()).toEqual(['ben', 'gang', 'mike', 'sam', 'tina']);
  });

  it('introduce each one on its own before burying it in a crowd', () => {
    const firstSeen = new Map<EnemyId, number>();
    WAVES.forEach((wave, i) => {
      for (const g of wave.groups) if (!firstSeen.has(g.enemy)) firstSeen.set(g.enemy, i);
    });
    // Nothing new turns up for the first time in the last third of the run,
    // where a player has no quiet round left to learn it in.
    for (const [, round] of firstSeen) expect(round).toBeLessThan(WAVES.length * 0.7);
  });
});
