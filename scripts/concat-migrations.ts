/**
 * Concatenates every .sql file in supabase/migrations/ into a single file
 * at supabase/migrations.all.sql. Useful as a copy-paste fallback when
 * DATABASE_URL isn't available – paste the file into the Supabase SQL Editor.
 *
 * Run: pnpm db:concat
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(process.cwd(), "supabase", "migrations");

async function main() {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const parts: string[] = [
    "-- =====================================================================",
    "-- Werbenest Shop – combined migration bundle",
    "-- Generated from supabase/migrations/*.sql",
    "-- Paste into Supabase Dashboard → SQL Editor → Run",
    "-- =====================================================================",
    "",
  ];

  for (const f of files) {
    const content = await readFile(path.join(dir, f), "utf8");
    parts.push(`-- ===== ${f} =====`, content.trim(), "");
  }

  const outFile = path.join(dir, "../migrations.all.sql");
  await writeFile(path.resolve(dir, "..", "migrations.all.sql"), parts.join("\n"), "utf8");
  console.log(`Wrote ${files.length} migrations → supabase/migrations.all.sql`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
