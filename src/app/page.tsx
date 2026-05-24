import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-8 px-8 py-16">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
          Folio · Investment Tracker
        </p>
        <h1 className="font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
          Track every investment <br className="hidden sm:block" />
          in one calm place.
        </h1>
      </div>

      <p className="max-w-prose text-base text-text-muted">
        Stocks and ETFs, crypto, and the deep-dive your real estate deserves &mdash; income,
        expenses, scenarios, ROI. All in EUR. All in one view.
      </p>

      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          View dashboard
        </Link>
      </div>

      <div className="mt-12 flex items-center gap-3 text-xs text-text-subtle">
        <span className="size-1.5 rounded-full bg-success" />
        Private, invite-only · Hosted on Vercel + Supabase
      </div>
    </main>
  );
}
