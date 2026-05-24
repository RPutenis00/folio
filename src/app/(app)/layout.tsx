import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { MobileNav } from "@/components/shell/mobile-nav";
import { getCurrentProfile } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <>
      <AppShell profile={profile}>{children}</AppShell>
      <div className="h-14 lg:hidden" aria-hidden />
      <MobileNav />
    </>
  );
}
