import pg from "pg";

export type DatabasePool = Pick<pg.Pool, "query" | "end">;

export function createDatabasePool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
