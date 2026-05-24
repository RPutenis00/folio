"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/current-user";
import { getPrice } from "@/lib/pricing";

export async function refreshPriceAction(ticker: string, category: string) {
  await requireProfile();
  const assetClass: "equity" | "crypto" = category === "crypto" ? "crypto" : "equity";

  try {
    const quote = await getPrice(ticker, assetClass);
    const asOfStr = new Date().toISOString().slice(0, 10);
    await db
      .insert(schema.priceSnapshots)
      .values({
        symbol: ticker.toUpperCase(),
        assetClass,
        asOf: asOfStr,
        price: String(quote.price),
        currency: quote.currency,
      })
      .onConflictDoUpdate({
        target: [schema.priceSnapshots.symbol, schema.priceSnapshots.assetClass, schema.priceSnapshots.asOf],
        set: { price: String(quote.price), currency: quote.currency },
      });
    revalidatePath(`/assets`);
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}
