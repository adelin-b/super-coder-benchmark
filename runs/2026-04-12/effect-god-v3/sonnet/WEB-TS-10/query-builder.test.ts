import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createQueryBuilder } from "./query-builder";

/**
 * WEB-TS-10: Type-Safe SQL Query Builder
 * Tests verify both runtime SQL generation and type-level correctness.
 */

const IMPL_PATH = join(__dirname, "query-builder.ts");
const TSC = join(__dirname, "..", "..", "node_modules", ".bin", "tsc");

function compilesOk(code: string): boolean {
  const dir = join(
    tmpdir(),
    `web-ts-10-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    include: ["case.ts", "query-builder.ts"],
  };
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, "query-builder.ts"));
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

const schema = {
  users: {} as { id: number; name: string; age: number; email: string },
  posts: {} as { id: number; title: string; body: string; author_id: number },
};

describe("WEB-TS-10: Type-Safe SQL Query Builder", () => {
  // ─── Runtime tests ──────────────────────────────────────────────────────

  it("runtime: basic select all", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb.from("users").build();
    expect(sql).toBe("SELECT * FROM users");
  });

  it("runtime: select specific columns", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb.from("users").select("name", "age").build();
    expect(sql).toBe("SELECT name, age FROM users");
  });

  it("runtime: where clause with string", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb
      .from("users")
      .select("name")
      .where("name", "=", "Alice")
      .build();
    expect(sql).toBe("SELECT name FROM users WHERE name = 'Alice'");
  });

  it("runtime: where clause with number", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb
      .from("users")
      .select("name", "age")
      .where("age", ">", 18)
      .build();
    expect(sql).toBe("SELECT name, age FROM users WHERE age > 18");
  });

  it("runtime: multiple where clauses", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb
      .from("users")
      .where("age", ">=", 18)
      .where("name", "!=", "Bob")
      .build();
    expect(sql).toBe(
      "SELECT * FROM users WHERE age >= 18 AND name != 'Bob'"
    );
  });

  it("runtime: order by", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb.from("users").select("name").orderBy("name", "desc").build();
    expect(sql).toBe("SELECT name FROM users ORDER BY name DESC");
  });

  it("runtime: limit", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb.from("users").select("name").limit(10).build();
    expect(sql).toBe("SELECT name FROM users LIMIT 10");
  });

  it("runtime: full chain", () => {
    const qb = createQueryBuilder(schema);
    const sql = qb
      .from("posts")
      .select("title", "body")
      .where("author_id", "=", 1)
      .orderBy("title", "asc")
      .limit(5)
      .build();
    expect(sql).toBe(
      "SELECT title, body FROM posts WHERE author_id = 1 ORDER BY title ASC LIMIT 5"
    );
  });

  // ─── Type-level tests ──────────────────────────────────────────────────

  it("type: select valid columns compiles", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number; email: string },
      }
      const qb = createQueryBuilder(schema)
      qb.from('users').select('name', 'age')
    `)
    ).toBe(true);
  });

  it("type: select invalid column fails to compile", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number },
      }
      const qb = createQueryBuilder(schema)
      qb.from('users').select('nonexistent')
    `)
    ).toBe(false);
  });

  it("type: where with wrong value type fails to compile", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number },
      }
      const qb = createQueryBuilder(schema)
      qb.from('users').where('age', '>', 'not-a-number')
    `)
    ).toBe(false);
  });

  it("type: where with invalid column fails to compile", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number },
      }
      const qb = createQueryBuilder(schema)
      qb.from('users').where('nonexistent', '=', 1)
    `)
    ).toBe(false);
  });

  it("type: from with invalid table fails to compile", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string },
      }
      const qb = createQueryBuilder(schema)
      qb.from('nonexistent')
    `)
    ).toBe(false);
  });

  it("type: execute returns Pick of selected columns", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number; email: string },
      }
      const qb = createQueryBuilder(schema)
      async function test() {
        const rows = await qb.from('users').select('name', 'age').execute()
        const first = rows[0]
        const name: string = first.name
        const age: number = first.age
      }
    `)
    ).toBe(true);
  });

  it("type: execute result does not include unselected columns", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number; email: string },
      }
      const qb = createQueryBuilder(schema)
      async function test() {
        const rows = await qb.from('users').select('name').execute()
        const first = rows[0]
        // email was not selected, should not be accessible
        const email: string = first.email
      }
    `)
    ).toBe(false);
  });

  it("type: execute without select returns all columns", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; age: number; email: string },
      }
      const qb = createQueryBuilder(schema)
      async function test() {
        const rows = await qb.from('users').execute()
        const first = rows[0]
        const id: number = first.id
        const name: string = first.name
        const age: number = first.age
        const email: string = first.email
      }
    `)
    ).toBe(true);
  });

  it("type: orderBy with invalid column fails to compile", () => {
    expect(
      compilesOk(`
      import { createQueryBuilder } from './query-builder'
      const schema = {
        users: {} as { id: number; name: string; },
      }
      const qb = createQueryBuilder(schema)
      qb.from('users').orderBy('nonexistent')
    `)
    ).toBe(false);
  });
});
