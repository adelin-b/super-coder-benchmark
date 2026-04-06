I notice the spec provided is incomplete. The title mentions "BL-5: Inventory Reservation System" with basic functionality (reserve stock, release, check availability, handle concurrent operations), but I need the **full specification** and **test file** to determine:

1. **Exported function/class names** (e.g., `createInventory()`, `class Inventory`, etc.)
2. **Method signatures** (what parameters, return types)
3. **Error handling** (what should throw vs. return)
4. **Edge cases** (zero/negative quantities, concurrent requests, double-release, etc.)
5. **Data structures** (what fields does an inventory item have?)

**Please provide:**
- The complete spec/requirements document
- The test file (so I can see exactly what gets imported and called)

Once you share those, I'll implement the module following the 7-step process:
1. Extract all exported names from tests
2. List edge cases
3. Identify 3 invariants
4. Implement with Effect internally, plain TS externally
5. Self-review exports
6. Find and fix 3 bugs
7. Pre-submission checklist