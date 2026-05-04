/**
 * Pricing engine – pure, testable functions.
 * Full implementation lives in SCHRITT 6 (see pricing.test.ts).
 * The stubs here exist so the rest of the app can import stable types.
 */

export type PriceTier = {
  min_quantity: number;
  purchase_price_cents: number;
  selling_price_cents: number;
  is_manual_override?: boolean;
};

export type PrintPriceTier = {
  min_quantity: number;
  setup_cost_cents: number;
  purchase_price_per_unit_cents: number;
  selling_price_per_unit_cents: number;
  is_manual_override?: boolean;
};

export type PriceBreakdown = {
  quantity: number;
  product_unit_net_cents: number;
  product_total_net_cents: number;
  print_setup_net_cents: number;
  print_unit_net_cents: number;
  print_total_net_cents: number;
  subtotal_net_cents: number;
  vat_cents: number;
  total_gross_cents: number;
  tier_used?: PriceTier;
  print_tier_used?: PrintPriceTier;
};

export * from "./calculate";
