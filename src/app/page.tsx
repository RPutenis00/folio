import { redirect } from "next/navigation";

/**
 * Root entry point. Authenticated users land on /dashboard, unauthenticated
 * get sent through to /login by the auth proxy. The standalone marketing
 * landing page is removed — this is a private invite-only app.
 */
export default function RootPage() {
  redirect("/dashboard");
}
