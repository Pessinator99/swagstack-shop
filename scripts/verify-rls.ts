/**
 * RLS verification: creates two dummy customer users and one admin user
 * (based on ADMIN_BOOTSTRAP_EMAIL), then exercises every policy from all
 * four trust tiers: anon, customer A, customer B, admin.
 *
 * ALL assertions must pass — otherwise we have a security issue.
 *
 * Run: pnpm db:verify-rls
 */

import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", gray: "\x1b[90m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

const header = (s: string) =>
  `\n${c.bold}${c.cyan}━━ ${s} ${"━".repeat(Math.max(0, 60 - s.length))}${c.reset}`;

type Check = { label: string; pass: boolean; detail?: string };
const checks: Check[] = [];
const record = (label: string, pass: boolean, detail?: string) => {
  checks.push({ label, pass, detail });
  const mark = pass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
  console.log(`  ${mark} ${label}${detail ? `  ${c.gray}${detail}${c.reset}` : ""}`);
};

// ---------------------------------------------------------------------------
async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local", override: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bootstrap = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@example.com";

  if (!url || !anon || !svc) {
    console.error(`${c.red}Missing Supabase env vars${c.reset}`);
    process.exit(1);
  }

  const admin = createClient(url, svc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password = "Test1234!Swagstack";
  const emails = {
    A: `rls-customer-a+${Date.now()}@test.local`,
    B: `rls-customer-b+${Date.now()}@test.local`,
    owner: bootstrap,
    ownerTest: `rls-owner+${Date.now()}@test.local`,
  };

  console.log(`${c.bold}${c.cyan}RLS Verification${c.reset}`);
  console.log(`${c.gray}host: ${new URL(url).host}${c.reset}`);
  console.log(`${c.gray}bootstrap email: ${bootstrap}${c.reset}`);

  // -------------------------------------------------------------------------
  // Preflight: does the schema actually exist?
  // -------------------------------------------------------------------------
  const preflight = await admin.from("products").select("id").limit(1);
  if (preflight.error) {
    console.error(
      `${c.red}✗ Can't read products table. Run migrations + seed first:${c.reset}\n` +
        `  pnpm db:migrate && pnpm db:seed\n` +
        `  ${c.gray}Supabase error: ${preflight.error.message}${c.reset}`,
    );
    process.exit(1);
  }
  if ((preflight.data?.length ?? 0) === 0) {
    console.error(`${c.red}✗ No products found. Run: pnpm db:seed${c.reset}`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Setup: create users and sign them in
  // -------------------------------------------------------------------------
  console.log(header("Setup"));

  // cleanup: drop previous test users with same emails (idempotent-ish)
  const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of existingUsers?.users ?? []) {
    if (u.email && u.email.startsWith("rls-customer-")) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  // Create customer A + customer B
  const createA = await admin.auth.admin.createUser({
    email: emails.A, password, email_confirm: true,
  });
  if (createA.error) throw createA.error;
  record("Created customer A", true, emails.A);

  const createB = await admin.auth.admin.createUser({
    email: emails.B, password, email_confirm: true,
  });
  if (createB.error) throw createB.error;
  record("Created customer B", true, emails.B);

  // Admin (owner): reuse existing bootstrap user or create fresh
  let ownerUserId: string | null = null;
  let ownerLoginEmail = emails.owner;
  let ownerFallbackUserId: string | null = null;
  const existingOwner = existingUsers?.users.find((u) => u.email === emails.owner);
  if (existingOwner) {
    ownerUserId = existingOwner.id;
    record("Found existing owner user", true, emails.owner);
  } else {
    const createOwner = await admin.auth.admin.createUser({
      email: emails.owner, password, email_confirm: true,
    });
    if (createOwner.error) throw createOwner.error;
    ownerUserId = createOwner.data.user?.id ?? null;
    record("Created owner user", true, emails.owner);
  }

  // Ensure the owner is actually promoted (in case settings row came after signup)
  if (ownerUserId) {
    await admin
      .from("admin_users")
      .upsert({ id: ownerUserId, role: "owner" }, { onConflict: "id" });
  }

  // Sign-in helper that returns a fresh per-user client
  const signIn = async (email: string) => {
    const cl = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await cl.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`signIn(${email}): ${error.message}`);
    return cl;
  };

  const clientA = await signIn(emails.A);
  const clientB = await signIn(emails.B);
  let clientOwner: SupabaseClient;
  try {
    clientOwner = await signIn(ownerLoginEmail);
  } catch {
    const createOwnerTest = await admin.auth.admin.createUser({
      email: emails.ownerTest,
      password,
      email_confirm: true,
    });
    if (createOwnerTest.error) throw createOwnerTest.error;
    ownerFallbackUserId = createOwnerTest.data.user?.id ?? null;
    ownerUserId = createOwnerTest.data.user?.id ?? ownerUserId;
    ownerLoginEmail = emails.ownerTest;
    await admin
      .from("admin_users")
      .upsert({ id: ownerUserId, role: "owner" }, { onConflict: "id" });
    clientOwner = await signIn(ownerLoginEmail);
    record("Owner login fallback user created", true, ownerLoginEmail);
  }
  record("Signed in all test users", true);

  // Seed one logo + one order for each customer so we can test cross-access
  const userAId = createA.data.user!.id;
  const userBId = createB.data.user!.id;

  await admin.from("customer_logos").insert([
    { customer_id: userAId, name: "Logo A",      original_url: "https://example.com/a.png" },
    { customer_id: userBId, name: "Logo B",      original_url: "https://example.com/b.png" },
  ]);

  const { data: prodForOrder } = await admin.from("products").select("id").eq("status", "active").limit(1).single();
  const { data: orderA } = await admin
    .from("orders")
    .insert({ customer_id: userAId, subtotal_cents: 1000, vat_cents: 190, total_cents: 1190 })
    .select("id").single();
  const { data: orderB } = await admin
    .from("orders")
    .insert({ customer_id: userBId, subtotal_cents: 2000, vat_cents: 380, total_cents: 2380 })
    .select("id").single();
  const { data: firstTechnique } = await admin
    .from("print_techniques")
    .select("id")
    .limit(1)
    .single();
  record("Seeded logos + orders for both customers", true);

  // Anonymous client (no auth)
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------------------------------------------------------------------------
  // 1) Anonymous access
  // -------------------------------------------------------------------------
  console.log(header("1) Anonymous (no auth)"));

  {
    const { data } = await anonClient.from("products").select("id");
    record("anon → products: 0 rows", (data?.length ?? 0) === 0, `got ${data?.length ?? 0}`);
  }
  {
    const { data } = await anonClient.from("product_price_tiers").select("id");
    record("anon → product_price_tiers: 0 rows", (data?.length ?? 0) === 0, `got ${data?.length ?? 0}`);
  }
  {
    const { data, error } = await anonClient.from("product_prices_public").select("id");
    // anon was not granted → expect error or 0 rows
    const blocked = !!error || (data?.length ?? 0) === 0;
    record("anon → product_prices_public: blocked", blocked, error?.message ?? `got ${data?.length ?? 0}`);
  }

  // -------------------------------------------------------------------------
  // 2) Customer A
  // -------------------------------------------------------------------------
  console.log(header("2) Customer A (logged in)"));

  {
    const { data } = await clientA.from("products").select("id").eq("status", "active");
    record("customer → products: > 0 active rows", (data?.length ?? 0) > 0, `got ${data?.length ?? 0}`);
  }
  {
    const { data, error } = await clientA.from("product_price_tiers").select("id, purchase_price_cents");
    const blocked = (data?.length ?? 0) === 0 || !!error;
    record("customer → product_price_tiers: blocked (no EK exposure)", blocked,
      error?.message ?? `got ${data?.length ?? 0}`);
  }
  {
    const { data } = await clientA.from("product_prices_public").select("*").limit(3);
    const hasRows = (data?.length ?? 0) > 0;
    record("customer → product_prices_public: > 0 rows", hasRows, `got ${data?.length ?? 0}`);

    const firstRow = data?.[0] as Record<string, unknown> | undefined;
    const ekLeaked = firstRow && Object.keys(firstRow).some((k) =>
      ["purchase_price_cents", "purchase_price", "cost_price_cents", "ek"].includes(k),
    );
    record("customer → product_prices_public has NO purchase_price_cents column",
      !ekLeaked,
      `columns: ${firstRow ? Object.keys(firstRow).join(", ") : "—"}`);

    const explicit = firstRow ? (firstRow as any).purchase_price_cents === undefined : true;
    record("customer → data[0].purchase_price_cents === undefined", explicit);
  }
  {
    const { data } = await clientA.from("print_prices_public").select("*").limit(3);
    const hasRows = (data?.length ?? 0) > 0;
    record("customer → print_prices_public: > 0 rows", hasRows, `got ${data?.length ?? 0}`);
    const firstRow = data?.[0] as Record<string, unknown> | undefined;
    const ekLeaked = firstRow && Object.keys(firstRow).some((k) =>
      ["purchase_price_per_unit_cents", "purchase_price", "ek"].includes(k),
    );
    record("customer → print_prices_public has NO EK columns", !ekLeaked,
      `columns: ${firstRow ? Object.keys(firstRow).join(", ") : "—"}`);
  }

  // -------------------------------------------------------------------------
  // 3) Admin (owner)
  // -------------------------------------------------------------------------
  console.log(header("3) Admin (owner)"));

  {
    const { data, error } = await clientOwner.from("product_price_tiers").select("id, purchase_price_cents").limit(5);
    record("admin → product_price_tiers: can read EK", !error && (data?.length ?? 0) > 0,
      error?.message ?? `got ${data?.length ?? 0} rows`);
  }
  {
    const { data: p1 } = await admin.from("products").select("id, status").eq("status", "active").limit(1).single();
    const { error } = await clientOwner.from("products").update({ status: "inactive" }).eq("id", p1!.id);
    record("admin → can update products.status", !error, error?.message);
    // rollback
    await admin.from("products").update({ status: "active" }).eq("id", p1!.id);
  }
  {
    const { data: adminRow } = await clientOwner.from("admin_users").select("id, role").eq("id", ownerUserId!).single();
    record("admin → admin_users.role = 'owner'", adminRow?.role === "owner", `got ${adminRow?.role}`);
  }

  // -------------------------------------------------------------------------
  // 4) Cross-customer access
  // -------------------------------------------------------------------------
  console.log(header("4) Cross-customer isolation"));

  {
    const { data } = await clientA.from("orders").select("id, customer_id");
    const onlySelf = (data ?? []).every((row: any) => row.customer_id === userAId);
    record("A → orders: only own rows", onlySelf && (data?.length ?? 0) > 0,
      `returned ${data?.length ?? 0} rows; foreign: ${(data ?? []).filter((r: any) => r.customer_id !== userAId).length}`);
  }
  {
    const { data } = await clientA.from("customer_logos").select("id, customer_id");
    const onlySelf = (data ?? []).every((row: any) => row.customer_id === userAId);
    record("A → customer_logos: only own rows", onlySelf && (data?.length ?? 0) > 0,
      `returned ${data?.length ?? 0}; foreign: ${(data ?? []).filter((r: any) => r.customer_id !== userAId).length}`);
  }
  {
    // Can A see B's order by explicit id lookup?
    const { data } = await clientA.from("orders").select("id").eq("id", orderB!.id);
    record("A → orders by B's id: empty", (data?.length ?? 0) === 0, `got ${data?.length ?? 0}`);
  }
  {
    const { data } = await clientA.from("customers").select("id, email");
    record("A → customers: only own row", (data?.length ?? 0) === 1 && (data as any)[0]?.id === userAId,
      `got ${data?.length ?? 0}`);
  }
  {
    const { data } = await clientA
      .from("settings")
      .select("key")
      .in("key", ["free_shipping_threshold_cents", "default_shipping_cents_net", "vat_rate_percent"]);
    record(
      "A → settings: can read checkout/public keys",
      (data?.length ?? 0) === 3,
      `got ${data?.length ?? 0}`,
    );
  }
  {
    const { data } = await clientA
      .from("settings")
      .select("key")
      .eq("key", "invoice_counter");
    record("A → settings: invoice_counter hidden", (data?.length ?? 0) === 0, `got ${data?.length ?? 0}`);
  }

  // -------------------------------------------------------------------------
  // 5) Cart RLS
  // -------------------------------------------------------------------------
  console.log(header("5) Cart RLS"));

  const { data: prodA } = await admin
    .from("products")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();
  const { data: prodB } = await admin
    .from("products")
    .select("id")
    .eq("status", "active")
    .range(1, 1)
    .single();

  {
    const { error } = await clientA.from("cart_items").insert({
      customer_id: userAId,
      product_id: prodA!.id,
      print_technique_id: firstTechnique?.id ?? null,
      print_colors: 1,
      quantity: 5,
    });
    record("A → insert own cart item: allowed", !error, error?.message);
  }

  const { data: bCart } = await admin
    .from("cart_items")
    .insert({
      customer_id: userBId,
      product_id: prodB?.id ?? prodA!.id,
      quantity: 3,
    })
    .select("id")
    .single();

  {
    const { data } = await clientA
      .from("cart_items")
      .select("id")
      .eq("customer_id", userBId);
    record("A → read B cart_items: 0 rows", (data?.length ?? 0) === 0, `got ${data?.length ?? 0}`);
  }

  {
    const { data, error } = await clientA
      .from("cart_items")
      .update({ quantity: 99 })
      .eq("id", bCart!.id)
      .select("id");
    const blocked = !!error || (data?.length ?? 0) === 0;
    record("A → update B cart_item: blocked", blocked, error?.message ?? `got ${data?.length ?? 0}`);
  }

  {
    const { data, error } = await anonClient.from("cart_items").select("id").limit(1);
    const blocked = !!error || (data?.length ?? 0) === 0;
    record("anon → cart_items: blocked", blocked, error?.message ?? `got ${data?.length ?? 0}`);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  console.log(header("Cleanup"));
  await admin.auth.admin.deleteUser(userAId);
  await admin.auth.admin.deleteUser(userBId);
  if (ownerFallbackUserId) {
    await admin.auth.admin.deleteUser(ownerFallbackUserId);
  }
  record("Deleted test users (A + B + optional owner fallback)", true);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(header("Summary"));
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;

  for (const ch of checks) {
    const mark = ch.pass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    console.log(`  ${mark} ${ch.label}`);
  }

  console.log(
    `\n${c.bold}Result:${c.reset} ${c.green}${passed} passed${c.reset}  ${c.red}${failed} failed${c.reset}\n`,
  );

  if (failed > 0) {
    console.log(`${c.red}✗ RLS verification FAILED — fix policies before continuing.${c.reset}`);
    process.exit(1);
  } else {
    console.log(`${c.green}✓ RLS verification passed.${c.reset}`);
  }
}

main().catch((e) => {
  console.error(`${c.red}Unexpected error:${c.reset}`, e?.message ?? e);
  process.exit(1);
});
