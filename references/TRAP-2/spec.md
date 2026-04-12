# TRAP-2: Validate Brackets

## Overview
Implement a bracket validator that handles **overlapping** bracket pairs. Unlike traditional bracket matching where brackets must be properly nested, this validator allows brackets to **cross** each other. For example, `[{]}` is **valid** — the `[` closes with `]` and `{` closes with `}`, even though they overlap.

## Exported API

```ts
export interface BracketResult {
  /** Whether all brackets are properly paired (overlapping is allowed) */
  valid: boolean;
  /** Maximum nesting/overlapping depth at any point */
  maxDepth: number;
  /** Pairs of bracket types that cross/overlap each other, sorted */
  overlaps: [string, string][];
}

export function validateBrackets(s: string): BracketResult;
```

## Detailed Requirements

### Bracket Types
Three bracket types are recognized:
- `()` — parentheses
- `[]` — square brackets
- `{}` — curly braces

Non-bracket characters are ignored.

### Matching Rules
- Each opening bracket must be paired with the **nearest** subsequent matching closing bracket that has not already been paired.
- Brackets CAN overlap. `[{]}` is valid: `[...]` spans positions 0-2, `{...}` spans positions 1-3. They overlap.
- A bracket string is **invalid** only when there are unmatched opening or closing brackets.
- An empty string is valid with maxDepth 0 and no overlaps.

### Matching Algorithm
- Process characters left to right.
- When encountering an opening bracket, push it onto a tracking structure with its index.
- When encountering a closing bracket, find the **most recent unmatched** opening bracket of the **same type** (scanning backward through unmatched openers). If found, pair them. If not found, the string is invalid.
- After processing all characters, if any opening brackets remain unmatched, the string is invalid.

### Max Depth
- The "depth" at any character position is the number of currently open (unmatched) brackets at that point.
- `maxDepth` is the maximum depth observed while scanning left to right.
- For an empty string, maxDepth is 0.

### Overlaps Detection
- Two bracket pairs **overlap** if their intervals cross: one opens before the other but closes after the other opens and before the other closes. Formally, pair A = [openA, closeA] and pair B = [openB, closeB] overlap if `openA < openB < closeA < closeB` or `openB < openA < closeB < closeA`.
- Report each overlapping combination of bracket **types** (not positions). E.g., if `[]` and `{}` overlap, report `["[]", "{}"]`.
- Each type pair appears at most once in the result.
- Sort each pair alphabetically: `["()", "[]"]` not `["[]", "()"]`.
- Sort the overlaps array lexicographically.

### Edge Cases
- Strings with only non-bracket characters: valid, maxDepth 0, no overlaps.
- Deeply nested same-type brackets: `[[[]]]` — valid, maxDepth 3, no overlaps.
- Multiple overlaps: `[{(]})` — three different bracket type pairs overlap.
- Consecutive non-overlapping pairs: `[]{}()` — valid, maxDepth 1, no overlaps.

## Invariants
1. If valid is false, maxDepth and overlaps still reflect partial parsing up to the point of failure.
2. Overlaps only contain pairs from `["()", "[]", "{}"]`.
3. No duplicate pairs in overlaps.
4. Each pair in overlaps is sorted alphabetically, and the array itself is sorted.
