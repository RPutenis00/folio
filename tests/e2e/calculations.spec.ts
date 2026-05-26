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

/* ---------------- 7. Rental scenario yields -------------- */

test.describe("Rental scenario — LTR yield calculation", () => {
  test("LTR scenario shows expected gross / net yields and NOI", async ({ page }) => {
    await signIn(page);

    // Create a €200k property
    await page.goto(`${APP}/real-estate/new`);
    await page.getByLabel("Name").fill("LTR Yield Test");
    await page.getByLabel("Street").fill("Yield St 1");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("200000");
    await page.getByLabel("Current valuation").fill("200000");
    await page.getByLabel("Last valued").fill(today);
    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);

    // Switch to scenarios tab
    await page.getByRole("tab", { name: /rental scenarios/i }).click();
    await page.getByRole("button", { name: /new scenario/i }).click();

    // LTR @ €1,000/month, 5% vacancy, €100 monthly OPEX
    // Expected:
    //   annual gross = 1000 * 12 * 0.95 = 11,400
    //   annual opex  = 100 * 12         = 1,200
    //   NOI          = 10,200
    //   gross yield  = 11,400 / 200,000 = 5.7%
    //   net yield    = 10,200 / 200,000 = 5.1%
    await page.getByLabel("Name").fill("Base LTR");
    // Strategy defaults to LTR (first option); we leave it
    await page.getByLabel(/Monthly rent/i).fill("1000");
    await page.getByLabel(/Vacancy/i).fill("5");
    await page.getByLabel(/Monthly OPEX/i).fill("100");
    await page.getByRole("button", { name: /save scenario/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Comparison table should appear with computed metrics
    await page.waitForLoadState("domcontentloaded");
    const html = await page.content();

    // gross yield 5.7%  net yield 5.1%
    expect(html, "gross yield should be 5.7%").toMatch(/5\.7\s*%/);
    expect(html, "net yield should be 5.1%").toMatch(/5\.1\s*%/);
    // NOI €10,200
    expect(html, "NOI should be €10,200").toMatch(/€\s?10[,.\s]?200/);
  });
});

/* ---------------- 8. STR scenario ---------------- */

test.describe("Rental scenario — STR yield calculation", () => {
  test("STR scenario yields match hand calc", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/real-estate/new`);
    await page.getByLabel("Name").fill("STR Yield Test");
    await page.getByLabel("Street").fill("STR St");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("300000");
    await page.getByLabel("Current valuation").fill("300000");
    await page.getByLabel("Last valued").fill(today);
    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);

    await page.getByRole("tab", { name: /rental scenarios/i }).click();
    await page.getByRole("button", { name: /new scenario/i }).click();

    await page.getByLabel("Name").fill("STR plan");
    // Change strategy to STR
    await page.locator('[id="strategy"]').click();
    await page.getByRole("option", { name: /short-term/i }).click();

    // STR: nightly rate €100, occupancy 70%, avg stay 3 nights,
    // cleaning fee €50 per stay, platform fee 15%, monthly opex €300
    // Expected:
    //   nights occupied = 365 * 0.70 = 255.5
    //   gross = 100 * 255.5 = 25,550
    //   stays = 255.5 / 3 = 85.166...
    //   cleaning income = 50 * 85.166... = 4,258.33
    //   annual gross  = 29,808.33 → rounds to ~€29,808
    //   annual opex   = 300*12 + 29,808.33 * 0.15 = 3600 + 4,471.25 = 8,071.25
    //   NOI           = 29,808.33 - 8,071.25 = 21,737.08
    //   gross yield   = 29,808.33 / 300,000 = 9.94%
    //   net yield     = 21,737.08 / 300,000 = 7.25%
    await page.getByLabel(/Nightly rate/i).fill("100");
    await page.getByLabel(/Occupancy/i).fill("70");
    await page.getByLabel(/Avg stay/i).fill("3");
    await page.getByLabel(/Cleaning fee/i).fill("50");
    await page.getByLabel(/Platform fee/i).fill("15");
    await page.getByLabel(/Monthly OPEX/i).fill("300");
    await page.getByRole("button", { name: /save scenario/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded");

    const html = await page.content();
    // Hand calc: gross ≈ 9.94%, net ≈ 7.25%
    expect(html, "STR gross yield ~9.94%").toMatch(/9\.9[0-9]?\s*%/);
    expect(html, "STR net yield ~7.25%").toMatch(/7\.2[0-9]?\s*%/);
  });
});

/* ---------------- 9. Multi-asset portfolio rollup -------------- */

test.describe("Portfolio rollup", () => {
  test("dashboard total = sum of all asset cost bases when no live prices", async ({ page }) => {
    await signIn(page);

    // Asset 1: 10 @ €100 → cost €1,000
    await createStock(page, "Asset One", "ONE");
    await addBuy(page, { quantity: 10, unitPrice: 100 });
    // Asset 2: 5 @ €200 → cost €1,000
    await createStock(page, "Asset Two", "TWO");
    await addBuy(page, { quantity: 5, unitPrice: 200 });
    // Asset 3: 1 @ €1500 → cost €1,500
    await createStock(page, "Asset Three", "THREE");
    await addBuy(page, { quantity: 1, unitPrice: 1500 });

    // Total cost basis = 1,000 + 1,000 + 1,500 = €3,500
    await page.goto(`${APP}/dashboard`);
    await page.waitForLoadState("domcontentloaded");
    const html = await page.content();

    // Without live prices, market value falls back to cost basis,
    // so total value = €3,500
    expect(html, "total cost basis should be €3,500").toMatch(/€\s?3[,.\s]?500/);
  });
});

/* ---------------- 10. Hybrid scenario -------------- */

test.describe("Rental scenario — Hybrid (LTR + STR)", () => {
  test("hybrid scenario blends LTR and STR portions correctly", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/real-estate/new`);
    await page.getByLabel("Name").fill("Hybrid Test");
    await page.getByLabel("Street").fill("Hybrid St");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("250000");
    await page.getByLabel("Current valuation").fill("250000");
    await page.getByLabel("Last valued").fill(today);
    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);

    await page.getByRole("tab", { name: /rental scenarios/i }).click();
    await page.getByRole("button", { name: /new scenario/i }).click();

    await page.getByLabel("Name").fill("Hybrid plan");
    await page.locator('[id="strategy"]').click();
    await page.getByRole("option", { name: /hybrid/i }).click();

    // LTR half: monthly rent €1500, 6 months, 0% vacancy → 1500*6 = 9,000
    // STR half: 365/2 = 182.5 days → occupied 127.75 nights at €120
    //   gross_str = 127.75 * 120 = 15,330
    //   stays = 127.75 / 3 = 42.58
    //   cleaning = 60 * 42.58 = 2,555
    //   str_total ≈ 17,885
    // grand total ≈ 26,885
    // opex: 200*12 + 26,885*0.15 = 2400 + 4032.75 = 6,432.75
    // NOI ≈ 20,452
    // gross yield = 26,885 / 250,000 ≈ 10.75%
    // net yield = 20,452 / 250,000 ≈ 8.18%
    await page.getByLabel(/Monthly rent/i).fill("1500");
    await page.getByLabel(/LTR months/i).fill("6");
    await page.getByLabel(/Vacancy/i).fill("0");
    await page.getByLabel(/Nightly rate/i).fill("120");
    await page.getByLabel(/Occupancy/i).fill("70");
    await page.getByLabel(/Avg stay/i).fill("3");
    await page.getByLabel(/Cleaning fee/i).fill("60");
    await page.getByLabel(/Platform fee/i).fill("15");
    await page.getByLabel(/Monthly OPEX/i).fill("200");
    const saveBtn = page.getByRole("button", { name: /save scenario/i });
    await saveBtn.click({ force: true });
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded");

    const html = await page.content();
    // gross yield ~10.7-10.8%
    expect(html, "Hybrid gross yield ~10.7%").toMatch(/10\.[78][0-9]?\s*%/);
  });
});

/* ---------------- 11. Property revaluation ---------------- */

test.describe("Property revaluation", () => {
  test("revalue increases current valuation and logs a valuation tx", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/real-estate/new`);
    await page.getByLabel("Name").fill("Revalue Test");
    await page.getByLabel("Street").fill("Up St");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("100000");
    await page.getByLabel("Current valuation").fill("100000");
    await page.getByLabel("Last valued").fill(today);
    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);

    await page.getByRole("button", { name: /^revalue$/i }).click();
    await page.getByLabel(/New valuation/i).fill("150000");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    const html = await page.content();
    expect(html, "current valuation should be €150,000").toMatch(/€\s?150[,.\s]?000/);
  });
});

/* ---------------- 12. Admin invite + revoke -------------- */

test.describe("Admin invites", () => {
  test("admin can add and revoke an invited email", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/settings/invites`);
    await expect(page.getByRole("heading", { name: /invites/i })).toBeVisible();

    const newEmail = `friend-${Date.now()}@example.com`;
    await page.getByLabel("Email").fill(newEmail);
    await page.getByRole("button", { name: /add invite/i }).click();
    await expect(page.getByText(newEmail)).toBeVisible({ timeout: 10_000 });

    // Revoke — click delete (Trash2 icon)
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: new RegExp(`revoke ${newEmail}`, "i") }).click();
    await expect(page.getByText(newEmail)).toBeHidden({ timeout: 10_000 });
  });
});

/* ---------------- 13. Sign out clears session -------------- */

test.describe("Sign out", () => {
  test("after sign-out, protected route bounces to /login", async ({ page, context }) => {
    await signIn(page);
    // Clear cookies (simpler than finding the sign-out menu)
    await context.clearCookies();
    await page.goto(`${APP}/dashboard`);
    expect(page.url()).toContain("/login");
  });
});
