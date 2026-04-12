import { Effect, Data } from "effect";

export interface Position { x: number; z: number }
export type Direction = 'up' | 'down' | 'left' | 'right'

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

const directionDelta: Record<Direction, Position> = {
  up:    { x: 0, z: -1 },
  down:  { x: 0, z:  1 },
  left:  { x: -1, z: 0 },
  right: { x:  1, z: 0 },
};

export function moveSnake(snake: SnakeState, direction: Direction): SnakeState {
  const delta = directionDelta[direction];
  const newHead: Position = { x: snake.head.x + delta.x, z: snake.head.z + delta.z };
  const newBody: Position[] = [snake.head, ...snake.body.slice(0, -1)];
  return { head: newHead, body: newBody, direction };
}

export function isFence(pos: Position, config: GridConfig): boolean {
  return config.fences.some(f => f.x === pos.x && f.z === pos.z);
}

export function collidesWithBody(pos: Position, snake: SnakeState): boolean {
  return snake.body.some(seg => seg.x === pos.x && seg.z === pos.z);
}

export function isValidMove(snake: SnakeState, direction: Direction, config: GridConfig): boolean {
  const delta = directionDelta[direction];
  const newHead: Position = { x: snake.head.x + delta.x, z: snake.head.z + delta.z };
  if (isFence(newHead, config)) return false;
  if (collidesWithBody(newHead, snake)) return false;
  return true;
}

export function growSnake(snake: SnakeState): SnakeState {
  const tail = snake.body.length > 0
    ? snake.body[snake.body.length - 1]
    : snake.head;
  return {
    head: snake.head,
    body: [...snake.body, { x: tail.x, z: tail.z }],
    direction: snake.direction,
  };
}

export function placeCandy(snake: SnakeState, config: GridConfig): Position | null {
  const { size, fences, portals } = config;
  const occupied = (pos: Position): boolean => {
    if (pos.x === snake.head.x && pos.z === snake.head.z) return true;
    if (snake.body.some(s => s.x === pos.x && s.z === pos.z)) return true;
    if (fences.some(f => f.x === pos.x && f.z === pos.z)) return true;
    if (portals[0].x === pos.x && portals[0].z === pos.z) return true;
    if (portals[1].x === pos.x && portals[1].z === pos.z) return true;
    return false;
  };
  for (let z = 1; z <= size - 2; z++) {
    for (let x = 1; x <= size - 2; x++) {
      const pos: Position = { x, z };
      if (!occupied(pos)) return pos;
    }
  }
  return null;
}

export function checkPortal(head: Position, config: GridConfig): Position | null {
  const [p0, p1] = config.portals;
  if (head.x === p0.x && head.z === p0.z) return { x: p1.x, z: p1.z };
  if (head.x === p1.x && head.z === p1.z) return { x: p0.x, z: p0.z };
  return null;
}

export function isDeadEnd(snake: SnakeState, config: GridConfig): boolean {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions.every(d => !isValidMove(snake, d, config));
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