import { Effect, Exit, Cause, Data } from "effect";

// ──────────────────────────────────────────────────────────────────────────────
// Public type helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Identity type-helper — just returns S as-is so callers can annotate schemas. */
export type DefineSchema<S> = S;

type SchemaBase = Record<string, Record<string, unknown>>;

// ──────────────────────────────────────────────────────────────────────────────
// QueryBuilder public type
// ──────────────────────────────────────────────────────────────────────────────

type IfSet<T, Yes, No> = [T] extends [never] ? No : Yes;

type ValidColumns<S extends SchemaBase, T extends keyof S> = [T] extends [never] ? never : keyof S[T];

type ValueOf<S extends SchemaBase, T extends keyof S, C> =
  [T] extends [never] ? never : C extends keyof S[T] ? S[T][C] : never;

type ExecuteResult<S extends SchemaBase, T extends keyof S, Selected> =
  [T] extends [never]
    ? never
    : [Selected] extends [never]
      ? S[T]
      : Selected extends keyof S[T]
        ? Pick<S[T], Selected>
        : never;

export type QueryBuilder<
  S extends SchemaBase,
  T extends keyof S = never,
  Selected = never
> = {
  /** Set the target table. Must be a key of the schema. */
  from<K extends keyof S>(table: K): QueryBuilder<S, K, never>;

  /** Select specific columns. Each must be a valid column of the current table. */
  select<C extends ValidColumns<S, T>>(...columns: C[]): QueryBuilder<S, T, C>;

  /** Add a WHERE condition. Column and value type must match the table's columns. */
  where<C extends ValidColumns<S, T>>(
    column: C,
    op: "=" | "!=" | ">" | "<" | ">=" | "<=",
    value: ValueOf<S, T, C>
  ): QueryBuilder<S, T, Selected>;

  /** Add ORDER BY clause. Column must be a valid column of the current table. */
  orderBy<C extends ValidColumns<S, T>>(
    column: C,
    direction?: "asc" | "desc"
  ): QueryBuilder<S, T, Selected>;

  /** Add LIMIT clause. */
  limit(n: number): QueryBuilder<S, T, Selected>;

  /** Produce the SQL string. */
  build(): string;

  /**
   * Execute the query.
   * Result type is narrowed to selected columns if .select() was called,
   * otherwise all columns of the table are returned.
   */
  execute(): Promise<Array<ExecuteResult<S, T, Selected>>>;
};

// ──────────────────────────────────────────────────────────────────────────────
// Internal state + Effect-based build logic
// ──────────────────────────────────────────────────────────────────────────────

interface BuilderState {
  table: string | undefined;
  selected: readonly string[];
  conditions: readonly { column: string; op: string; value: unknown }[];
  orderBys: readonly { column: string; direction: string }[];
  limitVal: number | undefined;
}

class BuildError extends Data.TaggedError("BuildError")<{ reason: string }> {}

const buildSQL = (state: BuilderState): Effect.Effect<string, BuildError> =>
  Effect.gen(function* () {
    if (!state.table) {
      yield* Effect.fail(new BuildError({ reason: "No table specified — call .from() first" }));
    }

    const cols =
      state.selected.length > 0 ? state.selected.join(", ") : "*";

    let sql = `SELECT ${cols} FROM ${state.table}`;

    if (state.conditions.length > 0) {
      const clauses = state.conditions.map(({ column, op, value }) => {
        const val =
          typeof value === "string"
            ? `'${String(value).replace(/'/g, "''")}'`
            : String(value);
        return `${column} ${op} ${val}`;
      });
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }

    if (state.orderBys.length > 0) {
      const clauses = state.orderBys.map(
        ({ column, direction }) => `${column} ${direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${clauses.join(", ")}`;
    }

    if (state.limitVal !== undefined) {
      sql += ` LIMIT ${state.limitVal}`;
    }

    return sql;
  });

// ──────────────────────────────────────────────────────────────────────────────
// Runtime implementation (loosely typed internally, cast at the boundary)
// ──────────────────────────────────────────────────────────────────────────────

class QueryBuilderImpl {
  private readonly state: BuilderState;

  constructor(state: BuilderState) {
    this.state = state;
  }

  private withState(patch: Partial<BuilderState>): QueryBuilderImpl {
    return new QueryBuilderImpl({ ...this.state, ...patch });
  }

  from(table: string): QueryBuilderImpl {
    return new QueryBuilderImpl({
      table,
      selected: [],
      conditions: [],
      orderBys: [],
      limitVal: undefined,
    });
  }

  select(...columns: string[]): QueryBuilderImpl {
    return this.withState({ selected: columns });
  }

  where(column: string, op: string, value: unknown): QueryBuilderImpl {
    return this.withState({
      conditions: [...this.state.conditions, { column, op, value }],
    });
  }

  orderBy(column: string, direction: string = "asc"): QueryBuilderImpl {
    return this.withState({
      orderBys: [...this.state.orderBys, { column, direction }],
    });
  }

  limit(n: number): QueryBuilderImpl {
    return this.withState({ limitVal: n });
  }

  build(): string {
    const exit = Effect.runSyncExit(buildSQL(this.state));
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause);
      const msg =
        raw instanceof Error
          ? raw.message
          : typeof (raw as { reason?: unknown }).reason === "string"
          ? (raw as { reason: string }).reason
          : String(raw);
      throw new Error(msg);
    }
    return exit.value;
  }

  async execute(): Promise<unknown[]> {
    // Build the SQL (validates state) then return an empty array — no real DB.
    this.build();
    return Promise.resolve([]);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory — public entry point
// ──────────────────────────────────────────────────────────────────────────────

const EMPTY_STATE: BuilderState = {
  table: undefined,
  selected: [],
  conditions: [],
  orderBys: [],
  limitVal: undefined,
};

/**
 * Create a new type-safe query builder bound to the given schema.
 *
 * @example
 * type DB = DefineSchema<{ users: { id: number; name: string } }>
 * const db = {} as DB;
 * const qb = createQueryBuilder(db);
 * const sql = qb.from('users').select('id', 'name').where('id', '=', 1).build();
 */
export function createQueryBuilder<S extends SchemaBase>(
  // schema is only used for type inference; the runtime doesn't need it
  _schema: S
): QueryBuilder<S> {
  return new QueryBuilderImpl(EMPTY_STATE) as unknown as QueryBuilder<S>;
}