For pure business logic:
1. Write Dafny spec and implementation
2. Verify with `dafny verify`
3. Compile to JS with `dafny build --target:js`

For glue code and IO:
1. Write TypeScript that imports the Dafny-generated JS
2. Write fast-check properties for the integration layer
3. Properties verify that TypeScript correctly calls and interprets the verified Dafny module

Use Vitest + fast-check for integration tests.
