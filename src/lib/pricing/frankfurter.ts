import "server-only";

const ISO_DATE = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Fetch the EUR-anchored FX rate for one currency on a given date.
 * Returns rate such that: `1 currency = rate EUR`.
 * EUR → EUR returns 1 without a network call.
 */
export async function fetchEurFxRate(currency: string, asOf?: Date): Promise<number> {
  const cur = currency.toUpperCase().trim();
  if (cur === "EUR") return 1;

  const date = asOf ? ISO_DATE(asOf) : "latest";
  const url = `https://api.frankfurter.dev/v1/${date}?base=${encodeURIComponent(cur)}&symbols=EUR`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Frankfurter error ${res.status} for ${cur}@${date}`);
  }
  const json = (await res.json()) as { rates?: { EUR?: number } };
  const rate = json.rates?.EUR;
  if (rate == null) throw new Error(`No EUR rate for ${cur}@${date}`);
  return rate;
}

/**
 * Batched fetch — one HTTP call returning EUR rates for multiple currencies.
 * Frankfurter doesn't support multi-base in one call, so we fan out.
 */
export async function fetchEurFxRates(
  currencies: string[],
  asOf?: Date,
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(currencies.map((c) => c.toUpperCase().trim())));
  const entries = await Promise.all(
    unique.map(async (cur) => [cur, await fetchEurFxRate(cur, asOf).catch(() => 1)] as const),
  );
  return Object.fromEntries(entries);
}
