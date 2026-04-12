<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-03 | Updated: 2026-04-03 -->

# references

## Purpose
Contains reference (ground truth) implementations for each benchmark task. Each subdirectory holds a spec, a correct implementation, tests, and seeded bug variants. LLM-generated code is compared against these references.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `BL-1/` | Mandate Pricing Engine — first business logic task with 4 seeded bugs (see `BL-1/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Each task follows the naming convention `{TRACK}-{NUMBER}` (e.g., BL-1, ALG-1, SAAS-1)
- Every task directory must contain: `spec.md`, the reference implementation, reference tests, and a `bugs/` subdirectory
- Reference implementations are the GROUND TRUTH — they must be provably correct before seeding bugs
- Future tasks to add: BL-2 through BL-5, ALG-1 through ALG-3, SAAS-1 through SAAS-3, UI-1/UI-2

### Directory Structure Convention
```
references/{TASK_ID}/
├── spec.md              # Problem specification with invariants
├── {module}.ts          # Ground truth implementation
├── {module}.test.ts     # Reference tests
└── bugs/
    ├── bug-verification.test.ts   # Tests proving each bug breaks an invariant
    ├── bug1-{name}.ts             # Buggy variant 1
    ├── bug2-{name}.ts             # Buggy variant 2
    └── ...
```

### Testing Requirements
- Reference tests must pass against the ground truth implementation
- Bug verification tests must FAIL for each buggy variant (proving the bug is detectable)
- Run `npm test` to verify all references

## Dependencies

### Internal
- Imports types from `@infra/types`
- Specs inform `infra/method-prompts.ts` task descriptions

<!-- MANUAL: -->
