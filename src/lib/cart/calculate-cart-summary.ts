import {
  calculateLineTotal,
  type PriceTier,
  type PrintPriceTier,
} from "@/lib/pricing";

const DEFAULT_MARGIN_PERCENT = 70;
const DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 25_000;
const DEFAULT_SHIPPING_CENTS_NET = 990;
const DEFAULT_VAT_RATE_PERCENT = 19;

type SupabaseLike = {
  from: (table: string) => {
    select: (query: string) => any;
  };
};

function pickJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseSettingNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value && "value" in value) {
    const nested = (value as { value: unknown }).value;
    if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  }
  return fallback;
}

export type ComputedCartItem = {
  id: string;
  quantity: number;
  productId: string;
  productName: string;
  productSlug: string;
  productMoq: number;
  variantLabel: string | null;
  printTechniqueName: string | null;
  printAreaName: string | null;
  printColors: number | null;
  imageUrl: string | null;
  productUnitNetCents: number;
  printSetupNetCents: number;
  printUnitNetCents: number;
  lineSubtotalNetCents: number;
  lineVatCents: number;
  lineTotalGrossCents: number;
};

export type ComputedCartSummary = {
  itemCount: number;
  vatRatePercent: number;
  freeShippingThresholdCents: number;
  shippingNetCents: number;
  freeShippingRemainingCents: number;
  subtotalNetCents: number;
  vatAmountCents: number;
  totalGrossCents: number;
  items: ComputedCartItem[];
};

export async function calculateCartSummaryForCustomer(args: {
  authSupabase: SupabaseLike;
  serviceSupabase: SupabaseLike;
  customerId: string;
}): Promise<{ summary?: ComputedCartSummary; error?: string; status?: number }> {
  const { authSupabase, serviceSupabase, customerId } = args;

  const { data: cartItems, error: cartError } = await authSupabase
    .from("cart_items")
    .select(
      `
      id, product_id, variant_id, print_technique_id, print_colors, quantity, added_at,
      product:products(id, slug, name, moq, short_description, category_id, margin_percent_override, base_images),
      variant:product_variants(id, variant_value),
      technique:print_techniques(
        id, technique_name, max_colors,
        print_area:print_areas(name)
      )
    `,
    )
    .eq("customer_id", customerId)
    .order("added_at", { ascending: false });

  if (cartError) {
    return { error: "Warenkorb konnte nicht geladen werden.", status: 500 };
  }

  const settingsRes = await authSupabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "free_shipping_threshold_cents",
      "default_shipping_cents_net",
      "vat_rate_percent",
    ]);

  if (settingsRes.error) {
    return { error: "Settings konnten nicht geladen werden.", status: 500 };
  }

  const settingsMap = new Map((settingsRes.data ?? []).map((row: any) => [row.key, row.value]));
  const freeShippingThresholdCents = parseSettingNumber(
    settingsMap.get("free_shipping_threshold_cents"),
    DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  );
  const defaultShippingCentsNet = parseSettingNumber(
    settingsMap.get("default_shipping_cents_net"),
    DEFAULT_SHIPPING_CENTS_NET,
  );
  const vatRatePercent = parseSettingNumber(
    settingsMap.get("vat_rate_percent"),
    DEFAULT_VAT_RATE_PERCENT,
  );

  const productIds = [...new Set((cartItems ?? []).map((item: any) => item.product_id))];
  const techniqueIds = [
    ...new Set(
      (cartItems ?? [])
        .map((item: any) => item.print_technique_id)
        .filter(Boolean),
    ),
  ];
  const categoryIds = [
    ...new Set(
      (cartItems ?? [])
        .map((item: any) => pickJoined(item.product)?.category_id ?? null)
        .filter(Boolean),
    ),
  ] as string[];

  const [productTierRes, printTierRes, categoriesRes] = await Promise.all([
    productIds.length
      ? serviceSupabase
          .from("product_price_tiers")
          .select(
            "product_id, min_quantity, purchase_price_cents, selling_price_cents, is_manual_override",
          )
          .in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
    techniqueIds.length
      ? serviceSupabase
          .from("print_price_tiers")
          .select(
            "print_technique_id, min_quantity, setup_cost_cents, purchase_price_per_unit_cents, selling_price_per_unit_cents, is_manual_override",
          )
          .in("print_technique_id", techniqueIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? serviceSupabase.from("categories").select("id, margin_percent").in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productTierRes.error || printTierRes.error || categoriesRes.error) {
    return { error: "Preisdaten konnten nicht geladen werden.", status: 500 };
  }

  const categoryMarginById = new Map(
    (categoriesRes.data ?? []).map((row: any) => [row.id, row.margin_percent]),
  );

  const productTiersByProduct = new Map<string, PriceTier[]>();
  for (const row of productTierRes.data ?? []) {
    const list = productTiersByProduct.get((row as any).product_id) ?? [];
    list.push(row as PriceTier);
    productTiersByProduct.set((row as any).product_id, list);
  }

  const printTiersByTechnique = new Map<string, PrintPriceTier[]>();
  for (const row of printTierRes.data ?? []) {
    const list = printTiersByTechnique.get((row as any).print_technique_id) ?? [];
    list.push(row as PrintPriceTier);
    printTiersByTechnique.set((row as any).print_technique_id, list);
  }

  const items: ComputedCartItem[] = (cartItems ?? []).map((item: any) => {
    const product = pickJoined(item.product);
    const variant = pickJoined(item.variant);
    const technique = pickJoined(item.technique);
    const printArea = pickJoined(technique?.print_area);

    const productTiers = (productTiersByProduct.get(item.product_id) ?? []).sort(
      (a, b) => a.min_quantity - b.min_quantity,
    );
    const printTiersRaw = item.print_technique_id
      ? (printTiersByTechnique.get(item.print_technique_id) ?? []).sort(
          (a, b) => a.min_quantity - b.min_quantity,
        )
      : [];

    const colors = item.print_colors ?? 1;
    const maxColors = technique?.max_colors;
    const colorFactor =
      maxColors && /^\d+$/.test(maxColors)
        ? Math.max(1, Math.min(colors, Number(maxColors)))
        : 1;

    const printTiers = printTiersRaw.map((tier) => ({
      ...tier,
      purchase_price_per_unit_cents: tier.purchase_price_per_unit_cents * colorFactor,
      selling_price_per_unit_cents: tier.selling_price_per_unit_cents * colorFactor,
    }));

    const marginPercent =
      product?.margin_percent_override ??
      (product?.category_id ? categoryMarginById.get(product.category_id) : null) ??
      DEFAULT_MARGIN_PERCENT;

    const breakdown = calculateLineTotal({
      productTiers,
      printTiers: printTiers.length ? printTiers : undefined,
      quantity: item.quantity,
      productMarginPercent: marginPercent,
      printMarginPercent: marginPercent,
      vatPercent: vatRatePercent,
    });

    const primaryImageUrl =
      Array.isArray(product?.base_images) && product.base_images.length
        ? (product.base_images.find(
            (img: unknown) =>
              typeof img === "object" &&
              img != null &&
              (img as { is_primary?: boolean }).is_primary,
          ) as { url?: string } | undefined)?.url ??
          (product.base_images[0] as { url?: string })?.url ??
          null
        : null;

    return {
      id: item.id,
      quantity: item.quantity,
      productId: item.product_id,
      productName: product?.name ?? "Produkt",
      productSlug: product?.slug ?? "",
      productMoq: product?.moq ?? 1,
      variantLabel: variant?.variant_value ?? null,
      printTechniqueName: technique?.technique_name ?? null,
      printAreaName: printArea?.name ?? null,
      printColors: item.print_colors ?? null,
      imageUrl: primaryImageUrl,
      productUnitNetCents: breakdown.product_unit_net_cents,
      printSetupNetCents: breakdown.print_setup_net_cents,
      printUnitNetCents: breakdown.print_unit_net_cents,
      lineSubtotalNetCents: breakdown.subtotal_net_cents,
      lineVatCents: breakdown.vat_cents,
      lineTotalGrossCents: breakdown.total_gross_cents,
    };
  });

  const subtotalNetCents = items.reduce((sum, item) => sum + item.lineSubtotalNetCents, 0);
  const shippingNetCents =
    subtotalNetCents >= freeShippingThresholdCents || subtotalNetCents === 0
      ? 0
      : defaultShippingCentsNet;
  const freeShippingRemainingCents =
    subtotalNetCents >= freeShippingThresholdCents
      ? 0
      : freeShippingThresholdCents - subtotalNetCents;
  const vatAmountCents = Math.round(
    ((subtotalNetCents + shippingNetCents) * vatRatePercent) / 100,
  );
  const totalGrossCents = subtotalNetCents + shippingNetCents + vatAmountCents;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    summary: {
      itemCount,
      vatRatePercent,
      freeShippingThresholdCents,
      shippingNetCents,
      freeShippingRemainingCents,
      subtotalNetCents,
      vatAmountCents,
      totalGrossCents,
      items,
    },
  };
}
