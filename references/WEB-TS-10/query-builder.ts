// Reference implementation for WEB-TS-10: Type-Safe SQL Query Builder

/**
 * Schema definition helper - identity at type level.
 */
export type DefineSchema<S extends Record<string, Record<string, unknown>>> = S;

type ComparisonOp = "=" | "!=" | ">" | "<" | ">=" | "<=";

interface WhereClause {
  column: string;
  op: ComparisonOp;
  value: unknown;
}

interface OrderByClause {
  column: string;
  direction: "asc" | "desc";
}

/**
 * The QueryBuilder class. Generic parameters:
 * - Schema: the full database schema
 * - Table: the currently selected table name (or never)
 * - Selected: tuple of selected column names (or never = all)
 */
export class QueryBuilder<
  Schema extends Record<string, Record<string, unknown>>,
  Table extends keyof Schema | never = never,
  Selected extends keyof Schema[Table & keyof Schema] | never = never,
> {
  private _schema: Schema;
  private _table: string | null = null;
  private _selected: string[] = [];
  private _wheres: WhereClause[] = [];
  private _orderBys: OrderByClause[] = [];
  private _limit: number | null = null;

  constructor(schema: Schema) {
    this._schema = schema;
  }

  private clone(): this {
    const c = new QueryBuilder(this._schema) as any;
    c._table = this._table;
    c._selected = [...this._selected];
    c._wheres = [...this._wheres];
    c._orderBys = [...this._orderBys];
    c._limit = this._limit;
    return c;
  }

  from<T extends keyof Schema & string>(
    table: T
  ): QueryBuilder<Schema, T, never> {
    const c = this.clone() as unknown as QueryBuilder<Schema, T, never>;
    (c as any)._table = table;
    return c;
  }

  select<C extends keyof Schema[Table & keyof Schema] & string>(
    ...columns: C[]
  ): QueryBuilder<Schema, Table, C> {
    const c = this.clone() as unknown as QueryBuilder<Schema, Table, C>;
    (c as any)._selected = [...columns];
    return c;
  }

  where<C extends keyof Schema[Table & keyof Schema] & string>(
    column: C,
    op: ComparisonOp,
    value: Schema[Table & keyof Schema][C]
  ): this {
    const c = this.clone();
    c._wheres.push({ column, op, value });
    return c;
  }

  orderBy<C extends keyof Schema[Table & keyof Schema] & string>(
    column: C,
    direction: "asc" | "desc" = "asc"
  ): this {
    const c = this.clone();
    c._orderBys.push({ column, direction });
    return c;
  }

  limit(n: number): this {
    const c = this.clone();
    c._limit = n;
    return c;
  }

  build(): string {
    const cols =
      this._selected.length > 0 ? this._selected.join(", ") : "*";
    let sql = `SELECT ${cols} FROM ${this._table as string}`;
    if (this._wheres.length > 0) {
      const conditions = this._wheres
        .map((w) => {
          const val =
            typeof w.value === "string" ? `'${w.value}'` : String(w.value);
          return `${w.column} ${w.op} ${val}`;
        })
        .join(" AND ");
      sql += ` WHERE ${conditions}`;
    }
    if (this._orderBys.length > 0) {
      const orders = this._orderBys
        .map((o) => `${o.column} ${o.direction.toUpperCase()}`)
        .join(", ");
      sql += ` ORDER BY ${orders}`;
    }
    if (this._limit !== null) {
      sql += ` LIMIT ${this._limit}`;
    }
    return sql;
  }

  execute(): Promise<
    [Selected] extends [never]
      ? Schema[Table & keyof Schema][]
      : Pick<Schema[Table & keyof Schema], Selected & keyof Schema[Table & keyof Schema]>[]
  > {
    // In a real implementation this would run the SQL.
    // Here we just return an empty array for testing purposes.
    return Promise.resolve([] as any);
  }
}

/**
 * Factory function to create a type-safe query builder.
 */
export function createQueryBuilder<
  S extends Record<string, Record<string, unknown>>,
>(schema: S): QueryBuilder<S> {
  return new QueryBuilder(schema);
}
