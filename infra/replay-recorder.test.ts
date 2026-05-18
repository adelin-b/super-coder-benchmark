import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReplayWriter, ReplayEventSchema } from "./replay-recorder.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "replay-test-"));
  // Ensure REPLAY_DISABLED is not set from an outer env
  delete process.env["REPLAY_DISABLED"];
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env["REPLAY_DISABLED"];
});

function readLines(filePath: string): unknown[] {
  const raw = readFileSync(filePath, "utf8");
  return raw
    .split("\n")
    .filter((l: string) => l.trim().length > 0)
    .map((l: string) => JSON.parse(l) as unknown);
}

describe("createReplayWriter", () => {
  it("creates the replay.jsonl file on first append", () => {
    const writer = createReplayWriter({ runId: "run-1", agent: "ag", task: "T1", root: tmpDir });
    expect(existsSync(writer.path)).toBe(false);
    writer.append({ turn: 0, kind: "agent_msg", payload: { text: "hello" } });
    expect(existsSync(writer.path)).toBe(true);
  });

  it("path is results/<runId>/<agent>/<task>/replay.jsonl", () => {
    const writer = createReplayWriter({ runId: "run-42", agent: "myAgent", task: "BL-1", root: tmpDir });
    expect(writer.path).toBe(join(tmpDir, "results", "run-42", "myAgent", "BL-1", "replay.jsonl"));
  });

  it("appends events as newline-delimited JSON", () => {
    const writer = createReplayWriter({ runId: "r1", agent: "a", task: "t", root: tmpDir });
    writer.append({ turn: 1, kind: "agent_msg", payload: { text: "hi" } });
    writer.append({ turn: 1, kind: "tool_call", payload: { name: "bash" } });
    const lines = readLines(writer.path);
    expect(lines).toHaveLength(2);
    expect((lines[0] as any).kind).toBe("agent_msg");
    expect((lines[1] as any).kind).toBe("tool_call");
  });

  it("finalize appends an exit event", () => {
    const writer = createReplayWriter({ runId: "r2", agent: "a", task: "t", root: tmpDir });
    writer.append({ turn: 1, kind: "agent_msg", payload: {} });
    writer.finalize({ code: 0, verdict: "pass" });
    const lines = readLines(writer.path);
    expect(lines).toHaveLength(2);
    const last = lines[1] as any;
    expect(last.kind).toBe("exit");
    expect(last.payload.code).toBe(0);
    expect(last.payload.verdict).toBe("pass");
  });

  it("truncates string payloads longer than 4 KB", () => {
    const writer = createReplayWriter({ runId: "r3", agent: "a", task: "t", root: tmpDir });
    const bigStr = "x".repeat(5000);
    writer.append({ turn: 1, kind: "test_output", payload: { stdout: bigStr } });
    const lines = readLines(writer.path);
    const payload = (lines[0] as any).payload;
    expect(payload.stdout.length).toBeLessThan(5000);
    expect(payload.stdout).toContain("…[truncated]");
  });

  it("does nothing when REPLAY_DISABLED=1", () => {
    process.env["REPLAY_DISABLED"] = "1";
    const writer = createReplayWriter({ runId: "r4", agent: "a", task: "t", root: tmpDir });
    writer.append({ turn: 1, kind: "agent_msg", payload: {} });
    writer.finalize({ code: 0, verdict: "pass" });
    expect(existsSync(writer.path)).toBe(false);
  });

  it("uses ISO date as runId fallback when runId is omitted", () => {
    const writer = createReplayWriter({ agent: "a", task: "t", root: tmpDir });
    // The directory should exist under results/<isoDate-like>
    writer.append({ turn: 0, kind: "agent_msg", payload: {} });
    expect(existsSync(writer.path)).toBe(true);
  });
});

describe("ReplayEventSchema", () => {
  it("accepts a valid event", () => {
    const event = { ts: new Date().toISOString(), turn: 0, kind: "agent_msg", payload: {} };
    expect(() => ReplayEventSchema.parse(event)).not.toThrow();
  });

  it("rejects missing ts", () => {
    const bad = { turn: 0, kind: "agent_msg", payload: {} };
    expect(() => ReplayEventSchema.parse(bad)).toThrow();
  });

  it("rejects unknown kind", () => {
    const bad = { ts: new Date().toISOString(), turn: 0, kind: "unknown_kind", payload: {} };
    expect(() => ReplayEventSchema.parse(bad)).toThrow();
  });

  it("rejects negative turn", () => {
    const bad = { ts: new Date().toISOString(), turn: -1, kind: "agent_msg", payload: {} };
    expect(() => ReplayEventSchema.parse(bad)).toThrow();
  });

  it("rejects fractional turn", () => {
    const bad = { ts: new Date().toISOString(), turn: 1.5, kind: "agent_msg", payload: {} };
    expect(() => ReplayEventSchema.parse(bad)).toThrow();
  });
});
