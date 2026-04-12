import { describe, it, expect, vi } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createEmitter } from "./typed-events";

/**
 * WEB-TS-13: Type-Safe Event Emitter with Inference
 * Tests verify both runtime behavior and type-level correctness.
 */

const IMPL_PATH = join(__dirname, "typed-events.ts");
const TSC = join(__dirname, "..", "..", "node_modules", ".bin", "tsc");

function compilesOk(code: string): boolean {
  const dir = join(
    tmpdir(),
    `web-ts-13-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    include: ["case.ts", "typed-events.ts"],
  };
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, "typed-events.ts"));
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

type TestEvents = {
  click: [x: number, y: number];
  message: [text: string, sender: string];
  "user.created": [user: { id: number; name: string }];
  "user.deleted": [userId: number];
  disconnect: [];
};

describe("WEB-TS-13: Type-Safe Event Emitter with Inference", () => {
  // ─── Runtime tests ──────────────────────────────────────────────────────

  it("runtime: on and emit basic event", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.on("click", fn);
    emitter.emit("click", 10, 20);
    expect(fn).toHaveBeenCalledWith(10, 20);
  });

  it("runtime: emit returns true when listeners exist", () => {
    const emitter = createEmitter<TestEvents>();
    emitter.on("click", () => {});
    expect(emitter.emit("click", 1, 2)).toBe(true);
  });

  it("runtime: emit returns false when no listeners", () => {
    const emitter = createEmitter<TestEvents>();
    expect(emitter.emit("click", 1, 2)).toBe(false);
  });

  it("runtime: once listener fires only once", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.once("click", fn);
    emitter.emit("click", 1, 2);
    emitter.emit("click", 3, 4);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2);
  });

  it("runtime: off removes listener", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.on("click", fn);
    emitter.off("click", fn);
    emitter.emit("click", 1, 2);
    expect(fn).not.toHaveBeenCalled();
  });

  it("runtime: multiple listeners on same event", () => {
    const emitter = createEmitter<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("message", fn1);
    emitter.on("message", fn2);
    emitter.emit("message", "hello", "alice");
    expect(fn1).toHaveBeenCalledWith("hello", "alice");
    expect(fn2).toHaveBeenCalledWith("hello", "alice");
  });

  it("runtime: zero-arg event", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.on("disconnect", fn);
    emitter.emit("disconnect");
    expect(fn).toHaveBeenCalledWith();
  });

  it("runtime: wildcard listener receives all events", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.onAny(fn);
    emitter.emit("click", 1, 2);
    emitter.emit("disconnect");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("click", 1, 2);
    expect(fn).toHaveBeenCalledWith("disconnect");
  });

  it("runtime: offAny removes wildcard listener", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.onAny(fn);
    emitter.offAny(fn);
    emitter.emit("click", 1, 2);
    expect(fn).not.toHaveBeenCalled();
  });

  it("runtime: namespace listener fires for matching events", () => {
    const emitter = createEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.onNamespace("user", fn);
    emitter.emit("user.created", { id: 1, name: "Alice" });
    emitter.emit("user.deleted", 1);
    emitter.emit("click", 1, 2); // should NOT trigger
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("runtime: listenerCount returns correct count", () => {
    const emitter = createEmitter<TestEvents>();
    expect(emitter.listenerCount("click")).toBe(0);
    emitter.on("click", () => {});
    emitter.on("click", () => {});
    expect(emitter.listenerCount("click")).toBe(2);
  });

  it("runtime: removeAllListeners for specific event", () => {
    const emitter = createEmitter<TestEvents>();
    emitter.on("click", () => {});
    emitter.on("click", () => {});
    emitter.on("message", () => {});
    emitter.removeAllListeners("click");
    expect(emitter.listenerCount("click")).toBe(0);
    expect(emitter.listenerCount("message")).toBe(1);
  });

  it("runtime: removeAllListeners with no arg clears everything", () => {
    const emitter = createEmitter<TestEvents>();
    emitter.on("click", () => {});
    emitter.on("message", () => {});
    emitter.onAny(() => {});
    emitter.removeAllListeners();
    expect(emitter.listenerCount("click")).toBe(0);
    expect(emitter.listenerCount("message")).toBe(0);
  });

  // ─── Type-level tests ──────────────────────────────────────────────────

  it("type: on infers listener parameter types", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { click: [x: number, y: number]; message: [text: string] }
      const e = createEmitter<Events>()
      e.on('click', (x, y) => {
        const a: number = x
        const b: number = y
      })
    `)
    ).toBe(true);
  });

  it("type: on rejects invalid event name", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { click: [x: number, y: number] }
      const e = createEmitter<Events>()
      e.on('nonexistent', () => {})
    `)
    ).toBe(false);
  });

  it("type: emit enforces correct arg types", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { click: [x: number, y: number] }
      const e = createEmitter<Events>()
      e.emit('click', 1, 2)
    `)
    ).toBe(true);
  });

  it("type: emit rejects wrong arg types", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { click: [x: number, y: number] }
      const e = createEmitter<Events>()
      e.emit('click', 'wrong', 2)
    `)
    ).toBe(false);
  });

  it("type: emit rejects extra args", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { click: [x: number, y: number] }
      const e = createEmitter<Events>()
      e.emit('click', 1, 2, 3)
    `)
    ).toBe(false);
  });

  it("type: emit rejects invalid event name", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { click: [x: number, y: number] }
      const e = createEmitter<Events>()
      e.emit('nonexistent')
    `)
    ).toBe(false);
  });

  it("type: zero-arg event requires no extra args", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { disconnect: [] }
      const e = createEmitter<Events>()
      e.emit('disconnect')
    `)
    ).toBe(true);
  });

  it("type: zero-arg event rejects args", () => {
    expect(
      compilesOk(`
      import { createEmitter } from './typed-events'
      type Events = { disconnect: [] }
      const e = createEmitter<Events>()
      e.emit('disconnect', 'extra')
    `)
    ).toBe(false);
  });
});
