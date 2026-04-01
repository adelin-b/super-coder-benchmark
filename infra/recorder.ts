/**
 * Results recorder — appends experiment results to results.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { ExperimentResult } from './types.js';

const RESULTS_PATH = join(import.meta.dirname ?? '.', '..', 'results', 'results.json');

const BugDetailSchema = z.object({
  bug_id: z.string(),
  caught: z.boolean(),
  error_actionable: z.boolean(),
  shrunk_example: z.string().optional(),
  error_message: z.string().optional(),
});

const ExperimentResultSchema = z.object({
  experiment_id: z.string().min(1),
  method: z.string(),
  task: z.string(),
  track: z.string(),
  timestamp: z.string(),
  generation: z.object({
    first_try_pass: z.boolean(),
    retries_needed: z.number().int().min(0).max(3),
    total_time_seconds: z.number().min(0),
    total_tokens: z.number().int().min(0),
    verification_type: z.string(),
    properties_defined: z.number().int().optional(),
    properties_passing: z.number().int().optional(),
    error_messages: z.array(z.string()),
  }),
  bug_detection: z.object({
    bugs_seeded: z.number().int().min(0),
    bugs_caught: z.number().int().min(0),
    bugs_missed: z.array(z.string()),
    actionable_errors: z.number().int().min(0),
    details: z.array(BugDetailSchema),
  }),
  scores: z.object({
    generation_score: z.number().min(0).max(10),
    detection_score: z.number().min(0).max(14),
    total: z.number().min(0).max(24),
  }),
});

export function verifyResultSchema(result: unknown): ExperimentResult {
  return ExperimentResultSchema.parse(result) as ExperimentResult;
}

export function readResults(path?: string): ExperimentResult[] {
  const filePath = path ?? RESULTS_PATH;
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('results.json must be an array');
  return data.map((r: unknown) => verifyResultSchema(r));
}

export function recordResult(result: ExperimentResult, path?: string): void {
  const validated = verifyResultSchema(result);
  const filePath = path ?? RESULTS_PATH;
  const existing = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, 'utf-8'))
    : [];
  if (!Array.isArray(existing)) throw new Error('results.json must be an array');
  existing.push(validated);
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n');
}

export function getResultsPath(): string {
  return RESULTS_PATH;
}
