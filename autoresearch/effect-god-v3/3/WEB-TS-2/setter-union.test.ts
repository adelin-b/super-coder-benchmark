import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-2: Generic Setter Union with ValueType Constraint
 * Tests adapted from Web-Bench TypeScript project task 12 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'setter-union.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
    },
    include: ['case.ts', 'setter-union.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'setter-union.ts'));
  writeFileSync(join(dir, 'case.ts'), code);
  try {
    execSync(`${TSC} --project ${join(dir, 'tsconfig.json')}`, {
      cwd: dir, stdio: 'pipe', timeout: 30000,
    });
    return true;
  } catch {
    return false;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

describe('WEB-TS-2: Generic Setter Union with ValueType Constraint', () => {
  it('Setter with object generic accepts valid ObjectSetter', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<{ a: string, b: number, c: boolean }> = {
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

  it('Setter with object generic rejects wrong property type', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<{ a: string, b: number, c: boolean }> = {
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

  it('Setter with array generic accepts valid ArraySetter', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<string[]> = {
        type: "array",
        item: { type: "input" },
        value: ["string"],
      }
    `)).toBe(true);
  });

  it('Setter with recursive array accepts nested ArraySetter', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<string[][]> = {
        type: 'array',
        item: {
          type: 'array',
          item: { type: "input" }
        },
        value: [["str"]],
      }
    `)).toBe(true);
  });

  it('Setter with array generic rejects wrong item type', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<boolean> = {
        type: 'array',
        item: { type: 'checkbox' },
        value: ['str'],
      }
    `)).toBe(false);
  });

  it('Setter without generic accepts InputSetter (backward compat)', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter = {
        type: "input",
        value: "str"
      }
    `)).toBe(true);
  });

  it('Setter with string generic accepts CustomSetter', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<string> = {
        type: "custom",
        customType: "custom1"
      }
    `)).toBe(true);
  });

  it('Setter with string generic rejects CustomSetter with wrong value', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<string> = {
        type: "custom",
        customType: "custom1",
        value: 123
      }
    `)).toBe(false);
  });

  it('Setter with nested object accepts recursive ObjectSetter', () => {
    expect(compilesOk(`
      import { Setter } from './setter-union'
      const s: Setter<{
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
              v: { type: 'array', item: { type: 'input' } },
            },
          },
        },
      }
    `)).toBe(true);
  });
});
