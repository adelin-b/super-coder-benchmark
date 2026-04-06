I notice the specification you provided is incomplete. You've given me:
- File name: `lru.ts`
- Brief description: "Least Recently Used cache with O(1) get/put"

But I'm missing critical details needed to follow my rigorous 7-step implementation process:

1. **Exported names**: Should I export a class like `LRUCache`? A factory function? What are the exact names?
2. **Constructor/factory signature**: What parameters does it take? (e.g., capacity)
3. **Methods**: What methods must the cache have? (e.g., `get()`, `put()`, `delete()`, `size()`, `clear()`?)
4. **Return types**: What does `get()` return on miss? (e.g., `undefined`, `null`, `-1`?)
5. **Edge cases**: How should invalid inputs be handled? (throw or return?)
6. **Test file**: Do you have a test file showing expected behavior?

Could you provide:
- The complete specification with exported function/class names and signatures
- The test file (if available) that shows what methods are called and expected behavior

Once I have these details, I'll implement it following my 7-step process with explicit validation, invariant checking, and comprehensive edge case handling.