/**
 * Run once before any Playwright tests. Hits the dev server's
 * /api/dev/reset endpoint to truncate every data table and re-seed the
 * admin invite. Each test then starts against a deterministic empty DB.
 *
 * If dev isn't responding, we wait up to 90 s — that covers the very first
 * Turbopack compile.
 */
const APP = "http://localhost:3000";

export default async function globalSetup() {
  // Wait for dev to be reachable
  let ready = false;
  for (let i = 0; i < 45; i++) {
    try {
      const r = await fetch(`${APP}/login`, { signal: AbortSignal.timeout(3_000) });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  if (!ready) {
    throw new Error(`Dev server at ${APP} didn't respond within 90 s — start it with \`pnpm dev\``);
  }

  const r = await fetch(`${APP}/api/dev/reset`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) {
    throw new Error(`DB reset failed: HTTP ${r.status}`);
  }
  console.log("[setup] DB reset complete");
}
