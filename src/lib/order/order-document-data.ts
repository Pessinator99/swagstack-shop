import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductSnapshot = {
  productName?: string;
  productSlug?: string;
  variant?: string | null;
  printTechnique?: string | null;
  printArea?: string | null;
  imageUrl?: string | null;
};

export type OrderItemRow = {
  id: string;
  quantity: number;
  unit_price_cents: number;
  print_setup_cents: number;
  print_unit_price_cents: number;
  line_total_cents: number;
  product_snapshot: ProductSnapshot | null;
};

export type OrderDocumentData = {
  order: {
    id: string;
    order_number: string | null;
    status: string;
    subtotal_cents: number;
    vat_cents: number;
    shipping_cents: number;
    total_cents: number;
    billing_address: Record<string, unknown> | null;
    shipping_address: Record<string, unknown> | null;
    paid_at: string | null;
    customer_id: string;
  };
  items: OrderItemRow[];
  customer: { id: string; email: string; contact_person: string | null };
};

function parseSnapshot(raw: unknown): ProductSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as ProductSnapshot;
}

export async function loadOrderDocumentData(
  client: SupabaseClient,
  orderId: string,
): Promise<OrderDocumentData | null> {
  const { data: order, error: oErr } = await client
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      subtotal_cents,
      vat_cents,
      shipping_cents,
      total_cents,
      billing_address,
      shipping_address,
      paid_at,
      customer_id
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (oErr || !order) return null;

  const { data: items, error: iErr } = await client
    .from("order_items")
    .select(
      "id, quantity, unit_price_cents, print_setup_cents, print_unit_price_cents, line_total_cents, product_snapshot",
    )
    .eq("order_id", orderId);

  if (iErr) return null;

  const { data: customer, error: cErr } = await client
    .from("customers")
    .select("id, email, contact_person")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (cErr || !customer) return null;

  const rows: OrderItemRow[] = (items ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    quantity: Number(row.quantity),
    unit_price_cents: Number(row.unit_price_cents),
    print_setup_cents: Number(row.print_setup_cents),
    print_unit_price_cents: Number(row.print_unit_price_cents),
    line_total_cents: Number(row.line_total_cents),
    product_snapshot: parseSnapshot(row.product_snapshot),
  }));

  return {
    order: {
      id: order.id as string,
      order_number: (order.order_number as string | null) ?? null,
      status: order.status as string,
      subtotal_cents: Number(order.subtotal_cents),
      vat_cents: Number(order.vat_cents),
      shipping_cents: Number(order.shipping_cents),
      total_cents: Number(order.total_cents),
      billing_address: (order.billing_address as Record<string, unknown> | null) ?? null,
      shipping_address: (order.shipping_address as Record<string, unknown> | null) ?? null,
      paid_at: (order.paid_at as string | null) ?? null,
      customer_id: order.customer_id as string,
    },
    items: rows,
    customer: {
      id: customer.id as string,
      email: String(customer.email),
      contact_person: (customer.contact_person as string | null) ?? null,
    },
  };
}

export function addressesDiffer(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null,
): boolean {
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

export function billingContactName(
  billing: Record<string, unknown> | null,
  fallback: string | null,
): string {
  const fromBilling = billing?.contactPerson ?? billing?.contact_person;
  if (typeof fromBilling === "string" && fromBilling.trim()) return fromBilling.trim();
  if (fallback?.trim()) return fallback.trim();
  return "Kundin / Kunde";
}

export function vatPercentLabel(subtotalCents: number, vatCents: number): string {
  if (subtotalCents <= 0) return "19";
  const p = Math.round((vatCents / subtotalCents) * 100);
  if (!Number.isFinite(p) || p <= 0) return "19";
  return String(p);
}
