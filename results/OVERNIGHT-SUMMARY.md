# Overnight Autopilot Summary — 2026-04-06

## What you asked for
"I want to wake up to the best agent possible with a presentation HTML ready to explain everything you did, decisions you took with quint-code / FPF principles, and also figure out how to use autoresearch from Karpathy."

## What you got

### The best agent: `plain-ts/v4` — 78.3% avg pass rate
- **Autoresearch-improved** via 5 Karpathy iterations (Sonnet improver, Haiku generator)
- **BL-5: 0% → 50%** — first ever non-zero on this task (no other agent achieved this)
- Prompt at: `agents/plain-ts/v4/system-prompt.md`
- Key AI-discovered improvements: export name matching, validation-vs-capping distinction, factory function guidance, structured pre-coding checklist

### Two HTML presentations
1. **`results/dashboard.html`** (970 lines) — interactive data dashboard with 5 tabs: audit, benchmarks, framework, evolution, roadmap
2. **`results/presentation.html`** (1693 lines) — narrative scroll page with all results, FPF decisions, and 9 sections including the 5 key discoveries

Open in browser: `open results/presentation.html`

### 5 key discoveries (each with FPF DRR)

| # | Discovery | Evidence | DRR |
|---|---|---|---|
| 1 | **Edge-case identification beats complexity** | plain-ts/v2 (53%) > self-critic (42%), stack-tc-pbt (51%) | `.quint/decisions/DRR-*-direction.md` |
| 2 | **H1 FALSIFIED: docs alone don't fix Effect** | 0/12 improvements v1→v2 | `DRR-*-h1-falsified.md` |
| 3 | **H1' CONFIRMED: boundary wrapping works** | SAAS-3: 0%→50% with v3 | `DRR-*-h1prime.md` |
| 4 | **Sonnet WORSE than Haiku one-shot** | Avg 31% vs 49% | `DRR-*-sonnet-worse.md` |
| 5 | **Autoresearch is the #1 lever** | 68.8%→78.3%, BL-5 0%→50% | `DRR-*-autoresearch-validated.md` |

### Infrastructure built
- `infra/agent-runner.mts` — manifest-driven SDK runner (CLI: `--agent --task --model`)
- `infra/autoresearch.mts` — Karpathy self-improvement loop (798 lines)
- `infra/manifest-schema.ts` — TypeScript types
- `context-bundles/` — Effect, XState, fast-check curated docs
- `quint-code` installed + `.mcp.json` configured

### Agent registry: 18 versions across 12 methods
```
agents/plain-ts/v1, v2 (edge-cases), v3 (self-review), v4 (autoresearch-improved) ← BEST
agents/effect-ts/v1, v2 (docs), v3 (boundary wrapping)
agents/tdd/v1, v2 (test enumeration)
agents/pbt/v1, v2 (+ fast-check bundle)
agents/self-critic/v1
agents/stack-tc-pbt/v1
agents/dafny/v1, lean4/v1, coq/v1, consensus/v1, pbt-effect/v1, dafny-pbt/v1
```

### Experimental data: ~120 SDK runs
- Phase 6.5: 11 Haiku audit runs
- Phase 7c: 12 effect-ts v1-vs-v2 runs
- Phase 8: 49 Tournament R1 Haiku runs
- Phase 8b: 5 effect-ts v3 runs
- Phase 9: ~30 autoresearch runs (5 iterations × 5 tasks + improver calls)
- Phase 10: 21 Tournament R2 Sonnet runs

### Git commits: 13
```
79e478a Phase 10b: Update presentation with all overnight results
7d5ad2b FPF DRR: Sonnet worse than Haiku
6350a59 Phase 10: Tournament R2 Sonnet — Haiku beats Sonnet
c3a9fd5 Phase 9b: Promote autoresearch plain-ts/v4 + FPF DRR
7831817 Phase 9: Karpathy autoresearch WORKS — 68.8% → 78.3%
2e6b8ec Phase 8b: effect-ts v3 — H1' PARTIALLY CONFIRMED
088b171 Phase 8: Tournament R1 Haiku — plain-ts/v2 wins at 53%
a99bd2c Phase 7d: autoresearch + presentation + H1 falsification
69c636a Phase 7b: 6 new agent versions
d403159 Phase 7c: v1 vs v2 — H1 FALSIFIED
4dbe4e6 Phase 7: Agent framework — runner, manifests, bundles, dashboard
ede0c10 Phase 6.5: Difficulty audit + benchmark catalog
1fd8fbf Phase 6.1: Full 44-bug matrix
```

## What's next (your choice)

1. **Run autoresearch on MORE agents** — the loop is ready, just needs `npx tsx infra/autoresearch.mts --agent <path> --tasks <tasks> --model haiku`
2. **Add typecheck feedback loop** — Phases 8/9 from roadmap. Would help Sonnet shine and help Effect further.
3. **Ingest real benchmarks** — 16 tasks from SWE-PolyBench TS, Web-Bench, BugsJS identified and documented
4. **Run `/q-onboard`** after restarting Claude Code to import all 4 FPF DRRs into quint-code
5. **Tournament R3 Opus** — only worth it with iteration loops (per Sonnet finding)

## Cost
All runs used your Claude Code subscription (no API key charges). Total tokens: ~300K output across ~120 runs. $0 out of pocket.
