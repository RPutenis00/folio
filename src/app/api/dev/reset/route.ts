import "server-only";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";

/**
 * POST /api/dev/reset
 *
 * Truncates every data table and re-seeds the admin invite. Refuses in
 * production. Used by Playwright globalSetup to start each test run with
 * a deterministic empty DB.
 */
export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  // Order matters — child rows first.
  await db.delete(schema.attachments);
  await db.delete(schema.holdingsSnapshots);
  await db.delete(schema.rentalScenarios);
  await db.delete(schema.properties);
  await db.delete(schema.transactions);
  await db.delete(schema.assets);
  await db.delete(schema.priceSnapshots);
  await db.delete(schema.fxRates);
  await db.delete(schema.invitedEmails);
  await db.delete(schema.profiles);

  // Re-seed admin invite from env (same logic as init.ts).
  const seedEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (seedEmail) {
    await db
      .insert(schema.invitedEmails)
      .values({ email: seedEmail, note: "Seeded admin" })
      .onConflictDoNothing();
  }

  return NextResponse.json({ ok: true });
}
