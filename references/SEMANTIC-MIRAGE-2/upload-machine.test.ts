import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  buildUploadMachine,
  MAX_SIZE_BYTES,
  type File as UploadFile,
  type Uploader,
} from './upload-machine.js';

function file(opts: Partial<UploadFile> & { size: number; type: string }): UploadFile {
  return {
    name: opts.name ?? 'f',
    size: opts.size,
    type: opts.type,
    blob: opts.blob ?? new Uint8Array(0),
  };
}

function later<T>(value: T, ms = 0): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

function rejectLater(reason: unknown, ms = 0): Promise<never> {
  return new Promise((_, rej) => setTimeout(() => rej(reason), ms));
}

async function waitFor<T>(actor: ReturnType<typeof createActor<ReturnType<typeof buildUploadMachine>>>, predicate: () => T, timeoutMs = 1000): Promise<T> {
  const start = Date.now();
  return new Promise((res, rej) => {
    const tick = () => {
      try {
        const v = predicate();
        if (v) return res(v);
      } catch {
        // keep polling
      }
      if (Date.now() - start > timeoutMs) return rej(new Error('timeout'));
      setTimeout(tick, 5);
    };
    tick();
  });
}

describe('SEMANTIC-MIRAGE-2: upload machine', () => {
  it('rejects file > MAX_SIZE_BYTES (catches X1: mutating guard would flip on size check)', async () => {
    const upload: Uploader = async () => ({ url: '/never' });
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: MAX_SIZE_BYTES + 1, type: 'image/png' }) });
    await waitFor(actor, () => actor.getSnapshot().value === 'rejected');
    expect(actor.getSnapshot().value).toBe('rejected');
    expect(actor.getSnapshot().context.errorMessage).toBe('too large');
    expect(actor.getSnapshot().context.attempts).toBe(0);
  });

  it('rejects unsupported mime type', async () => {
    const upload: Uploader = async () => ({ url: '/never' });
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: 1024, type: 'image/gif' }) });
    await waitFor(actor, () => actor.getSnapshot().value === 'rejected');
    expect(actor.getSnapshot().context.errorMessage).toBe('unsupported type');
  });

  it('successful upload populates uploadedUrl (catches X6: id mismatch breaks onDone)', async () => {
    const upload: Uploader = async () => later({ url: '/uploaded/abc' }, 5);
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: 1024, type: 'image/png' }) });
    await waitFor(actor, () => actor.getSnapshot().value === 'success');
    expect(actor.getSnapshot().context.uploadedUrl).toBe('/uploaded/abc');
    expect(actor.getSnapshot().context.attempts).toBe(1);
  });

  it('failed upload increments attempts; RETRY re-invokes (catches X1, X5)', async () => {
    let calls = 0;
    const upload: Uploader = async () => {
      calls += 1;
      if (calls < 3) return rejectLater(new Error('flaky'), 1);
      return later({ url: '/ok' }, 1);
    };
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: 1024, type: 'image/png' }) });
    await waitFor(actor, () => actor.getSnapshot().value === 'failed');
    expect(actor.getSnapshot().context.attempts).toBe(1);
    actor.send({ type: 'RETRY' });
    await waitFor(actor, () => actor.getSnapshot().value === 'failed');
    expect(actor.getSnapshot().context.attempts).toBe(2);
    actor.send({ type: 'RETRY' });
    await waitFor(actor, () => actor.getSnapshot().value === 'success');
    expect(calls).toBe(3);
  });

  it('RETRY blocked after 3 attempts (catches X1: pure-guard requirement)', async () => {
    let calls = 0;
    const upload: Uploader = async () => {
      calls += 1;
      return rejectLater(new Error('always fails'), 1);
    };
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: 1024, type: 'image/png' }) });
    await waitFor(actor, () => actor.getSnapshot().value === 'failed' && calls === 1);
    actor.send({ type: 'RETRY' });
    await waitFor(actor, () => actor.getSnapshot().value === 'failed' && calls === 2);
    actor.send({ type: 'RETRY' });
    await waitFor(actor, () => actor.getSnapshot().value === 'failed' && calls === 3);
    // Fourth retry should be blocked by canRetry guard (attempts === 3).
    actor.send({ type: 'RETRY' });
    await later(20);
    expect(calls).toBe(3);
    expect(actor.getSnapshot().context.attempts).toBe(3);
    expect(actor.getSnapshot().value).toBe('failed');
  });

  it('RESET clears context and returns to idle', async () => {
    const upload: Uploader = async () => later({ url: '/u' }, 1);
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: 1024, type: 'image/png' }) });
    await waitFor(actor, () => actor.getSnapshot().value === 'success');
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.attempts).toBe(0);
    expect(actor.getSnapshot().context.uploadedUrl).toBeNull();
    expect(actor.getSnapshot().context.file).toBeNull();
  });

  it('validating eventless transition terminates (catches X3: always with no fallback)', async () => {
    const upload: Uploader = async () => later({ url: '/u' }, 1);
    const actor = createActor(buildUploadMachine(upload)).start();
    actor.send({ type: 'UPLOAD', file: file({ size: 1024, type: 'image/png' }) });
    // After the always evaluates, we must NOT still be in 'validating'.
    await later(10);
    expect(['uploading', 'success']).toContain(actor.getSnapshot().value);
  });

  it('UPLOAD assigned via actions, not transition-level assign (catches X5)', () => {
    const upload: Uploader = async () => later({ url: '/u' }, 1);
    const actor = createActor(buildUploadMachine(upload)).start();
    const f = file({ size: 1024, type: 'image/png' });
    actor.send({ type: 'UPLOAD', file: f });
    // file must end up in context — if X5 (assign as transition key) was the implementation,
    // context.file would stay null and the guard would treat it as null → undefined branch.
    expect(actor.getSnapshot().context.file?.size).toBe(1024);
  });
});
