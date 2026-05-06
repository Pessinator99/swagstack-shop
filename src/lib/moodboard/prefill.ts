/**
 * PDP → /moodboard: strukturierter sessionStorage-Übergang (Logo + kartiertes Produktbild).
 * Query-Params: ?product=slug&variant=lieferanten-farbcode
 */

export interface MoodboardPrefill {
  productSlug: string;
  variantCode?: string;
  /** Anzeigename der auf der PDP gewählten Druckfläche (Abgleich mit Katalog `printAreas`). */
  printAreaName?: string;
  logoDataUrl?: string;
  /** Mapper-Referenzbild (für aktuelle Variante abgeleitet), für Canvas-Vorschau */
  mappedImageUrl?: string;
}

export const MOODBOARD_SESSION_PREFILL_KEY = "werbenest_moodboard_prefill";

/** @deprecated Nur Logo, ohne mappedImageUrl — wird beim Lesen noch unterstützt. */
export const MOODBOARD_SESSION_LOGO_KEY = "werbenest_moodboard_prefill_logo";

export function saveMoodboardPrefillToSession(data: MoodboardPrefill): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MOODBOARD_SESSION_PREFILL_KEY, JSON.stringify(data));
}

/** Liest und entfernt den Prefill-Eintrag (einmalige Verwendung). */
export function consumeMoodboardPrefillFromSession(): MoodboardPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MOODBOARD_SESSION_PREFILL_KEY);
    if (raw) {
      sessionStorage.removeItem(MOODBOARD_SESSION_PREFILL_KEY);
      const o = JSON.parse(raw) as unknown;
      if (!o || typeof o !== "object") return null;
      const p = o as Record<string, unknown>;
      const slug = p.productSlug;
      if (typeof slug !== "string") return null;
      return {
        productSlug: slug,
        variantCode: typeof p.variantCode === "string" ? p.variantCode : undefined,
        printAreaName: typeof p.printAreaName === "string" ? p.printAreaName : undefined,
        logoDataUrl: typeof p.logoDataUrl === "string" ? p.logoDataUrl : undefined,
        mappedImageUrl: typeof p.mappedImageUrl === "string" ? p.mappedImageUrl : undefined,
      };
    }
    const legacy = sessionStorage.getItem(MOODBOARD_SESSION_LOGO_KEY);
    if (legacy?.startsWith("data:image")) {
      sessionStorage.removeItem(MOODBOARD_SESSION_LOGO_KEY);
      return { productSlug: "", logoDataUrl: legacy };
    }
  } catch {
    /* ignore */
  }
  return null;
}
