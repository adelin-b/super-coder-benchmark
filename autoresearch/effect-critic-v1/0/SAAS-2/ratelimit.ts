import { Effect, Data, pipe } from "effect";

interface RateLimiterOptions {
  capacity: number;
  refillRate: number;
  refillInterval: number;
}

interface RateLimiter {
  tryConsume(tokens?: number): boolean;
  getRemaining(): number;
  reset(): void;
}

interface PerUserRateLimiter {
  tryConsume(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId?: string): void;
}

class InvalidOptionsError extends Data.TaggedError("InvalidOptionsError")<{
  reason: string;
}> {}

class InternalRateLimiterState {
  private lastRefillTime: number;
  private currentTokens: number;

  constructor(
    private capacity: number,
    private refillRate: number,
    private refillInterval: number
  ) {
    this.lastRefillTime = Date.now();
    this.currentTokens = capacity;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const refillCount = Math.floor(timePassed / this.refillInterval);

    if (refillCount > 0) {
      const tokensToAdd = refillCount * this.refillRate;
      this.currentTokens = Math.min(
        this.capacity,
        this.currentTokens + tokensToAdd
      );
      this.lastRefillTime = now;
    }
  }

  tryConsume(tokens: number): boolean {
    this.refillTokens();

    if (this.currentTokens >= tokens) {
      this.currentTokens -= tokens;
      return true;
    }

    return false;
  }

  getRemaining(): number {
    this.refillTokens();
    return Math.floor(this.currentTokens);
  }

  reset(): void {
    this.currentTokens = this.capacity;
    this.lastRefillTime = Date.now();
  }
}

function validateOptions(
  options: RateLimiterOptions
): Effect.Effect<void, InvalidOptionsError> {
  return Effect.gen(function* () {
    if (options.capacity <= 0) {
      yield* Effect.fail(
        new InvalidOptionsError({ reason: "capacity must be positive" })
      );
    }
    if (options.refillRate <= 0) {
      yield* Effect.fail(
        new InvalidOptionsError({ reason: "refillRate must be positive" })
      );
    }
    if (options.refillInterval <= 0) {
      yield* Effect.fail(
        new InvalidOptionsError({
          reason: "refillInterval must be positive",
        })
      );
    }
  });
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  try {
    Effect.runSync(validateOptions(options));
  } catch (e) {
    if (e instanceof InvalidOptionsError) {
      throw new Error(`Invalid rate limiter options: ${e.reason}`);
    }
    throw e;
  }

  const state = new InternalRateLimiterState(
    options.capacity,
    options.refillRate,
    options.refillInterval
  );

  return {
    tryConsume(tokens: number = 1): boolean {
      if (tokens <= 0) {
        throw new Error("tokens must be positive");
      }
      return state.tryConsume(tokens);
    },

    getRemaining(): number {
      return state.getRemaining();
    },

    reset(): void {
      state.reset();
    },
  };
}

export function createPerUserRateLimiter(
  options: RateLimiterOptions
): PerUserRateLimiter {
  try {
    Effect.runSync(validateOptions(options));
  } catch (e) {
    if (e instanceof InvalidOptionsError) {
      throw new Error(`Invalid rate limiter options: ${e.reason}`);
    }
    throw e;
  }

  const userStates = new Map<string, InternalRateLimiterState>();

  function getOrCreateState(userId: string): InternalRateLimiterState {
    let state = userStates.get(userId);
    if (!state) {
      state = new InternalRateLimiterState(
        options.capacity,
        options.refillRate,
        options.refillInterval
      );
      userStates.set(userId, state);
    }
    return state;
  }

  return {
    tryConsume(userId: string, tokens: number = 1): boolean {
      if (!userId) {
        throw new Error("userId cannot be empty");
      }
      if (tokens <= 0) {
        throw new Error("tokens must be positive");
      }

      const state = getOrCreateState(userId);
      return state.tryConsume(tokens);
    },

    getRemaining(userId: string): number {
      if (!userId) {
        throw new Error("userId cannot be empty");
      }

      const state = getOrCreateState(userId);
      return state.getRemaining();
    },

    reset(userId?: string): void {
      if (userId) {
        const state = userStates.get(userId);
        if (state) {
          state.reset();
        }
      } else {
        userStates.forEach((state) => state.reset());
      }
    },
  };
}