import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-6: Type-Inferred Props from CustomSetterRender
 * Tests adapted from Web-Bench TypeScript project task 17 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'render-props.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-6-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
      jsx: 'react',
    },
    include: ['case.ts', 'render-props.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'render-props.ts'));
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

describe('WEB-TS-6: Type-Inferred Props from CustomSetterRender', () => {
  it('valid props matching render definition', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './render-props'
      type Defs = { customSetterA: CustomSetterRender<string, { test: string }> }
      type FV = { name: string }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: {
              type: 'custom',
              customType: 'customSetterA',
              props: { test: '123' },
            },
          },
        },
        customSetterRenderDefinitions: {
          customSetterA: { render: ({ test }) => null },
        },
      }
    `)).toBe(true);
  });

  it('valid props in nested ObjectSetter', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './render-props'
      type Defs = { customSetterA: CustomSetterRender<string, { test: string }> }
      type FV = { name: string; obj: { val: string } }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: { type: 'custom', customType: 'customSetterA' },
            obj: {
              type: 'object',
              properties: {
                val: {
                  type: 'custom',
                  customType: 'customSetterA',
                  props: { test: '123' },
                },
              },
            },
          },
        },
        customSetterRenderDefinitions: {
          customSetterA: { render: ({ test }) => null },
        },
      }
    `)).toBe(true);
  });

  it('rejects props with wrong value type', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './render-props'
      type Defs = { customSetterA: CustomSetterRender<string, { test: string }> }
      type FV = { name: string }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: {
              type: 'custom',
              customType: 'customSetterA',
              props: { test: 123 },
            },
          },
        },
        customSetterRenderDefinitions: {
          customSetterA: { render: ({ test }) => null },
        },
      }
    `)).toBe(false);
  });

  it('rejects wrong props type in nested ObjectSetter', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './render-props'
      type Defs = { customSetterA: CustomSetterRender<string, { test: string }> }
      type FV = { name: string; obj: { val: string } }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: { type: 'custom', customType: 'customSetterA' },
            obj: {
              type: 'object',
              properties: {
                val: {
                  type: 'custom',
                  customType: 'customSetterA',
                  props: { test: 123 },
                },
              },
            },
          },
        },
        customSetterRenderDefinitions: {
          customSetterA: { render: ({ test }) => null },
        },
      }
    `)).toBe(false);
  });
});
