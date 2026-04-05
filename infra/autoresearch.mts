#!/usr/bin/env -S npx tsx
/**
 * Karpathy Autoresearch Loop
 *
 * An autonomous self-improvement cycle where the agent iteratively improves its
 * own system prompt to maximize test pass rate — a scalar metric.
 *
 * Three components (per Karpathy's autoresearch concept):
 *   1. Editable asset — the system prompt (instructions to the generator agent)
 *   2. Scalar metric  — tests_passed / tests_total averaged across a task set
 *   3. Time-boxed cycle — N iterations max or wall-clock budget
 *
 * The loop:
 *   baseline = run all tasks with current prompt → score
 *   for each iteration:
 *     improver(current prompt, failures) → revised prompt
 *     run all tasks with revised prompt → new score
 *     if new score > best: keep it
 *   return best prompt + history
 *
 * Usage:
 *   npx tsx infra/autoresearch.mts \
 *     --agent agents/effect-ts/v2 \
 *     --tasks BL-1,BL-5,SAAS-3 \
 *     --model haiku \
 *     --max-iterations 5 \
 *     --improver-model sonnet \
 *     [--dry-run]
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import YAML from "js-yaml";
import type { AgentManifest, RunVerdict } from "./manifest-schema.js";
import { TASK_FILE_MAP } from "./manifest-schema.js";
import {
  buildImproverSystemPrompt,
  buildImproverUserPrompt,
  type TaskFailure,
} from "./autoresearch-improver.js";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  const help = `
autoresearch — Karpathy autoresearch loop for agent self-improvement

USAGE
  npx tsx infra/autoresearch.mts \\
    --agent <path> --tasks <IDS> --model <model> [options]

OPTIONS
  --agent            Path to agent manifest dir (e.g. agents/effect-ts/v2)
  --tasks            Comma-separated task IDs (e.g. BL-1,BL-5,SAAS-3)
  --model            Generator model tier: haiku | sonnet | opus
  --max-iterations   Max improvement iterations (default: 5)
  --max-time         Max wall-clock seconds (default: 600)
  --improver-model   Model for the improver call (default: sonnet)
  --dry-run          Simulate iterations without calling the SDK
  --help             Show this help

EXAMPLES
  npx tsx infra/autoresearch.mts \\
    --agent agents/effect-ts/v2 \\
    --tasks BL-1,BL-5,SAAS-3 \\
    --model haiku \\
    --max-iterations 5 \\
    --improver-model sonnet
`.trim();
  console.log(help);
}

const { values: args } = parseArgs({
  options: {
    agent: { type: "string" },
    tasks: { type: "string" },
    model: { type: "string" },
    "max-iterations": { type: "string", default: "5" },
    "max-time": { type: "string", default: "600" },
    "improver-model": { type: "string", default: "sonnet" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!args.agent || !args.tasks || !args.model) {
  console.error(
    "ERROR: --agent, --tasks, and --model are required. Use --help for usage.",
  );
  process.exit(1);
}

const ROOT = process.cwd();
const agentDir = resolve(ROOT, args.agent);
const taskIds = args.tasks.split(",").map((s) => s.trim());
const modelArg = args.model as "haiku" | "sonnet" | "opus";
const maxIterations = parseInt(args["max-iterations"]!, 10);
const maxTimeSeconds = parseInt(args["max-time"]!, 10);
const improverModel = args["improver-model"] as "haiku" | "sonnet" | "opus";
const dryRun = args["dry-run"] ?? false;

// Validate task IDs
for (const tid of taskIds) {
  if (!TASK_FILE_MAP[tid]) {
    console.error(
      `ERROR: Unknown task ID "${tid}". Known: ${Object.keys(TASK_FILE_MAP).join(", ")}`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Manifest + prompt loading
// ---------------------------------------------------------------------------

function loadManifest(dir: string): AgentManifest {
  const manifestPath = join(dir, "manifest.yml");
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = YAML.load(raw) as AgentManifest;
  parsed.tools = parsed.tools ?? [];
  parsed.context_bundle = parsed.context_bundle ?? [];
  parsed.max_turns = parsed.max_turns ?? 1;
  return parsed;
}

function buildSystemPrompt(
  manifest: AgentManifest,
  manifestDir: string,
  overridePromptText?: string,
): string {
  const parts: string[] = [];

  // Load context bundles
  for (const bundlePath of manifest.context_bundle) {
    const fullPath = resolve(ROOT, bundlePath);
    if (existsSync(fullPath)) {
      parts.push(readFileSync(fullPath, "utf8"));
    } else {
      process.stderr.write(`WARN: context bundle not found: ${bundlePath}\n`);
    }
  }

  if (overridePromptText) {
    parts.push(overridePromptText);
  } else {
    const promptPath = resolve(manifestDir, manifest.system_prompt_file);
    if (existsSync(promptPath)) {
      parts.push(readFileSync(promptPath, "utf8"));
    } else {
      throw new Error(`System prompt file not found: ${promptPath}`);
    }
  }

  return parts.join("\n\n---\n\n");
}

function loadBasePromptText(
  manifest: AgentManifest,
  manifestDir: string,
): string {
  const promptPath = resolve(manifestDir, manifest.system_prompt_file);
  return readFileSync(promptPath, "utf8");
}

function promptHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

// ---------------------------------------------------------------------------
// Code extraction (duplicated from agent-runner to keep self-contained)
// ---------------------------------------------------------------------------

function extractCode(text: string): string {
  const patterns = [
    /```typescript\s*\n([\s\S]*?)```/,
    /```ts\s*\n([\s\S]*?)```/,
    /```\s*\n([\s\S]*?)```/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return text.trim();
}

// ---------------------------------------------------------------------------
// Vitest runner (duplicated from agent-runner)
// ---------------------------------------------------------------------------

interface TestResult {
  passed: number;
  total: number;
  rawOutput: string;
}

function runVitest(testFilePath: string): TestResult {
  try {
    const output = execSync(
      `npx vitest run "${testFilePath}" --reporter=verbose 2>&1`,
      { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
    );
    return parseVitestOutput(output);
  } catch (e: any) {
    const output = e.stdout ?? e.stderr ?? String(e);
    return parseVitestOutput(output);
  }
}

function parseVitestOutput(output: string): TestResult {
  const passMatch = output.match(/(\d+)\s+passed/);
  const failMatch = output.match(/(\d+)\s+failed/);
  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
  return { passed, total: passed + failed, rawOutput: output };
}

// ---------------------------------------------------------------------------
// Single task runner
// ---------------------------------------------------------------------------

interface SingleTaskResult {
  taskId: string;
  verdict: RunVerdict;
  testResult: TestResult;
  codeGenerated: boolean;
}

async function runOneTask(
  manifest: AgentManifest,
  systemPrompt: string,
  taskId: string,
  model: "haiku" | "sonnet" | "opus",
  outDir: string,
  isDryRun: boolean,
): Promise<SingleTaskResult> {
  const fileName = TASK_FILE_MAP[taskId]!;
  const specPath = join(ROOT, "references", taskId, "spec.md");

  if (!existsSync(specPath)) {
    throw new Error(`Spec not found: ${specPath}`);
  }

  const spec = readFileSync(specPath, "utf8");
  const userPrompt =
    `Implement the following TypeScript module exactly as specified. ` +
    `The file name is \`${fileName}.ts\`. Export everything the spec says to export. ` +
    `Do not write tests. Reply with ONLY the TypeScript code inside a single fenced \`\`\`typescript block.\n\n` +
    `## Spec\n\n${spec}`;

  const taskOutDir = join(outDir, taskId);
  mkdirSync(taskOutDir, { recursive: true });

  if (isDryRun) {
    // Simulate: random pass rate between 0.3 and 0.9
    const simPassed = Math.floor(Math.random() * 7) + 3;
    const simTotal = 10;
    const testResult: TestResult = {
      passed: simPassed,
      total: simTotal,
      rawOutput: `[dry-run] simulated ${simPassed}/${simTotal} tests passing`,
    };
    const verdict: RunVerdict = {
      task: taskId,
      agent: manifest.name,
      model,
      generated: true,
      tests_passed: simPassed,
      tests_total: simTotal,
      pass_rate: simPassed / simTotal,
      duration_ms: 0,
      verdict: simPassed === simTotal ? "pass" : "fail",
    };
    return { taskId, verdict, testResult, codeGenerated: true };
  }

  // Dynamic import of Agent SDK
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const start = Date.now();
  let assistantText = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let errored: string | undefined;

  try {
    const q = query({
      prompt: userPrompt,
      options: {
        model,
        allowedTools: manifest.tools,
        disallowedTools: [],
        mcpServers: {},
        settingSources: [],
        systemPrompt,
        permissionMode: "default",
        ...(manifest.max_turns > 1 ? { maxTurns: manifest.max_turns } : {}),
      },
    });

    for await (const msg of q as any) {
      if (msg.type === "assistant" && msg.message?.content) {
        for (const block of msg.message.content as Array<any>) {
          if (block.type === "text" && typeof block.text === "string") {
            assistantText += block.text;
          }
        }
      }
      if (msg.type === "result") {
        const usage = msg.usage;
        if (usage) {
          tokensIn = usage.input_tokens;
          tokensOut = usage.output_tokens;
        }
        if (msg.is_error) {
          errored = errored ?? `result error subtype=${msg.subtype}`;
        }
      }
    }
  } catch (e: any) {
    errored = e?.message ?? String(e);
  }

  const durationMs = Date.now() - start;

  if (errored || !assistantText) {
    const verdict: RunVerdict = {
      task: taskId,
      agent: manifest.name,
      model,
      generated: false,
      error: errored ?? "empty response",
      duration_ms: durationMs,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      verdict: "error",
    };
    return {
      taskId,
      verdict,
      testResult: { passed: 0, total: 0, rawOutput: errored ?? "" },
      codeGenerated: false,
    };
  }

  // Extract code and save
  const code = extractCode(assistantText);
  writeFileSync(join(taskOutDir, `${fileName}.ts`), code, "utf8");

  // Copy test file
  const testSrc = join(ROOT, "references", taskId, `${fileName}.test.ts`);
  const testDst = join(taskOutDir, `${fileName}.test.ts`);
  if (existsSync(testSrc)) {
    copyFileSync(testSrc, testDst);
  }

  // Run vitest
  let testResult: TestResult = { passed: 0, total: 0, rawOutput: "" };
  if (existsSync(testDst)) {
    testResult = runVitest(testDst);
  }

  const passRate =
    testResult.total > 0 ? testResult.passed / testResult.total : 0;

  const verdict: RunVerdict = {
    task: taskId,
    agent: manifest.name,
    model,
    generated: true,
    tests_passed: testResult.passed,
    tests_total: testResult.total,
    pass_rate: Math.round(passRate * 10000) / 10000,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    duration_ms: durationMs,
    verdict: passRate === 1 ? "pass" : "fail",
  };

  return { taskId, verdict, testResult, codeGenerated: true };
}

// ---------------------------------------------------------------------------
// Run all tasks and compute aggregate score
// ---------------------------------------------------------------------------

interface IterationResult {
  scoresPerTask: Record<string, { passed: number; total: number; rate: number }>;
  avgScore: number;
  totalPassed: number;
  totalTests: number;
  failures: TaskFailure[];
  verdicts: RunVerdict[];
}

async function runAllTasks(
  manifest: AgentManifest,
  systemPrompt: string,
  tasks: string[],
  model: "haiku" | "sonnet" | "opus",
  outDir: string,
  isDryRun: boolean,
): Promise<IterationResult> {
  const scoresPerTask: Record<
    string,
    { passed: number; total: number; rate: number }
  > = {};
  const failures: TaskFailure[] = [];
  const verdicts: RunVerdict[] = [];
  let totalPassed = 0;
  let totalTests = 0;

  for (const taskId of tasks) {
    const result = await runOneTask(
      manifest,
      systemPrompt,
      taskId,
      model,
      outDir,
      isDryRun,
    );

    const passed = result.verdict.tests_passed ?? 0;
    const total = result.verdict.tests_total ?? 0;
    const rate = total > 0 ? passed / total : 0;

    scoresPerTask[taskId] = { passed, total, rate };
    totalPassed += passed;
    totalTests += total;
    verdicts.push(result.verdict);

    // Collect failures (any task that isn't 100%)
    if (rate < 1) {
      failures.push({
        taskId,
        testsPassed: passed,
        testsTotal: total,
        rawOutput: result.testResult.rawOutput,
      });
    }
  }

  const avgScore = totalTests > 0 ? totalPassed / totalTests : 0;

  return {
    scoresPerTask,
    avgScore,
    totalPassed,
    totalTests,
    failures,
    verdicts,
  };
}

// ---------------------------------------------------------------------------
// Improver: ask Claude to revise the system prompt
// ---------------------------------------------------------------------------

async function callImprover(
  currentPromptText: string,
  contextBundlePaths: string[],
  failures: TaskFailure[],
  iterationNumber: number,
  previousScores: number[],
  model: "haiku" | "sonnet" | "opus",
  isDryRun: boolean,
): Promise<string> {
  if (isDryRun) {
    // Simulate: add a line to the prompt
    return (
      currentPromptText +
      `\n\n<!-- autoresearch iteration ${iterationNumber}: address ${failures.length} failing tasks -->`
    );
  }

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const improverSystemPrompt = buildImproverSystemPrompt();
  const improverUserPrompt = buildImproverUserPrompt({
    currentPrompt: currentPromptText,
    contextBundlePaths,
    failures,
    iterationNumber,
    previousScores,
  });

  let assistantText = "";

  const q = query({
    prompt: improverUserPrompt,
    options: {
      model,
      allowedTools: [],
      disallowedTools: [],
      mcpServers: {},
      settingSources: [],
      systemPrompt: improverSystemPrompt,
      permissionMode: "default",
    },
  });

  for await (const msg of q as any) {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content as Array<any>) {
        if (block.type === "text" && typeof block.text === "string") {
          assistantText += block.text;
        }
      }
    }
  }

  // Strip any markdown fencing the improver might wrap around the prompt
  const stripped = assistantText
    .replace(/^```(?:markdown|md)?\s*\n/i, "")
    .replace(/\n```\s*$/, "")
    .trim();

  return stripped || currentPromptText;
}

// ---------------------------------------------------------------------------
// History tracking
// ---------------------------------------------------------------------------

interface IterationRecord {
  iteration: number;
  promptHash: string;
  scoresPerTask: Record<string, { passed: number; total: number; rate: number }>;
  avgScore: number;
  totalPassed: number;
  totalTests: number;
  improved: boolean;
  durationMs?: number;
}

interface HistoryFile {
  agent: string;
  model: string;
  tasks: string[];
  startedAt: string;
  iterations: IterationRecord[];
  bestIteration: number;
  bestScore: number;
}

// ---------------------------------------------------------------------------
// Console output helpers
// ---------------------------------------------------------------------------

function log(msg: string): void {
  process.stderr.write(msg + "\n");
}

function formatScore(score: number): string {
  return (score * 100).toFixed(1) + "%";
}

function formatDelta(current: number, baseline: number): string {
  const delta = current - baseline;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Main autoresearch loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const manifest = loadManifest(agentDir);
  const agentId = `${manifest.name}-v${manifest.version}`;
  const baseDir = join(ROOT, "autoresearch", agentId);

  log(
    `[autoresearch] ${agentId} on [${taskIds.join(", ")}] x ${modelArg}`,
  );
  log(
    `[config] max_iterations=${maxIterations}, max_time=${maxTimeSeconds}s, improver=${improverModel}${dryRun ? ", DRY-RUN" : ""}`,
  );

  const startTime = Date.now();

  // Load the editable asset: the system prompt text (not the full assembled prompt)
  let currentPromptText = loadBasePromptText(manifest, agentDir);
  let bestPromptText = currentPromptText;
  let bestScore = -1;
  let bestIteration = -1;
  const scoreHistory: number[] = [];

  const history: HistoryFile = {
    agent: agentId,
    model: modelArg,
    tasks: taskIds,
    startedAt: new Date().toISOString(),
    iterations: [],
    bestIteration: 0,
    bestScore: 0,
  };

  // --- Baseline (iteration 0) ---
  const iter0Dir = join(baseDir, "0");
  mkdirSync(iter0Dir, { recursive: true });
  writeFileSync(join(iter0Dir, "system-prompt.md"), currentPromptText, "utf8");

  const fullSystemPrompt0 = buildSystemPrompt(manifest, agentDir);
  const baseline = await runAllTasks(
    manifest,
    fullSystemPrompt0,
    taskIds,
    modelArg,
    iter0Dir,
    dryRun,
  );

  writeFileSync(
    join(iter0Dir, "results.json"),
    JSON.stringify(baseline.verdicts, null, 2),
    "utf8",
  );

  bestScore = baseline.avgScore;
  bestIteration = 0;
  scoreHistory.push(baseline.avgScore);

  history.iterations.push({
    iteration: 0,
    promptHash: promptHash(currentPromptText),
    scoresPerTask: baseline.scoresPerTask,
    avgScore: baseline.avgScore,
    totalPassed: baseline.totalPassed,
    totalTests: baseline.totalTests,
    improved: true,
  });
  history.bestIteration = 0;
  history.bestScore = bestScore;

  log(
    `[iter 0] baseline: ${formatScore(baseline.avgScore)} (${baseline.totalPassed}/${baseline.totalTests} tests)`,
  );

  // Early exit if perfect
  if (baseline.avgScore >= 1.0) {
    log("[done] perfect score on baseline, nothing to improve");
    saveHistory(baseDir, history);
    saveBest(baseDir, bestPromptText);
    return;
  }

  // --- Improvement iterations ---
  let latestFailures = baseline.failures;

  for (let i = 1; i <= maxIterations; i++) {
    // Budget check: wall-clock time
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= maxTimeSeconds) {
      log(`[budget] time limit reached (${elapsed.toFixed(0)}s >= ${maxTimeSeconds}s)`);
      break;
    }

    // Ask the improver to revise the prompt
    const iterStart = Date.now();
    const revisedPromptText = await callImprover(
      currentPromptText,
      manifest.context_bundle,
      latestFailures,
      i,
      scoreHistory,
      improverModel,
      dryRun,
    );

    // Build the full system prompt with the revised text
    const fullSystemPrompt = buildSystemPrompt(
      manifest,
      agentDir,
      revisedPromptText,
    );

    // Persist this iteration's prompt
    const iterDir = join(baseDir, String(i));
    mkdirSync(iterDir, { recursive: true });
    writeFileSync(join(iterDir, "system-prompt.md"), revisedPromptText, "utf8");

    // Run all tasks
    const result = await runAllTasks(
      manifest,
      fullSystemPrompt,
      taskIds,
      modelArg,
      iterDir,
      dryRun,
    );

    writeFileSync(
      join(iterDir, "results.json"),
      JSON.stringify(result.verdicts, null, 2),
      "utf8",
    );

    const iterDuration = Date.now() - iterStart;
    const improved = result.avgScore > bestScore;
    const delta = formatDelta(result.avgScore, bestScore);

    const record: IterationRecord = {
      iteration: i,
      promptHash: promptHash(revisedPromptText),
      scoresPerTask: result.scoresPerTask,
      avgScore: result.avgScore,
      totalPassed: result.totalPassed,
      totalTests: result.totalTests,
      improved,
      durationMs: iterDuration,
    };
    history.iterations.push(record);
    scoreHistory.push(result.avgScore);

    if (improved) {
      bestScore = result.avgScore;
      bestIteration = i;
      bestPromptText = revisedPromptText;
      currentPromptText = revisedPromptText;
      latestFailures = result.failures;
      log(
        `[iter ${i}] score: ${formatScore(result.avgScore)} (${delta}) ✓ improved`,
      );
    } else {
      // Revert: keep the best prompt as the base for next iteration
      // but update failures from the best iteration's run
      log(
        `[iter ${i}] score: ${formatScore(result.avgScore)} (${delta}) ✗ ${result.avgScore === bestScore ? "no change" : "reverted"}`,
      );
    }

    history.bestIteration = bestIteration;
    history.bestScore = bestScore;

    // Save history after each iteration (crash-safe)
    saveHistory(baseDir, history);

    // Perfect score: stop early
    if (bestScore >= 1.0) {
      log("[done] perfect score reached");
      break;
    }
  }

  // --- Summary ---
  saveBest(baseDir, bestPromptText);
  saveHistory(baseDir, history);

  const baselineScore = history.iterations[0].avgScore;
  const relativeImprovement =
    baselineScore > 0
      ? (((bestScore - baselineScore) / baselineScore) * 100).toFixed(0)
      : "N/A";

  log(
    `[done] best: ${formatScore(bestScore)} at iter ${bestIteration} (from ${formatScore(baselineScore)} baseline, +${relativeImprovement}% relative improvement)`,
  );
  log(`[done] outputs in ${baseDir}`);
}

function saveHistory(baseDir: string, history: HistoryFile): void {
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(
    join(baseDir, "history.json"),
    JSON.stringify(history, null, 2),
    "utf8",
  );
}

function saveBest(baseDir: string, promptText: string): void {
  const bestDir = join(baseDir, "best");
  mkdirSync(bestDir, { recursive: true });
  writeFileSync(join(bestDir, "system-prompt.md"), promptText, "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
