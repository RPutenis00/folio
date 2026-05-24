import Link from "next/link";
import { requireProfile } from "@/lib/auth/current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Account</p>
        <h1 className="font-display text-3xl">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How Folio identifies you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={profile.displayName ?? "—"} />
          <Row label="Email" value={profile.email} />
          <Row label="Base currency" value={profile.baseCurrency} />
          <Row
            label="Role"
            value={
              <Badge variant={profile.isAdmin ? "accent" : "muted"}>
                {profile.isAdmin ? "Admin" : "Member"}
              </Badge>
            }
          />
        </CardContent>
      </Card>

      {profile.isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin tools</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/invites"
              className="inline-flex items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Manage invites →
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2 last:border-0">
      <span className="text-xs uppercase tracking-[0.06em] text-text-muted">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
