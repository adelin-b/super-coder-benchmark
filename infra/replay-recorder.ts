/**
 * Replay recorder — append-only per-run event log for structured replay.
 *
 * Path: results/<runId>/<agent>/<task>/replay.jsonl
 * One JSON object per line. Disable with REPLAY_DISABLED=1.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const ReplayEventSchema = z.object({
  ts: z.string(),
  turn: z.number().int().min(0),
  kind: z.enum(["agent_msg", "tool_call", "tool_result", "file_diff", "test_output", "exit"]),
  payload: z.unknown(),
});

export type ReplayEvent = z.infer<typeof ReplayEventSchema>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MAX_STRING_BYTES = 4 * 1024; // 4 KB
const TRUNCATION_MARKER = "…[truncated]";

function truncateStrings(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > MAX_STRING_BYTES) {
      return value.slice(0, MAX_STRING_BYTES) + TRUNCATION_MARKER;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(truncateStrings);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncateStrings(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReplayWriterOptions {
  /** Unique run identifier; falls back to ISO date string if omitted. */
  runId?: string;
  task: string;
  agent: string;
  /** Repository root; defaults to process.cwd(). */
  root?: string;
}

export interface ReplayWriter {
  append(event: Omit<ReplayEvent, "ts"> & { ts?: string }): void;
  finalize(exit: { code: number; verdict: string }): void;
  path: string;
}

export function createReplayWriter(opts: ReplayWriterOptions): ReplayWriter {
  const root = opts.root ?? process.cwd();
  const runId = opts.runId ?? new Date().toISOString();

  // Sanitize path segments (replace characters unsafe in directory names)
  const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, "_");

  const replayDir = join(root, "results", safe(runId), safe(opts.agent), safe(opts.task));
  const replayPath = join(replayDir, "replay.jsonl");

  mkdirSync(replayDir, { recursive: true });

  function append(event: Omit<ReplayEvent, "ts"> & { ts?: string }): void {
    if (process.env["REPLAY_DISABLED"] === "1") return;

    const full: ReplayEvent = {
      ts: event.ts ?? new Date().toISOString(),
      turn: event.turn,
      kind: event.kind,
      payload: truncateStrings(event.payload),
    };

    // Validate schema (throws if malformed — callers should not pass garbage)
    ReplayEventSchema.parse(full);

    appendFileSync(replayPath, JSON.stringify(full) + "\n", "utf8");
  }

  function finalize(exit: { code: number; verdict: string }): void {
    if (process.env["REPLAY_DISABLED"] === "1") return;
    append({ turn: 0, kind: "exit", payload: exit });
  }

  return { append, finalize, path: replayPath };
}
