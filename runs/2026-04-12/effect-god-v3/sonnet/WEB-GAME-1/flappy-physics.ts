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
  const newVelocity = Math.min(bird.velocity + config.gravity, config.maxFallSpeed);
  const newY = Math.max(0, bird.y + newVelocity);
  return { ...bird, velocity: newVelocity, y: newY };
}

export function applyJump(bird: Bird, config: GameConfig): Bird {
  return { ...bird, velocity: config.jumpVelocity };
}

export function getBirdRotation(bird: Bird): number {
  const minVel = -6;
  const maxVel = 6;
  const minRot = -35;
  const maxRot = 35;

  if (bird.velocity <= minVel) return minRot;
  if (bird.velocity >= maxVel) return maxRot;

  const t = (bird.velocity - minVel) / (maxVel - minVel);
  return minRot + t * (maxRot - minRot);
}

export function collidesWithFloor(bird: Bird, config: GameConfig): boolean {
  return bird.y + bird.height >= config.floorY;
}

export function collidesWithPipe(bird: Bird, pipe: Pipe): boolean {
  const birdLeft = bird.x;
  const birdRight = bird.x + bird.width;
  const birdTop = bird.y;
  const birdBottom = bird.y + bird.height;

  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + pipe.width;

  // Check horizontal overlap
  if (birdRight <= pipeLeft || birdLeft >= pipeRight) return false;

  // Check top pipe collision: (pipeLeft, 0) to (pipeRight, topHeight)
  if (birdTop < pipe.topHeight) return true;

  // Check bottom pipe collision: (pipeLeft, bottomY) to (pipeRight, canvasHeight)
  if (birdBottom > pipe.bottomY) return true;

  return false;
}

export function hasPassed(bird: Bird, pipe: Pipe): boolean {
  return bird.x > pipe.x + pipe.width;
}

export function generatePipe(
  x: number,
  config: { minGap: number; maxGap: number; minGapTop: number; maxGapTop: number; pipeWidth: number },
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

  let newScore = score;
  let gameOver = false;

  const newPipes = pipes.map((pipe) => {
    if (collidesWithPipe(newBird, pipe)) {
      gameOver = true;
    }

    if (!pipe.passed && hasPassed(newBird, pipe)) {
      newScore += 1;
      return { ...pipe, passed: true };
    }

    return pipe;
  });

  if (collidesWithFloor(newBird, config)) {
    gameOver = true;
  }

  return { bird: newBird, pipes: newPipes, score: newScore, gameOver };
}