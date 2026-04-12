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

/** Task ID to implementation file name mapping. Array = multi-file task. */
export const TASK_FILE_MAP: Record<string, string | string[]> = {
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
  "EXTREME-1": "interval-merge",
  "EXTREME-2": "pn-counter",
  "EXTREME-3": "tax-calc",
  "EXTREME-4": "history-tree",
  "EXTREME-5": "lock-manager",
  "NIGHTMARE-1": "rect-union",
  "NIGHTMARE-2": "bill-splitter",
  "NIGHTMARE-3": "spreadsheet",
  "TRAP-1": "dedup",
  "TRAP-2": "brackets",
  "TRAP-3": "optimizer",
  "TRAP-4": "sort-engine",
  "TRAP-5": "pathfinder",
  "MULTIFILE-1": ["types", "registry", "loader", "executor", "index"],
  "MULTIFILE-2": ["events", "handlers", "store", "saga"],
  "MULTIFILE-3": ["lexer", "parser", "analyzer", "emitter"],
  "EXERCISM-1": "forth",
  "EXERCISM-2": "react",
  "EXERCISM-3": "zipper",
  "WEB-TS-1": "setter-types",
  "WEB-TS-2": "setter-union",
  "WEB-TS-3": "form-schema",
  "WEB-TS-4": "visible-setter",
  "WEB-TS-5": "custom-render",
  "WEB-TS-6": "render-props",
  "WEB-TS-7": "ctx-value",
  "WEB-TS-8": "editor-ref",
  "WEB-GAME-1": "flappy-physics",
  "WEB-GAME-2": "snake-logic",
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
