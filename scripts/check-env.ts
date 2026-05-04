/**
 * Diagnose-Script: Prüft ENV-Variablen und testet Connections
 * zu Supabase, Stripe und SMTP (Mailpit).
 *
 * Aufruf: pnpm check:env
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import nodemailer from "nodemailer";

// ----------------------------------------------------------------------------
// ANSI colors (no extra dep)
// ----------------------------------------------------------------------------
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const ok = (s: string) => `${c.green}✓${c.reset} ${s}`;
const warn = (s: string) => `${c.yellow}⚠${c.reset} ${s}`;
const fail = (s: string) => `${c.red}✗${c.reset} ${s}`;
const info = (s: string) => `${c.blue}ℹ${c.reset} ${s}`;
const header = (s: string) =>
  `\n${c.bold}${c.cyan}━━ ${s} ${"━".repeat(Math.max(0, 60 - s.length))}${c.reset}`;

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------
type Result = { label: string; status: "ok" | "warn" | "fail"; detail?: string };
const results: Result[] = [];
const push = (r: Result) => {
  results.push(r);
  const line =
    r.status === "ok" ? ok(r.label) : r.status === "warn" ? warn(r.label) : fail(r.label);
  console.log(line + (r.detail ? `  ${c.gray}${r.detail}${c.reset}` : ""));
};

// ----------------------------------------------------------------------------
// 1) ENV variable presence
// ----------------------------------------------------------------------------
const PHASE_1_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "ADMIN_BOOTSTRAP_EMAIL",
  "VAT_RATE_PERCENT",
  "COMPANY_NAME",
] as const;

const PHASE_2_OPTIONAL = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "REMOVE_BG_API_KEY",
  "VECTORIZER_API_ID",
  "VECTORIZER_API_SECRET",
] as const;

const PHASE_3_OPTIONAL = [
  "STRICKER_API_URL",
  "STRICKER_API_USER",
  "STRICKER_API_PASS",
  "PFCONCEPT_API_URL",
  "PFCONCEPT_API_TOKEN",
  "MAKITO_API_URL",
  "MAKITO_API_TOKEN",
] as const;

function maskKey(key: string | undefined, show = 4) {
  if (!key) return "—";
  if (key.length <= show * 2) return "***";
  return `${key.slice(0, show)}…${key.slice(-show)}`;
}

const PLACEHOLDER_PATTERNS = [
  /^eyJ\.\.\./,
  /^sk_test_\.\.\./,
  /^pk_test_\.\.\./,
  /^whsec_\.\.\./,
  /^your-app-password$/,
  /xxxxxxxx/i,
  /https:\/\/\.supabase\.co/,
];

function isPlaceholder(val: string | undefined) {
  if (!val || val.trim() === "") return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(val));
}

function isLocalSmtp() {
  const host = (process.env.SMTP_HOST ?? "").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "mailpit" ||
    host === "mailhog" ||
    host === "host.docker.internal"
  );
}

async function checkEnvVars() {
  console.log(header("ENV Variables"));

  const smtpAuthExempt = isLocalSmtp();
  const required = PHASE_1_REQUIRED.filter(
    (k) => !(smtpAuthExempt && (k === "SMTP_USER" || k === "SMTP_PASS")),
  );

  const missing: string[] = [];
  for (const key of required) {
    if (isPlaceholder(process.env[key])) missing.push(key);
  }
  if (isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    if (!missing.includes("NEXT_PUBLIC_SUPABASE_URL")) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (smtpAuthExempt) {
    push({
      label: "SMTP_USER / SMTP_PASS intentionally empty (Mailpit)",
      status: "ok",
      detail: `SMTP_HOST=${process.env.SMTP_HOST} – no auth required for local Mailpit/MailHog`,
    });
  }

  if (missing.length === 0) {
    push({
      label: `All ${required.length} Phase 1 env vars present`,
      status: "ok",
    });
  } else {
    push({
      label: `${missing.length} Phase 1 env var(s) missing or still placeholder`,
      status: "fail",
      detail: missing.join(", "),
    });
  }

  const emptyP2 = PHASE_2_OPTIONAL.filter((k) => !process.env[k]);
  if (emptyP2.length === 0) push({ label: "Phase 2 keys all set", status: "ok" });
  else
    push({
      label: `Phase 2 keys empty (ok for now): ${emptyP2.length}/${PHASE_2_OPTIONAL.length}`,
      status: "warn",
      detail: emptyP2.join(", "),
    });

  const emptyP3 = PHASE_3_OPTIONAL.filter((k) => !process.env[k]);
  if (emptyP3.length === 0) push({ label: "Phase 3 keys all set", status: "ok" });
  else
    push({
      label: `Phase 3 keys empty (ok for now): ${emptyP3.length}/${PHASE_3_OPTIONAL.length}`,
      status: "warn",
      detail: emptyP3.join(", "),
    });

  return missing.length === 0;
}

// ----------------------------------------------------------------------------
// 2) Supabase – Anon
// ----------------------------------------------------------------------------
async function checkSupabaseAnon() {
  console.log(header("Supabase (Anon)"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    push({ label: "Supabase (Anon)", status: "fail", detail: "URL or anon key missing" });
    return;
  }
  if (isPlaceholder(url) || isPlaceholder(anon)) {
    push({
      label: "Supabase (Anon) skipped",
      status: "fail",
      detail: "URL or anon key is still a placeholder",
    });
    return;
  }
  try {
    // Hit the auth health endpoint – real network call, no cookies needed.
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const body = (await res.json().catch(() => ({}))) as { version?: string; name?: string };
    push({
      label: "Supabase (Anon) connected",
      status: "ok",
      detail: `${new URL(url).host} · ${body.name ?? "gotrue"} ${body.version ?? ""}`.trim(),
    });
  } catch (e: any) {
    push({
      label: "Supabase (Anon) failed",
      status: "fail",
      detail: e?.message ?? String(e),
    });
  }
}

// ----------------------------------------------------------------------------
// 3) Supabase – Service Role
// ----------------------------------------------------------------------------
async function checkSupabaseServiceRole() {
  console.log(header("Supabase (Service Role)"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc || isPlaceholder(url) || isPlaceholder(svc)) {
    push({
      label: "Supabase (Service Role) skipped",
      status: "fail",
      detail: "URL or service role key is still a placeholder",
    });
    return;
  }
  try {
    const sb = createClient(url, svc, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // auth.admin.listUsers requires service-role privileges and works
    // regardless of which application tables exist.
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
    const total = (data as { total?: number }).total;
    push({
      label: "Supabase (Service Role) connected",
      status: "ok",
      detail: `admin API reachable · users: ${total ?? data.users.length}`,
    });
  } catch (e: any) {
    push({
      label: "Supabase (Service Role) failed",
      status: "fail",
      detail: e?.message ?? String(e),
    });
  }
}

// ----------------------------------------------------------------------------
// 4) Stripe
// ----------------------------------------------------------------------------
async function checkStripe() {
  console.log(header("Stripe"));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || isPlaceholder(key)) {
    push({
      label: "Stripe skipped",
      status: "fail",
      detail: "STRIPE_SECRET_KEY is still a placeholder",
    });
    return;
  }
  try {
    const stripe = new Stripe(key);
    // Call GET /v1/account directly – works across all SDK versions.
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const account = (await res.json()) as { id: string; country?: string };
    // sanity: also call a typed endpoint to verify the SDK is wired up
    await stripe.balance.retrieve();
    const isTest = key.startsWith("sk_test_");
    const mode = isTest ? "Test Mode" : "LIVE Mode";
    const country = account.country ?? "??";
    push({
      label: `Stripe (${mode}) connected – ${country}`,
      status: "ok",
      detail: `account ${account.id} · key ${maskKey(key, 6)}`,
    });
    if (!isTest) {
      push({
        label: "Stripe is using LIVE keys – verify this is intended!",
        status: "warn",
      });
    }
  } catch (e: any) {
    push({
      label: "Stripe failed",
      status: "fail",
      detail: e?.message ?? String(e),
    });
  }
}

// ----------------------------------------------------------------------------
// 5) SMTP
// ----------------------------------------------------------------------------
async function checkSmtp() {
  console.log(header("SMTP"));
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 0);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port) {
    push({ label: "SMTP", status: "fail", detail: "SMTP_HOST or SMTP_PORT missing" });
    return;
  }

  const isMailpit =
    /localhost|127\.0\.0\.1|host\.docker\.internal|mailpit|mailhog/i.test(host);

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      // Mailpit/MailHog accept any auth or none; real servers need creds.
      auth: isMailpit ? undefined : user && pass ? { user, pass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      tls: isMailpit ? { rejectUnauthorized: false } : undefined,
    });

    await transport.verify();
    push({
      label: `SMTP (${isMailpit ? "Mailpit/local" : host}) reachable`,
      status: "ok",
      detail: `${host}:${port}${secure ? " (TLS)" : ""}`,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (isMailpit && /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(msg)) {
      push({
        label: "SMTP (Mailpit) unreachable",
        status: "fail",
        detail: `${msg}\n    ${c.yellow}Hinweis:${c.reset} Starte Mailpit mit:\n    ${c.bold}docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit${c.reset}\n    UI dann auf http://localhost:8025`,
      });
    } else {
      push({ label: `SMTP (${host}) failed`, status: "fail", detail: msg });
    }
  }
}

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
function printSummary() {
  console.log(header("Summary"));
  const okCount = results.filter((r) => r.status === "ok").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  for (const r of results) {
    const line =
      r.status === "ok" ? ok(r.label) : r.status === "warn" ? warn(r.label) : fail(r.label);
    console.log("  " + line);
  }

  console.log(
    `\n${c.bold}Result:${c.reset} ` +
      `${c.green}${okCount} ok${c.reset}  ` +
      `${c.yellow}${warnCount} warn${c.reset}  ` +
      `${c.red}${failCount} fail${c.reset}\n`,
  );

  if (failCount > 0) {
    console.log(fail("Some checks failed. Fix them before proceeding to SCHRITT 2."));
    process.exit(1);
  } else {
    console.log(ok("All checks green. Ready for SCHRITT 2 (Supabase-Migration)."));
  }
}

// ----------------------------------------------------------------------------
// Run
// ----------------------------------------------------------------------------
async function main() {
  // Load .env.local (dotenv/config loads .env by default; we want .env.local)
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local", override: true });

  console.log(
    `${c.bold}${c.cyan}Swagstack Shop – Environment Diagnosis${c.reset}\n` +
      `${c.gray}Phase 1 check (Next.js + Supabase + Stripe + SMTP)${c.reset}`,
  );

  await checkEnvVars();
  await checkSupabaseAnon();
  await checkSupabaseServiceRole();
  await checkStripe();
  await checkSmtp();
  printSummary();
}

main().catch((e) => {
  console.error(fail("Unexpected error:"), e);
  process.exit(1);
});
