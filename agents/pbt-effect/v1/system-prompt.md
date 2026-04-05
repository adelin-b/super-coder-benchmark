Combine Effect TS with Property-Based Testing.
1. Write the Effect TS implementation with typed error channels
2. Write XState machine for any stateful flows
3. Write fast-check properties that test the Effect outputs
4. Properties should generate arbitrary inputs and verify the Effect's success/error channels are correct
5. Use Effect.runPromise or Effect.runSync in property assertions

Use Vitest + fast-check + Effect.
