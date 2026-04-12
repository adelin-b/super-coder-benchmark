import { Effect, Data, Exit, Cause } from "effect";

// ── Primitives ────────────────────────────────────────────────────────────────

type Prim = "+" | "-" | "*" | "/" | "dup" | "drop" | "swap" | "over";
type Atom = number | Prim;

const PRIMS = new Set<string>(["+", "-", "*", "/", "dup", "drop", "swap", "over"]);

function isPrim(s: string): s is Prim {
  return PRIMS.has(s);
}

// ── Tagged errors (internal) ──────────────────────────────────────────────────

class StackEmpty extends Data.TaggedError("StackEmpty")<{}> {}
class OneValue extends Data.TaggedError("OneValue")<{}> {}
class DivByZero extends Data.TaggedError("DivByZero")<{}> {}
class UnknownCmd extends Data.TaggedError("UnknownCmd")<{}> {}
class InvalidDef extends Data.TaggedError("InvalidDef")<{}> {}

type ForthError = StackEmpty | OneValue | DivByZero | UnknownCmd | InvalidDef;

// ── Public exported class ─────────────────────────────────────────────────────

export class Forth {
  public stack: number[] = [];
  private dict: Map<string, Atom[]> = new Map();

  evaluate(program: string): void {
    const exit = Effect.runSyncExit(this.evalEffect(program));
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause) as ForthError;
      switch (raw._tag) {
        case "StackEmpty":  throw new Error("Stack empty");
        case "OneValue":    throw new Error("Only one value on the stack");
        case "DivByZero":   throw new Error("Division by zero");
        case "UnknownCmd":  throw new Error("Unknown command");
        case "InvalidDef":  throw new Error("Invalid definition");
        default:            throw new Error(String(raw));
      }
    }
  }

  // ── Effect implementation ─────────────────────────────────────────────────

  private evalEffect(program: string): Effect.Effect<void, ForthError> {
    return Effect.gen(this, function* () {
      const tokens = tokenize(program);
      let i = 0;

      while (i < tokens.length) {
        const tok = tokens[i];

        if (tok === ":") {
          // ── Word definition ────────────────────────────────────────────
          i++;
          if (i >= tokens.length) yield* Effect.fail(new UnknownCmd());
          const name = tokens[i].toLowerCase();

          if (/^\d+$/.test(name)) yield* Effect.fail(new InvalidDef());

          i++;
          const body: Atom[] = [];

          while (i < tokens.length && tokens[i] !== ";") {
            const expanded = yield* this.expandToken(tokens[i]);
            for (const a of expanded) body.push(a);
            i++;
          }

          this.dict.set(name, body);
          i++; // skip ';'
        } else {
          // ── Execute token ──────────────────────────────────────────────
          const atoms = yield* this.expandToken(tok);
          for (const a of atoms) {
            yield* this.execAtom(a);
          }
          i++;
        }
      }
    });
  }

  /** Expand a source token into a flat sequence of Atoms at definition time. */
  private expandToken(token: string): Effect.Effect<Atom[], ForthError> {
    return Effect.gen(this, function* () {
      const lower = token.toLowerCase();

      if (/^\d+$/.test(lower)) {
        return [parseInt(token, 10) as Atom];
      }

      if (this.dict.has(lower)) {
        return [...this.dict.get(lower)!];
      }

      if (isPrim(lower)) {
        return [lower];
      }

      yield* Effect.fail(new UnknownCmd());
      return [] as Atom[]; // unreachable
    });
  }

  /** Execute a single resolved Atom against the stack. */
  private execAtom(atom: Atom): Effect.Effect<void, ForthError> {
    return Effect.gen(this, function* () {
      if (typeof atom === "number") {
        this.stack.push(atom);
        return;
      }

      switch (atom) {
        // ── Binary arithmetic ───────────────────────────────────────────
        case "+":
        case "-":
        case "*":
        case "/": {
          if (this.stack.length === 0) yield* Effect.fail(new StackEmpty());
          if (this.stack.length < 2)  yield* Effect.fail(new OneValue());
          const b = this.stack.pop()!;
          const a = this.stack.pop()!;
          if (atom === "+") { this.stack.push(a + b); break; }
          if (atom === "-") { this.stack.push(a - b); break; }
          if (atom === "*") { this.stack.push(a * b); break; }
          // division
          if (b === 0) yield* Effect.fail(new DivByZero());
          this.stack.push(Math.trunc(a / b));
          break;
        }

        // ── Stack manipulation ──────────────────────────────────────────
        case "dup": {
          if (this.stack.length === 0) yield* Effect.fail(new StackEmpty());
          this.stack.push(this.stack[this.stack.length - 1]);
          break;
        }
        case "drop": {
          if (this.stack.length === 0) yield* Effect.fail(new StackEmpty());
          this.stack.pop();
          break;
        }
        case "swap": {
          if (this.stack.length === 0) yield* Effect.fail(new StackEmpty());
          if (this.stack.length < 2)  yield* Effect.fail(new OneValue());
          const top    = this.stack.pop()!;
          const second = this.stack.pop()!;
          this.stack.push(top);
          this.stack.push(second);
          break;
        }
        case "over": {
          if (this.stack.length === 0) yield* Effect.fail(new StackEmpty());
          if (this.stack.length < 2)  yield* Effect.fail(new OneValue());
          this.stack.push(this.stack[this.stack.length - 2]);
          break;
        }
      }
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tokenize(program: string): string[] {
  return program.trim().split(/\s+/).filter((t) => t.length > 0);
}