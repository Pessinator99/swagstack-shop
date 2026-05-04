"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Trash2, Minus, Plus } from "lucide-react";
import { useCart } from "@/components/shop/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCartSummary,
  useClearCart,
  useRemoveFromCart,
  useUpdateCartItem,
} from "@/hooks/use-cart";
import { formatCents } from "@/lib/pricing";

type CartPageClientProps = {
  canceledCheckout?: boolean;
};

export function CartPageClient({ canceledCheckout = false }: CartPageClientProps) {
  const router = useRouter();
  const { count } = useCart();
  const { data: summary, isLoading } = useCartSummary();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();
  const items = summary?.items ?? [];
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canceledCheckout) return;
    toast.message("Zahlung abgebrochen – dein Warenkorb ist noch da.", { id: "cart-checkout-canceled" });
    router.replace("/warenkorb", { scroll: false });
  }, [canceledCheckout, router]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of items) next[item.id] = String(item.quantity);
    setQuantityDrafts((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) return next;
      for (const key of nextKeys) {
        if (prev[key] !== next[key]) return next;
      }
      return prev;
    });
  }, [items]);

  const hasItems = items.length > 0;
  const thresholdHint =
    (summary?.freeShippingRemainingCents ?? 0) > 0 &&
    (summary?.subtotalNetCents ?? 0) > 0;

  const canCheckout = hasItems && !isLoading;

  const onQuantityDraft = (id: string, raw: string) => {
    const sanitized = raw.replace(/[^\d]/g, "");
    setQuantityDrafts((prev) => ({ ...prev, [id]: sanitized || "1" }));
    const numeric = Math.max(1, Number.parseInt(sanitized || "1", 10) || 1);
    updateItem.queueDebouncedUpdate(id, numeric);
  };

  const effectiveQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const draft = quantityDrafts[item.id];
      map.set(item.id, Math.max(1, Number.parseInt(draft ?? String(item.quantity), 10) || 1));
    }
    return map;
  }, [items, quantityDrafts]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {!hasItems && !isLoading ? (
        <section className="mx-auto flex min-h-[56vh] max-w-2xl flex-col items-center justify-center rounded-[var(--radius)] border border-dashed bg-muted/20 p-10 text-center">
          <ShoppingCart className="mb-5 size-20 text-muted-foreground" />
          <h1 className="font-heading text-3xl font-semibold">Dein Warenkorb ist leer</h1>
          <p className="mt-2 text-muted-foreground">
            Entdecke unsere Werbemittel und konfiguriere dein erstes Produkt.
          </p>
          <Button asChild variant="accent" className="mt-6">
            <Link href="/shop">Shop öffnen</Link>
          </Button>
        </section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-2xl font-semibold">Warenkorb</h1>
              <p className="text-sm text-muted-foreground">{count} Artikel</p>
            </div>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-brand-600"
            >
              <ArrowLeft className="size-4" />
              Weiter einkaufen
            </Link>

            {items.map((item) => {
              const qty = effectiveQty.get(item.id) ?? item.quantity;
              const unitGross = qty > 0 ? Math.round(item.lineTotalGrossCents / qty) : 0;
              return (
                <article key={item.id} className="rounded-[var(--radius)] border bg-surface p-4">
                  <div className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)_auto_auto] sm:items-start">
                    <div className="relative size-[100px] shrink-0 overflow-hidden rounded-md bg-brand-50">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- cart thumbnail from CMS URLs
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-base font-semibold">{item.productName}</h3>
                      {item.variantLabel ? (
                        <p className="text-sm text-muted-foreground">Farbe: {item.variantLabel}</p>
                      ) : null}
                      {item.printTechniqueName ? (
                        <p className="text-sm text-muted-foreground">
                          {item.printTechniqueName}
                          {item.printAreaName ? `, ${item.printAreaName}` : ""}
                          {item.printColors ? `, ${item.printColors} Farbe${item.printColors > 1 ? "n" : ""}` : ""}
                        </p>
                      ) : null}

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Menge verringern"
                          onClick={() => onQuantityDraft(item.id, String(Math.max(1, qty - 1)))}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          value={quantityDrafts[item.id] ?? String(item.quantity)}
                          aria-label={`Menge für ${item.productName}`}
                          onChange={(e) => onQuantityDraft(item.id, e.target.value)}
                          className="h-9 w-24 font-mono"
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Menge erhöhen"
                          onClick={() => onQuantityDraft(item.id, String(qty + 1))}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-right sm:pt-1">
                      <p className="font-mono text-xl font-semibold">
                        {formatCents(item.lineTotalGrossCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">à {formatCents(unitGross)}/Stk</p>
                    </div>

                    <div className="justify-self-end sm:self-start">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Artikel entfernen"
                        onClick={() => removeItem.mutate({ id: item.id })}
                        className="size-10 hover:bg-red-50 hover:text-destructive"
                      >
                        <Trash2 className="size-[18px]" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}

            {hasItems ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Alle Artikel aus dem Warenkorb entfernen?")) {
                    clearCart.mutate();
                  }
                }}
                className="text-sm text-muted-foreground transition-colors hover:text-destructive"
              >
                Alle entfernen
              </button>
            ) : null}
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[var(--radius)] border bg-surface p-5 shadow-[var(--shadow-raised)]">
              <h2 className="text-xl font-semibold">Bestellübersicht</h2>
              <div className="my-4 h-px bg-border" />

              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded bg-muted" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Zwischensumme netto</span>
                    <span className="font-mono">{formatCents(summary?.subtotalNetCents ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Versand</span>
                    <span className="font-mono">
                      {(summary?.shippingNetCents ?? 0) > 0
                        ? formatCents(summary?.shippingNetCents ?? 0)
                        : "Kostenlos"}
                    </span>
                  </div>

                  {thresholdHint ? (
                    <div className="rounded-md bg-accent-50 p-3 text-sm text-brand-800">
                      Noch {formatCents(summary?.freeShippingRemainingCents ?? 0)} bis kostenloser
                      Versand
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">MwSt {(summary?.vatRatePercent ?? 19)}%</span>
                    <span className="font-mono">{formatCents(summary?.vatAmountCents ?? 0)}</span>
                  </div>

                  <div className="my-3 h-px bg-border" />

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-brand-900">Gesamt brutto</span>
                    <span className="font-mono text-xl font-bold">
                      {formatCents(summary?.totalGrossCents ?? 0)}
                    </span>
                  </div>
                </div>
              )}

              <Button
                variant="accent"
                className="mt-5 h-12 w-full"
                disabled={!canCheckout}
                onClick={() => router.push("/checkout")}
              >
                Zur Kasse
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                🔒 Sichere Zahlung via Stripe
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
