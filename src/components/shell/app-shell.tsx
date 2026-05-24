import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import type { Profile } from "@/lib/db/schema";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin={profile.isAdmin} />
      <div className="lg:pl-60">
        <TopBar profile={profile} />
        <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
