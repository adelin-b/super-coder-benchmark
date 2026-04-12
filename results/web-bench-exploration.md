# Web-Bench Exploration Report

**Date:** 2026-04-12
**Source:** https://github.com/bytedance/web-bench (ByteDance Research)
**Paper:** https://arxiv.org/abs/2505.07473
**License:** Apache 2.0

---

## 1. Overview

Web-Bench is a benchmark evaluating LLM performance in real-world web development. It contains **50 projects** (plus 2 templates/demos), each with **20 sequential tasks** that build on each other, simulating how a senior engineer develops a project incrementally.

**Key stats:**
- 1,023 total tasks across 52 project directories (50 real + demo + template)
- 495 tasks rated "challenging" (48.4%)
- SOTA: Claude 3.7 Sonnet achieves only **25.1% Pass@1**
- Each project takes a senior engineer (5-10 years experience) 4-8 hours to complete
- Tasks have sequential dependencies: task-N builds on task-(N-1)

---

## 2. Project Structure

Every project follows a consistent structure:

```
project/
  src/              # Final reference solution (ground truth)
  src-init/         # Initial scaffold (starting point for LLM)
  test/
    init.spec.js    # Tests for initial scaffold
    task-1.spec.js  # Tests for task 1
    ...
    task-20.spec.js # Tests for task 20
  tasks.jsonl       # OR tasks.yml -- task descriptions
  package.json
  playwright.config.js
  readme.md
```

### Task Format (JSONL)

```json
{
  "id": "task-6",
  "date": "2025-05-12",
  "level": "moderate",
  "description": "Click button del to delete SelectedEntry and set SelectedEntry to its next sibling..."
}
```

Some projects use YAML (`tasks.yml`) with identical fields. Levels are: `easy`, `moderate`, `challenging`.

### Evaluation Protocol

1. Iterate `tasks.jsonl` sequentially
2. Give LLM only the task description (no test code)
3. Run `npm test -- N` (Playwright test for task N)
4. First attempt: if failed, give error context and retry once
5. Second attempt: if failed, evaluation stops for that task
6. Metrics: `pass@1` (first attempt), `pass@2` (with retry)

---

## 3. Testing Mechanism

### Primary: Playwright (100% of browser/UI projects)

Every project uses **Playwright** with Chromium for end-to-end testing. The standard config:

```js
module.exports = defineConfig({
  testDir: './test',
  timeout: process.env.IS_EVAL_PRODUCTION ? 30_000 : 2_000,
  expect: { timeout: process.env.IS_EVAL_PRODUCTION ? 5_000 : 1_000 },
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: `npx serve ${PROJECT_DIR} -p ${PORT}`,  // or vite, express, etc.
    url: `http://127.0.0.1:${PORT}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Web server commands vary by project type:
- **Static HTML:** `npx serve src -p PORT`
- **React/Vue/Svelte:** `npx vite --port PORT`
- **Express/Fastify:** `npm run dev -- src PORT` (with DB setup)
- **Next.js:** `npm run dev -- src PORT` (with Prisma/DB)

### Shared Test Utilities (`@web-bench/test-util`)

A shared library providing Playwright helper functions:
- `getComputedStyle(page, selector)` -- CSS computed style extraction
- `getOffset(page, selector)` -- element position/dimensions
- `getViewport(page)` -- viewport dimensions
- `getBox(style)` / `getMarginBox(style)` -- box model calculations
- `isExisted(filePath, srcPath)` -- file existence checks
- `expectBetween()`, `expectTolerance()` -- numeric range assertions
- `getCmdKey()` -- OS-aware keyboard shortcut helpers

### Exception: TypeScript Project

The TypeScript project uses a unique approach -- tests write `.ts` case files and run `tsc` to check for type errors:

```js
// Test writes a TS file, then compiles it
const casePath = getCasePath('task-10', 'case-1')
await writeCaseContent(casePath, `
  import { ObjectSetter } from '../../types/setter'
  const valid: ObjectSetter<{a: string}> = { type: "object", ... }
`)
const res = await executeCaseFile(casePath)  // runs tsc
expect(res).toBeUndefined()  // no errors = pass
```

---

## 4. Difficulty Distribution

### By Project (sorted by % challenging)

| Project | Total | Challenging | %Hard |
|---------|-------|------------|-------|
| threejs | 20 | 15 | 75% |
| color, flex, float, grid, pull-loading, svg, tailwind, unocss | 20 each | 12 | 60% |
| chart, esmodule, svg-chart, table | 20 each | 11 | 55% |
| dom, dom1, draw, expressjs, fastify, fastify-react, form, jotai, lowdb, mobx, nextjs, nosql, nuxt, prisma, redux, sequelize, styled-components, svelte, svg-solar, typescript, zustand | 20 each | 10 | 50% |
| angular, calculator, calculator-files, react, react-no-ts, vue | 20 each | 9 | 45% |
| bom, canvas, less, parcel, sass, selector, stylus, survey, vite, webpack | 20 each | 7 | 35% |
| expression-editor | 20 | 6 | 30% |

### Overall Distribution

- **Easy:** ~260 tasks (25%)
- **Moderate:** ~268 tasks (26%)
- **Challenging:** ~495 tasks (48%)

### Where Models Fail Most (Hardest Tasks)

Based on SOTA at 25.1% and sequential dependency (later tasks require all previous to pass):

1. **threejs** (75% challenging) -- 3D snake game with collision detection, portals, camera controls, animations. Tasks 6-20 are almost all challenging.
2. **canvas** (Flappy Bird clone) -- Weather systems, enemy AI, boss battles, bombs, special phases. Tasks 8+ are extremely hard.
3. **svg** (Drawing tool) -- Move/rotate/zoom with composed transforms. Task 20 (sequential transform composition) is notoriously hard.
4. **typescript** (Advanced generics) -- Tasks 12+ involve recursive generics, conditional types with FormSchema, and type-level path inference.
5. **flex/float/grid/tailwind** (CSS layout) -- 60% challenging; pixel-perfect layout reproduction.
6. **expressjs/nextjs/prisma** (Full-stack) -- Tasks 14+ involve complex business logic (carts, orders, payments, refunds, referral systems).

---

## 5. Project Categories

### Web Standards (no frameworks)
- **DOM manipulation:** dom, dom1 (file explorer UIs)
- **CSS Layout:** flex, float, grid, table, selector
- **CSS Preprocessors:** less, sass, stylus, tailwind, unocss, styled-components
- **Graphics:** canvas, svg, svg-chart, svg-solar, draw, color, chart
- **3D:** threejs (snake game)
- **Browser APIs:** bom (Browser Object Model), form
- **JS Modules:** esmodule
- **TypeScript:** typescript (advanced type system)
- **Build Tools:** vite, webpack, parcel
- **Misc:** calculator, calculator-files, pull-loading, survey, expression-editor

### Web Frameworks
- **React ecosystem:** react, react-no-ts, redux, zustand, jotai, mobx
- **Vue:** vue, nuxt
- **Svelte:** svelte
- **Angular:** angular
- **Server-side:** expressjs, fastify, fastify-react, nextjs
- **Databases:** prisma, sequelize, nosql, lowdb

---

## 6. Candidates for Vitest Adaptation (5-10 tasks)

Our benchmark uses vitest with pure TypeScript tasks (`.test.ts` + `.ts` pairs). The adaptation challenge is that Web-Bench uses Playwright (browser-based E2E), which fundamentally differs from vitest (unit/integration in Node.js).

### Best Candidates (adaptable to vitest without Playwright)

#### Tier 1: Direct Port (pure logic, no browser needed)

1. **typescript (tasks 8-20)** -- Advanced TypeScript generics
   - These tests already run `tsc` not Playwright. The test pattern (write TS, compile, check errors) maps directly to vitest.
   - Integration: Write vitest tests that use `ts.createProgram()` or `execa('tsc')` to validate type correctness.
   - **Difficulty: Challenging.** Tasks 12-20 involve recursive generics, conditional mapped types, and type-level path inference.
   - Example task-20: Implement `setSetterValueByPath` with type-safe nested property paths.

2. **esmodule (tasks 13-20)** -- Node.js module system edge cases
   - Tasks 13-20 involve Node.js-specific module operations (dynamic imports, CJS/ESM interop, import maps, data URLs).
   - Integration: Vitest can directly test module resolution, dynamic imports, and file generation.
   - **Difficulty: Challenging.** CJS/ESM interop, data URLs, dynamic glob imports.

3. **calculator (core logic extraction)** -- Mathematical operations
   - Strip the UI layer; test the computation engine (sqrt, sin, cos, tan, memory operations, expression parsing).
   - Integration: Extract pure functions, test with vitest assertions.
   - **Difficulty: Moderate to Challenging.** Expression parsing, operator precedence, memory state machine.

#### Tier 2: Logic Extraction (extract business logic from full-stack)

4. **expressjs / nextjs (API logic, tasks 7-20)** -- Shopping mart backend
   - JWT authentication, CRUD operations, order lifecycle (cart -> order -> payment -> refund), referral system.
   - Integration: Mock the DB layer, test route handlers as pure functions with vitest + supertest.
   - **Difficulty: Challenging.** Multi-step business transactions, auth middleware, referral reward calculations.

5. **redux / zustand (state management, tasks 11-20)** -- Complex state patterns
   - 100K item rendering performance, markdown with XSS prevention, Gomoku game logic, cross-tab sync, real-time chat.
   - Integration: Test store logic directly in vitest (Zustand/Redux stores are pure JS). Game logic (win detection, undo) is perfectly testable.
   - **Difficulty: Challenging.** Gomoku win detection, undo/redo, cross-tab BroadcastChannel sync.

6. **form (validation logic, tasks 7-20)** -- Form validation and state
   - Complex validation rules, conditional visibility, dynamic field generation.
   - Integration: Extract validation functions, test with vitest.
   - **Difficulty: Moderate to Challenging.**

#### Tier 3: Algorithm Extraction (highest adaptation effort)

7. **canvas (game logic, tasks 4-20)** -- Flappy Bird game engine
   - Collision detection, weather particle systems, enemy AI, boss behavior, item effects.
   - Integration: Extract physics/collision/AI as pure functions. Test game state transitions.
   - **Difficulty: Very Challenging.** Collision geometry, state machines, timing systems.

8. **threejs (tasks 6-17)** -- 3D snake game logic
   - Snake movement with body following, collision detection against fences/portals, candy placement algorithm.
   - Integration: Extract spatial logic (grid movement, collision) as pure math functions.
   - **Difficulty: Very Challenging.** 3D collision detection, pathfinding for dead-end detection.

9. **svg (tasks 16-20)** -- Transform composition
   - Move, rotate, zoom transforms that compose correctly in any sequence.
   - Integration: Test transform matrix operations as pure math.
   - **Difficulty: Very Challenging.** Matrix composition, coordinate system transforms.

10. **expression-editor (tasks 7-20)** -- Expression parsing and evaluation
    - Boolean expression tokenization, syntax highlighting, auto-completion, formula evaluation.
    - Integration: Tokenizer, parser, evaluator are pure functions.
    - **Difficulty: Challenging.** Recursive descent parsing, operator precedence.

---

## 7. Integration Path

### Approach A: Pure Logic Extraction (Recommended)

1. **Select 5-7 "challenging" tasks** from the candidates above
2. **Extract the pure logic** from the task description (strip all UI/DOM requirements)
3. **Write vitest tests** that mirror the Playwright assertions but test functions directly
4. **Provide the task description** (from tasks.jsonl) as the prompt
5. **Provide src-init/** content as the starting scaffold

**Concrete example -- Gomoku Win Detection (from zustand task-15):**

```typescript
// task: implement isWinner(board, lastMove) for 15x15 Gomoku
// vitest test:
describe('Gomoku win detection', () => {
  it('detects horizontal five-in-a-row', () => { ... })
  it('detects vertical five-in-a-row', () => { ... })
  it('detects diagonal five-in-a-row', () => { ... })
  it('returns false for four-in-a-row', () => { ... })
  it('handles board edges correctly', () => { ... })
})
```

### Approach B: Full Playwright Integration (Higher effort, higher fidelity)

1. Add Playwright as a test dependency alongside vitest
2. Port entire projects with their original test files
3. Run via `npx playwright test` instead of vitest
4. Higher fidelity but fundamentally different test paradigm from our current setup

### Approach C: Hybrid (Best of both)

1. Use **Approach A** for logic-heavy tasks (typescript, calculator, game engines, state management)
2. Use **Approach B** for a small set of full-stack tasks where the E2E nature IS the challenge
3. Tag tasks with `test-runner: vitest | playwright` in our manifest

### Recommended First Batch

| # | Source Project | Task Range | Topic | Difficulty | Effort |
|---|---------------|-----------|-------|-----------|--------|
| 1 | typescript | tasks 8-12 | Recursive generics, conditional types | Challenging | Low |
| 2 | typescript | tasks 15-20 | FormSchema, type-level paths | Very Challenging | Low |
| 3 | zustand/redux | task 15 logic | Gomoku win detection algorithm | Challenging | Medium |
| 4 | canvas | tasks 4-7 logic | Flappy Bird collision detection | Challenging | Medium |
| 5 | expressjs | tasks 16-18 logic | Order lifecycle state machine | Challenging | Medium |
| 6 | esmodule | tasks 13-15 | CJS/ESM interop, file I/O | Challenging | Low |
| 7 | svg | task 20 logic | Composed geometric transforms | Very Challenging | High |

---

## 8. Key Observations

### Strengths of Web-Bench
- **Sequential dependency** is a brilliant design -- later tasks require all earlier tasks to work, creating a cascading failure mode that punishes partial understanding
- **Real-world complexity** -- projects are designed by 5-10 year engineers, not synthetic puzzles
- **Broad coverage** -- 50 projects spanning standards, frameworks, build tools, databases
- **Low SOTA** -- 25.1% Pass@1 means lots of headroom for differentiation
- **Apache 2.0 license** -- fully open for integration

### Challenges for Integration
- **Playwright dependency** -- all tests are browser-based E2E; converting to vitest requires logic extraction
- **Sequential coupling** -- tasks build on each other; extracting individual tasks loses context
- **UI-heavy tasks** -- many tasks are "add a button with class X" which test DOM manipulation, not logic
- **Asset dependencies** -- canvas/threejs projects depend on image/3D assets

### What Makes Tasks Hard for LLMs
1. **Spatial/geometric reasoning** (drag-and-drop, collision detection, transform composition)
2. **State machine complexity** (order lifecycle, game state, undo/redo)
3. **Performance constraints** ("ensure page won't be stuck with 100K items")
4. **Security awareness** (XSS prevention in markdown, JWT validation)
5. **Cross-concern integration** (portal teleportation affecting snake color AND collision AND body following)
6. **Advanced type-level programming** (recursive generics, conditional mapped types)

---

## 9. Files of Interest

- Task definitions: `/tmp/web-bench/projects/*/tasks.jsonl` or `tasks.yml`
- Test files: `/tmp/web-bench/projects/*/test/task-*.spec.js`
- Reference solutions: `/tmp/web-bench/projects/*/src/`
- Initial scaffolds: `/tmp/web-bench/projects/*/src-init/`
- Test utilities: `/tmp/web-bench/libraries/test-util/src/index.js`
- Eval runner: `/tmp/web-bench/apps/eval/src/bench-eval-runner.ts`
- Playwright configs: `/tmp/web-bench/projects/*/playwright.config.js`
