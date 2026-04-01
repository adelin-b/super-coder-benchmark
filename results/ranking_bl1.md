# BL-1 Ranking: Mandate Pricing Engine

Generated: 2026-04-01T10:10:00Z

## Composite Rankings (BL-1)

| Rank | Method | Gen Score | Det Score | Total | 1st Try? | Tests | Bugs Caught | Actionable |
|------|--------|-----------|-----------|-------|----------|-------|-------------|------------|
| 🥇 1 | **A — Plain TS + Jest** | 10 | 13 | **23** | ✅ | 48 | 4/4 | 3/4 |
| 🥇 1 | **C — TDD** | 10 | 13 | **23** | ✅ | 27 | 4/4 | 3/4 |
| 🥉 3 | **H — Consensus** | 10 | 12 | **22** | ✅ | 19 | 4/4 | 2/4 |
| 4 | D — PBT (fast-check) | 7 | 14 | **21** | ❌ (1 retry) | 11 | 4/4 | 4/4 |
| 4 | J — Dafny+PBT Hybrid | 7 | 14 | **21** | ❌ (1 retry) | 14 | 4/4 | 4/4 |
| 6 | I — PBT+Effect Hybrid | 7 | 13 | **20** | ❌ (1 retry) | 14 | 4/4 | 3/4 |
| 7 | B — Effect TS+XState | 7 | 12 | **19** | ❌ (1 retry) | 25 | 4/4 | 2/4 |

**Skipped:** E (Dafny), F (Lean 4), G (Coq) — toolchains installing.

## Key Observations

### Generation Reliability
- **Simple methods win on first-try**: A (Plain TS), C (TDD), H (Consensus) all passed first try.
- **Complex methods needed fixes**: B (Effect), D (PBT), I (hybrid), J (hybrid) all required 1 retry due to:
  - Effect TS: `Effect.die()` wraps errors in `FiberFailure` — `instanceof` checks fail
  - PBT: Floating-point edge cases (`0.010000000000000002`) break strict equality assertions
  - These are **method complexity costs**, not implementation bugs

### Bug Detection
- **All methods caught all 4 bugs** — no differentiation on catch rate
- **PBT methods (D, J) scored highest on detection** — fast-check provides shrunk counterexamples that point directly to the bug (e.g., `prix=0.89, rate=0` for off-by-one)
- **Effect TS methods (B, I) had less actionable errors** — FiberFailure wrapping obscures the original error

### Complexity vs. Value
- **Plain TS + Jest**: Zero overhead, high reliability. The baseline is very strong.
- **TDD**: Same scores as Plain TS — the discipline didn't add detection power on this task.
- **PBT**: Best detection quality (actionable shrunk examples), but harder to write correctly (float edge cases).
- **Effect TS**: Adds typed error channels but introduces complexity (FiberFailure) with no detection benefit on this task.
- **Consensus**: High generation reliability, but 3x the code for the same result.

## Preliminary Verdict (BL-1 only)
For **business logic pricing**, the best method is the simplest: **Plain TS + Jest** or **TDD**.
PBT shines in **detection quality** (actionable counterexamples) but costs more to implement correctly.
Effect TS adds complexity without proportional benefit for pure computation tasks.

---

*This is one task. Conclusions will change with more data across different task types.*
