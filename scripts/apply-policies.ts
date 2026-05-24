import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const sqlPath = join(process.cwd(), "drizzle", "policies.sql");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sqlText = readFileSync(sqlPath, "utf8");
  const sql = postgres(url, { prepare: false, max: 1 });

  console.log("\nApplying RLS, triggers, and Storage buckets…\n");
  try {
    await sql.unsafe(sqlText);
    console.log("✓ Policies applied successfully");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Failed to apply policies:", err);
  process.exit(1);
});
