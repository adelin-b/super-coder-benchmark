import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { pipe } from "./pipe";

/**
 * WEB-TS-11: Variadic Pipe with Type Inference
 * Tests verify both runtime behavior and type-level correctness.
 */

const IMPL_PATH = join(__dirname, "pipe.ts");
const TSC = join(__dirname, "..", "..", "node_modules", ".bin", "tsc");

function compilesOk(code: string): boolean {
  const dir = join(
    tmpdir(),
    `web-ts-11-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    include: ["case.ts", "pipe.ts"],
  };
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, "pipe.ts"));
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

describe("WEB-TS-11: Variadic Pipe with Type Inference", () => {
  // ─── Runtime tests ──────────────────────────────────────────────────────

  it("runtime: single function pipe", () => {
    const double = pipe((x: number) => x * 2);
    expect(double(5)).toBe(10);
  });

  it("runtime: two function pipe", () => {
    const transform = pipe(
      (x: number) => x.toString(),
      (s: string) => s.length
    );
    expect(transform(123)).toBe(3);
  });

  it("runtime: three function pipe", () => {
    const transform = pipe(
      (x: number) => x + 1,
      (x: number) => x * 2,
      (x: number) => `result: ${x}`
    );
    expect(transform(4)).toBe("result: 10");
  });

  it("runtime: async function in pipe", async () => {
    const transform = pipe(
      (x: number) => Promise.resolve(x * 2),
      (x: number) => x + 1
    );
    const result = await transform(5);
    expect(result).toBe(11);
  });

  it("runtime: async in middle of pipe", async () => {
    const transform = pipe(
      (x: number) => x.toString(),
      (s: string) => Promise.resolve(s.length),
      (n: number) => n > 2
    );
    const result = await transform(1234);
    expect(result).toBe(true);
  });

  it("runtime: all sync pipe stays sync", () => {
    const transform = pipe(
      (x: number) => x + 1,
      (x: number) => x * 2
    );
    const result = transform(3);
    // Should NOT be a promise
    expect(result).toBe(8);
    expect(result instanceof Promise).toBe(false);
  });

  it("runtime: error propagation", () => {
    const transform = pipe(
      (x: number) => {
        if (x < 0) throw new Error("negative");
        return x;
      },
      (x: number) => x * 2
    );
    expect(() => transform(-1)).toThrow("negative");
  });

  it("runtime: async error propagation", async () => {
    const transform = pipe(
      (x: number) => Promise.reject(new Error("async fail")),
      (x: number) => x * 2
    );
    await expect(transform(1)).rejects.toThrow("async fail");
  });

  // ─── Type-level tests ──────────────────────────────────────────────────

  it("type: infers return type from chain", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      const fn = pipe(
        (x: number) => x.toString(),
        (s: string) => s.length
      )
      const result: number = fn(42)
    `)
    ).toBe(true);
  });

  it("type: rejects incompatible chain", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      // number -> string, but next expects number, not string
      const fn = pipe(
        (x: number) => x.toString(),
        (n: number) => n + 1
      )
    `)
    ).toBe(false);
  });

  it("type: async pipe returns Promise", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      const fn = pipe(
        (x: number) => Promise.resolve(x.toString()),
        (s: string) => s.length
      )
      // Return should be Promise<number>
      const result: Promise<number> = fn(42)
    `)
    ).toBe(true);
  });

  it("type: async pipe result is not assignable to sync type", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      const fn = pipe(
        (x: number) => Promise.resolve(x.toString()),
        (s: string) => s.length
      )
      // Should fail: result is Promise<number>, not number
      const result: number = fn(42)
    `)
    ).toBe(false);
  });

  it("type: sync pipe result is not Promise", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      const fn = pipe(
        (x: number) => x + 1,
        (x: number) => x.toString()
      )
      const result: string = fn(42)
    `)
    ).toBe(true);
  });

  it("type: single function pipe preserves types", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      const fn = pipe((x: number) => x.toString())
      const result: string = fn(42)
    `)
    ).toBe(true);
  });

  it("type: 5-function chain infers correctly", () => {
    expect(
      compilesOk(`
      import { pipe } from './pipe'
      const fn = pipe(
        (x: number) => x + 1,
        (x: number) => x.toString(),
        (s: string) => s.split(''),
        (arr: string[]) => arr.length,
        (n: number) => n > 0
      )
      const result: boolean = fn(42)
    `)
    ).toBe(true);
  });
});
