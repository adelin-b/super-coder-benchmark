import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { recordResult, readResults, verifyResultSchema } from './recorder.js';
import type { ExperimentResult } from './types.js';

const TEST_PATH = join(import.meta.dirname ?? '.', '..', 'results', 'test-results.json');

function makeDummyResult(overrides?: Partial<ExperimentResult>): ExperimentResult {
  return {
    experiment_id: 'test_001',
    method: 'D_pbt',
    task: 'BL-1',
    track: 'business_logic',
    timestamp: new Date().toISOString(),
    generation: {
      first_try_pass: true,
      retries_needed: 0,
      total_time_seconds: 45,
      total_tokens: 12500,
      verification_type: 'property_based_testing',
      properties_defined: 5,
      properties_passing: 5,
      error_messages: [],
    },
    bug_detection: {
      bugs_seeded: 4,
      bugs_caught: 3,
      bugs_missed: ['floating_point_accumulation'],
      actionable_errors: 2,
      details: [
        {
          bug_id: 'percentage_off_by_one',
          caught: true,
          error_actionable: true,
          shrunk_example: 'commission=0.01, price=100',
        },
        {
          bug_id: 'division_by_zero',
          caught: true,
          error_actionable: true,
        },
        {
          bug_id: 'negative_price',
          caught: true,
          error_actionable: false,
        },
        {
          bug_id: 'floating_point_accumulation',
          caught: false,
          error_actionable: false,
        },
      ],
    },
    scores: {
      generation_score: 10,
      detection_score: 9.5,
      total: 19.5,
    },
    ...overrides,
  };
}

describe('recorder', () => {
  beforeEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });

  afterEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });

  it('validates a correct result', () => {
    const result = makeDummyResult();
    expect(() => verifyResultSchema(result)).not.toThrow();
  });

  it('rejects invalid result (missing experiment_id)', () => {
    const bad = { ...makeDummyResult(), experiment_id: '' };
    expect(() => verifyResultSchema(bad)).toThrow();
  });

  it('rejects retries > 3', () => {
    const result = makeDummyResult();
    result.generation.retries_needed = 5;
    expect(() => verifyResultSchema(result)).toThrow();
  });

  it('records and reads back a result', () => {
    const result = makeDummyResult();
    recordResult(result, TEST_PATH);
    const results = readResults(TEST_PATH);
    expect(results).toHaveLength(1);
    expect(results[0].experiment_id).toBe('test_001');
    expect(results[0].scores.total).toBe(19.5);
  });

  it('appends multiple results', () => {
    recordResult(makeDummyResult({ experiment_id: 'test_001' }), TEST_PATH);
    recordResult(makeDummyResult({ experiment_id: 'test_002' }), TEST_PATH);
    const results = readResults(TEST_PATH);
    expect(results).toHaveLength(2);
  });

  it('returns empty array when no file exists', () => {
    const results = readResults(TEST_PATH);
    expect(results).toEqual([]);
  });
});
