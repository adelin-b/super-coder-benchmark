#!/usr/bin/env -S npx tsx
/**
 * Manifest-driven agent runner.
 *
 * Usage:
 *   npx tsx infra/agent-runner.mts --agent agents/plain-ts/v1 --task BL-1 --model haiku [--dry-run]
 *
 * Reads a manifest YAML, loads context bundles, calls the Claude Agent SDK,
 * extracts code, runs vitest, and outputs a verdict JSON to stdout.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import YAML from "js-yaml";
import type { AgentManifest, RunVerdict } from "./manifest-schema.js";
import { TASK_FILE_MAP } from "./manifest-schema.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function printHelp(): void {
  const help = `
agent-runner — manifest-driven Claude Agent SDK runner

USAGE
  npx tsx infra/agent-runner.mts --agent <path> --task <TASK_ID> --model <model> [--dry-run]

OPTIONS
  --agent   <path>    Path to manifest directory (e.g. agents/plain-ts/v1)
  --task    <id>      Task ID (e.g. BL-1, ALG-2, SAAS-3)
  --model   <model>   Model tier: haiku | sonnet | opus
  --dry-run           Parse manifest and print config without calling the SDK
  --help              Show this help message

EXAMPLES
  npx tsx infra/agent-runner.mts --agent agents/plain-ts/v1 --task BL-1 --model haiku
  npx tsx infra/agent-runner.mts --agent agents/effect-ts/v2 --task ALG-1 --model sonnet --dry-run
`.trim();
  console.log(help);
}

const { values: args } = parseArgs({
  options: {
    agent: { type: "string" },
    task: { type: "string" },
    model: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!args.agent || !args.task || !args.model) {
  console.error("ERROR: --agent, --task, and --model are required. Use --help for usage.");
  process.exit(1);
}

const ROOT = process.cwd();
const agentDir = resolve(ROOT, args.agent);
const taskId = args.task;
const modelArg = args.model as "haiku" | "sonnet" | "opus";
const dryRun = args["dry-run"] ?? false;

// ---------------------------------------------------------------------------
// Load manifest
// ---------------------------------------------------------------------------

function loadManifest(dir: string): AgentManifest {
  const manifestPath = join(dir, "manifest.yml");
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = YAML.load(raw) as AgentManifest;
  // Provide defaults for optional fields
  parsed.tools = parsed.tools ?? [];
  parsed.context_bundle = parsed.context_bundle ?? [];
  parsed.max_turns = parsed.max_turns ?? 1;
  return parsed;
}

// ---------------------------------------------------------------------------
// Build system prompt with context bundles
// ---------------------------------------------------------------------------

function buildSystemPrompt(manifest: AgentManifest, manifestDir: string): string {
  const parts: string[] = [];

  // Load context bundles (paths relative to repo root)
  for (const bundlePath of manifest.context_bundle) {
    const fullPath = resolve(ROOT, bundlePath);
    if (existsSync(fullPath)) {
      parts.push(readFileSync(fullPath, "utf8"));
    } else {
      process.stderr.write(`WARN: context bundle not found: ${bundlePath}\n`);
    }
  }

  // Load the system prompt file (relative to manifest directory)
  const promptPath = resolve(manifestDir, manifest.system_prompt_file);
  if (existsSync(promptPath)) {
    parts.push(readFileSync(promptPath, "utf8"));
  } else {
    throw new Error(`System prompt file not found: ${promptPath}`);
  }

  return parts.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Code extraction
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

/**
 * Extract multiple named files from agent response.
 * Expects format: ```typescript // filename.ts\n<code>\n```
 */
function extractFiles(text: string, fileNames: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const name of fileNames) {
    // Match: ```typescript // name.ts  or  ```ts // name.ts
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `\`\`\`(?:typescript|ts)\\s*(?://|/\\*)\\s*${escaped}\\.ts[\\s*/]*\\n([\\s\\S]*?)\`\`\``,
    );
    const m = text.match(pattern);
    if (m) {
      result.set(name, m[1].trim());
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Vitest runner
// ---------------------------------------------------------------------------

interface TestResult {
  passed: number;
  total: number;
  rawOutput: string;
}

function runVitest(testFilePath: string): TestResult {
  try {
    const output = execSync(`npx vitest run "${testFilePath}" --reporter=verbose 2>&1`, {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
    });
    return parseVitestOutput(output);
  } catch (e: any) {
    // vitest exits non-zero when tests fail — still parse the output
    const output = e.stdout ?? e.stderr ?? String(e);
    return parseVitestOutput(output);
  }
}

function parseVitestOutput(output: string): TestResult {
  // Match the "Tests" summary line specifically (not "Test Files" line).
  // Vitest output format:
  //   Test Files  1 passed (1)
  //        Tests  16 passed (16)        ← we want THIS line
  // The old regex matched the first "N passed" which hit "Test Files".
  const testsLine = output.match(/^\s*Tests\s+(.+)$/m);
  let passed = 0;
  let failed = 0;
  if (testsLine) {
    const passMatch = testsLine[1].match(/(\d+)\s+passed/);
    const failMatch = testsLine[1].match(/(\d+)\s+failed/);
    passed = passMatch ? parseInt(passMatch[1], 10) : 0;
    failed = failMatch ? parseInt(failMatch[1], 10) : 0;
  }
  return { passed, total: passed + failed, rawOutput: output };
}

// ---------------------------------------------------------------------------
// Main run
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const manifest = loadManifest(agentDir);
  const systemPrompt = buildSystemPrompt(manifest, agentDir);
  const fileSpec = TASK_FILE_MAP[taskId];

  if (!fileSpec) {
    console.error(`ERROR: Unknown task ID "${taskId}". Known: ${Object.keys(TASK_FILE_MAP).join(", ")}`);
    process.exit(1);
  }

  const isMultiFile = Array.isArray(fileSpec);
  const fileNames = isMultiFile ? fileSpec : [fileSpec];
  const fileName = isMultiFile ? fileSpec[0] : fileSpec; // primary file for backward compat

  const specPath = join(ROOT, "references", taskId, "spec.md");
  if (!existsSync(specPath)) {
    console.error(`ERROR: Spec not found: ${specPath}`);
    process.exit(1);
  }

  const spec = readFileSync(specPath, "utf8");
  let userPrompt: string;
  if (isMultiFile) {
    const fileList = fileNames.map(f => `\`${f}.ts\``).join(", ");
    userPrompt =
      `Implement the following TypeScript modules exactly as specified. ` +
      `You must produce these files: ${fileList}. ` +
      `Files must import from each other using relative paths with .js extensions. ` +
      `Output each file in a separate fenced \`\`\`typescript // filename.ts block. ` +
      `Do not write tests.\n\n` +
      `## Spec\n\n${spec}`;
  } else {
    userPrompt =
      `Implement the following TypeScript module exactly as specified. ` +
      `The file name is \`${fileName}.ts\`. Export everything the spec says to export. ` +
      `Do not write tests. Reply with ONLY the TypeScript code inside a single fenced \`\`\`typescript block.\n\n` +
      `## Spec\n\n${spec}`;
  }

  // Date-based output directory — include version and model to avoid collisions
  const dateStr = new Date().toISOString().slice(0, 10);
  const agentId = manifest.name;
  const versionTag = `v${manifest.version}`;
  const outDir = join(ROOT, "runs", dateStr, `${agentId}-${versionTag}`, modelArg, taskId);

  if (dryRun) {
    const config = {
      agentDir,
      manifest: { ...manifest, _systemPromptLength: systemPrompt.length },
      taskId,
      fileName,
      model: modelArg,
      outDir,
      specPath,
      userPromptLength: userPrompt.length,
      systemPromptPreview: systemPrompt.slice(0, 300) + (systemPrompt.length > 300 ? "..." : ""),
    };
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  // Dynamic import of the Agent SDK (only when not dry-run)
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const start = Date.now();
  let assistantText = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let errored: string | undefined;
  const trajectory: any[] = [];

  try {
    const q = query({
      prompt: userPrompt,
      options: {
        model: modelArg,
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
      trajectory.push(msg);

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

  // Error verdict
  if (errored || !assistantText) {
    const verdict: RunVerdict = {
      task: taskId,
      agent: agentId,
      model: modelArg,
      generated: false,
      error: errored ?? "empty response",
      duration_ms: durationMs,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      verdict: "error",
    };
    console.log(JSON.stringify(verdict, null, 2));
    return;
  }

  // Extract code and save outputs
  mkdirSync(outDir, { recursive: true });

  if (isMultiFile) {
    // Multi-file: extract named blocks
    const files = extractFiles(assistantText, fileNames);
    for (const [name, code] of files) {
      writeFileSync(join(outDir, `${name}.ts`), code, "utf8");
    }
    if (files.size === 0) {
      // Fallback: try single extraction for agents that ignore multi-file instructions
      const code = extractCode(assistantText);
      writeFileSync(join(outDir, `${fileName}.ts`), code, "utf8");
    }
  } else {
    const code = extractCode(assistantText);
    writeFileSync(join(outDir, `${fileName}.ts`), code, "utf8");
  }

  writeFileSync(
    join(outDir, "trajectory.json"),
    JSON.stringify(trajectory, null, 2),
    "utf8",
  );
  writeFileSync(
    join(outDir, "manifest-snapshot.yml"),
    readFileSync(join(agentDir, "manifest.yml"), "utf8"),
    "utf8",
  );

  // Copy test files alongside code
  const refDir = join(ROOT, "references", taskId);
  if (isMultiFile) {
    // Copy ALL test files from reference directory
    const refFiles = existsSync(refDir)
      ? execSync(`ls "${refDir}"`, { encoding: "utf8" }).trim().split("\n")
      : [];
    for (const f of refFiles) {
      if (f.endsWith(".test.ts")) {
        copyFileSync(join(refDir, f), join(outDir, f));
      }
    }
    // Also copy any existing source files needed for regression tasks (e.g., provided base code)
  } else {
    const testSrc = join(refDir, `${fileName}.test.ts`);
    const testDst = join(outDir, `${fileName}.test.ts`);
    if (existsSync(testSrc)) {
      copyFileSync(testSrc, testDst);
    } else {
      process.stderr.write(`WARN: test file not found: ${testSrc}\n`);
    }
  }

  // Run vitest
  let testResult: TestResult = { passed: 0, total: 0, rawOutput: "" };
  if (isMultiFile) {
    // Run vitest on the entire output directory
    process.stderr.write(`Running vitest on ${outDir}...\n`);
    testResult = runVitest(outDir);
  } else {
    const testDst = join(outDir, `${fileName}.test.ts`);
    if (existsSync(testDst)) {
      process.stderr.write(`Running vitest on ${testDst}...\n`);
      testResult = runVitest(testDst);
    }
  }

  const passRate = testResult.total > 0 ? testResult.passed / testResult.total : 0;

  const verdict: RunVerdict = {
    task: taskId,
    agent: agentId,
    model: modelArg,
    generated: true,
    tests_passed: testResult.passed,
    tests_total: testResult.total,
    pass_rate: Math.round(passRate * 10000) / 10000,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    duration_ms: durationMs,
    verdict: passRate === 1 ? "pass" : "fail",
  };

  console.log(JSON.stringify(verdict, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
