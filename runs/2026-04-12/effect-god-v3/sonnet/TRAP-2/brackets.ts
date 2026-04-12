import { Effect, Data, Exit, Cause } from "effect";

export interface BracketResult {
  valid: boolean;
  maxDepth: number;
  overlaps: [string, string][];
}

const OPEN = new Set(["(", "[", "{"]);
const CLOSE_TO_OPEN: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
const CHAR_TO_TYPE: Record<string, string> = {
  "(": "()", ")": "()",
  "[": "[]", "]": "[]",
  "{": "{}", "}": "{}",
};

class ParseFailure extends Data.TaggedError("ParseFailure")<{
  reason: string;
  maxDepth: number;
  overlaps: [string, string][];
}> {}

interface Pair {
  open: number;
  close: number;
  type: string;
}

function computeOverlaps(pairs: Pair[]): [string, string][] {
  const seen = new Set<string>();
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i];
      const b = pairs[j];
      if (a.type === b.type) continue;
      const overlapping =
        (a.open < b.open && b.open < a.close && a.close < b.close) ||
        (b.open < a.open && a.open < b.close && b.close < a.close);
      if (overlapping) {
        const sorted = [a.type, b.type].sort() as [string, string];
        seen.add(sorted[0] + "\0" + sorted[1]);
      }
    }
  }
  return Array.from(seen)
    .map((s) => s.split("\0") as [string, string])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1);
}

const parseEffect = (s: string): Effect.Effect<BracketResult, ParseFailure> =>
  Effect.gen(function* () {
    const stack: { char: string; index: number }[] = [];
    const pairs: Pair[] = [];
    let maxDepth = 0;
    let valid = true;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (OPEN.has(ch)) {
        stack.push({ char: ch, index: i });
        if (stack.length > maxDepth) maxDepth = stack.length;
      } else if (CLOSE_TO_OPEN[ch] !== undefined) {
        const needed = CLOSE_TO_OPEN[ch];
        let foundIdx = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].char === needed) {
            foundIdx = j;
            break;
          }
        }
        if (foundIdx === -1) {
          valid = false;
          const overlaps = computeOverlaps(pairs);
          yield* Effect.fail(
            new ParseFailure({ reason: "unmatched closing bracket", maxDepth, overlaps })
          );
        } else {
          const opener = stack[foundIdx];
          pairs.push({ open: opener.index, close: i, type: CHAR_TO_TYPE[ch] });
          stack.splice(foundIdx, 1);
        }
      }
    }

    if (stack.length > 0) {
      const overlaps = computeOverlaps(pairs);
      yield* Effect.fail(
        new ParseFailure({ reason: "unmatched opening bracket", maxDepth, overlaps })
      );
    }

    return {
      valid: true,
      maxDepth,
      overlaps: computeOverlaps(pairs),
    };
  });

export function validateBrackets(s: string): BracketResult {
  const exit = Effect.runSyncExit(parseEffect(s));
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const raw = Cause.squash(exit.cause);
  if (raw instanceof ParseFailure) {
    return {
      valid: false,
      maxDepth: raw.maxDepth,
      overlaps: raw.overlaps,
    };
  }
  return { valid: false, maxDepth: 0, overlaps: [] };
}