/**
 * Database seed: categories, settings, and Stricker product catalog from
 * `data/products-data-mapping.json` (see scripts/lib/product-catalog-seed.ts).
 *
 * Run: pnpm db:seed
 *
 * Requires migrations through 0017. After seed, run `pnpm upload:images`
 * to push binaries to the `product-images` bucket.
 */

import "dotenv/config";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { seedProductCatalogFromJson } from "./lib/product-catalog-seed";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};
const log = (s: string) => console.log(s);
const ok = (s: string) => log(`${c.green}✓${c.reset} ${s}`);
const info = (s: string) => log(`${c.cyan}→${c.reset} ${s}`);

type Category = { slug: string; name: string; margin_percent: number; sort_order: number };

const CATEGORIES: Category[] = [
  { slug: "tassen", name: "Tassen & Becher", margin_percent: 70, sort_order: 10 },
  { slug: "taschen", name: "Taschen", margin_percent: 75, sort_order: 20 },
  { slug: "flaschen", name: "Trinkflaschen", margin_percent: 65, sort_order: 30 },
  { slug: "rucksaecke", name: "Rucksäcke", margin_percent: 60, sort_order: 40 },
];

const REPO_ROOT = process.cwd();

async function run() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.join(REPO_ROOT, ".env.local"), override: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;

  if (!url || !svc) {
    console.error(`${c.red}Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY${c.reset}`);
    process.exit(1);
  }

  const sb = createClient(url, svc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log(`${c.bold}${c.cyan}Seeding Werbenest Shop${c.reset}`);
  log(`${c.gray}host: ${new URL(url).host}${c.reset}\n`);

  const tableCheck = await sb.from("categories").select("id").limit(1);
  if (tableCheck.error) {
    console.error(
      `${c.red}✗ Tables not found. Run migrations first: pnpm db:migrate${c.reset}\n` +
        `${c.gray}Supabase error: ${tableCheck.error.message}${c.reset}`,
    );
    process.exit(1);
  }

  if (bootstrapEmail) {
    await sb.from("settings").upsert({ key: "admin_bootstrap_email", value: { email: bootstrapEmail } }, { onConflict: "key" });
    ok(`settings.admin_bootstrap_email = ${bootstrapEmail}`);
  }

  await sb.from("settings").upsert({ key: "invoice_counter", value: { next: 1 } }, { onConflict: "key" });

  await sb.from("settings").upsert(
    [
      { key: "free_shipping_threshold_cents", value: 25000 },
      { key: "default_shipping_cents_net", value: 990 },
      { key: "vat_rate_percent", value: 19 },
    ],
    { onConflict: "key" },
  );

  info("Upserting categories…");
  for (const cat of CATEGORIES) {
    const { error } = await sb.from("categories").upsert(
      {
        slug: cat.slug,
        name: cat.name,
        margin_percent: cat.margin_percent,
        sort_order: cat.sort_order,
        is_active: true,
      },
      { onConflict: "slug" },
    );
    if (error) throw error;
    ok(`category: ${cat.slug}`);
  }

  info("Seeding Stricker catalog from data/products-data-mapping.json…");
  await seedProductCatalogFromJson(sb, REPO_ROOT, url);
  ok("products + variants + print stack + price tiers");

  log(`\n${c.bold}${c.green}✓ Seed complete.${c.reset}`);
  log(`${c.gray}Next: pnpm upload:images (requires uploads/produktbilder/{slug}/)${c.reset}`);
}

run().catch((e) => {
  console.error(`${c.red}✗ Seed failed:${c.reset}`, e?.message ?? e);
  process.exit(1);
});
