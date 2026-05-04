import { NextResponse } from "next/server";
import {
  calculateLineTotal,
  type PriceTier,
  type PrintPriceTier,
} from "@/lib/pricing";
import {
  priceCalculationInputSchema,
  priceCalculationResponseSchema,
} from "@/lib/pricing/price-calculation-schema";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const DEFAULT_MARGIN_PERCENT = 70;
const VAT_PERCENT = 19;

type ProductRow = {
  id: string;
  moq: number;
  margin_percent_override: number | null;
  category: { margin_percent: number | null } | null;
};

export async function POST(request: Request) {
  const inputRaw = await request.json();
  const parsed = priceCalculationInputSchema.safeParse(inputRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Eingabedaten.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: product, error: productError }, { data: productTiers, error: tierError }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, moq, margin_percent_override, category:categories(margin_percent)",
        )
        .eq("id", input.productId)
        .eq("status", "active")
        .maybeSingle<ProductRow>(),
      supabase
        .from("product_price_tiers")
        .select(
          "min_quantity, purchase_price_cents, selling_price_cents, is_manual_override",
        )
        .eq("product_id", input.productId)
        .order("min_quantity", { ascending: true }),
    ]);

  if (productError || !product) {
    return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }
  if (tierError || !productTiers?.length) {
    return NextResponse.json(
      { error: "Keine Preisstaffeln für Produkt gefunden." },
      { status: 422 },
    );
  }

  if (input.variantId) {
    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .select("id")
      .eq("id", input.variantId)
      .eq("product_id", input.productId)
      .eq("is_active", true)
      .maybeSingle();
    if (variantError || !variant) {
      return NextResponse.json(
        { error: "Variante gehört nicht zum Produkt." },
        { status: 422 },
      );
    }
  }

  let printTiers: PrintPriceTier[] | undefined;
  let maxColors: string | null = null;

  if (input.printTechniqueId) {
    const [{ data: technique, error: techniqueError }, { data: tiers, error: printTierError }] =
      await Promise.all([
        supabase
          .from("print_techniques")
          .select("id, max_colors, print_areas!inner(product_id)")
          .eq("id", input.printTechniqueId)
          .eq("print_areas.product_id", input.productId)
          .maybeSingle(),
        supabase
          .from("print_price_tiers")
          .select(
            "min_quantity, setup_cost_cents, purchase_price_per_unit_cents, selling_price_per_unit_cents, is_manual_override",
          )
          .eq("print_technique_id", input.printTechniqueId)
          .order("min_quantity", { ascending: true }),
      ]);

    if (techniqueError || !technique) {
      return NextResponse.json(
        { error: "Drucktechnik ungültig für dieses Produkt." },
        { status: 422 },
      );
    }
    if (printTierError) {
      return NextResponse.json(
        { error: "Druckpreis konnte nicht geladen werden." },
        { status: 422 },
      );
    }

    maxColors = (technique as { max_colors: string | null }).max_colors;
    const requestedColors = input.printColors ?? 1;
    if (maxColors && /^\d+$/.test(maxColors) && requestedColors > Number(maxColors)) {
      return NextResponse.json(
        { error: `Maximal ${maxColors} Farben für diese Technik.` },
        { status: 422 },
      );
    }

    const colorFactor =
      maxColors && /^\d+$/.test(maxColors) ? Math.max(1, requestedColors) : 1;

    printTiers = (tiers ?? []).map((tier) => ({
      ...tier,
      purchase_price_per_unit_cents:
        tier.purchase_price_per_unit_cents * colorFactor,
      selling_price_per_unit_cents:
        tier.selling_price_per_unit_cents * colorFactor,
    }));
  }

  const marginPercent =
    product.margin_percent_override ??
    product.category?.margin_percent ??
    DEFAULT_MARGIN_PERCENT;

  const breakdown = calculateLineTotal({
    productTiers: productTiers as PriceTier[],
    printTiers,
    quantity: input.quantity,
    productMarginPercent: marginPercent,
    printMarginPercent: marginPercent,
    vatPercent: VAT_PERCENT,
  });

  const response = {
    quantity: input.quantity,
    moq: product.moq,
    isMoqSatisfied: input.quantity >= product.moq,
    productUnitNetCents: breakdown.product_unit_net_cents,
    productTotalNetCents: breakdown.product_total_net_cents,
    printSetupNetCents: breakdown.print_setup_net_cents,
    printUnitNetCents: breakdown.print_unit_net_cents,
    printTotalNetCents: breakdown.print_total_net_cents,
    subtotalNetCents: breakdown.subtotal_net_cents,
    vatCents: breakdown.vat_cents,
    totalGrossCents: breakdown.total_gross_cents,
    activeTierMinQuantity: breakdown.tier_used?.min_quantity ?? productTiers[0].min_quantity,
    activePrintTierMinQuantity: breakdown.print_tier_used?.min_quantity ?? null,
    tiers: (productTiers as PriceTier[]).map((tier) => ({
      minQuantity: tier.min_quantity,
      unitNetCents:
        tier.is_manual_override && tier.selling_price_cents > 0
          ? tier.selling_price_cents
          : Math.round(tier.purchase_price_cents * (1 + marginPercent / 100)),
      active: tier.min_quantity === (breakdown.tier_used?.min_quantity ?? tier.min_quantity),
    })),
  };

  const safe = priceCalculationResponseSchema.parse(response);
  return NextResponse.json(safe);
}
