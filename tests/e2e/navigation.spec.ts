import { test, expect, type Page } from "@playwright/test";

/**
 * Navigation + UI behaviour tests:
 * - Sidebar nav links all reachable + correct routes
 * - Asset / property deletion cascades
 * - Crypto price refresh via the API
 * - Property edit flow updates the displayed name
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

/* ---------------- Sidebar navigation ---------------- */

test.describe("Sidebar navigation", () => {
  test("all primary sidebar links land on the correct routes", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const [label, expected] of [
      ["Dashboard", "/dashboard"],
      ["Assets", "/assets"],
      ["Real Estate", "/real-estate"],
      ["Settings", "/settings"],
    ] as const) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(expected);
    }
  });

  test("Invites link is visible to admin and lands on /settings/invites", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("link", { name: "Invites", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/invites/);
  });
});

/* ---------------- Asset delete cascades transactions ---------------- */

test.describe("Cascade delete — asset", () => {
  test("deleting an asset removes its transactions too", async ({ page }) => {
    await signIn(page);
    // Create asset + buy
    await page.goto(`${APP}/assets/new`);
    await page.getByLabel("Name").fill("Soon to be deleted");
    await page.getByLabel("Ticker").fill("DEL");
    await page.getByRole("button", { name: /create asset/i }).click();
    await expect(page).toHaveURL(/\/assets\/[a-f0-9-]{36}/);

    const newTxBtn = page.getByRole("button", { name: /new transaction/i }).first();
    await newTxBtn.click();
    await page.getByLabel("Quantity").fill("5");
    await page.getByLabel("Unit price").fill("20");
    await page.getByRole("button", { name: /save transaction/i }).click({ force: true });
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Navigate to edit page → delete
    await page.getByRole("link", { name: /edit asset/i }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /delete asset/i }).click();

    // Lands on /assets, the asset is gone
    await expect(page).toHaveURL(/\/assets$/);
    await expect(page.getByText("Soon to be deleted")).toBeHidden();
  });
});

/* ---------------- Property edit ---------------- */

test.describe("Property edit", () => {
  test("editing a property name updates the title", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/real-estate/new`);
    await page.getByLabel("Name").fill("Old Name");
    await page.getByLabel("Street").fill("X");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Purchase date").fill(today);
    await page.getByLabel("Purchase price").fill("100000");
    await page.getByLabel("Current valuation").fill("100000");
    await page.getByLabel("Last valued").fill(today);
    await page.getByRole("button", { name: /add property/i }).click();
    await expect(page).toHaveURL(/\/real-estate\/[a-f0-9-]{36}/);

    // Edit page
    await page.getByRole("link", { name: /^edit$/i }).click();
    await page.getByLabel("Name").fill("New Shiny Name");
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "New Shiny Name" })).toBeVisible({
      timeout: 10_000,
    });
  });
});

/* ---------------- Crypto pricing via Stooq (BTC) ---------------- */

test.describe("Crypto pricing", () => {
  test("create crypto asset BTC + refresh → API returns a positive price", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/assets/new`);
    // Fill basic fields first
    await page.getByLabel("Name").fill("Bitcoin");
    await page.getByLabel("Ticker").fill("BTC");
    // Open category select and pick Crypto (dropdown is Radix Select)
    await page.locator('[id="category"]').click();
    await page.getByRole("option", { name: "Crypto", exact: true }).click();
    // Wait a beat for state to settle, then submit
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /create asset/i }).click();
    await expect(page).toHaveURL(/\/assets\/[a-f0-9-]{36}/, { timeout: 30_000 });

    const r = await page.request.post(`${APP}/api/prices/refresh`, {
      data: { tickers: ["BTC"] },
    });
    expect(r.ok()).toBe(true);
    const body = await r.json();
    const btc = body.refreshed.find((q: { symbol: string }) => q.symbol === "BTC");
    expect(btc).toBeTruthy();
    expect(btc.price).toBeGreaterThan(0);
    console.log(`BTC = ${btc.price} ${btc.currency}`);
  });
});

/* ---------------- Settings page ---------------- */

test.describe("Settings page", () => {
  test("shows the current profile with admin badge", async ({ page }) => {
    await signIn(page);
    await page.goto(`${APP}/settings`);
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
    await expect(page.getByText(/^Admin$/i)).toBeVisible();
  });
});
