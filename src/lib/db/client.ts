import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy singleton — does NOT throw at import time so the production `next build`
 * step (which evaluates server modules without a DATABASE_URL) succeeds.
 * Connection is opened on first actual query.
 */
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const client = postgres(url, {
    prepare: false, // Supabase pooler (PgBouncer transaction mode)
    max: 10,
    idle_timeout: 20,
  });
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Proxy that defers initialization until any drizzle method is called.
 * Allows `import { db }` at module scope without a live DB.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
