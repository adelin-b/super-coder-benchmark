/**
 * Core types for the Super Coder Benchmark
 */

export type MethodId =
  | 'A_plain_ts'
  | 'B_effect_xstate'
  | 'C_tdd'
  | 'D_pbt'
  | 'E_dafny'
  | 'F_lean4'
  | 'G_coq'
  | 'H_consensus'
  | 'I_pbt_effect'
  | 'J_dafny_pbt';

export type TrackId = 'business_logic' | 'algorithms' | 'saas' | 'ui' | 'swe_bench';

export type TaskId =
  | 'BL-1' | 'BL-2' | 'BL-3' | 'BL-4' | 'BL-5'
  | 'ALG-1' | 'ALG-2' | 'ALG-3'
  | 'SAAS-1' | 'SAAS-2' | 'SAAS-3'
  | 'UI-1' | 'UI-2'
  | `SWE-${number}`;

export interface BugDetectionDetail {
  bug_id: string;
  caught: boolean;
  error_actionable: boolean;
  shrunk_example?: string;
  error_message?: string;
}

export interface GenerationResult {
  first_try_pass: boolean;
  retries_needed: number;
  total_time_seconds: number;
  total_tokens: number;
  verification_type: string;
  properties_defined?: number;
  properties_passing?: number;
  error_messages: string[];
}

export interface BugDetectionResult {
  bugs_seeded: number;
  bugs_caught: number;
  bugs_missed: string[];
  actionable_errors: number;
  details: BugDetectionDetail[];
}

export interface Scores {
  generation_score: number;
  detection_score: number;
  total: number;
}

export interface ExperimentResult {
  experiment_id: string;
  method: MethodId;
  task: TaskId;
  track: TrackId;
  timestamp: string;
  generation: GenerationResult;
  bug_detection: BugDetectionResult;
  scores: Scores;
}

export interface Rankings {
  reliability_rank: RankEntry[];
  detection_rank: RankEntry[];
  speed_rank: RankEntry[];
  cost_rank: RankEntry[];
  composite_rank: RankEntry[];
}

export interface RankEntry {
  method: MethodId;
  score: number;
  rank: number;
}

export const METHODS: MethodId[] = [
  'A_plain_ts', 'B_effect_xstate', 'C_tdd', 'D_pbt', 'E_dafny',
  'F_lean4', 'G_coq', 'H_consensus', 'I_pbt_effect', 'J_dafny_pbt',
];

export const TRACKS: Record<TrackId, TaskId[]> = {
  business_logic: ['BL-1', 'BL-2', 'BL-3', 'BL-4', 'BL-5'],
  algorithms: ['ALG-1', 'ALG-2', 'ALG-3'],
  saas: ['SAAS-1', 'SAAS-2', 'SAAS-3'],
  ui: ['UI-1', 'UI-2'],
  swe_bench: [],
};

/** Methods not applicable to UI tasks */
export const UI_NA_METHODS: MethodId[] = ['E_dafny', 'F_lean4', 'G_coq'];

/** Methods with partial applicability to SaaS tasks */
export const SAAS_PARTIAL_METHODS: MethodId[] = ['F_lean4', 'G_coq'];
