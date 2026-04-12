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
  constructor(message: string) {
    super(message);
    this.name = "RectError";
    Object.setPrototypeOf(this, RectError.prototype);
  }
}

// Direction constants: EAST=0, NORTH=1, WEST=2, SOUTH=3
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

// CW rotation order in y-up math coords: E(0)->S(3)->W(2)->N(1)->E
// CW_FROM[d] = directions in clockwise order starting at d
const CW_FROM: number[][] = [
  [0, 3, 2, 1], // from EAST
  [1, 0, 3, 2], // from NORTH
  [2, 1, 0, 3], // from WEST
  [3, 2, 1, 0], // from SOUTH
];

function signedArea2(pts: Point[]): number {
  let s = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return s;
}

function removeCollinear(pts: Point[]): Point[] {
  let cur = pts.slice();
  for (;;) {
    const n = cur.length;
    if (n < 3) return cur;
    const next: Point[] = [];
    let anyRemoved = false;
    for (let i = 0; i < n; i++) {
      const a = cur[(i - 1 + n) % n];
      const b = cur[i];
      const c = cur[(i + 1) % n];
      const collinear =
        (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
      if (collinear) {
        anyRemoved = true;
      } else {
        next.push(b);
      }
    }
    if (!anyRemoved) return cur;
    cur = next;
  }
}

function reorderFromBottomLeft(pts: Point[]): Point[] {
  let bi = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[bi];
    if (p.y < q.y || (p.y === q.y && p.x < q.x)) bi = i;
  }
  if (bi === 0) return pts.slice();
  return [...pts.slice(bi), ...pts.slice(0, bi)];
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > p.y) !== (yj > p.y)) {
      const xInt = ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
      if (p.x < xInt) inside = !inside;
    }
  }
  return inside;
}

export function computeUnionBoundary(rects: Rect[]): Polygon[] {
  if (rects.length === 0) return [];

  // --- Input Validation ---
  for (const r of rects) {
    if (
      !Number.isFinite(r.x1) || !Number.isFinite(r.y1) ||
      !Number.isFinite(r.x2) || !Number.isFinite(r.y2)
    ) {
      throw new RectError("Non-finite coordinate in rectangle");
    }
    if (r.x1 >= r.x2 || r.y1 >= r.y2) {
      throw new RectError(
        `Degenerate rectangle: x1=${r.x1} x2=${r.x2} y1=${r.y1} y2=${r.y2}`
      );
    }
  }

  // --- Coordinate Compression ---
  const xs = [...new Set(rects.flatMap((r) => [r.x1, r.x2]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y1, r.y2]))].sort((a, b) => a - b);
  const nc = xs.length - 1;
  const nr = ys.length - 1;
  if (nc < 1 || nr < 1) return [];

  const xIdx = new Map(xs.map((v, i) => [v, i]));
  const yIdx = new Map(ys.map((v, i) => [v, i]));

  // --- Mark Filled Cells: grid[col][row] ---
  const grid: Uint8Array[] = Array.from({ length: nc }, () => new Uint8Array(nr));
  for (const r of rects) {
    const c1 = xIdx.get(r.x1)!, c2 = xIdx.get(r.x2)!;
    const r1 = yIdx.get(r.y1)!, r2 = yIdx.get(r.y2)!;
    for (let c = c1; c < c2; c++)
      for (let row = r1; row < r2; row++)
        grid[c][row] = 1;
  }

  const cell = (c: number, row: number): number =>
    c >= 0 && c < nc && row >= 0 && row < nr ? grid[c][row] : 0;

  // --- Generate Boundary Half-Edges ---
  // out.get(`${gx},${gy}`) = Set of outgoing directions from grid-point (gx, gy)
  const out = new Map<string, Set<number>>();
  const addEdge = (gx: number, gy: number, dir: number) => {
    const k = `${gx},${gy}`;
    if (!out.has(k)) out.set(k, new Set());
    out.get(k)!.add(dir);
  };

  // Horizontal edges at y=ys[gy]: separating row gy (above) from row gy-1 (below)
  for (let gy = 0; gy <= nr; gy++) {
    for (let c = 0; c < nc; c++) {
      const ab = cell(c, gy);     // above
      const bl = cell(c, gy - 1); // below
      if (ab && !bl) {
        // Filled above → EAST (left of EAST = NORTH = filled side)
        addEdge(c, gy, 0 /* EAST */);
      } else if (!ab && bl) {
        // Filled below → WEST (left of WEST = SOUTH = filled side)
        addEdge(c + 1, gy, 2 /* WEST */);
      }
    }
  }

  // Vertical edges at x=xs[gx]: separating col gx (right) from col gx-1 (left)
  for (let gx = 0; gx <= nc; gx++) {
    for (let row = 0; row < nr; row++) {
      const rt = cell(gx, row);     // right
      const lt = cell(gx - 1, row); // left
      if (rt && !lt) {
        // Filled right → SOUTH (left of SOUTH = EAST = filled side)
        addEdge(gx, row + 1, 3 /* SOUTH */);
      } else if (!rt && lt) {
        // Filled left → NORTH (left of NORTH = WEST = filled side)
        addEdge(gx, row, 1 /* NORTH */);
      }
    }
  }

  if (out.size === 0) return [];

  // --- Collect & Sort Half-Edges ---
  const allEdges: [number, number, number][] = [];
  for (const [k, dirs] of out) {
    const ci = k.indexOf(",");
    const gx = parseInt(k.slice(0, ci), 10);
    const gy = parseInt(k.slice(ci + 1), 10);
    for (const dir of dirs) allEdges.push([gx, gy, dir]);
  }
  // Sort bottom-to-top, left-to-right, direction ascending
  allEdges.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);

  // --- Trace Polygons ---
  const visited = new Set<string>();
  const rawPolys: Point[][] = [];

  for (const [gx0, gy0, d0] of allEdges) {
    if (visited.has(`${gx0},${gy0},${d0}`)) continue;

    const pts: Point[] = [];
    let gx = gx0, gy = gy0, d = d0;
    let safety = 0;

    do {
      visited.add(`${gx},${gy},${d}`);
      pts.push({ x: xs[gx], y: ys[gy] });

      // Advance along this edge
      const nx = gx + DX[d];
      const ny = gy + DY[d];

      // Next direction: first in CW order from reverse-of-d
      const dRev = (d + 2) & 3;
      const nDirs = out.get(`${nx},${ny}`);
      let nd = -1;
      if (nDirs) {
        for (const cand of CW_FROM[dRev]) {
          if (nDirs.has(cand)) { nd = cand; break; }
        }
      }
      if (nd < 0) break; // Should not happen for valid inputs

      gx = nx; gy = ny; d = nd;
      if (++safety > 10_000_000) break;
    } while (gx !== gx0 || gy !== gy0 || d !== d0);

    if (pts.length >= 3) rawPolys.push(pts);
  }

  // --- Process Polygons ---
  const polygons: Point[][] = rawPolys
    .map((p) => {
      const c = removeCollinear(p);
      return c.length >= 3 ? reorderFromBottomLeft(c) : null;
    })
    .filter((p): p is Point[] => p !== null);

  // --- Classify: outer (CCW, area>0) vs hole (CW, area<0) ---
  const outers: Point[][] = [];
  const holes: Point[][] = [];
  for (const p of polygons) {
    const a = signedArea2(p);
    if (a > 0) outers.push(p);
    else if (a < 0) holes.push(p);
  }

  // --- Epsilon for interior-point testing ---
  let minGap = Infinity;
  for (let i = 1; i < xs.length; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
  for (let i = 1; i < ys.length; i++) minGap = Math.min(minGap, ys[i] - ys[i - 1]);
  const eps = minGap * 0.5;

  // --- Assign Holes to Outer Polygons ---
  const result: Polygon[] = outers.map((v) => ({ vertices: v, holes: [] }));

  for (const hole of holes) {
    // Interior point of CW hole: midpoint of first edge, shifted right (into interior)
    // Right perpendicular of direction (dx,dy) in y-up coords = (dy, -dx)
    let tp: Point;
    if (hole.length >= 2) {
      const mx = (hole[0].x + hole[1].x) * 0.5;
      const my = (hole[0].y + hole[1].y) * 0.5;
      const dx = hole[1].x - hole[0].x;
      const dy = hole[1].y - hole[0].y;
      const len = Math.hypot(dx, dy);
      tp = { x: mx + eps * dy / len, y: my - eps * dx / len };
    } else {
      tp = { ...hole[0] };
    }

    // Find smallest enclosing outer polygon
    let bestArea = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < outers.length; i++) {
      if (pointInPolygon(tp, outers[i])) {
        const a = Math.abs(signedArea2(outers[i]));
        if (a < bestArea) { bestArea = a; bestIdx = i; }
      }
    }
    if (bestIdx >= 0) result[bestIdx].holes.push(hole);
  }

  // --- Sort Output ---
  for (const p of result) {
    p.holes.sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x);
  }
  result.sort((a, b) =>
    a.vertices[0].y - b.vertices[0].y || a.vertices[0].x - b.vertices[0].x
  );

  return result;
}