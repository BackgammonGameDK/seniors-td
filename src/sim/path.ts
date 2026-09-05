/**
 * The board, and the one street the troublemakers come down.
 *
 * The lane is a polyline with four hairpins, which is not decoration: a corner
 * is where a long-range tower covers several stretches of road at once and
 * where a crowd bunches up for a splash. Placement is most of the decision in
 * this game, and the shape of the street is what gives placement something to
 * decide.
 */

export interface Point {
  x: number;
  y: number;
}

export const BOARD = {
  width: 960,
  height: 600,
  cell: 40,
  get cols(): number {
    return Math.floor(this.width / this.cell);
  },
  get rows(): number {
    return Math.floor(this.height / this.cell);
  },
} as const;

/** How close to the lane an ordinary tower may be built, in pixels. */
export const PATH_CLEARANCE = 34;

/**
 * How close to the lane a blockade must be. Walker Walter stands *in* the
 * road, so he is the one tower that inverts the clearance test rather than
 * being exempted from it.
 */
export const BLOCKER_CLEARANCE = 20;

/** The lane, as a polyline. Charges enter at the first point, leak at the last. */
export const PATH_POINTS: Point[] = [
  { x: -20, y: 140 },
  { x: 220, y: 140 },
  { x: 220, y: 380 },
  { x: 460, y: 380 },
  { x: 460, y: 100 },
  { x: 700, y: 100 },
  { x: 700, y: 460 },
  { x: 900, y: 460 },
  { x: 900, y: 220 },
  { x: 980, y: 220 },
];

/** Cumulative distance at each point; last entry is the total lane length. */
const CUMULATIVE: number[] = (() => {
  const out = [0];
  for (let i = 1; i < PATH_POINTS.length; i++) {
    const a = PATH_POINTS[i - 1]!;
    const b = PATH_POINTS[i]!;
    out.push(out[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return out;
})();

export const PATH_LENGTH: number = CUMULATIVE[CUMULATIVE.length - 1]!;

/** Position of a charge that has travelled `dist` pixels along the lane. */
export function pointAt(dist: number): Point {
  if (dist <= 0) return PATH_POINTS[0]!;
  if (dist >= PATH_LENGTH) return PATH_POINTS[PATH_POINTS.length - 1]!;
  let seg = 1;
  while (seg < CUMULATIVE.length - 1 && CUMULATIVE[seg]! < dist) seg++;
  const a = PATH_POINTS[seg - 1]!;
  const b = PATH_POINTS[seg]!;
  const segStart = CUMULATIVE[seg - 1]!;
  const segLen = CUMULATIVE[seg]! - segStart;
  const t = segLen === 0 ? 0 : (dist - segStart) / segLen;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Shortest distance from an arbitrary point to the lane. */
export function distanceToPath(p: Point): number {
  let best = Infinity;
  for (let i = 1; i < PATH_POINTS.length; i++) {
    best = Math.min(best, distToSegment(p, PATH_POINTS[i - 1]!, PATH_POINTS[i]!));
  }
  return best;
}

/** Pixel centre of a grid cell. */
export function cellCentre(col: number, row: number): Point {
  return { x: col * BOARD.cell + BOARD.cell / 2, y: row * BOARD.cell + BOARD.cell / 2 };
}

/** True if the cell is on the board at all. */
export function isOnBoard(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < BOARD.cols && row < BOARD.rows;
}

/** True if an ordinary tower could stand here, ignoring towers already there. */
export function isBuildableCell(col: number, row: number): boolean {
  if (!isOnBoard(col, row)) return false;
  return distanceToPath(cellCentre(col, row)) > PATH_CLEARANCE;
}

/** True if a blockade could stand here -- the road itself, not beside it. */
export function isBlockerCell(col: number, row: number): boolean {
  if (!isOnBoard(col, row)) return false;
  return distanceToPath(cellCentre(col, row)) <= BLOCKER_CLEARANCE;
}

/**
 * How far along the lane a point sits, in the same units as `Enemy.dist`.
 *
 * Only blockades need this, and only once each, at placement: it is the
 * inverse of `pointAt` and costs a walk of the whole polyline, so it must not
 * be called per tick.
 */
export function distanceAlong(p: Point): number {
  let best = Infinity;
  let bestDist = 0;
  for (let i = 1; i < PATH_POINTS.length; i++) {
    const a = PATH_POINTS[i - 1]!;
    const b = PATH_POINTS[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
    if (d < best) {
      best = d;
      bestDist = CUMULATIVE[i - 1]! + t * (CUMULATIVE[i]! - CUMULATIVE[i - 1]!);
    }
  }
  return bestDist;
}

/**
 * The buildable cell nearest a point some distance along the street.
 *
 * Both harnesses name their boards the same way -- "a tower about here, in
 * front of the second hairpin" -- and a board picked by two different rules
 * would make their two measurements incomparable. One rule, in the one place
 * that already knows the shape of the street.
 *
 * `taken` is the cells already claimed by earlier picks, so a build that wants
 * three towers along the same stretch does not stack them all on one square.
 */
export function nearestCell(
  dist: number,
  kind: 'build' | 'blocker' = 'build',
  taken: readonly { col: number; row: number }[] = [],
): { col: number; row: number } {
  const p = pointAt(dist);
  const legal = kind === 'blocker' ? isBlockerCell : isBuildableCell;
  let best = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let col = 0; col < BOARD.cols; col++) {
    for (let row = 0; row < BOARD.rows; row++) {
      if (!legal(col, row)) continue;
      if (taken.some((t) => t.col === col && t.row === row)) continue;
      const c = cellCentre(col, row);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  }
  if (bestD === Infinity) throw new Error(`no free ${kind} cell near distance ${dist}`);
  return best;
}
