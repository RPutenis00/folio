/**
 * Direct Playwright introspection — no test framework, no global setup.
 * Boots a dev server out-of-band, navigates to /login, prints computed
 * styles for the suspect elements, and saves screenshots.
 *
 * Run with:  pnpm exec tsx scripts/inspect.ts
 * Expects:   pnpm dev already running on :3000
 */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const APP = "http://localhost:3000";

async function main() {
  console.log("[inspect] launching chromium…");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  const page = await ctx.newPage();
  page.on("console", (msg) => console.log("  [browser]", msg.text()));

  await mkdir("test-results", { recursive: true });

  for (const path of ["/", "/login"]) {
    const url = `${APP}${path}`;
    console.log(`\n[inspect] ${url} (light mode)`);
    const t0 = Date.now();
    try {
      const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 600_000 });
      console.log(`  HTTP ${r?.status()}  (${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`  FAILED: ${(e as Error).message}`);
      continue;
    }

    // Wait for fonts + layout
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    // Capture computed colors for design-system tokens
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const names = [
        "--background",
        "--foreground",
        "--surface",
        "--surface-muted",
        "--border",
        "--text",
        "--text-muted",
        "--accent",
      ];
      return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
    });
    console.log("  CSS variables:", tokens);

    // For /login specifically, inspect the left brand panel
    if (path === "/login") {
      const panel = await page.evaluate(() => {
        const el = document.querySelector("aside.bg-foreground");
        if (!el) return { found: false };
        const cs = getComputedStyle(el);
        return {
          found: true,
          display: cs.display,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          width: cs.width,
          height: cs.height,
          className: (el as HTMLElement).className,
        };
      });
      console.log("  <aside.bg-foreground>:", panel);

      const heading = await page.evaluate(() => {
        const h = document.querySelector("aside h2");
        if (!h) return null;
        const cs = getComputedStyle(h);
        return { color: cs.color, fontFamily: cs.fontFamily, text: h.textContent?.trim() };
      });
      console.log("  <aside h2>:", heading);
    }

    const out = `test-results/inspect${path === "/" ? "-root" : path.replace(/\//g, "-")}-light.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log(`  screenshot -> ${out}`);
  }

  // Switch to dark mode and re-inspect /login
  console.log("\n[inspect] /login (dark mode)");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 600_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  const darkTokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      "--foreground": cs.getPropertyValue("--foreground").trim(),
      "--background": cs.getPropertyValue("--background").trim(),
      htmlClass: document.documentElement.className,
    };
  });
  console.log("  CSS variables:", darkTokens);

  const darkPanel = await page.evaluate(() => {
    const el = document.querySelector("aside.bg-foreground");
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    return { backgroundColor: cs.backgroundColor, color: cs.color };
  });
  console.log("  <aside.bg-foreground>:", darkPanel);
  await page.screenshot({ path: "test-results/inspect-login-dark.png", fullPage: true });

  // Dump the served CSS so we can post-mortem
  const cssResp = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="stylesheet"]') as HTMLLinkElement | null;
    if (!link) return null;
    const text = await fetch(link.href).then((r) => r.text());
    return { href: link.href, length: text.length, head: text.slice(0, 2000) };
  });
  if (cssResp) {
    console.log(`\n[inspect] CSS bundle ${cssResp.href} (${cssResp.length} bytes)`);
    await writeFile("test-results/served.css.head.txt", cssResp.head);
  }

  await browser.close();
  console.log("\n[inspect] done. See test-results/*.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
