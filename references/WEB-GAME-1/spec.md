# WEB-GAME-1: Flappy Bird Collision Detection & Game Physics

## Source
Extracted from [Web-Bench](https://github.com/bytedance/web-bench) Canvas project (Flappy Bird clone). Apache 2.0 license.

## Overview
Implement the core physics and collision detection engine for a Flappy Bird-style game. This is pure game logic with no rendering -- all functions operate on numeric coordinates and return computed results.

## Exported API

```ts
export interface Bird {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
}

export interface Pipe {
  x: number;
  topHeight: number;    // height of the top pipe from canvas top
  bottomY: number;      // y coordinate where bottom pipe starts
  width: number;
  passed: boolean;      // whether bird has passed this pipe
}

export interface GameConfig {
  gravity: number;           // downward acceleration per frame (e.g., 0.45)
  jumpVelocity: number;     // upward velocity on jump (e.g., -6)
  maxFallSpeed: number;     // terminal velocity (e.g., 6)
  canvasWidth: number;
  canvasHeight: number;
  floorY: number;           // y coordinate of the floor
}

/** Apply gravity to bird, cap fall speed, return updated bird. Do NOT mutate input. */
export function applyPhysics(bird: Bird, config: GameConfig): Bird;

/** Apply jump: set velocity to jumpVelocity. Do NOT mutate input. */
export function applyJump(bird: Bird, config: GameConfig): Bird;

/** Compute bird rotation in degrees: -35 ascending, +35 descending, interpolated between. */
export function getBirdRotation(bird: Bird): number;

/** Check if bird collides with the floor. */
export function collidesWithFloor(bird: Bird, config: GameConfig): boolean;

/** Check if bird collides with any pipe. Uses axis-aligned bounding box (AABB). */
export function collidesWithPipe(bird: Bird, pipe: Pipe): boolean;

/** Check if bird has passed a pipe (bird.x > pipe.x + pipe.width). */
export function hasPassed(bird: Bird, pipe: Pipe): boolean;

/**
 * Generate a new pipe pair at a given x position.
 * Gap size is between minGap and maxGap.
 * Gap top edge is between minGapTop and maxGapTop.
 * Uses the provided random value (0-1) to determine gap position and size.
 */
export function generatePipe(
  x: number,
  config: { minGap: number; maxGap: number; minGapTop: number; maxGapTop: number; pipeWidth: number },
  random: number,
): Pipe;

/**
 * Run one full game tick: apply physics, check floor/pipe collisions, update score.
 * Returns { bird, score, gameOver, pipes } with updated state.
 * Do NOT mutate inputs.
 */
export function gameTick(
  bird: Bird,
  pipes: Pipe[],
  score: number,
  config: GameConfig,
): { bird: Bird; pipes: Pipe[]; score: number; gameOver: boolean };
```

## Detailed Requirements

### Physics
- Each tick: `velocity += gravity`, capped at `maxFallSpeed`
- `y += velocity`
- Bird cannot go above y=0 (clamp)

### Collision Detection (AABB)
- Bird hitbox: rectangle from `(x, y)` to `(x+width, y+height)`
- Pipe hitbox: top pipe is `(pipe.x, 0)` to `(pipe.x+pipe.width, pipe.topHeight)`, bottom pipe is `(pipe.x, pipe.bottomY)` to `(pipe.x+pipe.width, canvasHeight)`
- Floor collision: `bird.y + bird.height >= floorY`

### Rotation
- velocity <= jumpVelocity: -35 degrees
- velocity >= maxFallSpeed: +35 degrees
- Between: linearly interpolate

### Pipe Generation
- Gap size: `minGap + random * (maxGap - minGap)`
- Gap top: `minGapTop + random * (maxGapTop - minGapTop)`
- `topHeight = gapTop`
- `bottomY = gapTop + gapSize`

### Game Tick
- Apply physics to bird
- For each pipe: check collision (gameOver if hit), check if passed (increment score, mark passed)
- Check floor collision (gameOver if hit)
- Return new state (immutable)
