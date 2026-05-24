import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { desc } from "drizzle-orm";
import { requireProfile } from "@/lib/auth/current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";
import { RevokeButton } from "./revoke-button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Manage invites" };

export default async function InvitesPage() {
  const profile = await requireProfile();
  if (!profile.isAdmin) redirect("/settings");

  const invites = await db
    .select()
    .from(schema.invitedEmails)
    .orderBy(desc(schema.invitedEmails.createdAt));

  const signedUp = await db
    .select({ email: schema.profiles.email })
    .from(schema.profiles);
  const signedUpSet = new Set(signedUp.map((p) => p.email.toLowerCase()));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Admin</p>
        <h1 className="font-display text-3xl">Invites</h1>
        <p className="text-sm text-text-muted">
          Only emails on this list can sign up. Adding an email here lets that person sign in
          with Google.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add invite</CardTitle>
          <CardDescription>Allow a new email to sign up.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowlist</CardTitle>
          <CardDescription>{invites.length} invited</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead aria-label="actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-text-muted">
                    No invites yet.
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((inv) => (
                  <TableRow key={inv.email}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      {signedUpSet.has(inv.email.toLowerCase()) ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="muted">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-text-muted">{inv.note ?? "—"}</TableCell>
                    <TableCell className="text-text-muted">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <RevokeButton email={inv.email} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
