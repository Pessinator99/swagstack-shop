/**
 * Applies every .sql file in supabase/migrations/ exactly once.
 * Keeps bookkeeping in public._migrations so re-runs are idempotent.
 *
 * Requires DATABASE_URL in .env.local (direct Postgres connection).
 * Get it from: Supabase Dashboard → Project Settings → Database → Connection string.
 *
 * Run: pnpm db:migrate
 */

import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", gray: "\x1b[90m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");

async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local", override: true });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || /YOUR-PASSWORD|<password>/i.test(dbUrl)) {
    console.error(`${c.red}✗ DATABASE_URL is missing or still a placeholder.${c.reset}
${c.yellow}How to fix:${c.reset}
  1. Open Supabase dashboard → Project Settings → Database
  2. Under "Connection string", copy the URI (session pooler)
     e.g. postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
  3. Paste it into .env.local as DATABASE_URL=...
  4. Re-run: pnpm db:migrate
`);
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log(`${c.yellow}No migration files found in ${MIGRATIONS_DIR}${c.reset}`);
    process.exit(0);
  }

  console.log(`${c.bold}${c.cyan}Applying migrations${c.reset} (${files.length} files)`);
  console.log(`${c.gray}host: ${new URL(dbUrl).host}${c.reset}\n`);

  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    onnotice: () => {},
    idle_timeout: 10,
    connect_timeout: 10,
  });

  try {
    await sql`
      create table if not exists public._migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    let applied = 0, skipped = 0;
    for (const file of files) {
      const existing = await sql`select 1 from public._migrations where name = ${file}`;
      if (existing.length > 0) {
        console.log(`  ${c.gray}·${c.reset} ${file} ${c.gray}(already applied)${c.reset}`);
        skipped++;
        continue;
      }

      const full = path.join(MIGRATIONS_DIR, file);
      const contents = await readFile(full, "utf8");
      process.stdout.write(`  ${c.cyan}→${c.reset} ${file}  `);
      const started = Date.now();
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(contents);
          await tx`insert into public._migrations (name) values (${file})`;
        });
        console.log(`${c.green}✓${c.reset} ${c.gray}${Date.now() - started}ms${c.reset}`);
        applied++;
      } catch (e: any) {
        console.log(`${c.red}✗${c.reset}`);
        console.error(`${c.red}Error in ${file}:${c.reset}\n${e?.message ?? e}`);
        throw e;
      }
    }

    console.log(`\n${c.bold}Done.${c.reset} ${c.green}${applied} applied${c.reset}, ${c.gray}${skipped} skipped${c.reset}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(`${c.red}Migration failed:${c.reset}`, e?.message ?? e);
  process.exit(1);
});
