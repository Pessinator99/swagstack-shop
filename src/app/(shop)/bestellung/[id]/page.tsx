import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  OrderConfirmationClient,
  type OrderConfirmationData,
  type OrderConfirmationItem,
} from "@/components/shop/order-confirmation-client";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BestellungPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/bestellung/${id}`)}`);
  }

  const { data: order, error: orderError } = await supabase
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
      order_items (
        id,
        quantity,
        unit_price_cents,
        print_setup_cents,
        print_unit_price_cents,
        line_total_cents,
        product_snapshot
      )
    `,
    )
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (orderError || !order) {
    notFound();
  }

  const { data: customerRow } = await supabase.from("customers").select("email").eq("id", user.id).maybeSingle();

  const customerEmail =
    (customerRow?.email as string | undefined) ?? user.email ?? "Ihre hinterlegte E-Mail-Adresse";

  const rawItems = (order as { order_items?: OrderConfirmationItem[] | null }).order_items;
  const orderItems: OrderConfirmationItem[] = Array.isArray(rawItems) ? rawItems : [];

  const payload: OrderConfirmationData = {
    id: order.id as string,
    order_number: (order.order_number as string | null) ?? null,
    status: order.status as string,
    subtotal_cents: order.subtotal_cents as number,
    vat_cents: order.vat_cents as number,
    shipping_cents: order.shipping_cents as number,
    total_cents: order.total_cents as number,
    billing_address: (order.billing_address as Record<string, unknown> | null) ?? null,
    shipping_address: (order.shipping_address as Record<string, unknown> | null) ?? null,
    order_items: orderItems.map((row) => ({
      ...row,
      product_snapshot:
        row.product_snapshot && typeof row.product_snapshot === "object" && !Array.isArray(row.product_snapshot)
          ? (row.product_snapshot as Record<string, unknown>)
          : null,
    })),
  };

  return (
    <OrderConfirmationClient order={payload} customerEmail={customerEmail} sessionId={sessionId ?? null} />
  );
}
