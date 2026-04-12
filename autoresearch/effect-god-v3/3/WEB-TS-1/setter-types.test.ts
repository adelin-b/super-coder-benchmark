import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-1: Recursive Collection Setter Types
 *
 * Tests adapted from Web-Bench TypeScript project tasks 8-10 (Apache 2.0).
 * Each test writes a TypeScript snippet that imports the candidate's types
 * and compiles it with tsc --noEmit --strict.
 */

const IMPL_PATH = join(__dirname, 'setter-types.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-1-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ES2020',
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['case.ts', 'setter-types.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'setter-types.ts'));
  writeFileSync(join(dir, 'case.ts'), code);
  try {
    execSync(`${TSC} --project ${join(dir, 'tsconfig.json')}`, {
      cwd: dir,
      stdio: 'pipe',
      timeout: 30000,
    });
    return true;
  } catch {
    return false;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

describe('WEB-TS-1: Recursive Collection Setter Types', () => {
  // --- ArraySetter (Web-Bench task-8) ---

  it('ArraySetter: valid string array', () => {
    expect(compilesOk(`
      import { ArraySetter, Setter } from './setter-types'
      const input: ArraySetter<string[]> = {
        type: "array",
        item: { type: "input" },
        value: ["hello"],
      }
      const s: Setter = input
    `)).toBe(true);
  });

  it('ArraySetter: valid number array', () => {
    expect(compilesOk(`
      import { ArraySetter } from './setter-types'
      const num: ArraySetter<number[]> = {
        type: "array",
        item: { type: "number" },
        value: [123, 456],
      }
    `)).toBe(true);
  });

  it('ArraySetter: valid boolean array', () => {
    expect(compilesOk(`
      import { ArraySetter } from './setter-types'
      const cbx: ArraySetter<boolean[]> = {
        type: "array",
        item: { type: "checkbox" },
        value: [true],
      }
    `)).toBe(true);
  });

  it('ArraySetter: rejects missing item property', () => {
    expect(compilesOk(`
      import { ArraySetter } from './setter-types'
      const invalid: ArraySetter<number[]> = {
        type: "array",
        value: [123]
      }
    `)).toBe(false);
  });

  it('ArraySetter: rejects wrong item type for value', () => {
    expect(compilesOk(`
      import { ArraySetter } from './setter-types'
      const invalid: ArraySetter<boolean[]> = {
        type: "array",
        item: { type: "checkbox" },
        value: ['str'],
      }
    `)).toBe(false);
  });

  it('ArraySetter: supports recursive nesting (string[][])', () => {
    expect(compilesOk(`
      import { ArraySetter } from './setter-types'
      const valid: ArraySetter<string[][]> = {
        type: 'array',
        item: {
          type: 'array',
          item: { type: "input" }
        },
        value: [["str"]],
      }
    `)).toBe(true);
  });

  // --- TupleSetter (Web-Bench task-9) ---

  it('TupleSetter: valid [string, number, boolean]', () => {
    expect(compilesOk(`
      import { TupleSetter } from './setter-types'
      const t: TupleSetter<[string, number, boolean]> = {
        type: 'tuple',
        items: [
          { type: 'input' },
          { type: 'number' },
          { type: 'checkbox' },
        ],
        value: ['string', 1, true],
      }
    `)).toBe(true);
  });

  it('TupleSetter: rejects wrong positional type', () => {
    expect(compilesOk(`
      import { TupleSetter } from './setter-types'
      const t: TupleSetter<[string, number, boolean]> = {
        type: 'tuple',
        items: [
          { type: 'input' },
          { type: 'input' },
          { type: 'checkbox' },
        ],
        value: ['string', 1, true],
      }
    `)).toBe(false);
  });

  // --- ObjectSetter (Web-Bench task-10) ---

  it('ObjectSetter: valid {a: string, b: number, c: boolean}', () => {
    expect(compilesOk(`
      import { ObjectSetter } from './setter-types'
      const obj: ObjectSetter<{ a: string, b: number, c: boolean }> = {
        type: "object",
        properties: {
          a: { type: "input" },
          b: { type: "number" },
          c: { type: "checkbox" },
        },
        value: { a: "str", b: 12, c: true },
      }
    `)).toBe(true);
  });

  it('ObjectSetter: rejects missing properties', () => {
    expect(compilesOk(`
      import { ObjectSetter } from './setter-types'
      const invalid: ObjectSetter<{ a: string, b: number, c: boolean }> = {
        type: "object",
        value: { a: "str", b: 12, c: true }
      }
    `)).toBe(false);
  });

  it('ObjectSetter: rejects wrong property setter type', () => {
    expect(compilesOk(`
      import { ObjectSetter } from './setter-types'
      const invalid: ObjectSetter<{ a: string, b: number, c: boolean }> = {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
          c: { type: "checkbox" },
        },
        value: { a: "str", b: 12, c: true },
      }
    `)).toBe(false);
  });

  it('ObjectSetter: rejects missing value keys', () => {
    expect(compilesOk(`
      import { ObjectSetter } from './setter-types'
      const invalid: ObjectSetter<{ a: string, b: number, c: boolean }> = {
        type: "object",
        properties: {
          a: { type: "input" },
          b: { type: "number" },
          c: { type: "checkbox" },
        },
        value: { a: "str", b: 12 },
      }
    `)).toBe(false);
  });

  it('ObjectSetter: supports recursive nesting (object with nested array)', () => {
    expect(compilesOk(`
      import { ObjectSetter } from './setter-types'
      const valid: ObjectSetter<{
        a: number
        b: string
        c: boolean
        d: { v: string[] }
      }> = {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'input' },
          c: { type: 'checkbox' },
          d: {
            type: 'object',
            properties: {
              v: {
                type: 'array',
                item: { type: 'input' },
              },
            },
          },
        },
      }
    `)).toBe(true);
  });
});
