/**
 * TypeScript type definitions for agent manifest YAML files.
 */

export interface AgentManifest {
  /** Human-readable agent/method name */
  name: string;

  /** Manifest version number (monotonically increasing) */
  version: number;

  /** Parent version this was derived from (undefined for v1) */
  parent?: number;

  /** Default model tier: haiku, sonnet, or opus */
  model_default: "haiku" | "sonnet" | "opus";

  /** Maximum agentic turns (tool-use round trips). 1 = single-shot. */
  max_turns: number;

  /** Allowed tools for iterative agents. Empty = no tools. */
  tools: string[];

  /**
   * Paths to context bundle files (relative to repo root).
   * Each file is read and prepended to the system prompt.
   */
  context_bundle: string[];

  /** Path to the system prompt file, relative to the manifest directory */
  system_prompt_file: string;

  /** Human-readable changelog entry for this version */
  changelog: string;
}

/** Task ID to implementation file name mapping */
export const TASK_FILE_MAP: Record<string, string> = {
  "BL-1": "pricing",
  "BL-2": "invoice",
  "BL-3": "converter",
  "BL-4": "prorate",
  "BL-5": "inventory",
  "ALG-1": "search",
  "ALG-2": "lru",
  "ALG-3": "toposort",
  "SAAS-1": "rbac",
  "SAAS-2": "ratelimit",
  "SAAS-3": "account",
  "HARD-1": "sliding-window-limiter",
  "HARD-2": "event-store",
  "HARD-3": "task-scheduler",
  "HARD-4": "ledger",
  "HARD-5": "rbac",
};

/** Verdict JSON output by the runner */
export interface RunVerdict {
  task: string;
  agent: string;
  model: string;
  generated: boolean;
  error?: string;
  tests_passed?: number;
  tests_total?: number;
  pass_rate?: number;
  tokens_in?: number;
  tokens_out?: number;
  duration_ms: number;
  verdict: "pass" | "fail" | "error";
}
