import { test, expect, type Page } from "@playwright/test";

/**
 * Folio smoke tests via Playwright. Drives the *local* dev stack:
 *   - Next.js dev at http://localhost:3000
 *   - Supabase local stack at http://127.0.0.1:54321
 *   - Mailpit at http://127.0.0.1:54324
 *
 * Each test logs what it does so failures are easy to diagnose.
 */

const APP = "http://localhost:3000";
const SUPABASE = "http://127.0.0.1:54321";
const MAILPIT = "http://127.0.0.1:54324";
const ADMIN_EMAIL = "majaskamera27@gmail.com";

/** Convert a CSS color (rgb/rgba/hex) into a 6-char hex, lowercase. */
function normalizeColor(c: string): string {
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = Number(m[1]).toString(16).padStart(2, "0");
    const g = Number(m[2]).toString(16).padStart(2, "0");
    const b = Number(m[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toLowerCase();
  }
  return c.toLowerCase();
}

async function readToken(page: Page, varName: string): Promise<string> {
  return page.evaluate(
    (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
    varName,
  );
}

test.describe("design tokens — CSS variables resolve correctly", () => {
  test("light: --foreground is dark, dark: --foreground is light", async ({ page, browserName }) => {
    // Force light mode
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    const lightFg = normalizeColor(await readToken(page, "--foreground"));
    const lightBg = normalizeColor(await readToken(page, "--background"));
    console.log(`[${browserName}] light: --foreground=${lightFg} --background=${lightBg}`);
    expect(lightFg, "light mode foreground should be dark charcoal").toBe("#1f1e1b");
    expect(lightBg, "light mode background should be warm off-white").toBe("#faf9f5");

    // Now flip to dark and reload
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload({ waitUntil: "domcontentloaded" });
    const darkFg = normalizeColor(await readToken(page, "--foreground"));
    const darkBg = normalizeColor(await readToken(page, "--background"));
    console.log(`[${browserName}] dark:  --foreground=${darkFg} --background=${darkBg}`);
    expect(darkFg, "dark mode foreground should be light cream").toBe("#edeae0");
    expect(darkBg, "dark mode background should be deep charcoal").toBe("#1f1e1b");
  });
});

test.describe("login page — visual contract", () => {
  test("left brand panel is dark, right form panel is light (light mode)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });

    // Brand panel selector: <aside> with bg-foreground class
    const aside = page.locator("aside.bg-foreground");
    await expect(aside, "brand panel must be in DOM").toBeVisible();

    const asideBg = await aside.evaluate((el) => getComputedStyle(el).backgroundColor);
    const asideColor = await aside.evaluate((el) => getComputedStyle(el).color);
    console.log(`left panel bg=${asideBg} color=${asideColor}`);
    // In light mode, bg-foreground = deep charcoal
    expect(normalizeColor(asideBg)).toBe("#1f1e1b");

    // Form panel — section element
    const section = page.locator("section").filter({ hasText: "Sign in" }).first();
    await expect(section).toBeVisible();
  });

  test("dark mode renders correctly too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });

    const aside = page.locator("aside.bg-foreground");
    const asideBg = await aside.evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log(`dark mode left panel bg=${asideBg}`);
    // In dark mode, bg-foreground = light cream
    expect(normalizeColor(asideBg)).toBe("#edeae0");
  });
});

test.describe("routing + auth gate", () => {
  test("/ renders landing page", async ({ page }) => {
    const r = await page.goto(APP, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Track every investment");
  });

  test("/dashboard redirects to /login when unauthenticated", async ({ page }) => {
    const r = await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
    expect(r?.url()).toContain("/login");
  });

  test("/assets, /real-estate, /settings all gated", async ({ page }) => {
    for (const path of ["/assets", "/real-estate", "/settings"]) {
      await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded" });
      expect(page.url()).toContain("/login");
    }
  });
});

test.describe("magic-link sign-in end-to-end", () => {
  test("send link → fetch from Mailpit → land on dashboard as admin", async ({ page, context }) => {
    test.setTimeout(120_000);
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });

    // Fill the email field and submit the magic-link form
    await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Server action returns; UI flips to "Check your inbox"
    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });

    // Drain Mailpit for the most recent magic-link email
    let link: string | null = null;
    for (let i = 0; i < 20; i++) {
      const list = await (await page.request.get(`${MAILPIT}/api/v1/messages`)).json();
      const msg = list.messages?.[0];
      if (msg) {
        const full = await (await page.request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
        const m = String(full.HTML ?? "").match(/href="([^"]+\/auth\/v1\/verify[^"]+)"/);
        if (m) {
          link = m[1].replace(/&amp;/g, "&");
          break;
        }
      }
      await page.waitForTimeout(1000);
    }
    expect(link, "magic-link email not found in Mailpit").not.toBeNull();
    console.log("magic link:", link);

    // Follow the link. Supabase verify redirects to the site URL with the
    // session in the URL fragment, and the Supabase JS client picks it up.
    await page.goto(link!);

    // Should land on dashboard (or get redirected through callback to it)
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 20_000 });

    // Check session cookie was actually set
    const cookies = await context.cookies();
    const sbCookie = cookies.find((c) => c.name.startsWith("sb-"));
    expect(sbCookie, "Supabase session cookie should be set").toBeTruthy();

    // Navigate to dashboard explicitly
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1")).toContainText(/Portfolio/i, { timeout: 15_000 });
  });
});
