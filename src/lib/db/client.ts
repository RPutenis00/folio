import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";
import { ensureSchema } from "./init";

let _db: BetterSQLite3Database<typeof schema> | null = null;

function getDb(): BetterSQLite3Database<typeof schema> {
  if (_db) return _db;
  const dbPath = resolve(process.cwd(), process.env.SQLITE_PATH ?? "./.data/folio.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  ensureSchema(sqlite);

  _db = drizzle(sqlite, { schema });
  return _db;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
