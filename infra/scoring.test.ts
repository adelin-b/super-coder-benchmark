import { describe, it, expect } from 'vitest';
import { calculateGenerationScore, calculateDetectionScore, calculateScores } from './scoring.js';
import type { ExperimentResult } from './types.js';

describe('calculateGenerationScore', () => {
  it('gives 10 for first-try pass', () => {
    expect(calculateGenerationScore(0, true)).toBe(10);
  });

  it('gives 7 for 1 retry', () => {
    expect(calculateGenerationScore(1, true)).toBe(7);
  });

  it('gives 4 for 2 retries', () => {
    expect(calculateGenerationScore(2, true)).toBe(4);
  });

  it('gives 2 for 3 retries', () => {
    expect(calculateGenerationScore(3, true)).toBe(2);
  });

  it('gives 0 for failure', () => {
    expect(calculateGenerationScore(0, false)).toBe(0);
    expect(calculateGenerationScore(3, false)).toBe(0);
  });
});

describe('calculateDetectionScore', () => {
  it('gives 2.5 per bug caught', () => {
    expect(calculateDetectionScore(4, 0)).toBe(10);
    expect(calculateDetectionScore(3, 0)).toBe(7.5);
    expect(calculateDetectionScore(0, 0)).toBe(0);
  });

  it('adds 1 per actionable error', () => {
    expect(calculateDetectionScore(4, 4)).toBe(14);
    expect(calculateDetectionScore(3, 2)).toBe(9.5);
  });

  it('caps at 14', () => {
    expect(calculateDetectionScore(4, 4)).toBe(14);
    // Even with hypothetical overflow
    expect(calculateDetectionScore(5, 5)).toBe(14);
  });
});

describe('calculateScores', () => {
  function makeResult(
    method: string,
    firstTry: boolean,
    retries: number,
    time: number,
    tokens: number,
    bugsCaught: number,
    bugsSeeded: number,
  ): ExperimentResult {
    return {
      experiment_id: `exp_${method}`,
      method: method as any,
      task: 'BL-1',
      track: 'business_logic',
      timestamp: new Date().toISOString(),
      generation: {
        first_try_pass: firstTry,
        retries_needed: retries,
        total_time_seconds: time,
        total_tokens: tokens,
        verification_type: 'test',
        error_messages: [],
      },
      bug_detection: {
        bugs_seeded: bugsSeeded,
        bugs_caught: bugsCaught,
        bugs_missed: [],
        actionable_errors: 0,
        details: [],
      },
      scores: {
        generation_score: calculateGenerationScore(retries, firstTry || retries <= 3),
        detection_score: calculateDetectionScore(bugsCaught, 0),
        total: 0,
      },
    };
  }

  it('ranks methods correctly by reliability', () => {
    const results = [
      makeResult('A_plain_ts', true, 0, 30, 10000, 2, 4),
      makeResult('D_pbt', false, 3, 60, 15000, 4, 4),
    ];

    const rankings = calculateScores(results);
    expect(rankings.reliability_rank[0].method).toBe('A_plain_ts');
    expect(rankings.reliability_rank[0].score).toBe(1); // 100% first-try
    expect(rankings.reliability_rank[1].method).toBe('D_pbt');
    expect(rankings.reliability_rank[1].score).toBe(0); // 0% first-try
  });

  it('ranks methods correctly by detection', () => {
    const results = [
      makeResult('A_plain_ts', true, 0, 30, 10000, 2, 4),
      makeResult('D_pbt', true, 0, 60, 15000, 4, 4),
    ];

    const rankings = calculateScores(results);
    expect(rankings.detection_rank[0].method).toBe('D_pbt');
    expect(rankings.detection_rank[0].score).toBe(1); // 4/4 = 100%
    expect(rankings.detection_rank[1].method).toBe('A_plain_ts');
    expect(rankings.detection_rank[1].score).toBe(0.5); // 2/4 = 50%
  });

  it('produces composite ranking', () => {
    const results = [
      makeResult('A_plain_ts', true, 0, 30, 10000, 2, 4),
      makeResult('D_pbt', true, 0, 60, 15000, 4, 4),
      makeResult('E_dafny', false, 3, 120, 20000, 4, 4),
    ];

    const rankings = calculateScores(results);
    expect(rankings.composite_rank).toHaveLength(3);
    expect(rankings.composite_rank[0].rank).toBe(1);
    expect(rankings.composite_rank[1].rank).toBe(2);
    expect(rankings.composite_rank[2].rank).toBe(3);
  });
});
