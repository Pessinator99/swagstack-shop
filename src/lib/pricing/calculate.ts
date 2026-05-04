import type { PriceBreakdown, PriceTier, PrintPriceTier } from "./index";

/**
 * NOTE: This is the SCHRITT 1 placeholder.
 * Full logic + Vitest edge cases land in SCHRITT 6.
 * Behavior implemented here (already usable):
 *  - Tier selection by "next higher threshold" (never interpolated).
 *  - Selling price from tier, or computed via margin if no selling price stored.
 *  - VAT applied on subtotal.
 */

function pickTier<T extends { min_quantity: number }>(
  tiers: T[] | undefined | null,
  quantity: number,
): T | undefined {
  if (!tiers?.length) return undefined;
  const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  // Largest min_quantity <= quantity. If qty < first tier, use the first tier.
  let picked: T | undefined;
  for (const t of sorted) {
    if (t.min_quantity <= quantity) picked = t;
    else break;
  }
  return picked ?? sorted[0];
}

function applyMargin(purchaseCents: number, marginPercent: number) {
  return Math.round(purchaseCents * (1 + marginPercent / 100));
}

export function calculateProductPrice(
  tiers: PriceTier[],
  quantity: number,
  marginPercent: number,
) {
  const tier = pickTier(tiers, quantity);
  if (!tier) {
    return { purchase_cents: 0, selling_cents: 0, tier_used: undefined };
  }
  const selling =
    tier.is_manual_override && tier.selling_price_cents > 0
      ? tier.selling_price_cents
      : applyMargin(tier.purchase_price_cents, marginPercent);
  return {
    purchase_cents: tier.purchase_price_cents,
    selling_cents: selling,
    tier_used: tier,
  };
}

export function calculatePrintPrice(
  tiers: PrintPriceTier[] | undefined,
  quantity: number,
  marginPercent: number,
) {
  const tier = pickTier(tiers, quantity);
  if (!tier) {
    return {
      setup_cents: 0,
      per_unit_cents: 0,
      tier_used: undefined,
    };
  }
  const perUnit =
    tier.is_manual_override && tier.selling_price_per_unit_cents > 0
      ? tier.selling_price_per_unit_cents
      : applyMargin(tier.purchase_price_per_unit_cents, marginPercent);
  return {
    setup_cents: tier.setup_cost_cents,
    per_unit_cents: perUnit,
    tier_used: tier,
  };
}

export function calculateLineTotal(args: {
  productTiers: PriceTier[];
  printTiers?: PrintPriceTier[];
  quantity: number;
  productMarginPercent: number;
  printMarginPercent?: number;
  vatPercent: number;
}): PriceBreakdown {
  const {
    productTiers,
    printTiers,
    quantity,
    productMarginPercent,
    printMarginPercent = productMarginPercent,
    vatPercent,
  } = args;

  const prod = calculateProductPrice(productTiers, quantity, productMarginPercent);
  const print = calculatePrintPrice(printTiers, quantity, printMarginPercent);

  const product_total_net_cents = prod.selling_cents * quantity;
  const print_total_net_cents =
    print.setup_cents + print.per_unit_cents * quantity;
  const subtotal_net_cents = product_total_net_cents + print_total_net_cents;
  const vat_cents = Math.round((subtotal_net_cents * vatPercent) / 100);

  return {
    quantity,
    product_unit_net_cents: prod.selling_cents,
    product_total_net_cents,
    print_setup_net_cents: print.setup_cents,
    print_unit_net_cents: print.per_unit_cents,
    print_total_net_cents,
    subtotal_net_cents,
    vat_cents,
    total_gross_cents: subtotal_net_cents + vat_cents,
    tier_used: prod.tier_used,
    print_tier_used: print.tier_used,
  };
}

export function formatCents(cents: number, locale = "de-DE", currency = "EUR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
