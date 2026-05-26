import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "./sign-in-form";
import { getCurrentProfile } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex">
        <Link href="/login" className="font-display text-2xl tracking-tight">
          Folio
        </Link>
        <div className="space-y-3">
          <h2 className="font-display text-4xl leading-[1.05]">
            A calm view of <br />
            everything you own.
          </h2>
          <p className="max-w-sm text-sm opacity-70">
            Track stocks, ETFs, crypto and real estate in one place. Built for a small,
            invited group of people who like their numbers tidy.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.18em] opacity-50">EUR · Invite only</div>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(216,107,71,0.35), transparent 70%)",
          }}
        />
      </aside>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-3xl tracking-tight">Sign in</h1>
            <p className="text-sm text-text-muted">
              Enter your invited email to access Folio.
            </p>
          </div>
          <SignInForm next={next} />
          <p className="text-xs text-text-subtle">
            By signing in you agree to keep your portfolio data inside this app.
          </p>
        </div>
      </section>
    </main>
  );
}
