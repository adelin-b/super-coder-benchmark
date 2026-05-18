import { Effect, Data, Schedule, Duration } from 'effect';

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly cause: unknown;
}> {}

export class RateLimitError extends Data.TaggedError('RateLimitError')<{
  readonly retryAfterMs: number;
}> {}

export class ServerError extends Data.TaggedError('ServerError')<{
  readonly status: number;
}> {}

export type HttpError = NetworkError | RateLimitError | ServerError;

export interface Response {
  status: number;
  text: () => Promise<string>;
  headers: Record<string, string>;
}

export type Fetcher = (url: string) => Promise<Response>;

function parseRetryAfter(headers: Record<string, string>): number {
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (raw === undefined) return 1000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 1000;
  return n * 1000;
}

export function makeClient(fetcher: Fetcher): {
  getText(url: string): Effect.Effect<string, HttpError>;
} {
  const singleAttempt = (url: string): Effect.Effect<string, HttpError> =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () => fetcher(url),
        catch: (cause) => new NetworkError({ cause }),
      });

      if (response.status >= 200 && response.status < 300) {
        return yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (cause) => new NetworkError({ cause }),
        });
      }

      if (response.status === 429) {
        return yield* Effect.fail(
          new RateLimitError({ retryAfterMs: parseRetryAfter(response.headers) }),
        );
      }

      return yield* Effect.fail(new ServerError({ status: response.status }));
    });

  const retryPolicy = Schedule.intersect(
    Schedule.exponential(Duration.millis(50), 2),
    Schedule.recurs(2),
  );

  function getText(url: string): Effect.Effect<string, HttpError> {
    return Effect.retry(singleAttempt(url), {
      schedule: retryPolicy,
      while: (err) => err._tag === 'ServerError' && err.status >= 500,
    });
  }

  return { getText };
}
