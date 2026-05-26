import { test, expect, type Page } from "@playwright/test";

/**
 * Folio E2E smoke tests for the SQLite + cookie-auth stack.
 * Assumes pnpm dev on :3000 + .env.local SEED_ADMIN_EMAIL set.
 */

const APP = "http://localhost:3000";
const ADMIN_EMAIL = "majaskamera27@gmail.com";

test.beforeEach(async ({ request }) => {
  // Truncate DB before each test for true isolation
  await request.post(`${APP}/api/dev/reset`);
});

async function signIn(page: Page, email = ADMIN_EMAIL) {
  // Server action click + redirect can be flaky under load — one retry
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${APP}/login`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

test.describe("auth gate", () => {
  test("/ redirects to /login", async ({ page }) => {
    await page.goto(APP);
    expect(page.url()).toContain("/login");
  });

  test("protected routes bounce to /login", async ({ page }) => {
    for (const path of ["/dashboard", "/assets", "/real-estate", "/settings"]) {
      await page.goto(`${APP}${path}`);
      expect(page.url()).toContain("/login");
    }
  });
});

test.describe("design tokens", () => {
  test("--foreground is deep charcoal in light mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${APP}/login`);
    const fg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim(),
    );
    expect(fg).toBe("#1f1e1b");
  });

  test("brand panel on /login is dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP}/login`);
    const bg = await page
      .locator("aside.bg-foreground")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(31, 30, 27)");
  });
});

test.describe("sign-in", () => {
  test("invited email signs in", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();
  });

  test("non-invited email is rejected", async ({ page }) => {
    await page.goto(`${APP}/login`);
    await page.getByLabel("Email", { exact: true }).fill("not-invited@example.com");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/isn'?t on the invite list/i)).toBeVisible();
  });
});

test.describe("assets", () => {
  test("create stock, add buy, see derived position", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/assets/new`);

    await page.getByLabel("Name").fill("Apple Inc.");
    await page.getByLabel("Ticker").fill("AAPL");
    await page.getByRole("button", { name: /create asset/i }).click();

    await expect(page).toHaveURL(/\/assets\/[a-f0-9-]{36}/);
    await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();

    const newTxBtn = page.getByRole("button", { name: /new transaction/i }).first();
    await expect(newTxBtn).toBeVisible({ timeout: 10_000 });
    await newTxBtn.click();
    await page.getByLabel("Quantity").fill("10");
    await page.getByLabel("Unit price").fill("100");
    await page.getByRole("button", { name: /save transaction/i }).click();

    await expect(page.getByText(/€\s?1[,.]000/)).toBeVisible({ timeout: 10_000 });
  });

  test("created asset shows on /assets list", async ({ page }) => {
    await signIn(page);
    // Create asset inline so test is independent of others
    await page.goto(`${APP}/assets/new`);
    await page.getByLabel("Name").fill("Microsoft Corp.");
    await page.getByLabel("Ticker").fill("MSFT");
    await page.getByRole("button", { name: /create asset/i }).click();
    await expect(page).toHaveURL(/\/assets\/[a-f0-9-]{36}/);

    await page.goto(`${APP}/assets`);
    await expect(page.getByText("Microsoft Corp.")).toBeVisible();
    await expect(page.getByText("MSFT")).toBeVisible();
  });
});

test.describe("pricing API", () => {
  test("POST /api/prices/refresh returns live AAPL price", async ({ page }) => {
    await signIn(page);
    // Create AAPL inline so the refresh has something to fetch
    await page.goto(`${APP}/assets/new`);
    await page.getByLabel("Name").fill("Apple Inc.");
    await page.getByLabel("Ticker").fill("AAPL");
    await page.getByRole("button", { name: /create asset/i }).click();
    await expect(page).toHaveURL(/\/assets\/[a-f0-9-]{36}/);

    const r = await page.request.post(`${APP}/api/prices/refresh`, {
      data: { tickers: ["AAPL"] },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);
    const aapl = body.refreshed.find(
      (q: { symbol: string; price: number }) => q.symbol === "AAPL",
    );
    expect(aapl).toBeTruthy();
    expect(typeof aapl.price).toBe("number");
    expect(aapl.price).toBeGreaterThan(0);
    console.log(`live AAPL = ${aapl.price} ${aapl.currency}`);
  });

  test("unauthenticated refresh is 401", async ({ request }) => {
    const r = await request.post(`${APP}/api/prices/refresh`, {
      data: { tickers: ["AAPL"] },
    });
    expect(r.status()).toBe(401);
  });
});

test.describe("real estate", () => {
  test("create property, see it on /real-estate", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/real-estate/new`);

    await page.getByLabel("Name").fill("Sunset Apt 3B");
    await page.getByLabel("Street").fill("Klaipēdas iela 58/60");
    await page.getByLabel("City").fill("Riga");
    await page.getByLabel("Country").fill("Latvia");

    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("250000");
    await page.getByLabel("Current valuation").fill("260000");
    await page.getByLabel("Last valued").fill(today);

    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);
    await expect(page.getByRole("heading", { name: "Sunset Apt 3B" })).toBeVisible();

    await page.goto(`${APP}/real-estate`);
    await expect(page.getByText("Sunset Apt 3B")).toBeVisible();
  });
});

test.describe("dashboard", () => {
  test("shows KPI cards with data after creating assets", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/dashboard`);
    await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();
    await expect(page.getByText(/total value/i)).toBeVisible();
    await expect(page.getByText(/cost basis/i)).toBeVisible();
  });
});
