# WEB-TS-10: Type-Safe SQL Query Builder

## Overview
Build a chainable SQL query builder where the result type reflects exactly which columns were selected from which table. Wrong column names produce compile-time errors, and the final result type is narrowed to only the selected columns.

## What You Must Implement

In the file `query-builder.ts`, implement and export:

### 1. `DefineSchema<S>`
A type helper that takes a schema definition object mapping table names to their column types, e.g.:
```ts
type DB = DefineSchema<{
  users: { id: number; name: string; age: number; email: string }
  posts: { id: number; title: string; body: string; author_id: number }
}>
```

### 2. `QueryBuilder<Schema, Table, Selected>`
A chainable query builder class/interface with these methods:

- `.from<T>(table: T)` -- Sets the target table. `T` must be a key of the schema. Returns a new builder with the table set.
- `.select<C>(...columns: C[])` -- Selects columns. Each column must be a key of the chosen table's columns. Returns a new builder with the selected columns recorded in the type.
- `.where<C>(column: C, op: '=' | '!=' | '>' | '<' | '>=' | '<=', value: V)` -- Adds a WHERE condition. The column must be a valid column of the current table, and the value type must match that column's type. Returns the same builder type.
- `.orderBy<C>(column: C, direction?: 'asc' | 'desc')` -- Adds ORDER BY. Column must be valid.
- `.limit(n: number)` -- Adds LIMIT.
- `.build()` -- Returns the SQL string.
- `.execute()` -- Returns `Promise<Result[]>` where `Result` is `Pick<TableColumns, SelectedColumns>`.

### 3. `createQueryBuilder<S>(schema: S): QueryBuilder<S>`
Factory function that creates a new query builder from a schema.

## Key Constraints
- Selecting a column that doesn't exist on the table must be a **compile-time error**.
- Using `.where()` with a column that doesn't exist must be a **compile-time error**.
- The `.where()` value parameter must match the type of the referenced column (e.g., `where('age', '>', 'not-a-number')` must fail).
- After `.select('name', 'age')`, the execute result type must be exactly `{ name: string, age: number }`, not the full row type.
- If `.select()` is not called, `.execute()` returns all columns.
- Multiple `.where()` calls chain with AND semantics.
- `.build()` must return a syntactically reasonable SQL string.
