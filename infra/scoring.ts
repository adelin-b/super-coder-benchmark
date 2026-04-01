/**
 * Scoring module — calculates rankings from experiment results
 * 
 * Scoring per task (Generation):
 * - First-try pass: 10 points
 * - Pass after 1 retry: 7 points
 * - Pass after 2 retries: 4 points
 * - Pass after 3 retries: 2 points
 * - Never passes: 0 points
 * 
 * Scoring per task (Bug Detection):
 * - Each seeded bug caught: 2.5 points (4 bugs × 2.5 = 10 points max)
 * - Bonus: actionable error message: +1 point per bug
 * 
 * Composite: 40% reliability + 30% detection + 20% speed + 10% cost
 */

import type { ExperimentResult, MethodId, Rankings, RankEntry } from './types.js';

export function calculateGenerationScore(retries: number, passed: boolean): number {
  if (!passed) return 0;
  switch (retries) {
    case 0: return 10;
    case 1: return 7;
    case 2: return 4;
    case 3: return 2;
    default: return 0;
  }
}

export function calculateDetectionScore(bugsCaught: number, actionableErrors: number): number {
  const base = bugsCaught * 2.5;
  const bonus = actionableErrors * 1;
  return Math.min(base + bonus, 14); // 10 base max + 4 bonus max
}

export function calculateScores(results: ExperimentResult[]): Rankings {
  const methodGroups = new Map<MethodId, ExperimentResult[]>();

  for (const r of results) {
    const existing = methodGroups.get(r.method) ?? [];
    existing.push(r);
    methodGroups.set(r.method, existing);
  }

  const methodStats: Array<{
    method: MethodId;
    reliabilityRate: number;
    detectionRate: number;
    avgTime: number;
    avgTokens: number;
  }> = [];

  for (const [method, experiments] of methodGroups) {
    const validExperiments = experiments.filter(e => e.track !== 'swe_bench');
    if (validExperiments.length === 0) continue;

    // Reliability: % first-try pass
    const firstTryPasses = validExperiments.filter(e => e.generation.first_try_pass).length;
    const reliabilityRate = firstTryPasses / validExperiments.length;

    // Detection: % bugs caught
    const totalBugsSeeded = validExperiments.reduce((s, e) => s + e.bug_detection.bugs_seeded, 0);
    const totalBugsCaught = validExperiments.reduce((s, e) => s + e.bug_detection.bugs_caught, 0);
    const detectionRate = totalBugsSeeded > 0 ? totalBugsCaught / totalBugsSeeded : 0;

    // Speed: average time
    const avgTime = validExperiments.reduce((s, e) => s + e.generation.total_time_seconds, 0) / validExperiments.length;

    // Cost: average tokens
    const avgTokens = validExperiments.reduce((s, e) => s + e.generation.total_tokens, 0) / validExperiments.length;

    methodStats.push({ method, reliabilityRate, detectionRate, avgTime, avgTokens });
  }

  const rank = (arr: RankEntry[]): RankEntry[] => {
    arr.sort((a, b) => b.score - a.score);
    arr.forEach((e, i) => { e.rank = i + 1; });
    return arr;
  };

  const reliability_rank = rank(
    methodStats.map(s => ({ method: s.method, score: s.reliabilityRate, rank: 0 }))
  );

  const detection_rank = rank(
    methodStats.map(s => ({ method: s.method, score: s.detectionRate, rank: 0 }))
  );

  // Speed: lower is better — invert for ranking
  const maxTime = Math.max(...methodStats.map(s => s.avgTime), 1);
  const speed_rank = rank(
    methodStats.map(s => ({ method: s.method, score: 1 - (s.avgTime / maxTime), rank: 0 }))
  );

  // Cost: lower is better — invert for ranking
  const maxTokens = Math.max(...methodStats.map(s => s.avgTokens), 1);
  const cost_rank = rank(
    methodStats.map(s => ({ method: s.method, score: 1 - (s.avgTokens / maxTokens), rank: 0 }))
  );

  // Composite: 40% reliability + 30% detection + 20% speed + 10% cost
  const composite_rank = rank(
    methodStats.map(s => {
      const relScore = s.reliabilityRate;
      const detScore = s.detectionRate;
      const spdScore = 1 - (s.avgTime / maxTime);
      const cstScore = 1 - (s.avgTokens / maxTokens);
      return {
        method: s.method,
        score: 0.4 * relScore + 0.3 * detScore + 0.2 * spdScore + 0.1 * cstScore,
        rank: 0,
      };
    })
  );

  return { reliability_rank, detection_rank, speed_rank, cost_rank, composite_rank };
}
