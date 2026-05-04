import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JsonProduct, JsonTechnique, ProductMappingFile } from "./product-catalog-types";

const euros = (eur: number) => Math.round(eur * 100);

/** Map JSON category_slug to existing seed categories. */
const CATEGORY_SLUG_MAP: Record<string, string> = {
  "tassen-becher": "tassen",
  trinkflaschen: "flaschen",
  taschen: "taschen",
  rucksaecke: "rucksaecke",
};

export function storagePublicObjectUrl(baseUrl: string, slug: string, filename: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return `${clean}/storage/v1/object/public/product-images/${slug}/${filename}`;
}

function shortDescription(desc: string, name: string): string {
  const t = desc.trim();
  if (t.length <= 200) return t;
  return `${t.slice(0, 197)}…`;
}

function specificationsFromProduct(p: JsonProduct): Record<string, unknown> {
  const spec: Record<string, unknown> = {};
  if (p.dimensions) spec.dimensions = p.dimensions;
  if (p.weight_g != null) spec.weight_g = p.weight_g;
  if (p.material) spec.material = p.material;
  if (p.country_of_origin) spec.country_of_origin = p.country_of_origin;
  if (p.volume_l != null) spec.volume_l = p.volume_l;
  if (p.capacity_ml != null) spec.capacity_ml = p.capacity_ml;
  if (p.laptop_size) spec.laptop_size = p.laptop_size;
  spec.supplier_name = p.supplier ?? "Stricker";
  spec.supplier_external_id = p.stricker_id;
  return spec;
}

type PriceTier = { min_quantity: number; purchase_price_cents: number; selling_price_cents: number };

function productPriceTiersForMoq(moq: number): PriceTier[] {
  if (moq >= 50 && moq !== 24 && moq !== 20 && moq !== 10) {
    return [
      { min_quantity: 50, purchase_price_cents: euros(1.1), selling_price_cents: euros(1.95) },
      { min_quantity: 100, purchase_price_cents: euros(0.9), selling_price_cents: euros(1.6) },
      { min_quantity: 250, purchase_price_cents: euros(0.7), selling_price_cents: euros(1.25) },
      { min_quantity: 500, purchase_price_cents: euros(0.55), selling_price_cents: euros(1.0) },
      { min_quantity: 1000, purchase_price_cents: euros(0.45), selling_price_cents: euros(0.85) },
    ];
  }
  if (moq === 10) {
    return [
      { min_quantity: 10, purchase_price_cents: euros(34.0), selling_price_cents: euros(58.0) },
      { min_quantity: 25, purchase_price_cents: euros(30.0), selling_price_cents: euros(51.0) },
      { min_quantity: 50, purchase_price_cents: euros(27.5), selling_price_cents: euros(47.0) },
      { min_quantity: 100, purchase_price_cents: euros(24.5), selling_price_cents: euros(42.0) },
      { min_quantity: 250, purchase_price_cents: euros(22.9), selling_price_cents: euros(39.0) },
    ];
  }
  if (moq === 24) {
    return [
      { min_quantity: 24, purchase_price_cents: euros(9.2), selling_price_cents: euros(15.2) },
      { min_quantity: 50, purchase_price_cents: euros(8.9), selling_price_cents: euros(14.5) },
      { min_quantity: 100, purchase_price_cents: euros(7.6), selling_price_cents: euros(12.6) },
      { min_quantity: 250, purchase_price_cents: euros(6.2), selling_price_cents: euros(10.3) },
      { min_quantity: 500, purchase_price_cents: euros(5.3), selling_price_cents: euros(8.9) },
    ];
  }
  if (moq === 20) {
    return [
      { min_quantity: 20, purchase_price_cents: euros(2.95), selling_price_cents: euros(4.95) },
      { min_quantity: 50, purchase_price_cents: euros(2.8), selling_price_cents: euros(4.7) },
      { min_quantity: 100, purchase_price_cents: euros(2.4), selling_price_cents: euros(4.1) },
      { min_quantity: 250, purchase_price_cents: euros(1.95), selling_price_cents: euros(3.35) },
      { min_quantity: 500, purchase_price_cents: euros(1.55), selling_price_cents: euros(2.7) },
    ];
  }
  return [
    { min_quantity: 50, purchase_price_cents: euros(1.1), selling_price_cents: euros(1.95) },
    { min_quantity: 100, purchase_price_cents: euros(0.9), selling_price_cents: euros(1.6) },
    { min_quantity: 250, purchase_price_cents: euros(0.7), selling_price_cents: euros(1.25) },
    { min_quantity: 500, purchase_price_cents: euros(0.55), selling_price_cents: euros(1.0) },
    { min_quantity: 1000, purchase_price_cents: euros(0.45), selling_price_cents: euros(0.85) },
  ];
}

type PrintTier = {
  min_quantity: number;
  setup_cost_cents: number;
  purchase_price_per_unit_cents: number;
  selling_price_per_unit_cents: number;
};

const screenPrintTiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.55), selling_price_per_unit_cents: euros(0.95) },
  { min_quantity: 100, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.4), selling_price_per_unit_cents: euros(0.7) },
  { min_quantity: 250, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.28), selling_price_per_unit_cents: euros(0.49) },
  { min_quantity: 500, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.2), selling_price_per_unit_cents: euros(0.36) },
  { min_quantity: 1000, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.15), selling_price_per_unit_cents: euros(0.28) },
];

const transferTiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(60), purchase_price_per_unit_cents: euros(1.1), selling_price_per_unit_cents: euros(1.85) },
  { min_quantity: 100, setup_cost_cents: euros(60), purchase_price_per_unit_cents: euros(0.85), selling_price_per_unit_cents: euros(1.45) },
  { min_quantity: 250, setup_cost_cents: euros(60), purchase_price_per_unit_cents: euros(0.6), selling_price_per_unit_cents: euros(1.05) },
  { min_quantity: 500, setup_cost_cents: euros(60), purchase_price_per_unit_cents: euros(0.45), selling_price_per_unit_cents: euros(0.79) },
  { min_quantity: 1000, setup_cost_cents: euros(60), purchase_price_per_unit_cents: euros(0.35), selling_price_per_unit_cents: euros(0.62) },
];

const transferSmallTiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.95), selling_price_per_unit_cents: euros(1.6) },
  { min_quantity: 100, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.72), selling_price_per_unit_cents: euros(1.22) },
  { min_quantity: 250, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.52), selling_price_per_unit_cents: euros(0.88) },
  { min_quantity: 500, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.4), selling_price_per_unit_cents: euros(0.68) },
  { min_quantity: 1000, setup_cost_cents: euros(45), purchase_price_per_unit_cents: euros(0.32), selling_price_per_unit_cents: euros(0.55) },
];

const laserTiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(50), purchase_price_per_unit_cents: euros(1.4), selling_price_per_unit_cents: euros(2.35) },
  { min_quantity: 100, setup_cost_cents: euros(50), purchase_price_per_unit_cents: euros(1.1), selling_price_per_unit_cents: euros(1.85) },
  { min_quantity: 250, setup_cost_cents: euros(50), purchase_price_per_unit_cents: euros(0.8), selling_price_per_unit_cents: euros(1.35) },
  { min_quantity: 500, setup_cost_cents: euros(50), purchase_price_per_unit_cents: euros(0.65), selling_price_per_unit_cents: euros(1.1) },
  { min_quantity: 1000, setup_cost_cents: euros(50), purchase_price_per_unit_cents: euros(0.5), selling_price_per_unit_cents: euros(0.85) },
];

const laserTiersLowSetup = (): PrintTier[] =>
  laserTiers().map((t) => ({ ...t, setup_cost_cents: euros(25) }));

const firePrintTiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(80), purchase_price_per_unit_cents: euros(2.2), selling_price_per_unit_cents: euros(3.75) },
  { min_quantity: 100, setup_cost_cents: euros(80), purchase_price_per_unit_cents: euros(1.75), selling_price_per_unit_cents: euros(2.95) },
  { min_quantity: 250, setup_cost_cents: euros(80), purchase_price_per_unit_cents: euros(1.25), selling_price_per_unit_cents: euros(2.1) },
  { min_quantity: 500, setup_cost_cents: euros(80), purchase_price_per_unit_cents: euros(0.95), selling_price_per_unit_cents: euros(1.6) },
  { min_quantity: 1000, setup_cost_cents: euros(80), purchase_price_per_unit_cents: euros(0.75), selling_price_per_unit_cents: euros(1.25) },
];

const tamponTiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(35), purchase_price_per_unit_cents: euros(0.65), selling_price_per_unit_cents: euros(1.1) },
  { min_quantity: 100, setup_cost_cents: euros(35), purchase_price_per_unit_cents: euros(0.48), selling_price_per_unit_cents: euros(0.82) },
  { min_quantity: 250, setup_cost_cents: euros(35), purchase_price_per_unit_cents: euros(0.35), selling_price_per_unit_cents: euros(0.6) },
  { min_quantity: 500, setup_cost_cents: euros(35), purchase_price_per_unit_cents: euros(0.28), selling_price_per_unit_cents: euros(0.48) },
  { min_quantity: 1000, setup_cost_cents: euros(35), purchase_price_per_unit_cents: euros(0.22), selling_price_per_unit_cents: euros(0.38) },
];

const uv360Tiers = (): PrintTier[] => [
  { min_quantity: 50, setup_cost_cents: euros(90), purchase_price_per_unit_cents: euros(1.35), selling_price_per_unit_cents: euros(2.25) },
  { min_quantity: 100, setup_cost_cents: euros(90), purchase_price_per_unit_cents: euros(1.05), selling_price_per_unit_cents: euros(1.75) },
  { min_quantity: 250, setup_cost_cents: euros(90), purchase_price_per_unit_cents: euros(0.78), selling_price_per_unit_cents: euros(1.3) },
  { min_quantity: 500, setup_cost_cents: euros(90), purchase_price_per_unit_cents: euros(0.58), selling_price_per_unit_cents: euros(0.98) },
  { min_quantity: 1000, setup_cost_cents: euros(90), purchase_price_per_unit_cents: euros(0.45), selling_price_per_unit_cents: euros(0.76) },
];

function printTiersForTechnique(t: JsonTechnique): PrintTier[] {
  const code = t.code.toUpperCase();
  const name = t.name.toUpperCase();
  if (code.startsWith("LSR2") || (name.includes("LASER") && code.includes("LSR"))) return laserTiersLowSetup();
  if (code.startsWith("LAS") || name.includes("LASER")) return laserTiers();
  if (code.startsWith("FIR")) return firePrintTiers();
  if (code.startsWith("PDP")) return tamponTiers();
  if (code.startsWith("UVC") || name.includes("360")) return uv360Tiers();
  if (code.startsWith("TRD") || code.startsWith("TRS") || name.includes("TRANSFER") || name.includes("DIGITAL"))
    return code.endsWith("3") || name.includes("UNTEN") || name.includes("SCHULTER") ? transferSmallTiers() : transferTiers();
  if (code.startsWith("TXP") || code.startsWith("SCR") || name.includes("SIEB") || name.includes("TEXTIL"))
    return screenPrintTiers();
  return screenPrintTiers();
}

function maxColorsToText(t: JsonTechnique): string | null {
  if (t.full_color) return "full_color";
  if (t.max_colors != null) return String(t.max_colors);
  if (t.is_engraving) return "1";
  return null;
}

function collectVariantAdditionalFilenames(
  repoRoot: string,
  slug: string,
  strickerId: string,
  code: string,
): string[] {
  const dir = path.join(repoRoot, "uploads", "produktbilder", slug);
  if (!existsSync(dir)) return [];
  const sidEsc = escapeRegExp(strickerId);
  const codeEsc = escapeRegExp(code);
  const mainRe = new RegExp(`^${sidEsc}_${codeEsc}\\.(jpg|jpeg|png)$`, "i");
  /** Perspektiven -a…-e, Mockup -logo, Stricker-Lifestyle -amb (z. B. 93832_128-amb.jpg). */
  const extraRe = new RegExp(
    `^${sidEsc}_${codeEsc}(-[a-e]|-amb|-logo)\\.(jpg|jpeg|png)$`,
    "i",
  );
  return readdirSync(dir).filter((f) => extraRe.test(f) && !mainRe.test(f)).sort();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Only add marketing images (amb/set) when the file exists locally — avoids 404s in the gallery. */
function productBaseImageJson(
  baseUrl: string,
  p: JsonProduct,
  firstVariantCode: string,
  repoRoot: string,
): Array<{ url: string; alt?: string; is_primary?: boolean }> {
  const slug = p.slug;
  const sid = p.stricker_id;
  const dir = path.join(repoRoot, "uploads", "produktbilder", slug);
  const out: Array<{ url: string; alt?: string; is_primary?: boolean }> = [
    {
      url: storagePublicObjectUrl(baseUrl, slug, `${sid}_${firstVariantCode}.jpg`),
      alt: "Hauptbild",
      is_primary: true,
    },
  ];

  let ambFile: string | null = null;
  let setFile: string | null = null;
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    const ambExact = `${sid}_amb.jpg`;
    if (files.includes(ambExact)) {
      ambFile = ambExact;
    } else {
      const prefixRe = new RegExp(`^${escapeRegExp(sid)}_`, "i");
      const ambLoose = files.filter((f) => {
        if (!prefixRe.test(f)) return false;
        if (!/\.(jpg|jpeg|png)$/i.test(f)) return false;
        return f.toLowerCase().includes("amb");
      });
      ambFile = ambLoose.sort()[0] ?? null;
    }

    const setExact = `${sid}_set.jpg`;
    if (files.includes(setExact)) {
      setFile = setExact;
    } else {
      const prefixRe = new RegExp(`^${escapeRegExp(sid)}_`, "i");
      const setLoose = files.filter((f) => {
        if (!prefixRe.test(f)) return false;
        if (!/\.(jpg|jpeg|png)$/i.test(f)) return false;
        return f.toLowerCase().includes("set");
      });
      setFile = setLoose.sort()[0] ?? null;
    }
  }

  if (ambFile) {
    out.push({ url: storagePublicObjectUrl(baseUrl, slug, ambFile), alt: "Ambient" });
  }
  if (setFile) {
    out.push({ url: storagePublicObjectUrl(baseUrl, slug, setFile), alt: "Alle Farben" });
  }
  return out;
}

export function loadProductMapping(repoRoot: string): ProductMappingFile {
  const fp = path.join(repoRoot, "data", "products-data-mapping.json");
  const raw = readFileSync(fp, "utf-8");
  return JSON.parse(raw) as ProductMappingFile;
}

export async function seedProductCatalogFromJson(sb: SupabaseClient, repoRoot: string, supabasePublicUrl: string) {
  const { products } = loadProductMapping(repoRoot);
  const slugs = products.map((x) => x.slug);
  const { error: delErr } = await sb.from("products").delete().in("slug", slugs);
  if (delErr) throw delErr;

  const { data: cats, error: catErr } = await sb.from("categories").select("id, slug");
  if (catErr) throw catErr;
  const catMap = new Map((cats ?? []).map((c) => [c.slug as string, c.id as string]));

  for (const p of products) {
    const mappedSlug = CATEGORY_SLUG_MAP[p.category_slug] ?? p.category_slug;
    const categoryId = catMap.get(mappedSlug);
    if (!categoryId) throw new Error(`Unknown category (mapped): ${p.category_slug} → ${mappedSlug}`);

    const firstCode = p.variants[0]?.code;
    if (!firstCode) throw new Error(`No variants: ${p.slug}`);

    const baseImages = productBaseImageJson(supabasePublicUrl, p, firstCode, repoRoot);
    const specs = specificationsFromProduct(p);
    const shortDesc = shortDescription(p.description, p.name);

    const { data: prodRow, error: prodErr } = await sb
      .from("products")
      .insert({
        supplier_sku: p.stricker_id,
        supplier_code: "stricker",
        slug: p.slug,
        name: p.name,
        description: p.description,
        short_description: shortDesc,
        category_id: categoryId,
        base_images: baseImages,
        specifications: specs,
        moq: p.moq,
        status: "active",
        is_featured: p.slug === "canary-einkaufstasche-non-woven" || p.slug === "nicklaus-edelstahlflasche-590ml",
      })
      .select("id")
      .single();
    if (prodErr) throw prodErr;
    const productId = prodRow.id as string;

    const priceTiers = productPriceTiersForMoq(p.moq);
    const { error: ptErr } = await sb.from("product_price_tiers").insert(
      priceTiers.map((t) => ({
        product_id: productId,
        min_quantity: t.min_quantity,
        purchase_price_cents: t.purchase_price_cents,
        selling_price_cents: t.selling_price_cents,
        is_manual_override: false,
      })),
    );
    if (ptErr) throw ptErr;

    const variantRows = p.variants.map((v, idx) => {
      const extraFiles = collectVariantAdditionalFilenames(repoRoot, p.slug, p.stricker_id, v.code);
      const extraUrls = extraFiles.map((fn) => ({
        url: storagePublicObjectUrl(supabasePublicUrl, p.slug, fn),
        alt: fn.includes("logo") ? "Mockup" : "Ansicht",
      }));
      return {
        product_id: productId,
        variant_type: "color" as const,
        variant_value: v.color_name,
        variant_code: v.code,
        sku: `${p.stricker_id}-${v.code}`,
        image_url: storagePublicObjectUrl(supabasePublicUrl, p.slug, v.main_image),
        color_hex: v.hex,
        additional_images: extraUrls,
        sort_order: idx,
        is_active: true,
        stock: 500,
      };
    });
    const { error: vErr } = await sb.from("product_variants").insert(variantRows);
    if (vErr) throw vErr;

    let areaOrder = 0;
    let defaultAssigned = false;
    for (const area of p.print_areas) {
      const isDefault = area.is_default === true || (!defaultAssigned && areaOrder === 0);
      if (isDefault) defaultAssigned = true;

      const { data: areaRow, error: areaErr } = await sb
        .from("print_areas")
        .insert({
          product_id: productId,
          name: area.name,
          position_code: null,
          perspective_hint: null,
          is_default: isDefault,
          sort_order: areaOrder++,
          max_width_mm: area.max_width_mm,
          max_height_mm: area.max_height_mm,
          pixel_coordinates: null,
        })
        .select("id")
        .single();
      if (areaErr) throw areaErr;
      const areaId = areaRow.id as string;

      let techOrder = 0;
      for (const tech of area.techniques) {
        const mw = tech.max_width_mm_override ?? area.max_width_mm;
        const mh = tech.max_height_mm_override ?? area.max_height_mm;
        const isDefaultTech = techOrder === 0;
        const { data: techRow, error: techErr } = await sb
          .from("print_techniques")
          .insert({
            print_area_id: areaId,
            technique_code: tech.code,
            technique_name: tech.name,
            max_width_mm: mw,
            max_height_mm: mh,
            max_colors: maxColorsToText(tech),
            is_default: isDefaultTech,
            is_full_color: !!tech.full_color,
            is_engraving: !!tech.is_engraving,
          })
          .select("id")
          .single();
        if (techErr) throw techErr;
        const techId = techRow.id as string;

        const tiers = printTiersForTechnique(tech);
        const { error: pptErr } = await sb.from("print_price_tiers").insert(
          tiers.map((t) => ({
            print_technique_id: techId,
            min_quantity: t.min_quantity,
            setup_cost_cents: t.setup_cost_cents,
            purchase_price_per_unit_cents: t.purchase_price_per_unit_cents,
            selling_price_per_unit_cents: t.selling_price_per_unit_cents,
            is_manual_override: false,
          })),
        );
        if (pptErr) throw pptErr;
        techOrder += 1;
      }
    }
  }
}
