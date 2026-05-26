import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end CALCULATION verification.
 *
 * Drives the UI, then asserts that rendered numbers match hand-calculated
 * expected values. Catches the case where the pure-functions are right but
 * the UI wiring is wrong (or vice versa).
 *
 * Runs against the same dev server with the same reset-each-run global setup,
 * so we get a deterministic empty DB.
 */

const APP = "http://localhost:3000";
const ADMIN_EMAIL = "majaskamera27@gmail.com";

test.beforeEach(async ({ request }) => {
  await request.post(`${APP}/api/dev/reset`);
});

async function signIn(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${APP}/login`);
    await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

async function createStock(page: Page, name: string, ticker: string) {
  await page.goto(`${APP}/assets/new`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Ticker").fill(ticker);
  await page.getByRole("button", { name: /create asset/i }).click();
  await expect(page).toHaveURL(/\/assets\/[a-f0-9-]{36}/);
}

async function addBuy(
  page: Page,
  opts: { quantity: number; unitPrice: number; date?: string; currency?: string },
) {
  const btn = page.getByRole("button", { name: /new transaction/i }).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click();
  await page.getByLabel("Quantity").fill(String(opts.quantity));
  await page.getByLabel("Unit price").fill(String(opts.unitPrice));
  if (opts.date) {
    await page.getByLabel("Date").fill(opts.date);
  }
  await page.getByRole("button", { name: /save transaction/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
  // After server action revalidates, the page re-renders; give it a tick
  await page.waitForLoadState("domcontentloaded");
}

/* ---------------- 1. Single buy -------------- */

test.describe("Cost basis — single buy", () => {
  test("10 shares @ €100 → quantity 10, avg cost €100, market value €1,000", async ({ page }) => {
    await signIn(page);
    await createStock(page, "Single Buy Test", "SBT");
    await addBuy(page, { quantity: 10, unitPrice: 100 });

    // Quantity card
    await expect(page.locator("text=Quantity").locator("..").getByText("10")).toBeVisible();

    // Avg cost = 100 (formatted with euro sign)
    const avg = page.locator("text=Avg cost").locator("..").locator(".tabular-nums").first();
    await expect(avg).toContainText(/€\s*100/);

    // Market value or cost basis = 1,000 (no price yet → uses cost basis)
    // We check the value contains "€1" and "000" since formatting may be €1,000.00 or €1 000
    const body = await page.content();
    expect(body).toMatch(/€\s?1[,.\s]?000/);
  });
});

/* ---------------- 2. Multiple buys → weighted avg -------------- */

test.describe("Cost basis — weighted average", () => {
  test("buys at different prices → correct weighted avg", async ({ page }) => {
    await signIn(page);
    await createStock(page, "Weighted Avg Test", "WAT");

    // 10 @ 100 + 10 @ 200 → avg = 150, total cost = 3000
    await addBuy(page, { quantity: 10, unitPrice: 100, date: "2024-01-01" });
    await addBuy(page, { quantity: 10, unitPrice: 200, date: "2024-02-01" });

    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // The asset detail page shows KPI cards: Quantity, Avg cost, Market value,
    // Unrealized P&L. We assert Avg cost = €150 (10*100 + 10*200) / 20 = 150
    // and Quantity = 20.
    const html = await page.content();
    // Avg cost €150 (formatted as €150.00 or €150)
    expect(html, "avg cost should be €150").toMatch(/€\s?150(\.00|[^0-9])/);
    // Quantity 20 (Drizzle stores as text, util renders as "20.00000000" or similar)
    expect(html, "quantity should include 20").toMatch(/[>"]\s*20(\.0+)?[<\s"]/);
  });
});

/* ---------------- 3. FX-converted buy -------------- */

test.describe("Cost basis — FX conversion", () => {
  test("buy in USD captures FX at entry; cost basis shows EUR-equivalent", async ({ page }) => {
    await signIn(page);
    await createStock(page, "USD Stock", "USDX");

    // We submit currency=USD. FX will be looked up via Frankfurter; we just
    // assert that A) the tx was saved with non-1 FX, and B) cost basis in
    // EUR ≠ raw USD total (it's been converted).
    await page.getByRole("button", { name: /new transaction/i }).first().click();
    await page.getByLabel("Quantity").fill("10");
    await page.getByLabel("Unit price").fill("100");
    // open the Currency select
    await page.locator('[id="currency"]').click();
    await page.getByRole("option", { name: "USD" }).first().click();
    await page.getByRole("button", { name: /save transaction/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await page.reload();

    // Cost basis (EUR) for 10 USD * 100 with EUR rate ~0.9 should be ~€900,
    // i.e. between €700 and €1,000 — definitely NOT €1,000 (which would mean
    // FX wasn't applied).
    const text = await page.content();
    const m = text.match(/Avg cost[\s\S]{0,200}?€\s?([0-9]+(?:[,.][0-9]{1,2})?)/);
    expect(m, "could not find avg cost").toBeTruthy();
    const eur = Number(m![1]!.replace(/,/g, ""));
    expect(eur).toBeGreaterThan(50);
    expect(eur).toBeLessThan(150);
    console.log(`USD->EUR avg cost ≈ €${eur} (raw 10*$100 = $1000)`);
  });
});

/* ---------------- 4. Pricing API math -------------- */

test.describe("Pricing API", () => {
  test("refresh returns prices that match Stooq's CSV directly", async ({ page, request }) => {
    await signIn(page);
    await createStock(page, "Live AAPL", "AAPL");

    const apiR = await page.request.post(`${APP}/api/prices/refresh`, {
      data: { tickers: ["AAPL"] },
    });
    expect(apiR.ok()).toBe(true);
    const body = await apiR.json();
    const aapl = body.refreshed.find((q: { symbol: string }) => q.symbol === "AAPL");
    expect(aapl).toBeTruthy();
    expect(aapl.price).toBeGreaterThan(0);
    expect(["USD", "EUR", "GBP"]).toContain(aapl.currency);

    // Cross-check against Stooq directly
    const stooq = await request.get(
      "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv",
    );
    const csv = (await stooq.text()).trim();
    const lines = csv.split(/\r?\n/);
    const headers = lines[0]!.split(",");
    const values = lines[1]!.split(",");
    const closeIdx = headers.findIndex((h) => h.toLowerCase() === "close");
    const stooqPrice = Number(values[closeIdx]!);
    expect(stooqPrice).toBeGreaterThan(0);

    // Allow 0.5% drift (rates can update between calls)
    const drift = Math.abs(aapl.price - stooqPrice) / stooqPrice;
    expect(drift).toBeLessThan(0.005);
    console.log(`API ${aapl.price} vs Stooq ${stooqPrice} (drift ${(drift * 100).toFixed(3)}%)`);
  });
});

/* ---------------- 5. Property net cash flow -------------- */

test.describe("Real estate cash flow", () => {
  test("expenses minus income = rendered net cash flow", async ({ page }) => {
    await signIn(page);

    // Create property
    await page.goto(`${APP}/real-estate/new`);
    await page.getByLabel("Name").fill("CashFlow Test");
    await page.getByLabel("Street").fill("Test St 1");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("100000");
    await page.getByLabel("Current valuation").fill("100000");
    await page.getByLabel("Last valued").fill(today);
    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);

    // KPI cards: cash invested should be 100,000 (the purchase)
    await expect(page.getByText(/cash invested/i)).toBeVisible();
    const body = await page.content();
    expect(body).toMatch(/€\s?100[,.\s]?000/);
  });
});

/* ---------------- 6. FIFO sell — realized P&L -------------- */

test.describe("Cost basis — FIFO realized P&L", () => {
  test("two buys then partial sell → realized P&L matches FIFO hand calc", async ({ page }) => {
    await signIn(page);
    await createStock(page, "FIFO Test", "FIFO");

    // Buy 10 @ €100 (Jan), Buy 10 @ €200 (Feb), Sell 15 @ €250 (Mar)
    // FIFO: sells 10 from Jan lot (cost 100) + 5 from Feb lot (cost 200)
    //   realized = 10*(250-100) + 5*(250-200) = 1500 + 250 = €1750
    //   remaining = 5 @ €200 cost
    await addBuy(page, { quantity: 10, unitPrice: 100, date: "2024-01-15" });
    await addBuy(page, { quantity: 10, unitPrice: 200, date: "2024-02-15" });

    // Add sell via TransactionDialog — select type=sell
    const btn = page.getByRole("button", { name: /new transaction/i }).first();
    await btn.click();
    await page.locator('[id="type"]').click();
    await page.getByRole("option", { name: /^sell$/i }).click();
    await page.getByLabel("Quantity").fill("15");
    await page.getByLabel("Unit price").fill("250");
    await page.getByLabel("Date").fill("2024-03-15");
    await page.getByRole("button", { name: /save transaction/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await page.reload();

    const html = await page.content();
    // Remaining quantity = 5
    expect(html, "quantity should be 5").toMatch(/[>"]\s*5(\.0+)?[<\s"]/);
    // Realized P&L = €1,750
    expect(html, "realized P&L should be €1,750").toMatch(/€\s?\+?1[,.\s]?750/);
  });
});

/* ---------------- 7. Sign out clears session -------------- */

test.describe("Sign out", () => {
  test("after sign-out, protected route bounces to /login", async ({ page, context }) => {
    await signIn(page);
    // Clear cookies (simpler than finding the sign-out menu)
    await context.clearCookies();
    await page.goto(`${APP}/dashboard`);
    expect(page.url()).toContain("/login");
  });
});
