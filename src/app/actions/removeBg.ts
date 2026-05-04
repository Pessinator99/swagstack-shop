"use server";

import { Buffer } from "node:buffer";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/pjpeg",
  "image/x-png",
]);

export type RemoveBgResult =
  | { ok: true; base64Png: string }
  | { ok: false; error: string };

/**
 * Entfernt den Hintergrund eines Logos via remove.bg.
 * Erwartet im FormData ein Feld `file` (PNG/JPEG/WebP, max. 10 MB).
 */
export async function removeLogoBackground(formData: FormData): Promise<RemoveBgResult> {
  const apiKey = process.env.REMOVE_BG_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "REMOVE_BG_API_KEY ist nicht gesetzt." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Keine gültige Datei übermittelt." };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Datei zu groß (max. 10 MB)." };
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) {
    return { ok: false, error: "Nur PNG, JPEG oder WebP sind erlaubt." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const outbound = new FormData();
    outbound.append(
      "image_file",
      new Blob([bytes], { type: mime || "application/octet-stream" }),
      file.name || "logo.png",
    );
    outbound.append("size", "auto");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: outbound,
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let message = `remove.bg antwortet mit HTTP ${res.status}.`;
      try {
        const parsed = JSON.parse(raw) as { errors?: { title?: string }[] };
        const title = parsed.errors?.[0]?.title;
        if (title) message = title;
      } catch {
        /* ignore */
      }
      return { ok: false, error: message };
    }

    const out = Buffer.from(await res.arrayBuffer());
    const base64Png = out.toString("base64");
    return { ok: true, base64Png };
  } catch (e) {
    console.error("[removeLogoBackground]", e);
    return { ok: false, error: "Netzwerk- oder Verarbeitungsfehler." };
  }
}
