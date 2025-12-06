import { SQL, type TransactionSQL } from "bun";

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformRow<T>(row: Record<string, unknown>): T {
  for (const key of Object.keys(row)) {
    const camelKey = snakeToCamel(key);
    if (camelKey !== key) {
      row[camelKey] = row[key];
      delete row[key];
    }
  }
  return row as T;
}

function transformRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => transformRow<T>(row));
}

type SQLTagFn = <T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

export type WrappedTransactionSQL = SQLTagFn & {
  raw: TransactionSQL;
  (value: Record<string, unknown> | string): SQL.Query<unknown>;
};

export type WrappedSQL = SQLTagFn & {
  begin<T>(fn: (tx: WrappedTransactionSQL) => Promise<T>): Promise<T>;
  close(): void;
  raw: SQL;
  (value: Record<string, unknown> | string): SQL.Query<unknown>;
};

async function wrapPending<T>(pending: Promise<T[]>): Promise<T[]> {
  const rows = await pending;
  return transformRows<T>(rows as Record<string, unknown>[]);
}

function wrapSQL<T extends SQL | TransactionSQL>(sql: T): T {
  const handler: ProxyHandler<T> = {
    apply(_target, _thisArg, args) {
      const result = Reflect.apply(sql as CallableFunction, undefined, args);
      // If result is thenable (a query), wrap it to transform results
      if (result && typeof result.then === "function") {
        return wrapPending(result);
      }
      return result;
    },
    get(_target, prop) {
      if (prop === "raw") return sql;
      if (prop === "begin" && sql instanceof SQL) {
        return <R>(fn: (tx: WrappedTransactionSQL) => Promise<R>) => {
          return sql.begin((tx) =>
            fn(wrapSQL(tx) as unknown as WrappedTransactionSQL),
          );
        };
      }
      return Reflect.get(sql, prop);
    },
  };

  return new Proxy(sql, handler) as T;
}

export function makeSQL(connectionString: string): WrappedSQL {
  return wrapSQL(new SQL(connectionString)) as unknown as WrappedSQL;
}
