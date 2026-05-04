import type { NormRect } from "@/lib/colormatch/pixel-coordinates";

export type MarketingCatalogVariant = {
  id: string;
  variant_value: string;
  variant_code: string | null;
  /** Falls der Katalog/Client Lieferanten-Codes separat liefert (Abgleich mit PDP-Prefill). */
  supplier_variant_code?: string | null;
  image_url: string | null;
  color_hex: string | null;
  sort_order: number;
};

/** Eine Druckfläche mit normiertem Overlay (wie PDP / Mockup-Canvas). */
export type MarketingCatalogPrintArea = {
  name: string;
  overlayRect: NormRect;
};

export type MarketingCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  variants: MarketingCatalogVariant[];
  /** Normiertes Logo-Rechteck für die Default-Druckfläche (bisher: größte Fläche nach mm²). */
  overlayRect: NormRect;
  /** Alle Flächen mit gültigem Overlay – Client wählt z. B. nach PDP-Druckflächen-Name. */
  printAreas: MarketingCatalogPrintArea[];
  primaryImageUrl: string | null;
};
