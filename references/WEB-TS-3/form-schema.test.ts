import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-3: FormSchema with Expression Types
 * Tests adapted from Web-Bench TypeScript project task 13 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'form-schema.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-3-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
    },
    include: ['case.ts', 'form-schema.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'form-schema.ts'));
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

describe('WEB-TS-3: FormSchema with Expression Types', () => {
  it('FormSchema: valid simple schema', () => {
    expect(compilesOk(`
      import { FormSchema } from './form-schema'
      const schema: FormSchema<{ a: string, b: number, c: boolean }> = {
        fields: {
          type: "object",
          properties: {
            a: { type: "input" },
            b: { type: "number" },
            c: { type: "checkbox" },
          },
          value: { a: "str", b: 12, c: true },
        }
      }
    `)).toBe(true);
  });

  it('FormSchema: valid nested schema', () => {
    expect(compilesOk(`
      import { FormSchema } from './form-schema'
      const schema: FormSchema<{
        a: number; b: string; c: boolean;
        d: { v: string[] }
      }> = {
        fields: {
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
      }
    `)).toBe(true);
  });

  it('FormSchema: rejects wrong property type', () => {
    expect(compilesOk(`
      import { FormSchema } from './form-schema'
      const schema: FormSchema<{ a: string, b: number, c: boolean }> = {
        fields: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
            c: { type: "checkbox" },
          },
          value: { a: "str", b: 12, c: true },
        }
      }
    `)).toBe(false);
  });

  it('ExpressionEvent: valid usage', () => {
    expect(compilesOk(`
      import { ExpressionEvent } from './form-schema'
      const expr: Partial<ExpressionEvent<string, { name: string }>> = {
        value: "str",
        formValue: { name: "str" }
      }
    `)).toBe(true);
  });

  it('ExpressionEvent: rejects non-object FormValue', () => {
    expect(compilesOk(`
      import { ExpressionEvent } from './form-schema'
      const expr: Partial<ExpressionEvent<string, string>> = {
        value: "str",
        formValue: "str"
      }
    `)).toBe(false);
  });

  it('ExpressionEvent: rejects missing generics', () => {
    expect(compilesOk(`
      import { ExpressionEvent } from './form-schema'
      const expr: Partial<ExpressionEvent> = {
        value: "str",
        formValue: { name: "str" }
      }
    `)).toBe(false);
  });

  it('Expression: valid expression object', () => {
    expect(compilesOk(`
      import { Expression } from './form-schema'
      const expr: Expression<string, { name: string }, string> = {
        type: 'expression',
        value: (ctx: { value: string, formValue: { name: string } }) => ctx.value
      }
    `)).toBe(true);
  });

  it('Expression: rejects wrong formValue type in callback', () => {
    expect(compilesOk(`
      import { Expression } from './form-schema'
      const expr: Expression<string, { name: string }, string> = {
        type: 'expression',
        value: (ctx: { value: string, formValue: string }) => ctx.value
      }
    `)).toBe(false);
  });

  it('SetterMaybeExpression: accepts both expression and raw value', () => {
    expect(compilesOk(`
      import { SetterMaybeExpression } from './form-schema'
      const e1: SetterMaybeExpression<string, { name: string }, string> = {
        type: 'expression',
        value: (ctx: { value: string, formValue: { name: string } }) => ctx.value
      }
      const e2: SetterMaybeExpression<string, { name: string }, string> = "raw"
    `)).toBe(true);
  });
});
