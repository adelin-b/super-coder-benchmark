import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { deepFlatten, deepUnflatten } from "./deep-flatten";

/**
 * WEB-TS-9: Deep Recursive Type Flattening
 * Tests verify both runtime behavior and type-level correctness.
 */

const IMPL_PATH = join(__dirname, "deep-flatten.ts");
const TSC = join(__dirname, "..", "..", "node_modules", ".bin", "tsc");

function compilesOk(code: string): boolean {
  const dir = join(
    tmpdir(),
    `web-ts-9-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "ES2020",
      module: "commonjs",
      moduleResolution: "node",
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["case.ts", "deep-flatten.ts"],
  };
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, "deep-flatten.ts"));
  writeFileSync(join(dir, "case.ts"), code);
  try {
    execSync(`${TSC} --project ${join(dir, "tsconfig.json")}`, {
      cwd: dir,
      stdio: "pipe",
      timeout: 30000,
    });
    return true;
  } catch {
    return false;
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

describe("WEB-TS-9: Deep Recursive Type Flattening", () => {
  // ─── Runtime tests ──────────────────────────────────────────────────────

  it("runtime: flattens a simple nested object", () => {
    const input = { a: { b: { c: 1 } }, d: "hello" };
    const result = deepFlatten(input);
    expect(result).toEqual({ "a.b.c": 1, d: "hello" });
  });

  it("runtime: flattens 4 levels deep", () => {
    const input = { a: { b: { c: { d: { e: 42 } } } } };
    const result = deepFlatten(input);
    expect(result).toEqual({ "a.b.c.d.e": 42 });
  });

  it("runtime: treats arrays as leaf values", () => {
    const input = { a: { b: [1, 2, 3] }, c: "str" };
    const result = deepFlatten(input);
    expect(result).toEqual({ "a.b": [1, 2, 3], c: "str" });
  });

  it("runtime: treats Date as leaf value", () => {
    const date = new Date("2024-01-01");
    const input = { a: { created: date } };
    const result = deepFlatten(input);
    expect(result).toEqual({ "a.created": date });
  });

  it("runtime: treats RegExp as leaf value", () => {
    const re = /test/g;
    const input = { config: { pattern: re } };
    const result = deepFlatten(input);
    expect(result).toEqual({ "config.pattern": re });
  });

  it("runtime: handles empty object", () => {
    const result = deepFlatten({});
    expect(result).toEqual({});
  });

  it("runtime: handles flat object (no nesting)", () => {
    const input = { a: 1, b: "two", c: true };
    const result = deepFlatten(input);
    expect(result).toEqual({ a: 1, b: "two", c: true });
  });

  it("runtime: handles null and undefined leaf values", () => {
    const input = { a: { b: null, c: undefined } };
    const result = deepFlatten(input as any);
    expect(result).toEqual({ "a.b": null, "a.c": undefined });
  });

  it("runtime: unflatten reverses flatten", () => {
    const input = { a: { b: { c: 1 } }, d: "hello", e: { f: true } };
    const flat = deepFlatten(input);
    const unflat = deepUnflatten(flat);
    expect(unflat).toEqual(input);
  });

  it("runtime: unflatten handles multiple branches", () => {
    const flat = {
      "a.b.c": 1,
      "a.b.d": 2,
      "a.e": 3,
      f: 4,
    };
    const result = deepUnflatten(flat);
    expect(result).toEqual({
      a: { b: { c: 1, d: 2 }, e: 3 },
      f: 4,
    });
  });

  // ─── Type-level tests ──────────────────────────────────────────────────

  it("type: DeepFlatten produces dot-notation keys", () => {
    expect(
      compilesOk(`
      import { DeepFlatten } from './deep-flatten'
      type Input = { a: { b: { c: number } }, d: string }
      type Flat = DeepFlatten<Input>
      const x: Flat = { "a.b.c": 42, "d": "hello" }
    `)
    ).toBe(true);
  });

  it("type: DeepFlatten rejects wrong value type at leaf", () => {
    expect(
      compilesOk(`
      import { DeepFlatten } from './deep-flatten'
      type Input = { a: { b: { c: number } }, d: string }
      type Flat = DeepFlatten<Input>
      const x: Flat = { "a.b.c": "wrong", "d": "hello" }
    `)
    ).toBe(false);
  });

  it("type: DeepFlatten rejects non-flattened key", () => {
    expect(
      compilesOk(`
      import { DeepFlatten } from './deep-flatten'
      type Input = { a: { b: number } }
      type Flat = DeepFlatten<Input>
      // 'a' should not exist as a key, only 'a.b'
      const x: Flat = { a: { b: 1 } } as any
      const check: string = x.a  // should error: 'a' doesn't exist
    `)
    ).toBe(false);
  });

  it("type: DeepFlatten preserves array types as leaves", () => {
    expect(
      compilesOk(`
      import { DeepFlatten } from './deep-flatten'
      type Input = { a: { items: string[] } }
      type Flat = DeepFlatten<Input>
      const x: Flat = { "a.items": ["hello"] }
    `)
    ).toBe(true);
  });

  it("type: DeepUnflatten reconstructs nested type", () => {
    expect(
      compilesOk(`
      import { DeepUnflatten } from './deep-flatten'
      type Flat = { "a.b.c": number, "d": string }
      type Nested = DeepUnflatten<Flat>
      const x: Nested = { a: { b: { c: 42 } }, d: "hello" }
    `)
    ).toBe(true);
  });

  it("type: DeepUnflatten rejects wrong nested shape", () => {
    expect(
      compilesOk(`
      import { DeepUnflatten } from './deep-flatten'
      type Flat = { "a.b.c": number, "d": string }
      type Nested = DeepUnflatten<Flat>
      const x: Nested = { a: { b: { c: "wrong" } }, d: "hello" }
    `)
    ).toBe(false);
  });

  it("type: deepFlatten return type matches DeepFlatten", () => {
    expect(
      compilesOk(`
      import { deepFlatten, DeepFlatten } from './deep-flatten'
      const input = { a: { b: 1 }, c: "str" } as const
      const result = deepFlatten(input)
      // result should have 'a.b' and 'c' keys
      const ab: number = result["a.b"]
      const c: string = result["c"]
    `)
    ).toBe(true);
  });

  it("type: deepFlatten rejects accessing original nested keys", () => {
    expect(
      compilesOk(`
      import { deepFlatten } from './deep-flatten'
      const input = { a: { b: 1 }, c: "str" } as const
      const result = deepFlatten(input)
      // 'a' should not be accessible as a key on the flattened result
      const a: any = result["a"]
    `)
    ).toBe(false);
  });
});
