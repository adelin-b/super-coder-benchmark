import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-7: Context-Aware ctxValue in Array Setters
 * Tests adapted from Web-Bench TypeScript project task 18 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'ctx-value.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-7-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
    },
    include: ['case.ts', 'ctx-value.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'ctx-value.ts'));
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

describe('WEB-TS-7: Context-Aware ctxValue in Array Setters', () => {
  it('ctxValue in ArraySetter item is the element type', () => {
    expect(compilesOk(`
      import { ArraySetter } from './ctx-value'
      const setter: ArraySetter<string[]> = {
        type: 'array',
        item: {
          type: 'input',
          value: {
            type: 'expression',
            value: ({ ctxValue }) => { return ctxValue! },
          },
        },
      }
    `)).toBe(true);
  });

  it('ctxValue outside ArraySetter defaults to FormValue', () => {
    expect(compilesOk(`
      import { Setter } from './ctx-value'
      const setter: Setter<
        { name: string; checked: boolean },
        { name: string; checked: boolean }
      > = {
        type: 'object',
        properties: {
          name: { type: 'input' },
          checked: {
            type: 'checkbox',
            visible: {
              type: 'expression',
              value: (ctx) => ctx.ctxValue!.checked,
            },
          },
        },
      }
    `)).toBe(true);
  });

  it('ctxValue outside ArraySetter rejects wrong access', () => {
    expect(compilesOk(`
      import { Setter } from './ctx-value'
      const setter: Setter<
        { name: string; checked: boolean },
        { name: string; checked: boolean }
      > = {
        type: 'object',
        properties: {
          name: { type: 'input' },
          checked: {
            type: 'checkbox',
            visible: {
              type: 'expression',
              value: (ctx) => ctx.ctxValue!,
            },
          },
        },
      }
    `)).toBe(false);
  });

  it('recursive: nested array inside object has correct ctxValue', () => {
    expect(compilesOk(`
      import { Setter } from './ctx-value'
      const setter: Setter<{
        users: {
          name: string
          checked: boolean
          parents: string[]
        }[]
      }> = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            item: {
              type: 'object',
              properties: {
                name: { type: 'input' },
                checked: {
                  type: 'checkbox',
                  visible: {
                    type: 'expression',
                    value: (ctx) => ctx.ctxValue!.checked,
                  },
                },
                parents: {
                  type: 'array',
                  item: {
                    type: 'input',
                    value: {
                      type: 'expression',
                      value: ({ ctxValue }) => { return ctxValue! },
                    },
                  },
                },
              },
            },
          },
        },
      }
    `)).toBe(true);
  });

  it('FormSchema threads ctxValue correctly', () => {
    expect(compilesOk(`
      import { FormSchema } from './ctx-value'
      const schema: FormSchema<{ users: { name: string; checked: boolean }[] }> = {
        fields: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              item: {
                type: 'object',
                properties: {
                  name: { type: 'input' },
                  checked: {
                    type: 'checkbox',
                    visible: {
                      type: 'expression',
                      value: (ctx) => ctx.ctxValue!.checked,
                    },
                  },
                },
              },
            },
          },
          visible: {
            type: 'expression',
            value: (ctx) => {
              return ctx.ctxValue!.users[0].checked
            },
          },
        },
      }
    `)).toBe(true);
  });

  it('FormSchema rejects wrong ctxValue type in nested expression', () => {
    expect(compilesOk(`
      import { FormSchema } from './ctx-value'
      const schema: FormSchema<{ users: { name: string; checked: boolean }[] }> = {
        fields: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              item: {
                type: 'object',
                properties: {
                  name: { type: 'input' },
                  checked: {
                    type: 'checkbox',
                    visible: {
                      type: 'expression',
                      value: (ctx) => ctx.ctxValue!,
                    },
                  },
                },
              },
            },
          },
          visible: {
            type: 'expression',
            value: (ctx) => {
              return ctx.ctxValue!.users[0].checked
            },
          },
        },
      }
    `)).toBe(false);
  });
});
