/**
 * Deletes a Supabase Auth user by email (and cascaded public rows).
 *
 * Usage: pnpm reset:user <email@example.com>
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local", override: true });

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm reset:user <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let foundId: string | null = null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) {
      foundId = hit.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!foundId) {
    console.log(`No user found with email: ${email}`);
    process.exit(0);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(foundId);
  if (delErr) throw delErr;

  console.log(`Deleted auth user ${foundId} (${email})`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
