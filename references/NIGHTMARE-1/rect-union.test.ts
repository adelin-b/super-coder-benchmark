import { describe, it, expect } from 'vitest';
import { computeUnionBoundary, RectError } from './rect-union.js';
import type { Rect, Point, Polygon } from './rect-union.js';

/** Helper: compute signed area via shoelace */
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

/** Helper: compute total area of union using inclusion-exclusion on grid */
function rectUnionArea(rects: Rect[]): number {
  if (rects.length === 0) return 0;
  const allX = rects.flatMap(r => [r.x1, r.x2]).sort((a, b) => a - b);
  const allY = rects.flatMap(r => [r.y1, r.y2]).sort((a, b) => a - b);
  const xs = [...new Set(allX)];
  const ys = [...new Set(allY)];
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      const covered = rects.some(r => r.x1 <= cx && cx <= r.x2 && r.y1 <= cy && cy <= r.y2);
      if (covered) {
        area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }
  return area;
}

/** Helper: compute polygon area from output (outer - holes) */
function polygonOutputArea(polys: Polygon[]): number {
  let total = 0;
  for (const p of polys) {
    total += Math.abs(shoelaceArea(p.vertices));
    for (const hole of p.holes) {
      total -= Math.abs(shoelaceArea(hole));
    }
  }
  return total;
}

/** Helper: check no three consecutive collinear vertices */
function hasNoCollinear(pts: Point[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    if (prev.x === curr.x && curr.x === next.x) return false;
    if (prev.y === curr.y && curr.y === next.y) return false;
  }
  return true;
}

describe('NIGHTMARE-1: Rectangle Union Boundary Path', () => {
  // ==================== Input Validation ====================

  it('returns empty array for empty input', () => {
    expect(computeUnionBoundary([])).toEqual([]);
  });

  it('throws RectError for degenerate rectangle (zero width)', () => {
    expect(() => computeUnionBoundary([{ x1: 0, y1: 0, x2: 0, y2: 5 }])).toThrow(RectError);
  });

  it('throws RectError for degenerate rectangle (zero height)', () => {
    expect(() => computeUnionBoundary([{ x1: 0, y1: 3, x2: 5, y2: 3 }])).toThrow(RectError);
  });

  it('throws RectError for inverted rectangle', () => {
    expect(() => computeUnionBoundary([{ x1: 5, y1: 0, x2: 0, y2: 5 }])).toThrow(RectError);
  });

  it('throws RectError for NaN coordinates', () => {
    expect(() => computeUnionBoundary([{ x1: NaN, y1: 0, x2: 5, y2: 5 }])).toThrow(RectError);
  });

  it('throws RectError for Infinity coordinates', () => {
    expect(() => computeUnionBoundary([{ x1: 0, y1: 0, x2: Infinity, y2: 5 }])).toThrow(RectError);
  });

  // ==================== Single Rectangle ====================

  it('traces a single rectangle as CCW boundary', () => {
    const result = computeUnionBoundary([{ x1: 0, y1: 0, x2: 4, y2: 3 }]);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0);
    expect(result[0].vertices).toHaveLength(4);
    const area = shoelaceArea(result[0].vertices);
    expect(area).toBeCloseTo(12, 10); // 4*3 = 12, positive = CCW
  });

  it('single rectangle vertices are at corners', () => {
    const result = computeUnionBoundary([{ x1: 1, y1: 2, x2: 5, y2: 6 }]);
    const verts = result[0].vertices;
    const xs = verts.map(v => v.x).sort((a, b) => a - b);
    const ys = verts.map(v => v.y).sort((a, b) => a - b);
    expect(xs).toEqual([1, 1, 5, 5]);
    expect(ys).toEqual([2, 2, 6, 6]);
  });

  it('single rectangle starts at bottom-left vertex', () => {
    const result = computeUnionBoundary([{ x1: 2, y1: 3, x2: 7, y2: 8 }]);
    expect(result[0].vertices[0]).toEqual({ x: 2, y: 3 });
  });

  // ==================== Two Rectangles: Overlapping ====================

  it('two overlapping rectangles produce single polygon', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 3, y2: 2 },
      { x1: 1, y1: 1, x2: 4, y2: 3 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0);
    // Area invariant
    const expected = rectUnionArea(rects);
    const actual = polygonOutputArea(result);
    expect(actual).toBeCloseTo(expected, 10);
  });

  it('two overlapping rectangles: no collinear vertices', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 3, y2: 2 },
      { x1: 1, y1: 1, x2: 4, y2: 3 },
    ];
    const result = computeUnionBoundary(rects);
    expect(hasNoCollinear(result[0].vertices)).toBe(true);
  });

  // ==================== Two Rectangles: Touching (Shared Edge) ====================

  it('two rectangles sharing an edge form one polygon', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 2, y2: 3 },
      { x1: 2, y1: 0, x2: 4, y2: 3 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].vertices).toHaveLength(4); // forms a single rectangle
    const area = shoelaceArea(result[0].vertices);
    expect(area).toBeCloseTo(12, 10); // 4*3
  });

  it('two rectangles sharing a partial edge produce correct boundary', () => {
    // Rect A: (0,0)-(2,3), Rect B: (2,1)-(4,2) — partial shared edge
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 2, y2: 3 },
      { x1: 2, y1: 1, x2: 4, y2: 2 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  // ==================== Two Rectangles: Disjoint ====================

  it('two disjoint rectangles produce two polygons', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 1, y2: 1 },
      { x1: 5, y1: 5, x2: 7, y2: 8 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(2);
    expect(result[0].vertices).toHaveLength(4);
    expect(result[1].vertices).toHaveLength(4);
  });

  it('disjoint polygons are sorted by y then x', () => {
    const rects: Rect[] = [
      { x1: 10, y1: 10, x2: 12, y2: 12 },
      { x1: 0, y1: 0, x2: 2, y2: 2 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(2);
    expect(result[0].vertices[0].y).toBeLessThanOrEqual(result[1].vertices[0].y);
  });

  // ==================== Fully Contained Rectangle ====================

  it('fully contained rectangle does not change boundary', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 10, y2: 10 },
      { x1: 2, y1: 2, x2: 5, y2: 5 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].vertices).toHaveLength(4); // Still a single rectangle
    expect(shoelaceArea(result[0].vertices)).toBeCloseTo(100, 10);
  });

  // ==================== T-Junction (Critical LLM Failure Mode) ====================

  it('T-junction: horizontal rect meets vertical rect midway', () => {
    // Vertical: (2,0)-(4,6), Horizontal: (0,2)-(6,4)
    // Forms a + shape. Boundary is a 12-vertex polygon.
    const rects: Rect[] = [
      { x1: 2, y1: 0, x2: 4, y2: 6 },
      { x1: 0, y1: 2, x2: 6, y2: 4 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0);
    expect(result[0].vertices).toHaveLength(12); // + shape has 12 corners
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('T-junction: three rectangles forming T-shape', () => {
    // Top bar: (0,4)-(6,6), Left leg: (0,0)-(2,4), right part of bar only
    const rects: Rect[] = [
      { x1: 0, y1: 4, x2: 6, y2: 6 },
      { x1: 2, y1: 0, x2: 4, y2: 4 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
    expect(hasNoCollinear(result[0].vertices)).toBe(true);
  });

  // ==================== Interior Hole ====================

  it('four rectangles forming a frame produce one polygon with one hole', () => {
    // Frame: 10x10 outer, 4x4 inner hole
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 10, y2: 3 },  // bottom
      { x1: 0, y1: 7, x2: 10, y2: 10 }, // top
      { x1: 0, y1: 3, x2: 3, y2: 7 },   // left
      { x1: 7, y1: 3, x2: 10, y2: 7 },  // right
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(1);

    // Outer boundary: CCW, positive area
    const outerArea = shoelaceArea(result[0].vertices);
    expect(outerArea).toBeGreaterThan(0);

    // Hole: CW, negative area
    const holeArea = shoelaceArea(result[0].holes[0]);
    expect(holeArea).toBeLessThan(0);

    // Total area = outer - |hole| = 100 - 16 = 84
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('hole boundary starts at bottom-left vertex of hole', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 10, y2: 3 },
      { x1: 0, y1: 7, x2: 10, y2: 10 },
      { x1: 0, y1: 3, x2: 3, y2: 7 },
      { x1: 7, y1: 3, x2: 10, y2: 7 },
    ];
    const result = computeUnionBoundary(rects);
    const hole = result[0].holes[0];
    // Hole is the 3..7 x 3..7 region, bottom-left = (3,3)
    expect(hole[0]).toEqual({ x: 3, y: 3 });
  });

  // ==================== Three Overlapping Rectangles (Naive Merge Fails) ====================

  it('three overlapping rectangles: area invariant holds', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 2, y1: 2, x2: 6, y2: 6 },
      { x1: 4, y1: 0, x2: 8, y2: 4 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('three rectangles in a row merge collinear edges', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 2, y2: 3 },
      { x1: 2, y1: 0, x2: 4, y2: 3 },
      { x1: 4, y1: 0, x2: 6, y2: 3 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].vertices).toHaveLength(4); // single rectangle 6x3
    expect(hasNoCollinear(result[0].vertices)).toBe(true);
  });

  // ==================== L-Shape ====================

  it('L-shaped union has 6 vertices', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 4, y2: 2 },
      { x1: 0, y1: 2, x2: 2, y2: 5 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].vertices).toHaveLength(6);
    expect(hasNoCollinear(result[0].vertices)).toBe(true);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  // ==================== Staircase ====================

  it('staircase of 3 rectangles: corner-touching forms connected boundary', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 2, y2: 2 },
      { x1: 2, y1: 2, x2: 4, y2: 4 },
      { x1: 4, y1: 4, x2: 6, y2: 6 },
    ];
    const result = computeUnionBoundary(rects);
    // Corner-touching rectangles share grid vertices. The boundary tracer
    // follows connected edges through these vertices, producing one polygon.
    expect(result).toHaveLength(1);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('truly disjoint rectangles (gap between them) produce separate polygons', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 2, y2: 2 },
      { x1: 3, y1: 3, x2: 5, y2: 5 },
      { x1: 6, y1: 6, x2: 8, y2: 8 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(3);
  });

  // ==================== Winding Order Invariants ====================

  it('outer boundary always has positive signed area (CCW)', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 5, y2: 5 },
      { x1: 3, y1: 3, x2: 8, y2: 8 },
    ];
    const result = computeUnionBoundary(rects);
    for (const poly of result) {
      expect(shoelaceArea(poly.vertices)).toBeGreaterThan(0);
    }
  });

  it('hole boundaries always have negative signed area (CW)', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 10, y2: 3 },
      { x1: 0, y1: 7, x2: 10, y2: 10 },
      { x1: 0, y1: 3, x2: 3, y2: 7 },
      { x1: 7, y1: 3, x2: 10, y2: 7 },
    ];
    const result = computeUnionBoundary(rects);
    for (const poly of result) {
      for (const hole of poly.holes) {
        expect(shoelaceArea(hole)).toBeLessThan(0);
      }
    }
  });

  // ==================== Collinear Edge Merging ====================

  it('collinear edges from side-by-side rects with same height are merged', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 3, y2: 5 },
      { x1: 3, y1: 0, x2: 6, y2: 5 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    // Should be 4 vertices (merged into one rectangle), not 6
    expect(result[0].vertices).toHaveLength(4);
  });

  it('partial overlap produces no collinear triples', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 5, y2: 3 },
      { x1: 2, y1: 0, x2: 7, y2: 3 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    // Same height, overlap in x: should merge to (0,0)-(7,3)
    expect(result[0].vertices).toHaveLength(4);
    expect(hasNoCollinear(result[0].vertices)).toBe(true);
  });

  // ==================== Area Invariant (Property Test) ====================

  it('area invariant: output area equals union area for 5 random-ish rects', () => {
    const rects: Rect[] = [
      { x1: 1, y1: 2, x2: 5, y2: 7 },
      { x1: 3, y1: 0, x2: 8, y2: 4 },
      { x1: 0, y1: 5, x2: 6, y2: 9 },
      { x1: 4, y1: 3, x2: 9, y2: 6 },
      { x1: 2, y1: 1, x2: 7, y2: 8 },
    ];
    const result = computeUnionBoundary(rects);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('area invariant: many overlapping rects', () => {
    const rects: Rect[] = [];
    for (let i = 0; i < 8; i++) {
      rects.push({ x1: i, y1: i, x2: i + 3, y2: i + 3 });
    }
    const result = computeUnionBoundary(rects);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  // ==================== Complex Shapes ====================

  it('U-shape: three sides of a rectangle', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 6, y2: 2 },  // bottom
      { x1: 0, y1: 2, x2: 2, y2: 6 },  // left
      { x1: 4, y1: 2, x2: 6, y2: 6 },  // right
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0); // U-shape has no hole (open top)
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('cross shape (+) has 12 vertices and no holes', () => {
    const rects: Rect[] = [
      { x1: 1, y1: 0, x2: 3, y2: 4 }, // vertical bar
      { x1: 0, y1: 1, x2: 4, y2: 3 }, // horizontal bar
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].holes).toHaveLength(0);
    expect(result[0].vertices).toHaveLength(12);
  });

  // ==================== Identical Rectangles ====================

  it('two identical rectangles produce single rectangle boundary', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 5, y2: 5 },
      { x1: 0, y1: 0, x2: 5, y2: 5 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].vertices).toHaveLength(4);
    expect(shoelaceArea(result[0].vertices)).toBeCloseTo(25, 10);
  });

  // ==================== Negative Coordinates ====================

  it('handles negative coordinates correctly', () => {
    const rects: Rect[] = [
      { x1: -5, y1: -3, x2: 0, y2: 0 },
      { x1: -2, y1: -1, x2: 3, y2: 2 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  // ==================== Many Rectangles Forming Grid ====================

  it('grid of 4 rectangles with center hole', () => {
    // 2x2 grid with a hole in the center
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 6, y1: 0, x2: 10, y2: 4 },
      { x1: 0, y1: 6, x2: 4, y2: 10 },
      { x1: 6, y1: 6, x2: 10, y2: 10 },
    ];
    const result = computeUnionBoundary(rects);
    // These are 4 separate polygons (not connected)
    expect(result).toHaveLength(4);
    for (const poly of result) {
      expect(poly.vertices).toHaveLength(4);
      expect(poly.holes).toHaveLength(0);
    }
  });

  // ==================== Edge Cases with Floating Point ====================

  it('handles fractional coordinates', () => {
    const rects: Rect[] = [
      { x1: 0.5, y1: 0.5, x2: 2.5, y2: 2.5 },
      { x1: 1.5, y1: 1.5, x2: 3.5, y2: 3.5 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  it('very thin rectangles', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 100, y2: 0.1 },
      { x1: 50, y1: 0, x2: 150, y2: 0.1 },
    ];
    const result = computeUnionBoundary(rects);
    expect(result).toHaveLength(1);
    expect(result[0].vertices).toHaveLength(4); // merged into one thin rect
    expect(polygonOutputArea(result)).toBeCloseTo(15, 10); // 150 * 0.1
  });

  // ==================== Nested Holes ====================

  it('nested frame: outer frame with hole, inner frame fills part of hole', () => {
    // Outer frame
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 20, y2: 4 },   // bottom
      { x1: 0, y1: 16, x2: 20, y2: 20 },  // top
      { x1: 0, y1: 4, x2: 4, y2: 16 },    // left
      { x1: 16, y1: 4, x2: 20, y2: 16 },   // right
      // Inner block filling part of hole
      { x1: 8, y1: 8, x2: 12, y2: 12 },
    ];
    const result = computeUnionBoundary(rects);
    const expected = rectUnionArea(rects);
    expect(polygonOutputArea(result)).toBeCloseTo(expected, 10);
  });

  // ==================== All Edges Axis-Aligned ====================

  it('all output edges are axis-aligned', () => {
    const rects: Rect[] = [
      { x1: 0, y1: 0, x2: 3, y2: 5 },
      { x1: 1, y1: 2, x2: 6, y2: 4 },
      { x1: 4, y1: 1, x2: 7, y2: 6 },
    ];
    const result = computeUnionBoundary(rects);
    for (const poly of result) {
      const allPts = [poly.vertices, ...poly.holes];
      for (const pts of allPts) {
        for (let i = 0; i < pts.length; i++) {
          const curr = pts[i];
          const next = pts[(i + 1) % pts.length];
          const sameX = curr.x === next.x;
          const sameY = curr.y === next.y;
          expect(sameX || sameY).toBe(true);
        }
      }
    }
  });

  // ==================== Vertices on Grid Points ====================

  it('all output vertices are on input coordinate grid', () => {
    const rects: Rect[] = [
      { x1: 1, y1: 2, x2: 5, y2: 7 },
      { x1: 3, y1: 0, x2: 8, y2: 4 },
    ];
    const allX = new Set(rects.flatMap(r => [r.x1, r.x2]));
    const allY = new Set(rects.flatMap(r => [r.y1, r.y2]));
    const result = computeUnionBoundary(rects);
    for (const poly of result) {
      for (const v of poly.vertices) {
        expect(allX.has(v.x)).toBe(true);
        expect(allY.has(v.y)).toBe(true);
      }
    }
  });
});
