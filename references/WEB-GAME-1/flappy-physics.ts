// Reference implementation for WEB-GAME-1: Flappy Bird Physics & Collision
// Extracted from Web-Bench Canvas project (Apache 2.0)

export interface Bird {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
}

export interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  width: number;
  passed: boolean;
}

export interface GameConfig {
  gravity: number;
  jumpVelocity: number;
  maxFallSpeed: number;
  canvasWidth: number;
  canvasHeight: number;
  floorY: number;
}

export function applyPhysics(bird: Bird, config: GameConfig): Bird {
  let newVelocity = bird.velocity + config.gravity;
  if (newVelocity > config.maxFallSpeed) {
    newVelocity = config.maxFallSpeed;
  }
  let newY = bird.y + newVelocity;
  if (newY < 0) {
    newY = 0;
  }
  return { ...bird, y: newY, velocity: newVelocity };
}

export function applyJump(bird: Bird, config: GameConfig): Bird {
  return { ...bird, velocity: config.jumpVelocity };
}

export function getBirdRotation(bird: Bird): number {
  // Interpolate between -35 (ascending) and +35 (descending)
  // velocity <= jumpVelocity -> -35
  // velocity >= maxFallSpeed -> +35
  // In between: linear interpolation
  // We use a fixed range for interpolation based on typical values
  const minV = -6; // typical jumpVelocity
  const maxV = 6;  // typical maxFallSpeed

  if (bird.velocity <= minV) return -35;
  if (bird.velocity >= maxV) return 35;

  const t = (bird.velocity - minV) / (maxV - minV);
  return -35 + t * 70;
}

export function collidesWithFloor(bird: Bird, config: GameConfig): boolean {
  return bird.y + bird.height >= config.floorY;
}

export function collidesWithPipe(bird: Bird, pipe: Pipe): boolean {
  // AABB collision check
  const birdRight = bird.x + bird.width;
  const birdBottom = bird.y + bird.height;
  const pipeRight = pipe.x + pipe.width;

  // Check horizontal overlap first
  if (birdRight <= pipe.x || bird.x >= pipeRight) {
    return false;
  }

  // Check collision with top pipe
  if (bird.y < pipe.topHeight) {
    return true;
  }

  // Check collision with bottom pipe
  if (birdBottom > pipe.bottomY) {
    return true;
  }

  return false;
}

export function hasPassed(bird: Bird, pipe: Pipe): boolean {
  return bird.x > pipe.x + pipe.width;
}

export function generatePipe(
  x: number,
  config: {
    minGap: number;
    maxGap: number;
    minGapTop: number;
    maxGapTop: number;
    pipeWidth: number;
  },
  random: number,
): Pipe {
  const gapSize = config.minGap + random * (config.maxGap - config.minGap);
  const gapTop = config.minGapTop + random * (config.maxGapTop - config.minGapTop);
  return {
    x,
    topHeight: gapTop,
    bottomY: gapTop + gapSize,
    width: config.pipeWidth,
    passed: false,
  };
}

export function gameTick(
  bird: Bird,
  pipes: Pipe[],
  score: number,
  config: GameConfig,
): { bird: Bird; pipes: Pipe[]; score: number; gameOver: boolean } {
  const newBird = applyPhysics(bird, config);

  // Check floor collision
  if (collidesWithFloor(newBird, config)) {
    return { bird: newBird, pipes, score, gameOver: true };
  }

  let newScore = score;
  let gameOver = false;
  const newPipes = pipes.map((pipe) => {
    // Check collision
    if (collidesWithPipe(newBird, pipe)) {
      gameOver = true;
    }

    // Check if passed
    if (!pipe.passed && hasPassed(newBird, pipe)) {
      newScore += 1;
      return { ...pipe, passed: true };
    }
    return pipe;
  });

  return { bird: newBird, pipes: newPipes, score: newScore, gameOver };
}
