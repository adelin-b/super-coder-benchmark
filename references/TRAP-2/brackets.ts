export interface BracketResult {
  valid: boolean;
  maxDepth: number;
  overlaps: [string, string][];
}

const OPEN_BRACKETS = new Set(['(', '[', '{']);
const CLOSE_BRACKETS = new Set([')', ']', '}']);
const MATCH_MAP: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
};
const BRACKET_TYPE: Record<string, string> = {
  '(': '()', ')': '()',
  '[': '[]', ']': '[]',
  '{': '{}', '}': '{}',
};

interface OpenEntry {
  char: string;
  index: number;
  matched: boolean;
}

export function validateBrackets(s: string): BracketResult {
  // Track all open brackets with their positions
  const openers: OpenEntry[] = [];
  // Matched pairs: [openIndex, closeIndex, bracketType]
  const pairs: [number, number, string][] = [];
  let maxDepth = 0;
  let currentDepth = 0;
  let valid = true;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (OPEN_BRACKETS.has(ch)) {
      openers.push({ char: ch, index: i, matched: false });
      currentDepth++;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }
    } else if (CLOSE_BRACKETS.has(ch)) {
      const expectedOpen = MATCH_MAP[ch];
      // Find the most recent unmatched opener of the same type (scan backward)
      let found = false;
      for (let j = openers.length - 1; j >= 0; j--) {
        if (!openers[j].matched && openers[j].char === expectedOpen) {
          openers[j].matched = true;
          pairs.push([openers[j].index, i, BRACKET_TYPE[ch]]);
          found = true;
          currentDepth--;
          break;
        }
      }
      if (!found) {
        valid = false;
        // For maxDepth tracking, closing an unmatched bracket doesn't reduce depth
        // but the string is already invalid
      }
    }
  }

  // Check for unmatched openers
  for (const opener of openers) {
    if (!opener.matched) {
      valid = false;
      break;
    }
  }

  // Detect overlapping pairs
  const overlapSet = new Set<string>();
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const [openA, closeA, typeA] = pairs[i];
      const [openB, closeB, typeB] = pairs[j];
      // Check if intervals cross (overlap but neither contains the other fully in a nesting sense)
      // Overlap: openA < openB < closeA < closeB  OR  openB < openA < closeB < closeA
      const crossAB = openA < openB && openB < closeA && closeA < closeB;
      const crossBA = openB < openA && openA < closeB && closeB < closeA;
      if (crossAB || crossBA) {
        const sorted = [typeA, typeB].sort();
        overlapSet.add(`${sorted[0]}|${sorted[1]}`);
      }
    }
  }

  const overlaps: [string, string][] = Array.from(overlapSet)
    .sort()
    .map(key => {
      const [a, b] = key.split('|');
      return [a, b] as [string, string];
    });

  return { valid, maxDepth, overlaps };
}
