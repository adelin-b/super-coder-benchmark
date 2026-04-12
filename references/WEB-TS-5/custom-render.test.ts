import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-5: CustomSetterRender with Type-Safe Render Definitions
 * Tests adapted from Web-Bench TypeScript project tasks 15-16 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'custom-render.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-5-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
      jsx: 'react',
    },
    include: ['case.ts', 'custom-render.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'custom-render.ts'));
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

describe('WEB-TS-5: CustomSetterRender with Type-Safe Render Definitions', () => {
  it('valid custom render definition in FormSchema', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './custom-render'
      type Defs = { customType: CustomSetterRender<string, { test: string }> }
      type FV = { name: string }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: { type: 'input' },
          },
        },
        customSetterRenderDefinitions: {
          customType: {
            render: ({ test }) => null,
          },
        },
      }
    `)).toBe(true);
  });

  it('rejects mismatched render definition key', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './custom-render'
      type Defs = { customType: CustomSetterRender<string, { test: string }> }
      type FV = { name: string }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: { name: { type: 'input' } },
        },
        customSetterRenderDefinitions: {
          wrongKey: {
            render: ({ test }) => null,
          },
        },
      }
    `)).toBe(false);
  });

  it('valid customType references defined key', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './custom-render'
      type Defs = { customSetterA: CustomSetterRender<string, { test: string }> }
      type FV = { name: string }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: { type: 'custom', customType: 'customSetterA' },
          },
        },
        customSetterRenderDefinitions: {
          customSetterA: { render: ({ test }) => null },
        },
      }
    `)).toBe(true);
  });

  it('rejects customType not in definitions', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './custom-render'
      type Defs = { customSetterA: CustomSetterRender<string, { test: string }> }
      type FV = { name: string }
      const schema: FormSchema<FV, Defs> = {
        fields: {
          type: 'object',
          properties: {
            name: { type: 'custom', customType: 'customSetterB' },
          },
        },
        customSetterRenderDefinitions: {
          customSetterA: { render: ({ test }) => null },
        },
      }
    `)).toBe(false);
  });

  it('recursive: custom type valid in nested ObjectSetter', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './custom-render'
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
                val: { type: 'custom', customType: 'customSetterA' },
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

  it('recursive: rejects invalid customType in nested ObjectSetter', () => {
    expect(compilesOk(`
      import { FormSchema, CustomSetterRender } from './custom-render'
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
                val: { type: 'custom', customType: 'customSetterB' },
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
