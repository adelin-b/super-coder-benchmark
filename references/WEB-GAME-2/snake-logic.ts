// Reference implementation for WEB-GAME-2: 3D Snake Game Logic
// Extracted from Web-Bench Three.js project (Apache 2.0)

export interface Position {
  x: number;
  z: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface SnakeState {
  head: Position;
  body: Position[];
  direction: Direction;
}

export interface GridConfig {
  size: number;
  fences: Position[];
  portals: [Position, Position];
}

function posEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.z === b.z;
}

function applyDirection(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up':
      return { x: pos.x, z: pos.z - 1 };
    case 'down':
      return { x: pos.x, z: pos.z + 1 };
    case 'left':
      return { x: pos.x - 1, z: pos.z };
    case 'right':
      return { x: pos.x + 1, z: pos.z };
  }
}

export function moveSnake(snake: SnakeState, direction: Direction): SnakeState {
  const newHead = applyDirection(snake.head, direction);
  const newBody: Position[] = [];
  if (snake.body.length > 0) {
    newBody.push({ ...snake.head });
    for (let i = 0; i < snake.body.length - 1; i++) {
      newBody.push({ ...snake.body[i] });
    }
  }
  return { head: newHead, body: newBody, direction };
}

export function isFence(pos: Position, config: GridConfig): boolean {
  return config.fences.some((f) => posEqual(f, pos));
}

export function collidesWithBody(pos: Position, snake: SnakeState): boolean {
  return snake.body.some((seg) => posEqual(seg, pos));
}

export function isValidMove(
  snake: SnakeState,
  direction: Direction,
  config: GridConfig,
): boolean {
  const newHead = applyDirection(snake.head, direction);
  if (isFence(newHead, config)) return false;
  if (collidesWithBody(newHead, snake)) return false;
  return true;
}

export function growSnake(snake: SnakeState): SnakeState {
  const lastPos =
    snake.body.length > 0
      ? snake.body[snake.body.length - 1]
      : snake.head;
  return {
    ...snake,
    body: [...snake.body, { ...lastPos }],
  };
}

export function placeCandy(
  snake: SnakeState,
  config: GridConfig,
): Position | null {
  const occupied = new Set<string>();
  occupied.add(`${snake.head.x},${snake.head.z}`);
  for (const seg of snake.body) {
    occupied.add(`${seg.x},${seg.z}`);
  }
  for (const f of config.fences) {
    occupied.add(`${f.x},${f.z}`);
  }
  for (const p of config.portals) {
    occupied.add(`${p.x},${p.z}`);
  }

  for (let z = 1; z < config.size - 1; z++) {
    for (let x = 1; x < config.size - 1; x++) {
      if (!occupied.has(`${x},${z}`)) {
        return { x, z };
      }
    }
  }
  return null;
}

export function checkPortal(
  head: Position,
  config: GridConfig,
): Position | null {
  if (posEqual(head, config.portals[0])) {
    return { ...config.portals[1] };
  }
  if (posEqual(head, config.portals[1])) {
    return { ...config.portals[0] };
  }
  return null;
}

export function isDeadEnd(snake: SnakeState, config: GridConfig): boolean {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions.every((dir) => !isValidMove(snake, dir, config));
}

export function generateFences(size: number): Position[] {
  const fences: Position[] = [];
  for (let x = 0; x < size; x++) {
    fences.push({ x, z: 0 });
    fences.push({ x, z: size - 1 });
  }
  for (let z = 1; z < size - 1; z++) {
    fences.push({ x: 0, z });
    fences.push({ x: size - 1, z });
  }
  return fences;
}
