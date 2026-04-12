import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { validate, createValidator } from "./schema-infer";

/**
 * WEB-TS-12: JSON Schema to TypeScript Type
 * Tests verify both runtime validation and type-level inference.
 */

const IMPL_PATH = join(__dirname, "schema-infer.ts");
const TSC = join(__dirname, "..", "..", "node_modules", ".bin", "tsc");

function compilesOk(code: string): boolean {
  const dir = join(
    tmpdir(),
    `web-ts-12-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    include: ["case.ts", "schema-infer.ts"],
  };
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, "schema-infer.ts"));
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

describe("WEB-TS-12: JSON Schema to TypeScript Type", () => {
  // ─── Runtime validation tests ──────────────────────────────────────────

  it("runtime: validates string type", () => {
    const schema = { type: "string" } as const;
    const result = validate(schema, "hello");
    expect(result.success).toBe(true);
  });

  it("runtime: rejects non-string for string type", () => {
    const schema = { type: "string" } as const;
    const result = validate(schema, 42);
    expect(result.success).toBe(false);
  });

  it("runtime: validates number type", () => {
    const schema = { type: "number" } as const;
    expect(validate(schema, 42).success).toBe(true);
    expect(validate(schema, "str").success).toBe(false);
  });

  it("runtime: validates boolean type", () => {
    const schema = { type: "boolean" } as const;
    expect(validate(schema, true).success).toBe(true);
    expect(validate(schema, "yes").success).toBe(false);
  });

  it("runtime: validates null type", () => {
    const schema = { type: "null" } as const;
    expect(validate(schema, null).success).toBe(true);
    expect(validate(schema, undefined).success).toBe(false);
  });

  it("runtime: validates array type", () => {
    const schema = { type: "array", items: { type: "number" } } as const;
    expect(validate(schema, [1, 2, 3]).success).toBe(true);
    expect(validate(schema, [1, "two", 3]).success).toBe(false);
    expect(validate(schema, "not array").success).toBe(false);
  });

  it("runtime: validates object with required", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    } as const;
    expect(validate(schema, { name: "Alice", age: 30 }).success).toBe(true);
    expect(validate(schema, { name: "Alice" }).success).toBe(true);
    expect(validate(schema, { age: 30 }).success).toBe(false); // missing required
  });

  it("runtime: validates enum", () => {
    const schema = { enum: ["red", "green", "blue"] } as const;
    expect(validate(schema, "red").success).toBe(true);
    expect(validate(schema, "yellow").success).toBe(false);
  });

  it("runtime: validates nullable", () => {
    const schema = { type: "string", nullable: true } as const;
    expect(validate(schema, "hello").success).toBe(true);
    expect(validate(schema, null).success).toBe(true);
    expect(validate(schema, 42).success).toBe(false);
  });

  it("runtime: createValidator returns type guard", () => {
    const schema = { type: "string" } as const;
    const isString = createValidator(schema);
    expect(isString("hello")).toBe(true);
    expect(isString(42)).toBe(false);
  });

  // ─── Type-level tests ──────────────────────────────────────────────────

  it("type: InferSchema string resolves to string", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { type: "string" } as const
      type T = InferSchema<typeof schema>
      const x: T = "hello"
    `)
    ).toBe(true);
  });

  it("type: InferSchema string rejects number", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { type: "string" } as const
      type T = InferSchema<typeof schema>
      const x: T = 42
    `)
    ).toBe(false);
  });

  it("type: InferSchema object with required makes keys mandatory", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      } as const
      type T = InferSchema<typeof schema>
      // name is required, age is optional
      const valid: T = { name: "Alice" }
    `)
    ).toBe(true);
  });

  it("type: InferSchema object rejects missing required key", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      } as const
      type T = InferSchema<typeof schema>
      const invalid: T = { age: 30 }
    `)
    ).toBe(false);
  });

  it("type: InferSchema array infers element type", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { type: "array", items: { type: "number" } } as const
      type T = InferSchema<typeof schema>
      const x: T = [1, 2, 3]
    `)
    ).toBe(true);
  });

  it("type: InferSchema array rejects wrong element type", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { type: "array", items: { type: "number" } } as const
      type T = InferSchema<typeof schema>
      const x: T = ["not", "numbers"]
    `)
    ).toBe(false);
  });

  it("type: InferSchema enum produces literal union", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { enum: ["red", "green", "blue"] } as const
      type T = InferSchema<typeof schema>
      const x: T = "red"
      const y: T = "green"
    `)
    ).toBe(true);
  });

  it("type: InferSchema enum rejects non-member", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { enum: ["red", "green", "blue"] } as const
      type T = InferSchema<typeof schema>
      const x: T = "yellow"
    `)
    ).toBe(false);
  });

  it("type: InferSchema nullable adds null", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = { type: "string", nullable: true } as const
      type T = InferSchema<typeof schema>
      const a: T = "hello"
      const b: T = null
    `)
    ).toBe(true);
  });

  it("type: InferSchema nested object with array", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "tags"],
      } as const
      type T = InferSchema<typeof schema>
      const x: T = { name: "test", tags: ["a", "b"] }
    `)
    ).toBe(true);
  });

  it("type: InferSchema oneOf produces union", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = {
        oneOf: [
          { type: "string" },
          { type: "number" },
        ],
      } as const
      type T = InferSchema<typeof schema>
      const a: T = "hello"
      const b: T = 42
    `)
    ).toBe(true);
  });

  it("type: InferSchema allOf produces intersection", () => {
    expect(
      compilesOk(`
      import { InferSchema } from './schema-infer'
      const schema = {
        allOf: [
          { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
          { type: "object", properties: { age: { type: "number" } }, required: ["age"] },
        ],
      } as const
      type T = InferSchema<typeof schema>
      const x: T = { name: "Alice", age: 30 }
    `)
    ).toBe(true);
  });
});
