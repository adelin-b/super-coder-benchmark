import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-4: Conditional Visibility with Expression Props
 * Tests adapted from Web-Bench TypeScript project task 14 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'visible-setter.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-4-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
    },
    include: ['case.ts', 'visible-setter.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'visible-setter.ts'));
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

describe('WEB-TS-4: Conditional Visibility with Expression Props', () => {
  it('visible: accepts boolean literal true', () => {
    expect(compilesOk(`
      import { Setter } from './visible-setter'
      type FV = { a: string, b: number, c: boolean }
      const s: Setter<boolean, FV> = {
        type: 'checkbox',
        visible: true,
      }
    `)).toBe(true);
  });

  it('visible: accepts expression returning boolean', () => {
    expect(compilesOk(`
      import { Setter } from './visible-setter'
      type FV = { a: string, b: number, c: boolean }
      const s: Setter<boolean, FV> = {
        type: 'checkbox',
        visible: {
          type: 'expression',
          value: (ctx) => { return ctx.value },
        },
      }
    `)).toBe(true);
  });

  it('visible: omitting is valid', () => {
    expect(compilesOk(`
      import { Setter } from './visible-setter'
      const s: Setter<boolean> = {
        type: 'checkbox',
      }
    `)).toBe(true);
  });

  it('visible: expression can access formValue fields', () => {
    expect(compilesOk(`
      import { Setter } from './visible-setter'
      type FV = { a: string, b: number, c: boolean }
      const s: Setter<boolean, FV> = {
        type: 'checkbox',
        visible: {
          type: 'expression',
          value: (ctx) => { return ctx.formValue.c },
        },
      }
    `)).toBe(true);
  });

  it('FormSchema: threads FormValue to nested visible expressions', () => {
    expect(compilesOk(`
      import { FormSchema } from './visible-setter'
      type FV = { a: string, b: number, c: boolean }
      const schema: FormSchema<FV> = {
        fields: {
          type: "object",
          properties: {
            a: { type: "input" },
            b: {
              type: "number",
              visible: {
                type: 'expression',
                value: (ctx) => { return ctx.formValue.c },
              },
            },
            c: { type: "checkbox" },
          },
          value: { a: "str", b: 12, c: true },
        }
      }
    `)).toBe(true);
  });
});
