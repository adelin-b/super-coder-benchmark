I need the test file to implement this correctly. According to my instructions, I must:

1. **Read the test file first** to extract the complete API contract (function names, method signatures, class structure, exports)
2. **Export every symbol the test imports** with exact names and types
3. **Match method vs. property distinction** exactly as the test uses them

The spec alone ("Reserve stock, release, check availability, handle concurrent-style operations") is too vague. The test file will tell me:
- What functions/classes to export
- What methods vs. properties to implement
- What error cases to validate with `throw` vs. silently handle
- Edge cases and boundary conditions

Please provide the test file (e.g., `inventory.test.ts`) and I'll implement the module to make all tests pass.