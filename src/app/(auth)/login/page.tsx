import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main style={{ padding: 40, fontFamily: "system-ui", maxWidth: 400, margin: "60px auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Folio — Sign in</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Enter your invited email.</p>
      <SignInForm />
    </main>
  );
}
