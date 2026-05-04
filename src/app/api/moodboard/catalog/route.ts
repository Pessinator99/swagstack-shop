import { NextResponse } from "next/server";
import {
  parsePrintAreaPixelPayload,
  scaledLogoOverlayRect,
} from "@/lib/colormatch/pixel-coordinates";
import type { NormRect } from "@/lib/colormatch/pixel-coordinates";
import type {
  MarketingCatalogPrintArea,
  MarketingCatalogProduct,
  MarketingCatalogVariant,
} from "@/lib/moodboard/marketing-types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ProductImage } from "@/types/database";

function parseBaseImages(raw: unknown): ProductImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is ProductImage =>
      typeof x === "object" &&
      x != null &&
      "url" in x &&
      typeof (x as { url: unknown }).url === "string",
  ) as ProductImage[];
}

type PrintTechniqueMm = {
  max_width_mm: number | null;
  max_height_mm: number | null;
};

type PrintAreaRow = {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  pixel_coordinates: unknown;
  print_techniques: PrintTechniqueMm[] | null;
};

/** Größtes Druckmaß (mm²) über alle Techniken dieser Fläche. */
function maxMmFootprintForArea(techs: PrintTechniqueMm[] | null | undefined): number {
  if (!techs?.length) return 0;
  let max = 0;
  for (const t of techs) {
    const w = t.max_width_mm ?? 0;
    const h = t.max_height_mm ?? 0;
    const prod = w * h;
    if (prod > max) max = prod;
  }
  return max;
}

type VariantRow = {
  id: string;
  variant_type: string;
  variant_value: string;
  variant_code: string | null;
  image_url: string | null;
  color_hex: string | null;
  is_active: boolean;
  sort_order: number;
};

function pickOverlayRect(areas: PrintAreaRow[]) {
  type Scored = {
    area: PrintAreaRow;
    rect: NonNullable<ReturnType<typeof parsePrintAreaPixelPayload>["overlayRect"]>;
  };
  const scored: Scored[] = [];
  for (const a of areas) {
    const { overlayRect } = parsePrintAreaPixelPayload(a.pixel_coordinates);
    if (overlayRect) scored.push({ area: a, rect: overlayRect });
  }
  if (!scored.length) return null;
  scored.sort((x, y) => {
    const mmY = maxMmFootprintForArea(y.area.print_techniques);
    const mmX = maxMmFootprintForArea(x.area.print_techniques);
    if (mmY !== mmX) return mmY - mmX;
    const normY = y.rect.width * y.rect.height;
    const normX = x.rect.width * x.rect.height;
    if (normY !== normX) return normY - normX;
    return x.area.sort_order - y.area.sort_order;
  });
  return scaledLogoOverlayRect(scored[0].rect);
}

/** Alle Druckflächen mit parsbarem Overlay (normiert), unabhängig von der Default-Auswahl. */
function buildPrintAreasCatalog(areas: PrintAreaRow[] | null | undefined): MarketingCatalogPrintArea[] {
  if (!areas?.length) return [];
  const out: MarketingCatalogPrintArea[] = [];
  for (const a of areas) {
    const { overlayRect } = parsePrintAreaPixelPayload(a.pixel_coordinates);
    if (!overlayRect) continue;
    out.push({ name: a.name, overlayRect: scaledLogoOverlayRect(overlayRect) });
  }
  return out;
}

function toMarketingProduct(
  row: {
    id: string;
    slug: string;
    name: string;
    base_images: unknown;
    product_variants: VariantRow[] | null;
    print_areas: PrintAreaRow[] | null;
  },
  overlayRect: NormRect | null,
  printAreas: MarketingCatalogPrintArea[],
): MarketingCatalogProduct | null {
  if (!overlayRect) return null;
  const variants = (row.product_variants ?? [])
    .filter((v) => v.is_active && v.variant_type === "color")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (v): MarketingCatalogVariant => ({
        id: v.id,
        variant_value: v.variant_value,
        variant_code: v.variant_code,
        image_url: v.image_url,
        color_hex: v.color_hex,
        sort_order: v.sort_order,
      }),
    );
  if (!variants.length) return null;

  const imgs = parseBaseImages(row.base_images);
  const basePrimary = imgs.find((i) => i.is_primary)?.url ?? imgs[0]?.url ?? null;
  const colorWithImg = variants.filter((v) => v.image_url);
  const primaryImageUrl =
    colorWithImg[0]?.image_url ?? basePrimary ?? variants[0]?.image_url ?? null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    variants,
    overlayRect,
    printAreas,
    primaryImageUrl,
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        slug,
        name,
        base_images,
        product_variants ( id, variant_type, variant_value, variant_code, image_url, color_hex, is_active, sort_order ),
        print_areas (
          id,
          name,
          sort_order,
          is_default,
          pixel_coordinates,
          print_techniques ( max_width_mm, max_height_mm )
        )
      `,
      )
      .eq("status", "active")
      .order("name");

    if (error) throw error;

    const products: MarketingCatalogProduct[] = [];
    for (const row of data ?? []) {
      const r = row as unknown as {
        id: string;
        slug: string;
        name: string;
        base_images: unknown;
        product_variants: VariantRow[] | null;
        print_areas: PrintAreaRow[] | null;
      };
      const paRows = r.print_areas ?? [];
      const rect = pickOverlayRect(paRows);
      const printAreas = buildPrintAreasCatalog(paRows);
      const m = toMarketingProduct(r, rect, printAreas);
      if (m) products.push(m);
    }

    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } },
    );
  } catch (e) {
    console.error("[GET /api/moodboard/catalog]", e);
    return NextResponse.json({ error: "Katalog konnte nicht geladen werden." }, { status: 500 });
  }
}
