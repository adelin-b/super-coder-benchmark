export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Polygon {
  vertices: Point[];
  holes: Point[][];
}

export class RectError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RectError';
  }
}

function validateRect(r: Rect): void {
  if (!isFinite(r.x1) || !isFinite(r.y1) || !isFinite(r.x2) || !isFinite(r.y2)) {
    throw new RectError('Coordinates must be finite numbers');
  }
  if (isNaN(r.x1) || isNaN(r.y1) || isNaN(r.x2) || isNaN(r.y2)) {
    throw new RectError('Coordinates must not be NaN');
  }
  if (r.x1 >= r.x2 || r.y1 >= r.y2) {
    throw new RectError('Rectangle must have x1 < x2 and y1 < y2');
  }
}

function uniqueSorted(arr: number[]): number[] {
  return [...new Set(arr)].sort((a, b) => a - b);
}

function shoelaceArea(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return area / 2;
}

function removeCollinear(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const result: Point[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const sameX = prev.x === curr.x && curr.x === next.x;
    const sameY = prev.y === curr.y && curr.y === next.y;
    if (!sameX && !sameY) {
      result.push(curr);
    }
  }
  return result;
}

function rotateToStart(pts: Point[]): Point[] {
  if (pts.length === 0) return pts;
  let bestIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y < pts[bestIdx].y || (pts[i].y === pts[bestIdx].y && pts[i].x < pts[bestIdx].x)) {
      bestIdx = i;
    }
  }
  return [...pts.slice(bestIdx), ...pts.slice(0, bestIdx)];
}

/**
 * Trace boundaries on a grid of filled/unfilled cells.
 *
 * Uses the "march along boundary edges" approach:
 * - A boundary edge separates a filled cell from an unfilled cell (or out-of-bounds).
 * - We represent each directed boundary edge by the grid point it starts from and its direction.
 * - Direction convention: 0=right, 1=up, 2=left, 3=down
 * - "Filled on the left" convention: when walking in direction d, the filled cell is to the left.
 *
 * At each grid vertex where we arrive, we pick the next edge by trying right turn first,
 * then straight, then left turn. This traces the tightest loop around the filled region.
 */
function traceBoundaries(
  filled: boolean[][],
  cols: number,
  rows: number,
): { x: number; y: number }[][] {

  function isFilled(cx: number, cy: number): boolean {
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return false;
    return filled[cy][cx];
  }

  // Given a directed edge starting at (px, py) in direction dir,
  // return whether it's a boundary edge (filled cell on left, unfilled on right).
  //
  // Direction 0 (right): goes from (px,py) to (px+1,py). Left cell = (px, py), Right cell = (px, py-1)
  // Direction 1 (up):    goes from (px,py) to (px,py+1). Left cell = (px-1, py), Right cell = (px, py)
  // Direction 2 (left):  goes from (px,py) to (px-1,py). Left cell = (px-1, py-1), Right cell = (px-1, py)
  // Direction 3 (down):  goes from (px,py) to (px,py-1). Left cell = (px, py-1), Right cell = (px-1, py-1)
  function isBoundaryEdge(px: number, py: number, dir: number): boolean {
    let leftCx: number, leftCy: number, rightCx: number, rightCy: number;
    switch (dir) {
      case 0: leftCx = px; leftCy = py; rightCx = px; rightCy = py - 1; break;
      case 1: leftCx = px - 1; leftCy = py; rightCx = px; rightCy = py; break;
      case 2: leftCx = px - 1; leftCy = py - 1; rightCx = px - 1; rightCy = py; break;
      case 3: leftCx = px; leftCy = py - 1; rightCx = px - 1; rightCy = py - 1; break;
      default: return false;
    }
    return isFilled(leftCx, leftCy) && !isFilled(rightCx, rightCy);
  }

  const visited = new Set<string>();
  function edgeKey(px: number, py: number, dir: number): string {
    return `${px},${py},${dir}`;
  }

  // dx, dy for each direction
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];

  const loops: { x: number; y: number }[][] = [];

  for (let py = 0; py <= rows; py++) {
    for (let px = 0; px <= cols; px++) {
      for (let dir = 0; dir < 4; dir++) {
        if (visited.has(edgeKey(px, py, dir))) continue;
        if (!isBoundaryEdge(px, py, dir)) continue;

        const loop: { x: number; y: number }[] = [];
        let cx = px, cy = py, cd = dir;
        const startKey = edgeKey(cx, cy, cd);

        // eslint-disable-next-line no-constant-condition
        while (true) {
          visited.add(edgeKey(cx, cy, cd));
          loop.push({ x: cx, y: cy });

          // Move to the endpoint of this edge
          const nx = cx + DX[cd];
          const ny = cy + DY[cd];

          // From the new point (nx, ny), try directions: right turn, straight, left turn, U-turn
          const rightDir = (cd + 3) % 4;
          const straightDir = cd;
          const leftDir = (cd + 1) % 4;
          const backDir = (cd + 2) % 4;

          let nextDir = -1;
          if (isBoundaryEdge(nx, ny, rightDir)) {
            nextDir = rightDir;
          } else if (isBoundaryEdge(nx, ny, straightDir)) {
            nextDir = straightDir;
          } else if (isBoundaryEdge(nx, ny, leftDir)) {
            nextDir = leftDir;
          } else if (isBoundaryEdge(nx, ny, backDir)) {
            nextDir = backDir;
          }

          if (nextDir === -1) break; // shouldn't happen on valid boundary

          cx = nx;
          cy = ny;
          cd = nextDir;

          if (edgeKey(cx, cy, cd) === startKey) break;
        }

        if (loop.length >= 4) {
          loops.push(loop);
        }
      }
    }
  }

  return loops;
}

/**
 * Ray-casting point-in-polygon test for axis-aligned polygons.
 */
function pointInPolygon(pt: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = polygon[i].y, yj = polygon[j].y;
    const xi = polygon[i].x, xj = polygon[j].x;

    if ((yi > pt.y) !== (yj > pt.y)) {
      const intersectX = xj + ((pt.y - yj) / (yi - yj)) * (xi - xj);
      if (pt.x < intersectX) {
        inside = !inside;
      }
    }
  }
  return inside;
}

export function computeUnionBoundary(rects: Rect[]): Polygon[] {
  if (rects.length === 0) return [];

  for (const r of rects) {
    validateRect(r);
  }

  // Step 1: Coordinate compression
  const allX: number[] = [];
  const allY: number[] = [];
  for (const r of rects) {
    allX.push(r.x1, r.x2);
    allY.push(r.y1, r.y2);
  }
  const xs = uniqueSorted(allX);
  const ys = uniqueSorted(allY);

  const cols = xs.length - 1;
  const rows = ys.length - 1;

  if (cols <= 0 || rows <= 0) return [];

  // Build index maps for fast lookup
  const xIndex = new Map<number, number>();
  for (let i = 0; i < xs.length; i++) xIndex.set(xs[i], i);
  const yIndex = new Map<number, number>();
  for (let i = 0; i < ys.length; i++) yIndex.set(ys[i], i);

  // Step 2: Mark filled cells
  const filled: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (const r of rects) {
    const xStart = xIndex.get(r.x1)!;
    const xEnd = xIndex.get(r.x2)!;
    const yStart = yIndex.get(r.y1)!;
    const yEnd = yIndex.get(r.y2)!;

    for (let cy = yStart; cy < yEnd; cy++) {
      for (let cx = xStart; cx < xEnd; cx++) {
        filled[cy][cx] = true;
      }
    }
  }

  // Step 3: Trace boundaries
  const loops = traceBoundaries(filled, cols, rows);

  // Step 4: Convert grid coordinates to real coordinates and classify
  const realLoops: { pts: Point[]; area: number }[] = [];

  for (const loop of loops) {
    let pts = loop.map(p => ({ x: xs[p.x], y: ys[p.y] }));
    pts = removeCollinear(pts);
    if (pts.length < 3) continue;

    const area = shoelaceArea(pts);
    if (Math.abs(area) < 1e-12) continue;

    realLoops.push({ pts, area });
  }

  // Step 5: Separate outer boundaries (CCW, positive area) and holes (CW, negative area)
  const outers: { pts: Point[]; area: number; holes: Point[][] }[] = [];
  const holes: { pts: Point[]; area: number }[] = [];

  for (const loop of realLoops) {
    if (loop.area > 0) {
      outers.push({ pts: rotateToStart(loop.pts), area: loop.area, holes: [] });
    } else {
      holes.push({ pts: rotateToStart(loop.pts), area: loop.area });
    }
  }

  // Step 6: Assign holes to enclosing outer boundary (smallest enclosing)
  for (const hole of holes) {
    const testPt = hole.pts[0];
    let bestOuter: (typeof outers)[0] | null = null;
    let bestArea = Infinity;

    for (const outer of outers) {
      if (pointInPolygon(testPt, outer.pts) && outer.area < bestArea) {
        bestOuter = outer;
        bestArea = outer.area;
      }
    }

    if (bestOuter) {
      bestOuter.holes.push(hole.pts);
    }
  }

  // Step 7: Sort holes within each polygon
  for (const outer of outers) {
    outer.holes.sort((a, b) => {
      if (a[0].y !== b[0].y) return a[0].y - b[0].y;
      return a[0].x - b[0].x;
    });
  }

  // Step 8: Sort polygons
  outers.sort((a, b) => {
    if (a.pts[0].y !== b.pts[0].y) return a.pts[0].y - b.pts[0].y;
    return a.pts[0].x - b.pts[0].x;
  });

  return outers.map(o => ({
    vertices: o.pts,
    holes: o.holes,
  }));
}
