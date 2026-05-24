import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("SEED_ADMIN_EMAIL not set — skipping invite bootstrap.");
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    if (adminEmail) {
      const email = adminEmail.trim().toLowerCase();
      console.log(`\nInviting ${email} as the first admin…`);

      await sql`
        insert into public.invited_emails (email, note)
        values (${email}, 'Seeded admin invite')
        on conflict (email) do nothing
      `;

      // If the user has already signed up, flip their is_admin flag.
      await sql`
        update public.profiles
           set is_admin = true
         where lower(email) = ${email}
      `;

      console.log("✓ Admin invite seeded. Sign in with this email and you'll be admin on first login.");
    }

    console.log("\nDone.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
