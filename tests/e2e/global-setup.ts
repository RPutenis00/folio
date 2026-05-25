/**
 * Pre-warm every route Playwright is about to test. Next.js dev mode
 * (Turbopack) compiles per-route on first hit, which can take 30-60s the
 * first time. Doing it up-front means our actual test timeouts can be sane.
 */
const APP = "http://localhost:3000";
const ROUTES = ["/", "/login", "/dashboard", "/assets", "/real-estate", "/settings"];

export default async function globalSetup() {
  console.log(`\n[setup] pre-warming ${ROUTES.length} routes (first-compile)…`);
  const started = Date.now();

  // Wait for the dev server to respond at all.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(APP, { signal: AbortSignal.timeout(5_000) });
      if (r.status) break;
    } catch {
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  // Warm each route serially with a generous timeout.
  for (const path of ROUTES) {
    const t0 = Date.now();
    try {
      const r = await fetch(`${APP}${path}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(180_000),
      });
      console.log(`  ${path.padEnd(15)} -> HTTP ${r.status}  (${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`  ${path.padEnd(15)} -> ERROR  (${Date.now() - t0}ms): ${(e as Error).message}`);
    }
  }
  console.log(`[setup] warm-up done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}
