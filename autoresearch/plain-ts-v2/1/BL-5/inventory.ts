I need more information to implement this correctly. The spec you provided only says:

> Reserve stock, release, check availability, handle concurrent-style operations.

But it doesn't specify:
- What classes or functions to export
- What methods they should have
- What parameters they accept
- What they return
- What errors should be thrown
- The exact API contract

According to the critical rules, I need to read test files carefully to understand the exact API contract (function names, method names, parameter shapes, return types).

Could you provide either:
1. **A test file** (e.g., `inventory.test.ts`) that shows what's being imported and tested, OR
2. **A detailed spec** listing the classes/functions, their signatures, and behavior

For example:
- Should I export a `createInventory()` function, an `Inventory` class, or both?
- What methods should the inventory object have? (`reserve()`, `release()`, `getAvailable()`, etc.?)
- What parameters do they take?
- What validation should throw errors?

Once you provide the test file or detailed API specification, I can implement the module correctly.