/** Prefer DB hex; otherwise map label to a CSS color for filter swatches. */
export function shopColorSwatchCss(
  hex: string | null | undefined,
  label: string,
): string {
  const h = hex?.trim();
  if (h && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return h;
  return variantColorToCss(label);
}

/** Map common DE variant labels to CSS colors for small swatches. */
export function variantColorToCss(value: string): string {
  const v = value.trim().toLowerCase();
  const map: Record<string, string> = {
    schwarz: "#1a1a1a",
    black: "#1a1a1a",
    weiß: "#f4f4f0",
    weiss: "#f4f4f0",
    white: "#f4f4f0",
    grau: "#8a8a82",
    gray: "#8a8a82",
    grey: "#8a8a82",
    rot: "#b42318",
    red: "#b42318",
    blau: "#2563eb",
    blue: "#2563eb",
    navy: "#1e3a5f",
    grün: "#166534",
    gruen: "#166534",
    green: "#166534",
    gelb: "#eab308",
    yellow: "#eab308",
    orange: "#ea580c",
    natur: "#c9b896",
    beige: "#d6c8a8",
    braun: "#78350f",
    bordeaux: "#7f1d1d",
    silber: "#c0c0c0",
    gold: "#b8860b",
  };
  return map[v] ?? "#c4c4bc";
}
