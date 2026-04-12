# NIGHTMARE-1: Rectangle Union Boundary Path

## Overview
Given N axis-aligned rectangles, compute the boundary path(s) of their union as ordered lists of vertices forming polygons. The result includes outer boundaries (counter-clockwise) and holes (clockwise). This requires a coordinate compression + sweep approach; naive pairwise merge fails for 3+ overlapping rectangles.

## Exported API

```ts
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x1: number;  // left
  y1: number;  // bottom
  x2: number;  // right (x2 > x1)
  y2: number;  // top (y2 > y1)
}

export interface Polygon {
  /** Outer boundary vertices in counter-clockwise order */
  vertices: Point[];
  /** Hole boundaries, each in clockwise order */
  holes: Point[][];
}

export class RectError extends Error {}

export function computeUnionBoundary(rects: Rect[]): Polygon[];
```

## Detailed Requirements

### Input Validation
- Each rect must have `x1 < x2` and `y1 < y2`. Throw `RectError` for degenerate (zero-area) rectangles.
- Empty input returns `[]`.
- All coordinates are finite numbers. Throw `RectError` for NaN or Infinity.

### Coordinate Compression
1. Collect all unique x-coordinates and y-coordinates from all rectangles.
2. Sort them to form a grid of cells.
3. Each cell `(i, j)` spans from `xs[i]..xs[i+1]` horizontally and `ys[j]..ys[j+1]` vertically.
4. A cell is "filled" if any input rectangle fully covers it.

### Boundary Tracing
1. After marking filled cells, trace the boundary between filled and unfilled cells.
2. The boundary consists of edges on the grid lines between filled and unfilled regions.
3. Vertices occur at grid points where the boundary changes direction.
4. Multiple disconnected components produce multiple `Polygon` objects.
5. Interior holes (unfilled regions surrounded by filled regions) are returned in the `holes` array of the enclosing polygon.

### Winding Order
- **Outer boundaries**: counter-clockwise (CCW). When traversing vertices, the filled region is to the LEFT.
- **Holes**: clockwise (CW). When traversing vertices, the filled region is to the RIGHT.
- Verify: for CCW polygon, the signed area (shoelace formula) is positive. For CW, it is negative.

### Vertex Ordering
- Each boundary starts at the bottom-left-most vertex (minimum y, then minimum x as tiebreaker).
- Consecutive duplicate vertices are never included.
- Collinear vertices are removed: if three consecutive vertices lie on the same horizontal or vertical line, the middle one is omitted.

### Special Cases

#### Fully Contained Rectangles
A rectangle fully inside another contributes nothing to the boundary.

#### Touching Rectangles (Shared Edge)
Two rectangles sharing exactly one edge form a single connected boundary with no gap. The shared edge is interior and does not appear in the output.

#### T-Junctions
When an edge of one rectangle meets the middle of an edge of another, the boundary has a vertex at the junction point. This is the #1 failure mode for naive approaches.

#### Interior Holes
Four rectangles arranged as a frame around empty space produce one polygon with one hole. The hole boundary is clockwise.

#### Multiple Disconnected Components
Rectangles that don't touch produce separate `Polygon` objects, each with its own outer boundary.

#### Overlapping Rectangles
Multiple overlapping rectangles are equivalent to their union. The boundary traces the outermost edge of the combined shape.

### Collinear Edge Merging
If two adjacent boundary edges are collinear (same direction on the same line), they must be merged into a single edge. The intermediate vertex is removed. This is critical for:
- Two rectangles side by side with matching heights
- Rectangles that share a partial edge

### Output Ordering
- The returned `Polygon[]` array is sorted by the minimum y-coordinate of each polygon's first vertex, then by minimum x-coordinate.
- Within each polygon, holes are sorted by the minimum y-coordinate of their first vertex, then minimum x.

## Invariants
1. Every vertex in the output corresponds to a grid point (intersection of input x and y coordinates).
2. All edges are axis-aligned (horizontal or vertical).
3. No three consecutive vertices are collinear.
4. Outer boundaries have positive signed area (CCW); holes have negative signed area (CW).
5. The total area computed from the output polygons (outer - holes) equals the area of the union of input rectangles.
6. Each edge of the boundary separates a filled region from an unfilled region.
