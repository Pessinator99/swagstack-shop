import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductImage } from "@/types/database";

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type ProductVariantRow = {
  id: string;
  variant_type: "color" | "size";
  variant_value: string;
  image_url: string | null;
  color_hex?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  supplier_sku: string | null;
  moq: number;
  is_featured: boolean;
  base_images: unknown;
  created_at: string;
  category_id: string | null;
  supplier_code: string;
  product_variants: ProductVariantRow[] | null;
};

export type PriceTierPublic = {
  product_id: string;
  min_quantity: number;
  selling_price_cents: number;
};

export type ShopCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  supplier_sku: string | null;
  moq: number;
  is_featured: boolean;
  created_at: string;
  supplier_code: string;
  category: { id: string; slug: string; name: string } | null;
  variants: ProductVariantRow[];
  /** Selling €/Stk at highest quantity tier (lowest unit price). */
  listUnitCents: number;
  listTierQty: number;
  /** Same as list for filter slider (spec: price at highest tier). */
  filterUnitCents: number;
  techniqueNames: string[];
  primaryImageUrl: string | null;
  hoverImageUrl: string | null;
};

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

function pickListTier(tiers: PriceTierPublic[]) {
  if (!tiers.length) return { cents: 0, qty: 1 };
  const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const top = sorted[sorted.length - 1];
  return { cents: top.selling_price_cents, qty: top.min_quantity };
}

export async function fetchShopCatalog(supabase: SupabaseClient): Promise<{
  products: ShopCatalogProduct[];
}> {
  const [productsRes, categoriesRes, pricesRes, areasRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        `
        id,
        slug,
        name,
        short_description,
        description,
        supplier_sku,
        moq,
        is_featured,
        base_images,
        created_at,
        category_id,
        supplier_code,
        product_variants ( id, variant_type, variant_value, image_url, color_hex, is_active, sort_order )
      `,
      )
      .eq("status", "active")
      .order("name"),
    supabase.from("categories").select("id, slug, name").eq("is_active", true),
    supabase
      .from("product_prices_public")
      .select("product_id, min_quantity, selling_price_cents"),
    supabase.from("print_areas").select(
      `
        product_id,
        print_techniques ( technique_name )
      `,
    ),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (pricesRes.error) throw pricesRes.error;
  if (areasRes.error) throw areasRes.error;

  const products = (productsRes.data ?? []) as unknown as ProductRow[];
  const catById = new Map(
    (categoriesRes.data ?? []).map((c) => [
      (c as { id: string }).id,
      c as { id: string; slug: string; name: string },
    ]),
  );
  const prices = (pricesRes.data ?? []) as PriceTierPublic[];

  const priceByProduct = new Map<string, PriceTierPublic[]>();
  for (const row of prices) {
    const list = priceByProduct.get(row.product_id) ?? [];
    list.push(row);
    priceByProduct.set(row.product_id, list);
  }

  const techByProduct = new Map<string, Set<string>>();
  for (const row of areasRes.data ?? []) {
    const pid = row.product_id as string;
    const nested = row.print_techniques as
      | { technique_name: string }[]
      | { technique_name: string }
      | null;
    const set = techByProduct.get(pid) ?? new Set();
    if (Array.isArray(nested)) {
      for (const t of nested) {
        if (t?.technique_name) set.add(t.technique_name);
      }
    } else if (nested && typeof nested === "object" && "technique_name" in nested) {
      set.add((nested as { technique_name: string }).technique_name);
    }
    techByProduct.set(pid, set);
  }

  const merged: ShopCatalogProduct[] = products.map((p) => {
    const tiers = priceByProduct.get(p.id) ?? [];
    const { cents: listUnitCents, qty: listTierQty } = pickListTier(tiers);
    const variants = (p.product_variants ?? [])
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    const imgs = parseBaseImages(p.base_images);
    const basePrimary =
      imgs.find((i) => i.is_primary)?.url ?? imgs[0]?.url ?? null;

    const colorVariants = variants.filter((v) => v.variant_type === "color");
    const colorWithImg = colorVariants.filter((v) => v.image_url);
    const primaryImageUrl =
      colorWithImg[0]?.image_url ?? basePrimary ?? colorVariants[0]?.image_url;
    const hoverCandidate =
      colorWithImg[1]?.image_url ??
      (imgs[1]?.url && imgs[1].url !== primaryImageUrl ? imgs[1].url : null);
    const hoverImageUrl =
      hoverCandidate && hoverCandidate !== primaryImageUrl
        ? hoverCandidate
        : null;

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      short_description: p.short_description,
      description: p.description,
      supplier_sku: p.supplier_sku,
      moq: p.moq,
      is_featured: p.is_featured,
      created_at: p.created_at,
      supplier_code: p.supplier_code,
      category: p.category_id ? catById.get(p.category_id) ?? null : null,
      variants,
      listUnitCents: listUnitCents,
      listTierQty: listTierQty,
      filterUnitCents: listUnitCents,
      techniqueNames: [...(techByProduct.get(p.id) ?? [])].sort((a, b) =>
        a.localeCompare(b, "de"),
      ),
      primaryImageUrl,
      hoverImageUrl:
        hoverImageUrl && hoverImageUrl !== primaryImageUrl
          ? hoverImageUrl
          : null,
    };
  });

  return { products: merged };
}
