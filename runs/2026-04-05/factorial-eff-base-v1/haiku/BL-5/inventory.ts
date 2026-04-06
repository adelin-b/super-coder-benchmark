I need the complete specification for BL-5: Inventory Reservation System. Please provide:

1. **Data structures** — what interfaces/types should be exported?
2. **Functions** — what are the exact function signatures (reserve, release, checkAvailability, etc.)?
3. **Behavior** — the expected behavior for each operation
4. **Concurrency model** — how should concurrent requests be handled?
5. **Error cases** — what errors can occur and how should they be reported?
6. **State management** — should this track inventory per product ID, with quantities, reservation state, etc.?

For example, is it something like:
- `reserve(productId: string, quantity: number): ReservationId`
- `release(reservationId: string): void`
- `checkAvailability(productId: string): number`
- etc.?

Please share the full specification so I can implement it correctly.