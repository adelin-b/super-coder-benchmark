import { describe, it, expect } from 'vitest';
import { Effect, Cause, Exit } from 'effect';
import {
  makeClient,
  NetworkError,
  RateLimitError,
  ServerError,
  type Fetcher,
  type Response,
} from './resilient-fetch.js';

function mkResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return {
    status,
    text: () => Promise.resolve(body),
    headers,
  };
}

function recorder<T>(impl: (calls: number) => Promise<T>): { fn: () => Promise<T>; calls: () => number } {
  let n = 0;
  return {
    fn: () => {
      n += 1;
      return impl(n);
    },
    calls: () => n,
  };
}

async function runExit<E, A>(eff: Effect.Effect<A, E>) {
  return Effect.runPromiseExit(eff);
}

describe('SEMANTIC-MIRAGE-1: resilient HTTP client', () => {
  it('returns body text on 2xx (catches E3: succeed-wraps-promise)', async () => {
    const fetcher: Fetcher = async () => mkResponse(200, 'hello');
    const client = makeClient(fetcher);
    const result = await Effect.runPromise(client.getText('/x'));
    expect(typeof result).toBe('string');
    expect(result).toBe('hello');
  });

  it('returned value is a string, not a Promise (catches E1: await inside gen)', async () => {
    const fetcher: Fetcher = async () => mkResponse(200, 'body');
    const client = makeClient(fetcher);
    const result = await Effect.runPromise(client.getText('/x'));
    // typeof Promise would be 'object' with .then; this asserts unwrap happened
    expect(typeof result).toBe('string');
    expect((result as unknown as { then?: unknown }).then).toBeUndefined();
  });

  it('network reject becomes NetworkError, NOT a synchronous throw (catches E2, E5)', async () => {
    const fetcher: Fetcher = async () => {
      throw new Error('boom');
    };
    const client = makeClient(fetcher);
    const exit = await runExit(client.getText('/x'));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause);
      expect(err._tag).toBe('Some');
      if (err._tag === 'Some') {
        expect(err.value).toBeInstanceOf(NetworkError);
      }
    }
  });

  it('429 produces RateLimitError tagged correctly (catches E2: tagged error laundering)', async () => {
    const fetcher: Fetcher = async () => mkResponse(429, '', { 'retry-after': '2' });
    const client = makeClient(fetcher);
    const exit = await runExit(client.getText('/x'));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause);
      if (err._tag === 'Some') {
        expect(err.value).toBeInstanceOf(RateLimitError);
        expect((err.value as RateLimitError).retryAfterMs).toBe(2000);
        expect((err.value as RateLimitError)._tag).toBe('RateLimitError');
      }
    }
  });

  it('429 missing retry-after defaults to 1000ms', async () => {
    const fetcher: Fetcher = async () => mkResponse(429, '', {});
    const client = makeClient(fetcher);
    const exit = await runExit(client.getText('/x'));
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause);
      if (err._tag === 'Some' && err.value instanceof RateLimitError) {
        expect(err.value.retryAfterMs).toBe(1000);
      }
    }
  });

  it('429 is NOT retried', async () => {
    const rec = recorder(async () => mkResponse(429, '', { 'retry-after': '1' }));
    const client = makeClient(rec.fn);
    await runExit(client.getText('/x'));
    expect(rec.calls()).toBe(1);
  });

  it('5xx retries up to 3 attempts total then fails with ServerError (catches M3: infinite retries / no recurs)', async () => {
    const rec = recorder(async () => mkResponse(503, ''));
    const client = makeClient(rec.fn);
    const exit = await runExit(client.getText('/x'));
    expect(rec.calls()).toBe(3);
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause);
      if (err._tag === 'Some') {
        expect(err.value).toBeInstanceOf(ServerError);
        expect((err.value as ServerError).status).toBe(503);
      }
    }
  });

  it('5xx then 200 on retry succeeds (catches: retry filter wrong)', async () => {
    const rec = recorder<Response>(async (n) =>
      n === 1 ? mkResponse(500, '') : mkResponse(200, 'ok'),
    );
    const client = makeClient(rec.fn);
    const result = await Effect.runPromise(client.getText('/x'));
    expect(result).toBe('ok');
    expect(rec.calls()).toBe(2);
  });

  it('400 is NOT retried (catches: retry policy matches all errors)', async () => {
    const rec = recorder(async () => mkResponse(400, ''));
    const client = makeClient(rec.fn);
    await runExit(client.getText('/x'));
    expect(rec.calls()).toBe(1);
  });

  it('constructing getText is lazy: no fetch until run (catches E3, E5)', () => {
    let called = 0;
    const fetcher: Fetcher = async () => {
      called += 1;
      return mkResponse(200, 'x');
    };
    const client = makeClient(fetcher);
    const _eff = client.getText('/x');
    expect(called).toBe(0);
    expect(Effect.isEffect(_eff)).toBe(true);
  });

  it('successful run does not retry (catches: forgot Schedule.intersect with recurs)', async () => {
    const rec = recorder(async () => mkResponse(200, 'ok'));
    const client = makeClient(rec.fn);
    await Effect.runPromise(client.getText('/x'));
    expect(rec.calls()).toBe(1);
  });

  it('429 still tagged after retry filter (catches E2)', async () => {
    const rec = recorder(async () => mkResponse(429, '', { 'retry-after': '5' }));
    const client = makeClient(rec.fn);
    const exit = await runExit(client.getText('/x'));
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause);
      if (err._tag === 'Some' && err.value instanceof RateLimitError) {
        // _tag must survive — catchTag downstream relies on it
        expect(err.value._tag).toBe('RateLimitError');
        expect(err.value.retryAfterMs).toBe(5000);
      }
    }
    expect(rec.calls()).toBe(1); // 429 not retried
  });
});
