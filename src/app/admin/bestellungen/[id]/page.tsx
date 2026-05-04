import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { singleEmbedded } from "@/lib/supabase/relation";
import { addressesDiffer } from "@/lib/order/order-document-data";
import { formatEurCents } from "@/lib/pdf/format-eur";
import { formatOrderDateTime } from "@/lib/admin/format-order-datetime";
import { stripeCheckoutSessionDashboardUrl, stripePaymentIntentDashboardUrl } from "@/lib/stripe/dashboard-url";
import { StatusBadge, ORDER_STATUS_LABELS } from "@/components/admin/status-badge";
import { OrderActions } from "@/components/admin/order-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderStatus } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

function formatAddressLines(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const company = String(raw.companyName ?? raw.company_name ?? "");
  const contact = String(raw.contactPerson ?? raw.contact_person ?? "");
  const street = String(raw.street ?? "");
  const zip = String(raw.zip ?? "");
  const city = String(raw.city ?? "");
  const country = String(raw.country ?? "");
  const phone = String(raw.phone ?? "");
  return [company, contact, street, `${zip} ${city}`.trim(), country, phone].filter((l) => l.length > 0);
}

function snapshotParts(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return { title: "Position", subtitle: null as string | null, image: null as string | null };
  }
  const productName = typeof snapshot.productName === "string" ? snapshot.productName : "Produkt";
  const variant = typeof snapshot.variant === "string" ? snapshot.variant : null;
  const technique = typeof snapshot.printTechnique === "string" ? snapshot.printTechnique : null;
  const area = typeof snapshot.printArea === "string" ? snapshot.printArea : null;
  const imageUrl = typeof snapshot.imageUrl === "string" ? snapshot.imageUrl : null;
  const veredelung = [technique, area].filter(Boolean).join(", ") || null;
  const subtitle = [variant ? `Variante: ${variant}` : null, veredelung ? `Veredelung: ${veredelung}` : null]
    .filter(Boolean)
    .join(" · ");
  return { title: productName, subtitle: subtitle || null, image: imageUrl };
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: order, error } = await supabase
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
      created_at,
      shipped_at,
      stripe_payment_intent_id,
      stripe_checkout_session_id,
      customer_id,
      customer:customers(id, company_name, contact_person, email, phone),
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
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const status = order.status as OrderStatus;
  const customer = singleEmbedded(
    order.customer as
      | {
          id: string;
          company_name: string | null;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
        }
      | {
          id: string;
          company_name: string | null;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
        }[]
      | null,
  );

  const rawItems = order.order_items as Array<{
    id: string;
    quantity: number;
    unit_price_cents: number;
    print_setup_cents: number;
    print_unit_price_cents: number;
    line_total_cents: number;
    product_snapshot: unknown;
  }> | null;

  const items = Array.isArray(rawItems) ? rawItems : [];
  const billing = (order.billing_address as Record<string, unknown> | null) ?? null;
  const shipping = (order.shipping_address as Record<string, unknown> | null) ?? null;
  const separateShipping = addressesDiffer(billing, shipping);

  const pi = order.stripe_payment_intent_id as string | null;
  const sessionId = order.stripe_checkout_session_id as string | null;

  const events: { at: string; text: string }[] = [];
  events.push({ at: order.created_at as string, text: "Bestellung erstellt" });
  if (order.paid_at) {
    events.push({ at: order.paid_at as string, text: "Zahlung erhalten" });
  }
  if (order.shipped_at) {
    events.push({ at: order.shipped_at as string, text: "Versand erfasst" });
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const canPdf = ["paid", "in_production", "shipped", "delivered"].includes(status);

  return (
    <div className="p-6 lg:p-8">
      <Link href="/admin/bestellungen" className="text-sm text-muted-foreground hover:text-foreground">
        ← Bestellübersicht
      </Link>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bestellung {order.order_number ?? id.slice(0, 8)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={status} size="md" />
            <span className="text-sm text-muted-foreground">Erstellt {formatOrderDateTime(order.created_at as string)}</span>
          </div>
        </div>
        <OrderActions orderId={id} currentStatus={status} showInvoiceDownload={canPdf} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Positionen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((line) => {
                const snap =
                  line.product_snapshot && typeof line.product_snapshot === "object" && !Array.isArray(line.product_snapshot)
                    ? (line.product_snapshot as Record<string, unknown>)
                    : null;
                const { title, subtitle, image } = snapshotParts(snap);
                const unitNet = line.unit_price_cents + line.print_unit_price_cents;
                return (
                  <div key={line.id} className="flex gap-3 border-b pb-4 last:border-0 last:pb-0">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- snapshot URLs from varied hosts
                        <img src={image} alt="" className="size-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{title}</p>
                      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {line.quantity} × {formatEurCents(unitNet)} · Summe{" "}
                        <span className="font-mono text-foreground">{formatEurCents(line.line_total_cents)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zwischensumme</span>
                  <span className="font-mono">{formatEurCents(Number(order.subtotal_cents))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versand</span>
                  <span className="font-mono">{formatEurCents(Number(order.shipping_cents))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MwSt.</span>
                  <span className="font-mono">{formatEurCents(Number(order.vat_cents))}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total brutto</span>
                  <span className="font-mono">{formatEurCents(Number(order.total_cents))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stripe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment Intent</p>
                {pi ? (
                  <a
                    href={stripePaymentIntentDashboardUrl(pi)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {pi}
                  </a>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checkout Session</p>
                {sessionId ? (
                  <a
                    href={stripeCheckoutSessionDashboardUrl(sessionId)}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-mono text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {sessionId}
                  </a>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paid at</p>
                <p>{formatOrderDateTime((order.paid_at as string | null) ?? null)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kunde</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {customer ? (
                <>
                  <p>
                    <Link href={`/admin/kunden/${customer.id}`} className="font-medium text-primary hover:underline">
                      {customer.company_name ?? "Unbenannt"}
                    </Link>
                  </p>
                  <p>{customer.contact_person ?? "—"}</p>
                  <p className="text-muted-foreground">{customer.email ?? "—"}</p>
                  <p className="text-muted-foreground">{customer.phone ?? "—"}</p>
                  <p>
                    <span className="text-muted-foreground">Kundenhistorie ansehen</span>{" "}
                    <span className="text-xs text-muted-foreground">(bald)</span>
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Keine Kundendaten.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rechnungsadresse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {formatAddressLines(billing).length ? (
                formatAddressLines(billing).map((line, i) => <p key={`b-${i}`}>{line}</p>)
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          {separateShipping ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lieferadresse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {formatAddressLines(shipping).map((line, i) => (
                  <p key={`s-${i}`}>{line}</p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Aktivität</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="text-muted-foreground">{formatOrderDateTime(e.at)}</span> — {e.text}
              </li>
            ))}
            <li>
              <span className="font-medium">Aktueller Status:</span> {ORDER_STATUS_LABELS[status] ?? status}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
