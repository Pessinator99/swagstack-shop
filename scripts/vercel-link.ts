/**
 * Verknüpft das Repo mit dem Vercel-Projekt (nicht-interaktiv).
 *
 * Optional: VERCEL_TEAM=<slug oder id> (siehe `vercel teams ls` nach Login)
 *
 * pnpm vercel:link
 */

import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const PROJECT = process.env.VERCEL_PROJECT ?? "werbenest-shop";
const TEAM = process.env.VERCEL_TEAM?.trim();

const args = ["exec", "vercel", "link", "--yes"];
if (TEAM) args.push("--team", TEAM);
args.push("--project", PROJECT);

const r = spawnSync("pnpm", args, {
  cwd: ROOT,
  stdio: "inherit",
  shell: false,
});

process.exit(r.status ?? 1);
