#!/usr/bin/env -S npx tsx
/**
 * Phase 6.5 Part A — Difficulty audit harness.
 *
 * Runs Claude Haiku one-shot on each of the 11 benchmark tasks via the
 * Anthropic Claude Agent SDK (TypeScript). Fully isolated:
 *   - no MCP servers
 *   - no filesystem settings (no CLAUDE.md, no hooks)
 *   - no tools allowed
 *   - custom minimal system prompt
 *   - auth inherited from Claude Code subscription (no API key env var)
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const TASKS: Array<{ id: string; file: string }> = [
  { id: "BL-1",   file: "pricing"   },
  { id: "BL-2",   file: "invoice"   },
  { id: "BL-3",   file: "converter" },
  { id: "BL-4",   file: "prorate"   },
  { id: "BL-5",   file: "inventory" },
  { id: "ALG-1",  file: "search"    },
  { id: "ALG-2",  file: "lru"       },
  { id: "ALG-3",  file: "toposort"  },
  { id: "SAAS-1", file: "rbac"      },
  { id: "SAAS-2", file: "ratelimit" },
  { id: "SAAS-3", file: "account"   },
];

const ROOT = process.cwd();
const OUT_ROOT = join(ROOT, "experiments", "AUDIT_haiku");

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

interface TaskResult {
  task: string;
  file: string;
  generated: boolean;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  cacheCreateTokens?: number;
  cacheReadTokens?: number;
  totalCostUsd?: number;
  durationMs?: number;
  rawLen?: number;
  codeLen?: number;
}

async function runOne(task: { id: string; file: string }): Promise<TaskResult> {
  const specPath = join(ROOT, "references", task.id, "spec.md");
  const spec = readFileSync(specPath, "utf8");
  const prompt =
    `Implement the following TypeScript module exactly as specified. ` +
    `The file name is \`${task.file}.ts\`. Export everything the spec says to export. ` +
    `Do not write tests. Reply with ONLY the TypeScript code inside a single fenced \`\`\`typescript block.\n\n` +
    `## Spec\n\n${spec}`;

  const start = Date.now();
  let assistantText = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let cacheCreate: number | undefined;
  let cacheRead: number | undefined;
  let totalCostUsd: number | undefined;
  let errored: string | undefined;

  try {
    const q = query({
      prompt,
      options: {
        model: "haiku",
        allowedTools: [],
        disallowedTools: [],
        mcpServers: {},
        settingSources: [],
        systemPrompt:
          "You are an expert TypeScript engineer. Reply with code ONLY inside a single fenced ```typescript block. No explanations, no preamble, no trailing prose.",
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
      if (msg.type === "result") {
        const usage = msg.usage;
        if (usage) {
          tokensIn = usage.input_tokens;
          tokensOut = usage.output_tokens;
          cacheCreate = usage.cache_creation_input_tokens;
          cacheRead = usage.cache_read_input_tokens;
        }
        if (typeof msg.total_cost_usd === "number") {
          totalCostUsd = msg.total_cost_usd;
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
    return {
      task: task.id,
      file: task.file,
      generated: false,
      error: errored ?? "empty response",
      tokensIn,
      tokensOut,
      cacheCreateTokens: cacheCreate,
      cacheReadTokens: cacheRead,
      totalCostUsd,
      durationMs,
      rawLen: assistantText.length,
    };
  }

  const code = extractCode(assistantText);
  const outDir = join(OUT_ROOT, task.id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${task.file}.ts`), code, "utf8");
  writeFileSync(join(outDir, `${task.file}.raw.txt`), assistantText, "utf8");
  copyFileSync(
    join(ROOT, "references", task.id, `${task.file}.test.ts`),
    join(outDir, `${task.file}.test.ts`),
  );

  return {
    task: task.id,
    file: task.file,
    generated: true,
    tokensIn,
    tokensOut,
    cacheCreateTokens: cacheCreate,
    cacheReadTokens: cacheRead,
    totalCostUsd,
    durationMs,
    rawLen: assistantText.length,
    codeLen: code.length,
  };
}

async function main() {
  mkdirSync(OUT_ROOT, { recursive: true });
  const results: TaskResult[] = [];
  const overallStart = Date.now();

  for (const t of TASKS) {
    process.stderr.write(`[${t.id}] generating... `);
    const r = await runOne(t);
    results.push(r);
    if (r.generated) {
      process.stderr.write(`ok (${r.durationMs}ms, in=${r.tokensIn} out=${r.tokensOut})\n`);
    } else {
      process.stderr.write(`FAIL (${r.error})\n`);
      // Auth-failure fast-stop: don't hammer 11 times
      if (
        results.length === 1 &&
        r.error &&
        /authentication|unauthor|401|api[_ -]?key|login/i.test(r.error)
      ) {
        process.stderr.write(
          `\nFATAL: first call failed with auth error — aborting to avoid retry storm.\n`,
        );
        writeFileSync(
          join(OUT_ROOT, "generation-log.json"),
          JSON.stringify({ abortedAfterFirstAuthFailure: true, results }, null, 2),
          "utf8",
        );
        process.exit(2);
      }
    }
  }

  const totalWallMs = Date.now() - overallStart;
  const summary = {
    totalWallMs,
    totalTokensIn: results.reduce((s, r) => s + (r.tokensIn ?? 0), 0),
    totalTokensOut: results.reduce((s, r) => s + (r.tokensOut ?? 0), 0),
    totalCostUsd: results.reduce((s, r) => s + (r.totalCostUsd ?? 0), 0),
    generated: results.filter((r) => r.generated).length,
    failed: results.filter((r) => !r.generated).length,
    results,
  };

  writeFileSync(
    join(OUT_ROOT, "generation-log.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
