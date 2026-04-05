/**
 * Improver prompt templates for the Karpathy autoresearch loop.
 *
 * The improver is a Claude call that analyzes test failures from the current
 * iteration and proposes a REVISED system prompt to address them. It never
 * modifies implementation code — only the instructions given to the generator.
 */

export interface TaskFailure {
  taskId: string;
  testsPassed: number;
  testsTotal: number;
  /** Raw vitest output (truncated to keep context manageable) */
  rawOutput: string;
}

export interface ImproverInput {
  currentPrompt: string;
  contextBundlePaths: string[];
  failures: TaskFailure[];
  iterationNumber: number;
  previousScores: number[];
}

/**
 * Build the system prompt for the improver Claude call.
 */
export function buildImproverSystemPrompt(): string {
  return `You are an expert prompt engineer specializing in AI coding assistants.

Your job: analyze test failures from a code-generation agent and produce a REVISED system prompt that will make the agent generate better code on the next iteration.

Rules:
1. You can ONLY change the system prompt text. You cannot change the code, tests, or context bundles.
2. Be specific about failure patterns. If tests fail because of missing edge cases, tell the agent to handle those edges. If tests fail because of wrong return types, specify the types.
3. Keep the prompt concise but precise — long, rambling prompts hurt performance.
4. Preserve any instructions that are working well (tests that already pass).
5. Add concrete examples or patterns when they would help.
6. Do NOT include meta-commentary. Output ONLY the revised system prompt text.
7. The prompt should be generic enough to work across different tasks, not overfit to one specific task.`;
}

/**
 * Build the user prompt for the improver Claude call.
 */
export function buildImproverUserPrompt(input: ImproverInput): string {
  const { currentPrompt, failures, iterationNumber, previousScores } = input;

  const failureSummaries = failures.map((f) => {
    // Truncate raw output to avoid blowing up context
    const maxOutput = 2000;
    const truncated =
      f.rawOutput.length > maxOutput
        ? f.rawOutput.slice(0, maxOutput) + "\n... [truncated]"
        : f.rawOutput;

    return `### Task: ${f.taskId}
- Tests passed: ${f.testsPassed}/${f.testsTotal}
- Pass rate: ${f.testsTotal > 0 ? ((f.testsPassed / f.testsTotal) * 100).toFixed(1) : 0}%
- Test output:
\`\`\`
${truncated}
\`\`\``;
  });

  const scoreHistory =
    previousScores.length > 0
      ? `\nScore history: ${previousScores.map((s, i) => `iter ${i}: ${(s * 100).toFixed(1)}%`).join(", ")}`
      : "";

  return `## Iteration ${iterationNumber}
${scoreHistory}

## Current System Prompt

\`\`\`
${currentPrompt}
\`\`\`

## Test Results (failures and partial passes)

${failureSummaries.join("\n\n")}

## Your Task

Analyze the test failures above. Identify patterns in what went wrong. Then output a REVISED system prompt that addresses these issues.

The revised prompt should:
- Fix the identified failure patterns
- Retain instructions that are working (for tasks that passed)
- Be specific about edge cases, return types, error handling, etc.
- Stay general enough to work across different task types

Output ONLY the revised system prompt text, nothing else.`;
}
