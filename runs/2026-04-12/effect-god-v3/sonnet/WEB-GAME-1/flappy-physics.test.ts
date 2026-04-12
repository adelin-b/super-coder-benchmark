import { describe, it, expect } from 'vitest';
import {
  applyPhysics,
  applyJump,
  getBirdRotation,
  collidesWithFloor,
  collidesWithPipe,
  hasPassed,
  generatePipe,
  gameTick,
  type Bird,
  type Pipe,
  type GameConfig,
} from './flappy-physics.js';

const defaultConfig: GameConfig = {
  gravity: 0.45,
  jumpVelocity: -6,
  maxFallSpeed: 6,
  canvasWidth: 600,
  canvasHeight: 800,
  floorY: 720,
};

const defaultBird: Bird = { x: 30, y: 400, width: 34, height: 24, velocity: 0 };

describe('WEB-GAME-1: Flappy Bird Physics & Collision', () => {
  // --- Physics ---
  it('applyPhysics: gravity increases velocity and y', () => {
    const b = applyPhysics(defaultBird, defaultConfig);
    expect(b.velocity).toBeCloseTo(0.45);
    expect(b.y).toBeCloseTo(400.45);
  });

  it('applyPhysics: caps fall speed at maxFallSpeed', () => {
    const fast = { ...defaultBird, velocity: 5.8 };
    const b = applyPhysics(fast, defaultConfig);
    expect(b.velocity).toBe(6);
  });

  it('applyPhysics: clamps y at 0 (top of canvas)', () => {
    const high = { ...defaultBird, y: 1, velocity: -5 };
    const b = applyPhysics(high, defaultConfig);
    expect(b.y).toBe(0);
  });

  it('applyPhysics: does not mutate input', () => {
    const original = { ...defaultBird };
    applyPhysics(original, defaultConfig);
    expect(original.velocity).toBe(0);
    expect(original.y).toBe(400);
  });

  it('applyJump: sets velocity to jumpVelocity', () => {
    const b = applyJump(defaultBird, defaultConfig);
    expect(b.velocity).toBe(-6);
  });

  it('applyJump: does not mutate input', () => {
    const original = { ...defaultBird };
    applyJump(original, defaultConfig);
    expect(original.velocity).toBe(0);
  });

  // --- Rotation ---
  it('getBirdRotation: ascending returns negative degrees', () => {
    const ascending = { ...defaultBird, velocity: -6 };
    expect(getBirdRotation(ascending)).toBe(-35);
  });

  it('getBirdRotation: descending returns positive degrees', () => {
    const descending = { ...defaultBird, velocity: 6 };
    expect(getBirdRotation(descending)).toBe(35);
  });

  it('getBirdRotation: zero velocity returns ~0 degrees', () => {
    const r = getBirdRotation(defaultBird);
    expect(r).toBeCloseTo(0, 0);
  });

  // --- Floor collision ---
  it('collidesWithFloor: true when bird reaches floor', () => {
    const atFloor = { ...defaultBird, y: 700 };
    expect(collidesWithFloor(atFloor, defaultConfig)).toBe(true);
  });

  it('collidesWithFloor: false when above floor', () => {
    expect(collidesWithFloor(defaultBird, defaultConfig)).toBe(false);
  });

  // --- Pipe collision ---
  it('collidesWithPipe: false when bird is in the gap', () => {
    const pipe: Pipe = { x: 25, topHeight: 200, bottomY: 500, width: 52, passed: false };
    const bird = { ...defaultBird, y: 300 }; // in the gap (200-500)
    expect(collidesWithPipe(bird, pipe)).toBe(false);
  });

  it('collidesWithPipe: true when bird hits top pipe', () => {
    const pipe: Pipe = { x: 25, topHeight: 200, bottomY: 500, width: 52, passed: false };
    const bird = { ...defaultBird, y: 180 }; // above gap
    expect(collidesWithPipe(bird, pipe)).toBe(true);
  });

  it('collidesWithPipe: true when bird hits bottom pipe', () => {
    const pipe: Pipe = { x: 25, topHeight: 200, bottomY: 500, width: 52, passed: false };
    const bird = { ...defaultBird, y: 490 }; // below gap (y + height = 514 > 500)
    expect(collidesWithPipe(bird, pipe)).toBe(true);
  });

  it('collidesWithPipe: false when bird is past pipe horizontally', () => {
    const pipe: Pipe = { x: 0, topHeight: 200, bottomY: 500, width: 20, passed: false };
    const bird = { ...defaultBird, y: 180 }; // would collide vertically but is past
    expect(collidesWithPipe(bird, pipe)).toBe(false);
  });

  it('collidesWithPipe: false when pipe is ahead of bird', () => {
    const pipe: Pipe = { x: 200, topHeight: 200, bottomY: 500, width: 52, passed: false };
    const bird = { ...defaultBird, y: 180 }; // would collide but pipe not reached
    expect(collidesWithPipe(bird, pipe)).toBe(false);
  });

  // --- hasPassed ---
  it('hasPassed: true when bird is past pipe', () => {
    const pipe: Pipe = { x: 0, topHeight: 200, bottomY: 500, width: 20, passed: false };
    expect(hasPassed(defaultBird, pipe)).toBe(true); // bird.x=30 > 0+20
  });

  it('hasPassed: false when bird has not passed', () => {
    const pipe: Pipe = { x: 100, topHeight: 200, bottomY: 500, width: 52, passed: false };
    expect(hasPassed(defaultBird, pipe)).toBe(false);
  });

  // --- Pipe generation ---
  it('generatePipe: creates pipe with valid gap', () => {
    const p = generatePipe(500, {
      minGap: 120, maxGap: 240, minGapTop: 80, maxGapTop: 320, pipeWidth: 52,
    }, 0.5);
    expect(p.x).toBe(500);
    expect(p.width).toBe(52);
    expect(p.bottomY - p.topHeight).toBeCloseTo(180); // 120 + 0.5 * 120
    expect(p.topHeight).toBeCloseTo(200); // 80 + 0.5 * 240
    expect(p.passed).toBe(false);
  });

  it('generatePipe: random=0 gives minimum gap', () => {
    const p = generatePipe(100, {
      minGap: 120, maxGap: 240, minGapTop: 80, maxGapTop: 320, pipeWidth: 52,
    }, 0);
    expect(p.bottomY - p.topHeight).toBeCloseTo(120);
    expect(p.topHeight).toBeCloseTo(80);
  });

  it('generatePipe: random=1 gives maximum gap', () => {
    const p = generatePipe(100, {
      minGap: 120, maxGap: 240, minGapTop: 80, maxGapTop: 320, pipeWidth: 52,
    }, 1);
    expect(p.bottomY - p.topHeight).toBeCloseTo(240);
    expect(p.topHeight).toBeCloseTo(320);
  });

  // --- Game tick ---
  it('gameTick: normal tick applies physics', () => {
    const result = gameTick(defaultBird, [], 0, defaultConfig);
    expect(result.bird.velocity).toBeCloseTo(0.45);
    expect(result.gameOver).toBe(false);
    expect(result.score).toBe(0);
  });

  it('gameTick: floor collision causes gameOver', () => {
    const nearFloor = { ...defaultBird, y: 700, velocity: 2 };
    const result = gameTick(nearFloor, [], 0, defaultConfig);
    expect(result.gameOver).toBe(true);
  });

  it('gameTick: pipe collision causes gameOver', () => {
    const pipe: Pipe = { x: 25, topHeight: 200, bottomY: 300, width: 52, passed: false };
    const bird = { ...defaultBird, y: 100 }; // hits top pipe
    const result = gameTick(bird, [pipe], 0, defaultConfig);
    expect(result.gameOver).toBe(true);
  });

  it('gameTick: passing a pipe increments score', () => {
    const pipe: Pipe = { x: 0, topHeight: 200, bottomY: 500, width: 10, passed: false };
    const result = gameTick(defaultBird, [pipe], 5, defaultConfig);
    expect(result.score).toBe(6);
    expect(result.pipes[0].passed).toBe(true);
  });

  it('gameTick: already-passed pipe does not increment score again', () => {
    const pipe: Pipe = { x: 0, topHeight: 200, bottomY: 500, width: 10, passed: true };
    const result = gameTick(defaultBird, [pipe], 5, defaultConfig);
    expect(result.score).toBe(5);
  });

  it('gameTick: does not mutate original inputs', () => {
    const bird = { ...defaultBird };
    const pipe: Pipe = { x: 0, topHeight: 200, bottomY: 500, width: 10, passed: false };
    const pipes = [pipe];
    gameTick(bird, pipes, 0, defaultConfig);
    expect(bird.velocity).toBe(0);
    expect(pipes[0].passed).toBe(false);
  });
});
