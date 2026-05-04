import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ShopProductDetailClient } from "@/components/shop/shop-product-detail-client";
import { parsePrintAreaPixelPayload } from "@/lib/colormatch/pixel-coordinates";
import type { ProductImage } from "@/types/database";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
};

function parseBaseImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is ProductImage =>
        typeof x === "object" &&
        x != null &&
        "url" in x &&
        typeof (x as { url: unknown }).url === "string",
    )
    .map((x) => x.url);
}

function parseVariantAdditionalUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (
      typeof x === "object" &&
      x != null &&
      "url" in x &&
      typeof (x as { url: unknown }).url === "string"
    ) {
      out.push((x as { url: string }).url);
    }
  }
  return out;
}

export default async function ShopProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { color: colorQuery } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products")
    .select(
      `
      id, slug, name, description, short_description, specifications, moq, base_images,
      category:categories(slug, name),
      product_variants(id, variant_type, variant_value, variant_code, image_url, color_hex, additional_images, is_active, sort_order),
      print_areas(
        id, name, mockup_image_url, sort_order, is_default, pixel_coordinates,
        print_techniques(id, technique_name, max_width_mm, max_height_mm, max_colors, is_default)
      )
    `,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!product) notFound();

  const { data: tiers } = await supabase
    .from("product_prices_public")
    .select("min_quantity, selling_price_cents")
    .eq("product_id", product.id)
    .order("min_quantity", { ascending: true });

  const { data: deliverySetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "delivery_info")
    .maybeSingle();

  const detailData = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    short_description: product.short_description,
    specifications: (product.specifications ?? {}) as Record<string, unknown>,
    moq: product.moq,
    category: Array.isArray(product.category) && product.category[0]
      ? { slug: product.category[0].slug, name: product.category[0].name }
      : null,
    baseImages: parseBaseImages(product.base_images),
    variants: (product.product_variants ?? [])
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        variant_type: v.variant_type,
        variant_value: v.variant_value,
        variant_code: (v as { variant_code?: string | null }).variant_code ?? null,
        image_url: v.image_url,
        color_hex: v.color_hex,
        sort_order: v.sort_order,
        additionalImageUrls: parseVariantAdditionalUrls(
          (v as { additional_images?: unknown }).additional_images,
        ),
      })),
    priceTiers: tiers ?? [],
    printAreas: (product.print_areas ?? [])
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.sort_order - b.sort_order;
      })
      .map((area) => {
        const { overlayRect, mappedImageUrl } = parsePrintAreaPixelPayload(
          (area as { pixel_coordinates?: unknown }).pixel_coordinates,
        );
        return {
          id: area.id,
          name: area.name,
          mockup_image_url: area.mockup_image_url,
          overlayRect,
          mappedImageUrl,
          techniques: (area.print_techniques ?? [])
            .sort((a, b) => (a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1))
            .map((tech) => ({
              id: tech.id,
              technique_name: tech.technique_name,
              max_width_mm: tech.max_width_mm,
              max_height_mm: tech.max_height_mm,
              max_colors: tech.max_colors,
            })),
        };
      }),
  };

  const deliveryText =
    typeof deliverySetting?.value === "object" &&
    deliverySetting.value &&
    "text" in deliverySetting.value
      ? String((deliverySetting.value as { text: unknown }).text)
      : "Lieferzeit standardmäßig 7–12 Werktage nach Druckfreigabe. Express auf Anfrage.";

  return (
    <ShopProductDetailClient
      product={detailData}
      deliveryText={deliveryText}
      isLoggedIn={Boolean(user)}
      initialVariantCode={colorQuery?.trim() || null}
    />
  );
}
