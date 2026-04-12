import { describe, it, expect, vi } from 'vitest';
import { createSagaOrchestrator, SagaError, type SagaStep, type SagaInstance } from './saga.js';

describe('Saga Orchestrator', () => {
  // ── Registration (3 tests) ──────────────────────────────────────────────

  it('registers a saga definition', () => {
    const orch = createSagaOrchestrator();
    expect(() => {
      orch.register({
        name: 'order-fulfillment',
        steps: [
          { name: 'payment', execute: vi.fn(), compensate: vi.fn() },
        ],
      });
    }).not.toThrow();
  });

  it('throws SagaError on duplicate registration', () => {
    const orch = createSagaOrchestrator();
    orch.register({ name: 'dup', steps: [] });
    expect(() => orch.register({ name: 'dup', steps: [] })).toThrow(SagaError);
  });

  it('throws SagaError when starting unregistered definition', async () => {
    const orch = createSagaOrchestrator();
    await expect(orch.start('nonexistent', 'saga-1')).rejects.toThrow(SagaError);
  });

  // ── Successful execution (4 tests) ─────────────────────────────────────

  it('executes all steps in order and completes', async () => {
    const orch = createSagaOrchestrator();
    const order: string[] = [];

    orch.register({
      name: 'flow',
      steps: [
        { name: 'step-a', execute: () => { order.push('a'); }, compensate: vi.fn() },
        { name: 'step-b', execute: () => { order.push('b'); }, compensate: vi.fn() },
        { name: 'step-c', execute: () => { order.push('c'); }, compensate: vi.fn() },
      ],
    });

    const result = await orch.start('flow', 'saga-1');
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toEqual(['step-a', 'step-b', 'step-c']);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('sets completedAt on success', async () => {
    const orch = createSagaOrchestrator();
    orch.register({
      name: 'simple',
      steps: [{ name: 's1', execute: vi.fn(), compensate: vi.fn() }],
    });

    const result = await orch.start('simple', 'saga-1');
    expect(result.completedAt).not.toBeNull();
    expect(result.completedAt!).toBeGreaterThanOrEqual(result.startedAt);
  });

  it('handles async steps', async () => {
    const orch = createSagaOrchestrator();
    const order: string[] = [];

    orch.register({
      name: 'async-flow',
      steps: [
        {
          name: 'async-a',
          execute: async () => { await delay(5); order.push('a'); },
          compensate: vi.fn(),
        },
        {
          name: 'async-b',
          execute: async () => { await delay(5); order.push('b'); },
          compensate: vi.fn(),
        },
      ],
    });

    const result = await orch.start('async-flow', 'saga-1');
    expect(result.status).toBe('completed');
    expect(order).toEqual(['a', 'b']);
  });

  it('saga with zero steps completes immediately', async () => {
    const orch = createSagaOrchestrator();
    orch.register({ name: 'empty', steps: [] });

    const result = await orch.start('empty', 'saga-1');
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toEqual([]);
  });

  // ── Compensation / failure (5 tests) ───────────────────────────────────

  it('compensates in reverse order on step failure', async () => {
    const orch = createSagaOrchestrator();
    const compensated: string[] = [];

    orch.register({
      name: 'fail-flow',
      steps: [
        { name: 'step-1', execute: vi.fn(), compensate: () => { compensated.push('comp-1'); } },
        { name: 'step-2', execute: vi.fn(), compensate: () => { compensated.push('comp-2'); } },
        {
          name: 'step-3',
          execute: () => { throw new Error('boom'); },
          compensate: () => { compensated.push('comp-3'); },
        },
      ],
    });

    const result = await orch.start('fail-flow', 'saga-1');
    expect(result.status).toBe('failed');
    expect(result.failedStep).toBe('step-3');
    expect(result.error).toContain('boom');
    // Only step-1 and step-2 completed, compensated in reverse
    expect(compensated).toEqual(['comp-2', 'comp-1']);
    expect(result.compensatedSteps).toEqual(['step-2', 'step-1']);
  });

  it('first step failure means no compensation needed', async () => {
    const orch = createSagaOrchestrator();
    const compensateFn = vi.fn();

    orch.register({
      name: 'first-fail',
      steps: [
        {
          name: 'step-1',
          execute: () => { throw new Error('first fails'); },
          compensate: compensateFn,
        },
      ],
    });

    const result = await orch.start('first-fail', 'saga-1');
    expect(result.status).toBe('failed');
    expect(result.failedStep).toBe('step-1');
    expect(compensateFn).not.toHaveBeenCalled();
    expect(result.compensatedSteps).toEqual([]);
  });

  it('records error when compensation itself throws', async () => {
    const orch = createSagaOrchestrator();

    orch.register({
      name: 'comp-fail',
      steps: [
        {
          name: 'step-1',
          execute: vi.fn(),
          compensate: () => { throw new Error('comp-boom'); },
        },
        {
          name: 'step-2',
          execute: () => { throw new Error('exec-boom'); },
          compensate: vi.fn(),
        },
      ],
    });

    const result = await orch.start('comp-fail', 'saga-1');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('comp-boom');
    expect(result.error).toContain('exec-boom');
  });

  it('compensation runs for async steps', async () => {
    const orch = createSagaOrchestrator();
    const compensated: string[] = [];

    orch.register({
      name: 'async-comp',
      steps: [
        {
          name: 'step-1',
          execute: vi.fn(),
          compensate: async () => { await delay(5); compensated.push('comp-1'); },
        },
        {
          name: 'step-2',
          execute: () => { throw new Error('fail'); },
          compensate: vi.fn(),
        },
      ],
    });

    const result = await orch.start('async-comp', 'saga-1');
    expect(result.status).toBe('failed');
    expect(compensated).toEqual(['comp-1']);
  });

  it('mid-flow failure only compensates completed steps', async () => {
    const orch = createSagaOrchestrator();
    const compensated: string[] = [];

    orch.register({
      name: 'mid-fail',
      steps: [
        { name: 'a', execute: vi.fn(), compensate: () => { compensated.push('a'); } },
        { name: 'b', execute: vi.fn(), compensate: () => { compensated.push('b'); } },
        { name: 'c', execute: () => { throw new Error('c-fail'); }, compensate: () => { compensated.push('c'); } },
        { name: 'd', execute: vi.fn(), compensate: () => { compensated.push('d'); } },
      ],
    });

    const result = await orch.start('mid-fail', 'saga-1');
    expect(result.status).toBe('failed');
    expect(result.completedSteps).toEqual(['a', 'b']);
    // 'c' was never completed, 'd' was never reached
    expect(compensated).toEqual(['b', 'a']);
  });

  // ── Instance tracking (3 tests) ────────────────────────────────────────

  it('getInstance returns the saga after completion', async () => {
    const orch = createSagaOrchestrator();
    orch.register({ name: 'track', steps: [{ name: 's', execute: vi.fn(), compensate: vi.fn() }] });

    await orch.start('track', 'saga-1');
    const instance = orch.getInstance('saga-1');
    expect(instance).not.toBeNull();
    expect(instance!.status).toBe('completed');
  });

  it('getInstance returns null for unknown saga', () => {
    const orch = createSagaOrchestrator();
    expect(orch.getInstance('unknown')).toBeNull();
  });

  it('getInstancesByDefinition returns all instances for a definition', async () => {
    const orch = createSagaOrchestrator();
    orch.register({ name: 'multi', steps: [{ name: 's', execute: vi.fn(), compensate: vi.fn() }] });

    await orch.start('multi', 'saga-1');
    await orch.start('multi', 'saga-2');
    await orch.start('multi', 'saga-3');

    const instances = orch.getInstancesByDefinition('multi');
    expect(instances).toHaveLength(3);
  });

  // ── Duplicate saga ID (1 test) ─────────────────────────────────────────

  it('throws SagaError on duplicate saga ID', async () => {
    const orch = createSagaOrchestrator();
    orch.register({ name: 'dedup', steps: [{ name: 's', execute: vi.fn(), compensate: vi.fn() }] });

    await orch.start('dedup', 'saga-1');
    await expect(orch.start('dedup', 'saga-1')).rejects.toThrow(SagaError);
  });

  // ── Concurrent sagas (2 tests) ─────────────────────────────────────────

  it('concurrent sagas are isolated — one failure does not affect another', async () => {
    const orch = createSagaOrchestrator();
    let callCount = 0;

    orch.register({
      name: 'concurrent',
      steps: [
        {
          name: 'step-1',
          execute: () => {
            callCount++;
            if (callCount === 1) throw new Error('first-fails');
          },
          compensate: vi.fn(),
        },
      ],
    });

    const [result1, result2] = await Promise.all([
      orch.start('concurrent', 'saga-fail'),
      orch.start('concurrent', 'saga-ok'),
    ]);

    // One should fail, one should succeed (order may vary)
    const statuses = [result1.status, result2.status].sort();
    expect(statuses).toEqual(['completed', 'failed']);
  });

  it('getActiveSagaCount reflects running sagas', async () => {
    const orch = createSagaOrchestrator();

    orch.register({
      name: 'slow',
      steps: [
        {
          name: 'wait',
          execute: () => delay(50),
          compensate: vi.fn(),
        },
      ],
    });

    // Start but don't await
    const p1 = orch.start('slow', 'saga-1');
    const p2 = orch.start('slow', 'saga-2');

    // While running, count should be > 0
    expect(orch.getActiveSagaCount()).toBeGreaterThanOrEqual(1);

    await Promise.all([p1, p2]);
    expect(orch.getActiveSagaCount()).toBe(0);
  });

  // ── Timeout (2 tests) ─────────────────────────────────────────────────

  it('saga times out and triggers compensation', async () => {
    const orch = createSagaOrchestrator();
    const compensated: string[] = [];

    orch.register({
      name: 'timeout-flow',
      timeout: 50, // 50ms timeout
      steps: [
        {
          name: 'fast-step',
          execute: vi.fn(),
          compensate: () => { compensated.push('fast'); },
        },
        {
          name: 'slow-step',
          execute: () => delay(200), // will exceed 50ms timeout
          compensate: () => { compensated.push('slow'); },
        },
      ],
    });

    const result = await orch.start('timeout-flow', 'saga-1');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('timed out');
    // fast-step completed, should be compensated
    expect(compensated).toContain('fast');
  });

  it('saga with default timeout does not time out for fast steps', async () => {
    const orch = createSagaOrchestrator();
    orch.register({
      name: 'fast',
      steps: [
        { name: 's1', execute: vi.fn(), compensate: vi.fn() },
        { name: 's2', execute: vi.fn(), compensate: vi.fn() },
      ],
      // no timeout specified — defaults to 30000ms
    });

    const result = await orch.start('fast', 'saga-1');
    expect(result.status).toBe('completed');
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
