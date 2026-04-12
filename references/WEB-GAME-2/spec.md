# WEB-GAME-2: 3D Snake Game Logic (Grid Movement, Collision, Growth)

## Source
Extracted from [Web-Bench](https://github.com/bytedance/web-bench) Three.js project (3D Snake game). Apache 2.0 license.

## Overview
Implement the core logic for a 3D snake game on a grid. The snake moves on a 2D grid (x, z axes), can grow by eating candy, must avoid fences (walls) and its own body, and can teleport through portals. All logic is pure functions operating on grid coordinates -- no 3D rendering.

## Exported API

```ts
export interface Position { x: number; z: number }
export type Direction = 'up' | 'down' | 'left' | 'right'

export interface SnakeState {
  head: Position;
  body: Position[];       // body segments following the head
  direction: Direction;
}

export interface GridConfig {
  size: number;            // grid is size x size (e.g., 8 for an 8x8 grid)
  fences: Position[];      // wall positions (border cells)
  portals: [Position, Position]; // pair of portal positions
}

/** Move snake one step in the given direction. Body follows head. Returns new state. */
export function moveSnake(snake: SnakeState, direction: Direction): SnakeState;

/** Check if a position is a fence. */
export function isFence(pos: Position, config: GridConfig): boolean;

/** Check if a position collides with any snake body segment. */
export function collidesWithBody(pos: Position, snake: SnakeState): boolean;

/** Check if a move is valid (not into fence or own body). */
export function isValidMove(snake: SnakeState, direction: Direction, config: GridConfig): boolean;

/** Grow snake: add a new body segment at the tail. Returns new state. */
export function growSnake(snake: SnakeState): SnakeState;

/**
 * Place candy on the grid. Starts at top-left interior cell, scans right then down.
 * Skips cells occupied by snake, fences, or portals. Returns the position or null if grid full.
 */
export function placeCandy(
  snake: SnakeState,
  config: GridConfig,
): Position | null;

/**
 * Check portal teleportation: if head is on a portal, return the other portal's position.
 * Otherwise return null.
 */
export function checkPortal(head: Position, config: GridConfig): Position | null;

/**
 * Detect if snake is in a dead end (no valid moves in any direction).
 */
export function isDeadEnd(snake: SnakeState, config: GridConfig): boolean;

/** Generate fence positions for the border of a size x size grid. */
export function generateFences(size: number): Position[];
```

## Detailed Requirements

### Grid System
- Grid is `size x size` with coordinates from (0,0) to (size-1, size-1)
- Fences occupy the border cells
- Interior cells are (1,1) to (size-2, size-2)

### Movement
- 'up' decreases z by 1, 'down' increases z by 1
- 'left' decreases x by 1, 'right' increases x by 1
- Body follows: each segment moves to the previous position of the segment ahead of it
- Head moves to new position

### Collision
- Fence collision: new head position matches any fence position
- Self collision: new head position matches any body segment position

### Growth
- When snake eats candy, a new body segment is added at the tail position (the position the last body segment just left)

### Candy Placement
- Start scanning from position (1, 1) -- top-left interior cell
- Scan right (increment x), then next row (increment z)
- Skip cells occupied by snake head, body, fences, or portals
- Return first available position, or null if grid is full

### Portals
- If snake head lands on a portal position, teleport to the other portal position
- After teleportation, body follows normally

### Dead End Detection
- Snake is in a dead end if no direction (up/down/left/right) leads to a valid cell (not fence, not own body)
