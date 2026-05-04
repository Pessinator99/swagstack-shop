/**
 * Upload local product images to Supabase Storage bucket `product-images`.
 * Paths: product-images/{slug}/{filename}
 *
 * Requires: uploads/produktbilder/{slug}/ with files matching Stricker naming.
 * Run: pnpm upload:images
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadProductMapping } from "./lib/product-catalog-seed";

function contentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function main() {
  const dotenv = await import("dotenv");
  const repoRoot = process.cwd();
  dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !svc) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, svc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { products } = loadProductMapping(repoRoot);
  let count = 0;

  for (const p of products) {
    const dir = path.join(repoRoot, "uploads", "produktbilder", p.slug);
    if (!existsSync(dir)) {
      console.warn(`⚠ skip ${p.slug}: folder missing (${dir})`);
      continue;
    }
    const files = readdirSync(dir).filter((f) => {
      const fp = path.join(dir, f);
      try {
        return statSync(fp).isFile();
      } catch {
        return false;
      }
    });
    for (const file of files) {
      const fp = path.join(dir, file);
      const body = readFileSync(fp);
      const storagePath = `${p.slug}/${file}`;
      const { error } = await sb.storage.from("product-images").upload(storagePath, body, {
        contentType: contentType(file),
        upsert: true,
      });
      if (error) {
        console.error(`✗ ${storagePath}`, error.message);
        process.exit(1);
      }
      console.log(`✓ ${storagePath}`);
      count += 1;
    }
  }

  console.log(`\nDone. ${count} file(s) uploaded.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
