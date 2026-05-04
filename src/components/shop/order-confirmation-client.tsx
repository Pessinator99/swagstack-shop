"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { CheckCircle2, Loader2, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/pricing";

export type OrderConfirmationItem = {
  id: string;
  quantity: number;
  unit_price_cents: number;
  print_setup_cents: number;
  print_unit_price_cents: number;
  line_total_cents: number;
  product_snapshot: Record<string, unknown> | null;
};

export type OrderConfirmationData = {
  id: string;
  order_number: string | null;
  status: string;
  subtotal_cents: number;
  vat_cents: number;
  shipping_cents: number;
  total_cents: number;
  billing_address: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
  order_items: OrderConfirmationItem[];
};

function snapshotLabel(snapshot: Record<string, unknown> | null) {
  if (!snapshot) return { title: "Position", subtitle: "" as string | null, image: null as string | null };
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

function formatAddressBlock(label: string, raw: Record<string, unknown> | null) {
  if (!raw) return null;
  const company = String(raw.companyName ?? raw.company_name ?? "");
  const contact = String(raw.contactPerson ?? raw.contact_person ?? "");
  const street = String(raw.street ?? "");
  const zip = String(raw.zip ?? "");
  const city = String(raw.city ?? "");
  const country = String(raw.country ?? "");
  const phone = String(raw.phone ?? "");
  const lines = [company, contact, street, `${zip} ${city}`.trim(), country, phone].filter(
    (l) => l.length > 0,
  );
  if (!lines.length) return null;
  return (
    <div className="rounded-[var(--radius)] border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-0.5 text-sm">
        {lines.map((line, i) => (
          <p key={`${label}-${i}`}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function addressesDiffer(
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

type Props = {
  order: OrderConfirmationData;
  customerEmail: string;
  sessionId: string | null;
};

export function OrderConfirmationClient({ order, customerEmail, sessionId }: Props) {
  const router = useRouter();
  const [pollExhausted, setPollExhausted] = useState(false);
  const pollAttempts = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiFired = useRef(false);

  const isPendingWithStripeReturn = order.status === "pending" && Boolean(sessionId);

  useEffect(() => {
    if (!isPendingWithStripeReturn) return;
    let cancelled = false;

    const poll = async () => {
      pollAttempts.current += 1;
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { status?: string };
        if (data.status === "paid") {
          router.refresh();
          return;
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      if (pollAttempts.current >= 10) {
        setPollExhausted(true);
        return;
      }
      pollTimer.current = setTimeout(poll, 1500);
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [isPendingWithStripeReturn, order.id, router]);

  const isPaidLike = ["paid", "in_production", "shipped", "delivered"].includes(order.status);

  useEffect(() => {
    if (order.status !== "paid") return;
    if (typeof window === "undefined") return;
    const key = `confetti-${order.id}`;
    if (sessionStorage.getItem(key)) return;
    if (confettiFired.current) return;
    confettiFired.current = true;
    sessionStorage.setItem(key, "1");
    void confetti({
      particleCount: 140,
      spread: 72,
      origin: { y: 0.62 },
      colors: ["#6366f1", "#22c55e", "#f97316", "#0ea5e9"],
    });
  }, [order.id, order.status]);

  if (order.status === "cancelled") {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
        <div className="text-center">
          <PackageX className="mx-auto size-16 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Bestellung nicht abgeschlossen</h1>
          <p className="mt-2 text-muted-foreground">
            Die Zahlung wurde nicht abgeschlossen oder die Sitzung ist abgelaufen. Dein Warenkorb bleibt
            unverändert, sofern du ihn nicht geleert hast.
          </p>
          <Button asChild className="mt-8" variant="accent">
            <Link href="/warenkorb">Zurück zum Warenkorb</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (order.status === "pending" && !sessionId) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
        <div className="text-center">
          <Loader2 className="mx-auto size-12 animate-spin text-brand-600" aria-hidden />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Bestellung ausstehend</h1>
          <p className="mt-2 text-muted-foreground">
            Diese Bestellung wartet noch auf die Zahlungsbestätigung. Bitte prüfe dein E-Mail-Postfach oder
            kontaktiere uns, falls etwas nicht stimmt.
          </p>
          <Button asChild variant="outline" className="mt-8">
            <Link href="/warenkorb">Zum Warenkorb</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (order.status === "pending" && sessionId) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-[var(--radius)] border bg-surface p-10 text-center shadow-[var(--shadow-raised)]">
          <Loader2 className="mx-auto size-12 animate-spin text-brand-600" aria-hidden />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Wir bestätigen deine Zahlung…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Das dauert in der Regel nur einen Moment. Bitte diese Seite nicht schließen.
          </p>
          {pollExhausted ? (
            <p className="mt-6 text-sm text-destructive">
              Die Bestätigung dauert ungewöhnlich lange. Bitte lade die Seite neu oder schaue unter{" "}
              <Link href="/konto/bestellungen" className="underline">
                Bestellungen
              </Link>
              .
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (!isPaidLike) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
        <div className="text-center">
          <PackageX className="mx-auto size-16 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Bestellung nicht abgeschlossen</h1>
          <p className="mt-2 text-muted-foreground">Diese Bestellung ist nicht als bezahlt markiert.</p>
          <Button asChild className="mt-8" variant="accent">
            <Link href="/warenkorb">Zurück zum Warenkorb</Link>
          </Button>
        </div>
      </main>
    );
  }

  const billing = order.billing_address;
  const shipping = order.shipping_address;
  const showShipping = addressesDiffer(billing, shipping);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <header className="text-center">
        <CheckCircle2 className="mx-auto size-16 text-brand-600" aria-hidden />
        <h1 className="mt-4 font-heading text-3xl font-semibold">
          {order.status === "paid"
            ? "Vielen Dank für Ihre Bestellung!"
            : "Ihre Bestellung ist bei uns eingegangen"}
        </h1>
        {order.order_number ? (
          <p className="mt-3 font-mono text-xl font-medium tracking-tight text-foreground">
            Bestellnummer {order.order_number}
          </p>
        ) : null}
        <p className="mt-4 text-muted-foreground">
          Wir haben Ihnen eine Bestätigung an <span className="font-medium text-foreground">{customerEmail}</span>{" "}
          gesendet.
        </p>
      </header>

      <section className="rounded-[var(--radius)] border bg-surface p-6 shadow-[var(--shadow-raised)]">
        <h2 className="text-lg font-semibold">Bestellpositionen</h2>
        <ul className="mt-4 divide-y">
          {order.order_items.map((row) => {
            const snap = row.product_snapshot;
            const { title, subtitle, image } = snapshotLabel(snap);
            return (
              <li key={row.id} className="flex gap-4 py-4 first:pt-0">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- snapshot URLs (Supabase etc.)
                    <img src={image} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
                  <p className="mt-1 text-sm text-muted-foreground">Menge: {row.quantity}</p>
                </div>
                <p className="shrink-0 font-mono text-sm">{formatCents(row.line_total_cents)}</p>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zwischensumme (netto)</span>
            <span className="font-mono">{formatCents(order.subtotal_cents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Versand (netto)</span>
            <span className="font-mono">
              {order.shipping_cents > 0 ? formatCents(order.shipping_cents) : "Kostenlos"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MwSt.</span>
            <span className="font-mono">{formatCents(order.vat_cents)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Gesamt (brutto)</span>
            <span className="font-mono">{formatCents(order.total_cents)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {formatAddressBlock("Rechnungsadresse", billing)}
        {showShipping ? formatAddressBlock("Lieferadresse", shipping) : null}
      </section>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {order.status === "paid" ? (
          <Button asChild variant="outline" className="min-h-11">
            <a href={`/api/orders/${order.id}/invoice.pdf`} download>
              Rechnung herunterladen
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled className="min-h-11">
            Rechnung herunterladen
          </Button>
        )}
      </div>

      <p className="text-center">
        <Link href="/konto/bestellungen" className="text-sm font-medium text-brand-600 hover:underline">
          Zur Bestellübersicht
        </Link>
      </p>
    </main>
  );
}
