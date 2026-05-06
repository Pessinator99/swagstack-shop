/**
 * Liest `.env.local` und schreibt Variablen nach Vercel (production) via REST API.
 *
 * Voraussetzungen:
 * - `VERCEL_TOKEN` (https://vercel.com/account/tokens) in der Umgebung oder in `.env.local`
 * - `.vercel/project.json` (nach `pnpm vercel:link`)
 *
 * Aufruf: pnpm vercel:env-push
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const ENV_FILE = resolve(ROOT, ".env.local");
const VERCEL_PROJECT_FILE = resolve(ROOT, ".vercel", "project.json");
const PRODUCTION_SITE_FALLBACK = "https://swagstack-shop-new.vercel.app";

const PROD_SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"] as const;

/** Niemals als Projekt-Env hochladen. */
const SKIP_PUSH_KEYS = new Set(["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_TEAM", "VERCEL_PROJECT"]);

type VercelEnvType = "plain" | "encrypted";

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    const quoted =
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2);
    if (quoted) {
      val = val.slice(1, -1);
    } else {
      // Unquoted inline comments aus .env entfernen: KEY=value  # comment
      val = val.replace(/\s+#.*$/, "").trim();
    }
    out[key] = val;
  }
  return out;
}

function isLocalSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "mailpit" ||
    h === "0.0.0.0" ||
    h === "host.docker.internal"
  );
}

function hasProdSmtpBlock(raw: Record<string, string>): boolean {
  return Boolean((raw.SMTP_HOST_PROD ?? "").trim());
}

function vercelEnvType(key: string): VercelEnvType {
  return key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted";
}

/** Finale Map für Vercel production. */
function buildProductionEnv(raw: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  const prodSmtp = hasProdSmtpBlock(raw);

  for (const [key, value] of Object.entries(raw)) {
    if (SKIP_PUSH_KEYS.has(key)) continue;
    if (key === "DATABASE_URL") continue;
    if (key.endsWith("_PROD")) continue;

    if (prodSmtp && (PROD_SMTP_KEYS as readonly string[]).includes(key)) {
      continue;
    }

    if (!prodSmtp) {
      if (key === "SMTP_HOST" && isLocalSmtpHost(value)) continue;
      if (key === "SMTP_PORT" && value.trim() === "1025") continue;
      if (key === "SMTP_SECURE" && value.trim().toLowerCase() === "false") {
        const host = (raw.SMTP_HOST ?? "").trim();
        const port = (raw.SMTP_PORT ?? "").trim();
        if (isLocalSmtpHost(host) || port === "1025") continue;
      }
      if (key === "SMTP_USER" && !value.trim()) continue;
      if (key === "SMTP_PASS" && !value.trim()) continue;
    }

    if (value.trim() === "") continue;

    out.set(key, value);
  }

  if (prodSmtp) {
    const mapProd = (from: string, to: string) => {
      const v = raw[from]?.trim();
      if (v) out.set(to, v);
    };
    mapProd("SMTP_HOST_PROD", "SMTP_HOST");
    mapProd("SMTP_PORT_PROD", "SMTP_PORT");
    mapProd("SMTP_SECURE_PROD", "SMTP_SECURE");
    mapProd("SMTP_USER_PROD", "SMTP_USER");
    mapProd("SMTP_PASS_PROD", "SMTP_PASS");
  }

  const site = out.get("NEXT_PUBLIC_SITE_URL") ?? raw.NEXT_PUBLIC_SITE_URL ?? "";
  const s = site.trim();
  if (s) {
    if (/localhost|127\.0\.0\.1/i.test(s)) {
      out.set("NEXT_PUBLIC_SITE_URL", PRODUCTION_SITE_FALLBACK);
    } else if (!/^https?:\/\//i.test(s)) {
      out.set("NEXT_PUBLIC_SITE_URL", `https://${s.replace(/^\/+/, "")}`);
    } else {
      out.set("NEXT_PUBLIC_SITE_URL", s);
    }
  }

  return out;
}

type VercelProjectJson = {
  projectId?: string;
  orgId?: string;
  projectName?: string;
};

function loadProjectMeta(): { projectId: string; teamId: string } {
  if (!existsSync(VERCEL_PROJECT_FILE)) {
    throw new Error(`Fehlt: ${VERCEL_PROJECT_FILE} — zuerst "pnpm vercel:link" ausführen.`);
  }
  const j = JSON.parse(readFileSync(VERCEL_PROJECT_FILE, "utf8")) as VercelProjectJson;
  const projectId = j.projectId?.trim();
  const teamId = j.orgId?.trim();
  if (!projectId) throw new Error("projectId fehlt in .vercel/project.json");
  if (!teamId) throw new Error("orgId (Team) fehlt in .vercel/project.json");
  return { projectId, teamId };
}

type VercelEnvItem = {
  key: string;
  value: string;
  type: VercelEnvType;
  target: ("production" | "preview" | "development")[];
};

type CreateEnvResponse = {
  created?: unknown;
  failed?: Array<{ error?: { code?: string; message?: string } }>;
};

async function pushEnvBatch(
  token: string,
  projectId: string,
  teamId: string,
  items: VercelEnvItem[],
): Promise<void> {
  const q = new URLSearchParams({ upsert: "true", teamId });
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?${q.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });

  const text = await res.text();
  let json: CreateEnvResponse | null = null;
  try {
    json = JSON.parse(text) as CreateEnvResponse;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    console.error(`[vercel-env-push] HTTP ${res.status}: ${text.slice(0, 800)}`);
    if (res.status === 401) {
      console.error("  → Token prüfen (VERCEL_TOKEN ungültig oder abgelaufen).");
    }
    if (res.status === 403) {
      console.error("  → Fehlende Rechte (z. B. Production-Env) oder falsches Team (orgId).");
    }
    process.exitCode = 1;
    return;
  }

  const failed = json?.failed;
  if (Array.isArray(failed) && failed.length > 0) {
    for (const f of failed) {
      const code = f.error?.code ?? "?";
      const msg = f.error?.message ?? JSON.stringify(f);
      console.error(`[vercel-env-push] Teil-Fehler: [${code}] ${msg}`);
    }
  }

  console.log(`[vercel-env-push] API OK (${res.status}), ${items.length} Einträge gesendet.`);
}

function resolveToken(raw: Record<string, string>): string {
  const t = (process.env.VERCEL_TOKEN ?? raw.VERCEL_TOKEN ?? "").trim();
  return t;
}

async function main(): Promise<void> {
  if (!existsSync(ENV_FILE)) {
    console.error(`Datei fehlt: ${ENV_FILE}`);
    process.exit(1);
  }

  const raw = parseDotEnv(readFileSync(ENV_FILE, "utf8"));
  const token = resolveToken(raw);
  if (!token) {
    console.error(
      "VERCEL_TOKEN fehlt. Lege ein Token an: https://vercel.com/account/tokens\n" +
        "Dann: setze VERCEL_TOKEN in der Shell oder trage VERCEL_TOKEN=… in .env.local ein (wird nicht nach Vercel gepusht).",
    );
    process.exit(1);
  }

  let meta: { projectId: string; teamId: string };
  try {
    meta = loadProjectMeta();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const finalEnv = buildProductionEnv(raw);
  const keys = [...finalEnv.keys()].sort((a, b) => a.localeCompare(b));

  const items: VercelEnvItem[] = keys.map((key) => ({
    key,
    value: finalEnv.get(key)!,
    type: vercelEnvType(key),
    target: ["production"],
  }));

  console.log(`→ ${items.length} Variablen → Vercel production (POST …/env?upsert=true)\n`);

  await pushEnvBatch(token, meta.projectId, meta.teamId, items);
  if (process.exitCode === 1) {
    process.exit(1);
  }

  console.log("\nHinweise:");
  console.log("  • Neu deployen: pnpm vercel:deploy");
  console.log("  • STRIPE_WEBHOOK_SECRET für Production-URL in Stripe anlegen:");
  console.log(`    ${PRODUCTION_SITE_FALLBACK}/api/stripe/webhook`);
  console.log("  • DATABASE_URL wird nicht gepusht.");
  if (hasProdSmtpBlock(raw)) {
    console.log("  • SMTP_* aus *_PROD gemappt.");
  }
}

void main();
