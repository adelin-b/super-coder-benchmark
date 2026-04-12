import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WEB-TS-8: Type-Safe Nested Path Access (EditorRef)
 * Tests adapted from Web-Bench TypeScript project task 20 (Apache 2.0).
 */

const IMPL_PATH = join(__dirname, 'editor-ref.ts');
const TSC = join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

function compilesOk(code: string): boolean {
  const dir = join(tmpdir(), `web-ts-8-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const tsconfig = {
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2020',
      module: 'commonjs', moduleResolution: 'node',
      esModuleInterop: true, skipLibCheck: true,
    },
    include: ['case.ts', 'editor-ref.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  copyFileSync(IMPL_PATH, join(dir, 'editor-ref.ts'));
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

describe('WEB-TS-8: Type-Safe Nested Path Access (EditorRef)', () => {
  it('valid: set nested object by path', () => {
    expect(compilesOk(`
      import { EditorRef } from './editor-ref'
      type TestValue = {
        name: string
        object: { age: number }
      }
      const a: EditorRef<TestValue> = {} as any
      a.setSetterValueByPath(['object'], { age: 12 })
    `)).toBe(true);
  });

  it('invalid: wrong nested value type', () => {
    expect(compilesOk(`
      import { EditorRef } from './editor-ref'
      type TestValue = {
        name: string
        object: { age: number }
      }
      const a: EditorRef<TestValue> = {} as any
      a.setSetterValueByPath(['object'], { age: "12" })
    `)).toBe(false);
  });

  it('valid: set string property by path', () => {
    expect(compilesOk(`
      import { EditorRef } from './editor-ref'
      type TestValue = {
        name: string
        object: { age: number }
      }
      const a: EditorRef<TestValue> = {} as any
      a.setSetterValueByPath(['name'], "hello")
    `)).toBe(true);
  });

  it('invalid: wrong primitive type for path', () => {
    expect(compilesOk(`
      import { EditorRef } from './editor-ref'
      type TestValue = {
        name: string
        object: { age: number }
      }
      const a: EditorRef<TestValue> = {} as any
      a.setSetterValueByPath(['name'], 123)
    `)).toBe(false);
  });

  it('valid: deep path into nested object', () => {
    expect(compilesOk(`
      import { EditorRef } from './editor-ref'
      type TestValue = {
        name: string
        object: { age: number }
      }
      const a: EditorRef<TestValue> = {} as any
      a.setSetterValueByPath(['object', 'age'], 42)
    `)).toBe(true);
  });

  it('invalid: deep path with wrong value type', () => {
    expect(compilesOk(`
      import { EditorRef } from './editor-ref'
      type TestValue = {
        name: string
        object: { age: number }
      }
      const a: EditorRef<TestValue> = {} as any
      a.setSetterValueByPath(['object', 'age'], "42")
    `)).toBe(false);
  });
});
