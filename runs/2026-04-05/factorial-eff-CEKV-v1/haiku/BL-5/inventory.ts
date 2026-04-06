I need the complete specification for BL-5: Inventory Reservation System to implement this correctly.

Please provide:

1. **Exported functions/classes** — What should be exported? (e.g., `createInventory`, `reserve`, `release`, etc.)
2. **Function signatures** — Parameters, return types, and behavior for each
3. **Data structures** — What shape does the inventory state/reservation have?
4. **Error cases** — What errors should be thrown? (e.g., insufficient stock, invalid reservation ID)
5. **Concurrency semantics** — How should concurrent reservations behave? (e.g., atomic operations, ordering guarantees)
6. **Edge cases** — Zero stock, negative quantities, double-release, etc.

For example:
- Do you need a class like `Inventory` with methods `.reserve(itemId, qty)`, `.release(reservationId)`, etc.?
- What happens when stock runs out?
- Should reservations have IDs or references?
- Any expiration/timeout behavior?

Share the full spec and I'll implement it exactly.