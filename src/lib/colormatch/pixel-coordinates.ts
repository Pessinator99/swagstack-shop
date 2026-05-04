export type NormRect = { x: number; y: number; width: number; height: number };

/** Alias für API-Klarheit (normiertes Rechteck 0–1). */
export type NormalizedRect = NormRect;

/** Logo innerhalb der Druckfläche zentriert, nicht randfüllend (ColorMatch + PDP). */
const LOGO_OVERLAY_SCALE = 0.65;

/** Normiertes Rechteck (0–1) für das Logo: 65 % der Druckfläche, zentriert. */
export function scaledLogoOverlayRect(printArea: NormRect): NormRect {
  const overlayW = printArea.width * LOGO_OVERLAY_SCALE;
  const overlayH = printArea.height * LOGO_OVERLAY_SCALE;
  return {
    x: printArea.x + (printArea.width - overlayW) / 2,
    y: printArea.y + (printArea.height - overlayH) / 2,
    width: overlayW,
    height: overlayH,
  };
}

export function parsePrintAreaPixelPayload(raw: unknown): {
  overlayRect: NormalizedRect | null;
  mappedImageUrl: string | null;
} {
  if (!raw || typeof raw !== "object") return { overlayRect: null, mappedImageUrl: null };
  const o = raw as Record<string, unknown>;
  const mappedRaw = o.mapped_image_url;
  const mappedStr =
    typeof mappedRaw === "string" && mappedRaw.trim() ? mappedRaw.trim() : null;
  const n = (k: string) => {
    const v = o[k];
    const num = typeof v === "number" ? v : Number(v);
    return Number.isFinite(num) ? num : NaN;
  };
  if (["x", "y", "width", "height"].some((k) => Number.isNaN(n(k)))) {
    return { overlayRect: null, mappedImageUrl: mappedStr };
  }
  const x = n("x");
  const y = n("y");
  const w = n("width");
  const h = n("height");
  const iw = n("image_width");
  const ih = n("image_height");
  if (iw > 0 && ih > 0) {
    return {
      overlayRect: {
        x: x / iw,
        y: y / ih,
        width: w / iw,
        height: h / ih,
      },
      mappedImageUrl: mappedStr,
    };
  }
  return {
    overlayRect: { x, y, width: w, height: h },
    mappedImageUrl: mappedStr,
  };
}
