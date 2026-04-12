import { describe, it, expect } from 'vitest';
import {
  moveSnake,
  isFence,
  collidesWithBody,
  isValidMove,
  growSnake,
  placeCandy,
  checkPortal,
  isDeadEnd,
  generateFences,
  type SnakeState,
  type GridConfig,
  type Position,
} from './snake-logic.js';

function makeConfig(size = 8): GridConfig {
  return {
    size,
    fences: generateFences(size),
    portals: [
      { x: size - 2, z: 1 },       // top-right interior
      { x: 1, z: size - 2 },       // bottom-left interior
    ],
  };
}

const defaultSnake: SnakeState = {
  head: { x: 4, z: 4 },
  body: [
    { x: 4, z: 5 },
    { x: 4, z: 6 },
    { x: 4, z: 7 },   // note: z=7 is a fence in 8x8, but for init testing it's fine
  ],
  direction: 'up',
};

// Use a snake fully inside the grid for movement tests
const interiorSnake: SnakeState = {
  head: { x: 4, z: 4 },
  body: [
    { x: 4, z: 5 },
    { x: 4, z: 6 },
  ],
  direction: 'up',
};

describe('WEB-GAME-2: 3D Snake Game Logic', () => {
  // --- Movement ---
  it('moveSnake: head moves in direction, body follows', () => {
    const s = moveSnake(interiorSnake, 'up');
    expect(s.head).toEqual({ x: 4, z: 3 });
    expect(s.body[0]).toEqual({ x: 4, z: 4 }); // old head
    expect(s.body[1]).toEqual({ x: 4, z: 5 }); // old body[0]
    expect(s.body.length).toBe(2);
    expect(s.direction).toBe('up');
  });

  it('moveSnake: left direction', () => {
    const s = moveSnake(interiorSnake, 'left');
    expect(s.head).toEqual({ x: 3, z: 4 });
  });

  it('moveSnake: right direction', () => {
    const s = moveSnake(interiorSnake, 'right');
    expect(s.head).toEqual({ x: 5, z: 4 });
  });

  it('moveSnake: down direction', () => {
    const s = moveSnake(interiorSnake, 'down');
    expect(s.head).toEqual({ x: 4, z: 5 });
  });

  it('moveSnake: does not mutate input', () => {
    const original = {
      head: { x: 4, z: 4 },
      body: [{ x: 4, z: 5 }],
      direction: 'up' as const,
    };
    moveSnake(original, 'up');
    expect(original.head).toEqual({ x: 4, z: 4 });
    expect(original.body[0]).toEqual({ x: 4, z: 5 });
  });

  it('moveSnake: snake with no body', () => {
    const headOnly: SnakeState = { head: { x: 3, z: 3 }, body: [], direction: 'right' };
    const s = moveSnake(headOnly, 'right');
    expect(s.head).toEqual({ x: 4, z: 3 });
    expect(s.body.length).toBe(0);
  });

  // --- Fence collision ---
  it('isFence: border cell is a fence', () => {
    const config = makeConfig(8);
    expect(isFence({ x: 0, z: 0 }, config)).toBe(true);
    expect(isFence({ x: 3, z: 0 }, config)).toBe(true);
    expect(isFence({ x: 0, z: 5 }, config)).toBe(true);
    expect(isFence({ x: 7, z: 7 }, config)).toBe(true);
  });

  it('isFence: interior cell is not a fence', () => {
    const config = makeConfig(8);
    expect(isFence({ x: 1, z: 1 }, config)).toBe(false);
    expect(isFence({ x: 4, z: 4 }, config)).toBe(false);
  });

  // --- Body collision ---
  it('collidesWithBody: true when position matches a body segment', () => {
    expect(collidesWithBody({ x: 4, z: 5 }, interiorSnake)).toBe(true);
  });

  it('collidesWithBody: false when position does not match', () => {
    expect(collidesWithBody({ x: 3, z: 3 }, interiorSnake)).toBe(false);
  });

  it('collidesWithBody: does not include head', () => {
    expect(collidesWithBody({ x: 4, z: 4 }, interiorSnake)).toBe(false);
  });

  // --- Valid move ---
  it('isValidMove: valid direction in open space', () => {
    const config = makeConfig(8);
    expect(isValidMove(interiorSnake, 'up', config)).toBe(true);
    expect(isValidMove(interiorSnake, 'left', config)).toBe(true);
    expect(isValidMove(interiorSnake, 'right', config)).toBe(true);
  });

  it('isValidMove: invalid into fence', () => {
    const config = makeConfig(8);
    const nearWall: SnakeState = { head: { x: 1, z: 1 }, body: [], direction: 'up' };
    expect(isValidMove(nearWall, 'up', config)).toBe(false);
    expect(isValidMove(nearWall, 'left', config)).toBe(false);
  });

  it('isValidMove: invalid into own body', () => {
    const config = makeConfig(8);
    // Moving down would collide with body[0] at (4,5)
    expect(isValidMove(interiorSnake, 'down', config)).toBe(false);
  });

  // --- Growth ---
  it('growSnake: adds segment at tail position', () => {
    const grown = growSnake(interiorSnake);
    expect(grown.body.length).toBe(3);
    expect(grown.body[2]).toEqual({ x: 4, z: 6 }); // same as last body
  });

  it('growSnake: head-only snake grows body from head position', () => {
    const headOnly: SnakeState = { head: { x: 3, z: 3 }, body: [], direction: 'right' };
    const grown = growSnake(headOnly);
    expect(grown.body.length).toBe(1);
    expect(grown.body[0]).toEqual({ x: 3, z: 3 });
  });

  it('growSnake: does not mutate input', () => {
    const original = { ...interiorSnake, body: [...interiorSnake.body] };
    growSnake(original);
    expect(original.body.length).toBe(2);
  });

  // --- Candy placement ---
  it('placeCandy: places at first available interior cell', () => {
    const config = makeConfig(8);
    const smallSnake: SnakeState = { head: { x: 4, z: 4 }, body: [], direction: 'up' };
    const candy = placeCandy(smallSnake, config);
    // (1,1) is first interior cell, but portal might be at (6,1)
    // If (1,1) is not occupied, that's where candy goes
    expect(candy).toEqual({ x: 1, z: 1 });
  });

  it('placeCandy: skips occupied cells', () => {
    const config = makeConfig(8);
    const snake: SnakeState = {
      head: { x: 1, z: 1 },
      body: [{ x: 2, z: 1 }],
      direction: 'right',
    };
    const candy = placeCandy(snake, config);
    // (1,1) and (2,1) are occupied, portal at (6,1) is also skipped
    expect(candy).not.toBeNull();
    expect(candy!.x).not.toBe(1);
  });

  it('placeCandy: skips portal positions', () => {
    const config = makeConfig(8);
    // Snake covering nothing special
    const snake: SnakeState = { head: { x: 4, z: 4 }, body: [], direction: 'up' };
    const candy = placeCandy(snake, config);
    expect(candy).not.toBeNull();
    // Must not be a portal position
    expect(
      candy!.x === config.portals[0].x && candy!.z === config.portals[0].z,
    ).toBe(false);
    expect(
      candy!.x === config.portals[1].x && candy!.z === config.portals[1].z,
    ).toBe(false);
  });

  // --- Portals ---
  it('checkPortal: teleports from portal 0 to portal 1', () => {
    const config = makeConfig(8);
    const result = checkPortal(config.portals[0], config);
    expect(result).toEqual(config.portals[1]);
  });

  it('checkPortal: teleports from portal 1 to portal 0', () => {
    const config = makeConfig(8);
    const result = checkPortal(config.portals[1], config);
    expect(result).toEqual(config.portals[0]);
  });

  it('checkPortal: returns null when not on portal', () => {
    const config = makeConfig(8);
    expect(checkPortal({ x: 4, z: 4 }, config)).toBeNull();
  });

  // --- Dead end detection ---
  it('isDeadEnd: false in open space', () => {
    const config = makeConfig(8);
    expect(isDeadEnd(interiorSnake, config)).toBe(false);
  });

  it('isDeadEnd: true when surrounded', () => {
    const config = makeConfig(8);
    // Snake at (1,1) with body on all open neighbors
    const trapped: SnakeState = {
      head: { x: 1, z: 1 },
      body: [
        { x: 2, z: 1 }, // right
        { x: 1, z: 2 }, // down
      ],
      direction: 'right',
    };
    // up is fence (z=0), left is fence (x=0), right and down are body
    expect(isDeadEnd(trapped, config)).toBe(true);
  });

  // --- Fence generation ---
  it('generateFences: correct count for 8x8 grid', () => {
    const fences = generateFences(8);
    // Border: 4 * 8 - 4 corners (counted twice) = 28
    const unique = new Set(fences.map((f) => `${f.x},${f.z}`));
    expect(unique.size).toBe(28);
  });

  it('generateFences: all border cells present', () => {
    const fences = generateFences(4);
    const set = new Set(fences.map((f) => `${f.x},${f.z}`));
    // Top and bottom rows
    for (let x = 0; x < 4; x++) {
      expect(set.has(`${x},0`)).toBe(true);
      expect(set.has(`${x},3`)).toBe(true);
    }
    // Left and right columns
    for (let z = 1; z < 3; z++) {
      expect(set.has(`0,${z}`)).toBe(true);
      expect(set.has(`3,${z}`)).toBe(true);
    }
  });

  it('generateFences: no interior cells', () => {
    const fences = generateFences(8);
    for (const f of fences) {
      const isInterior = f.x > 0 && f.x < 7 && f.z > 0 && f.z < 7;
      expect(isInterior).toBe(false);
    }
  });
});
