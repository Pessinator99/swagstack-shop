import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { calculateCartSummaryForCustomer } from "@/lib/cart/calculate-cart-summary";
import { getStripeServerClient } from "@/lib/stripe/client";

const addressSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().min(2),
  street: z.string().min(2),
  zip: z.string().min(3),
  city: z.string().min(2),
  country: z.string().min(2),
  vatId: z.string().optional(),
  phone: z.string().min(5),
});

const createCheckoutSchema = z.object({
  customerId: z.string().uuid(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  saveForFuture: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const parsed = createCheckoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Checkout-Daten.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.customerId !== user.id) {
    return NextResponse.json({ error: "customer_id passt nicht zu auth.uid()." }, { status: 403 });
  }

  const computed = await calculateCartSummaryForCustomer({
    authSupabase: supabase as any,
    serviceSupabase: createSupabaseServiceRoleClient() as any,
    customerId: user.id,
  });
  if (!computed.summary) {
    return NextResponse.json(
      { error: computed.error ?? "Warenkorb konnte nicht geladen werden." },
      { status: computed.status ?? 500 },
    );
  }
  if (!computed.summary.items.length) {
    return NextResponse.json({ error: "Warenkorb ist leer." }, { status: 422 });
  }

  const service = createSupabaseServiceRoleClient();

  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      customer_id: user.id,
      status: "pending",
      subtotal_cents: computed.summary.subtotalNetCents,
      shipping_cents: computed.summary.shippingNetCents,
      vat_cents: computed.summary.vatAmountCents,
      total_cents: computed.summary.totalGrossCents,
      billing_address: input.billingAddress,
      shipping_address: input.shippingAddress,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Bestellung konnte nicht erstellt werden." }, { status: 500 });
  }

  const { data: cartRows, error: cartRowsError } = await service
    .from("cart_items")
    .select(
      `
      id, product_id, variant_id, print_technique_id, quantity,
      product:products(id, slug, name),
      variant:product_variants(id, variant_value),
      technique:print_techniques(id, technique_name, print_area:print_areas(name))
    `,
    )
    .eq("customer_id", user.id);
  if (cartRowsError) {
    return NextResponse.json({ error: "Warenkorbpositionen konnten nicht geladen werden." }, { status: 500 });
  }

  const summaryById = new Map(computed.summary.items.map((item) => [item.id, item]));

  const orderItemsPayload = (cartRows ?? []).map((row: any) => {
    const summaryItem = summaryById.get(row.id);
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const variant = Array.isArray(row.variant) ? row.variant[0] : row.variant;
    const technique = Array.isArray(row.technique) ? row.technique[0] : row.technique;
    const printArea = technique?.print_area
      ? Array.isArray(technique.print_area)
        ? technique.print_area[0]
        : technique.print_area
      : null;

    return {
      order_id: order.id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      print_technique_id: row.print_technique_id,
      quantity: row.quantity,
      unit_price_cents: summaryItem?.productUnitNetCents ?? 0,
      print_setup_cents: summaryItem?.printSetupNetCents ?? 0,
      print_unit_price_cents: summaryItem?.printUnitNetCents ?? 0,
      line_total_cents: summaryItem?.lineSubtotalNetCents ?? 0,
      product_snapshot: {
        productName: product?.name ?? "Produkt",
        productSlug: product?.slug ?? "",
        variant: variant?.variant_value ?? null,
        printTechnique: technique?.technique_name ?? null,
        printArea: printArea?.name ?? null,
        imageUrl: summaryItem?.imageUrl ?? null,
      },
    };
  });

  const { error: orderItemsError } = await service.from("order_items").insert(orderItemsPayload);
  if (orderItemsError) {
    return NextResponse.json({ error: "Bestellpositionen konnten nicht erstellt werden." }, { status: 500 });
  }

  if (input.saveForFuture) {
    await service
      .from("customers")
      .update({
        company_name: input.billingAddress.companyName,
        contact_person: input.billingAddress.contactPerson,
        vat_id: input.billingAddress.vatId ?? null,
        phone: input.billingAddress.phone,
        billing_address: input.billingAddress,
        shipping_address: input.shippingAddress,
      })
      .eq("id", user.id);
  }

  const stripe = getStripeServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const stripeLineItems = computed.summary.items.map((item) => {
    const variantLabel = item.variantLabel ? ` (${item.variantLabel})` : "";
    const printLabel = item.printTechniqueName
      ? ` mit ${item.printTechniqueName}${item.printAreaName ? `, ${item.printAreaName}` : ""}`
      : "";
    return {
      price_data: {
        currency: "eur",
        product_data: {
          name: `${item.productName}${variantLabel}${printLabel}`,
        },
        unit_amount: Math.round(item.lineTotalGrossCents / Math.max(1, item.quantity)),
      },
      quantity: item.quantity,
    };
  });

  if (computed.summary.shippingNetCents > 0) {
    const shippingGross = computed.summary.shippingNetCents + Math.round(computed.summary.shippingNetCents * (computed.summary.vatRatePercent / 100));
    stripeLineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "Versand",
        },
        unit_amount: shippingGross,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
    customer_email: user.email ?? undefined,
    success_url: `${siteUrl}/bestellung/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/warenkorb?canceled=1`,
    metadata: { order_id: order.id },
    payment_method_types: ["card", "sepa_debit", "klarna"],
    locale: "de",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["DE", "AT", "CH"],
    },
  });

  await service
    .from("orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", order.id);

  return NextResponse.json({ url: session.url, orderId: order.id, sessionId: session.id });
}
