"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCartSummary } from "@/hooks/use-cart";
import { formatCents } from "@/lib/pricing";

const addressSchema = z.object({
  companyName: z.string().min(2, "Firmenname ist erforderlich."),
  contactPerson: z.string().min(2, "Kontaktperson ist erforderlich."),
  street: z.string().min(2, "Straße ist erforderlich."),
  zip: z.string().min(3, "PLZ ist erforderlich."),
  city: z.string().min(2, "Ort ist erforderlich."),
  country: z.string().min(2),
  vatId: z.string().optional(),
  phone: z.string().min(5, "Telefon ist erforderlich."),
});

/** Nur Formular-Shape, keine Min-Längen — echte Prüfung nur bei separateShipping via superRefine + addressSchema. */
const shippingFormShapeSchema = z.object({
  companyName: z.string(),
  contactPerson: z.string(),
  street: z.string(),
  zip: z.string(),
  city: z.string(),
  country: z.string(),
  vatId: z.string().optional(),
  phone: z.string(),
});

const checkoutSchema = z.object({
  billing: addressSchema,
  separateShipping: z.boolean(),
  shipping: shippingFormShapeSchema.optional(),
  saveForFuture: z.boolean(),
  paymentMethod: z.enum(["stripe", "invoice"]),
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, { message: "Bitte AGB akzeptieren." }),
}).superRefine((data, ctx) => {
  if (!data.separateShipping) return;
  const parsed = addressSchema.safeParse(data.shipping);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shipping", ...(issue.path ?? [])],
      message: issue.message,
    });
  }
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type Prefill = {
  id: string;
  email: string;
  company_name: string | null;
  contact_person: string | null;
  vat_id: string | null;
  phone: string | null;
  billing_address: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
};

function toAddress(source: Record<string, unknown> | null | undefined) {
  return {
    companyName: String(source?.companyName ?? source?.company_name ?? ""),
    contactPerson: String(source?.contactPerson ?? source?.contact_person ?? ""),
    street: String(source?.street ?? ""),
    zip: String(source?.zip ?? ""),
    city: String(source?.city ?? ""),
    country: String(source?.country ?? "DE"),
    vatId: String(source?.vatId ?? source?.vat_id ?? ""),
    phone: String(source?.phone ?? ""),
  };
}

export function CheckoutPageClient({ prefill }: { prefill: Prefill }) {
  const { data: summary, isLoading: summaryLoading } = useCartSummary();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const defaultBilling = useMemo(
    () => ({
      ...toAddress(prefill.billing_address),
      companyName: prefill.company_name ?? toAddress(prefill.billing_address).companyName,
      contactPerson:
        prefill.contact_person ?? toAddress(prefill.billing_address).contactPerson,
      vatId: prefill.vat_id ?? toAddress(prefill.billing_address).vatId,
      phone: prefill.phone ?? toAddress(prefill.billing_address).phone,
    }),
    [prefill],
  );

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      billing: defaultBilling,
      separateShipping: false,
      shipping: toAddress(prefill.shipping_address),
      saveForFuture: true,
      paymentMethod: "stripe",
      termsAccepted: false,
    },
    mode: "onChange",
    reValidateMode: "onChange",
    criteriaMode: "all",
    shouldFocusError: true,
  });
  const formState = form.formState;

  const separateShipping = form.watch("separateShipping");
  const paymentMethod = form.watch("paymentMethod");
  useEffect(() => {
    void form.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run one initial validation pass
  }, []);

  const canSubmit =
    formState.isValid &&
    paymentMethod === "stripe" &&
    (summary?.items.length ?? 0) > 0 &&
    !summaryLoading &&
    !isRedirecting;

  const inputClass = (hasError: boolean) => (hasError ? "border-destructive focus-visible:ring-destructive/30" : "");

  const onSubmit = form.handleSubmit(async (values) => {
    setIsRedirecting(true);
    try {
      const shipping = values.separateShipping ? values.shipping : values.billing;
      const payload = {
        customerId: prefill.id,
        billingAddress: values.billing,
        shippingAddress: shipping,
        saveForFuture: values.saveForFuture,
      };
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !json?.url) {
        throw new Error(json?.error ?? "Checkout-Session konnte nicht erstellt werden.");
      }
      window.location.href = json.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout fehlgeschlagen.");
      setIsRedirecting(false);
    }
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold">Kasse</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-muted px-3 py-1">🔒 Sichere Zahlung</span>
          <span className="rounded-full bg-muted px-3 py-1">🇩🇪 Rechnungskauf möglich</span>
          <span className="rounded-full bg-muted px-3 py-1">✅ B2B-Konditionen</span>
        </div>
      </header>

      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <div className="rounded-[var(--radius)] border bg-surface p-5">
            <h2 className="mb-4 text-lg font-semibold">1. Rechnungsadresse</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="billing-company">Firmenname *</Label>
                <Input
                  id="billing-company"
                  placeholder="Firmenname"
                  className={inputClass(Boolean(formState.errors.billing?.companyName))}
                  {...form.register("billing.companyName")}
                />
                {formState.errors.billing?.companyName ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.companyName.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-contact">Kontaktperson *</Label>
                <Input
                  id="billing-contact"
                  placeholder="Kontaktperson"
                  className={inputClass(Boolean(formState.errors.billing?.contactPerson))}
                  {...form.register("billing.contactPerson")}
                />
                {formState.errors.billing?.contactPerson ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.contactPerson.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-street">Straße *</Label>
                <Input
                  id="billing-street"
                  placeholder="Straße"
                  className={inputClass(Boolean(formState.errors.billing?.street))}
                  {...form.register("billing.street")}
                />
                {formState.errors.billing?.street ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.street.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-zip">PLZ *</Label>
                <Input
                  id="billing-zip"
                  placeholder="PLZ"
                  className={inputClass(Boolean(formState.errors.billing?.zip))}
                  {...form.register("billing.zip")}
                />
                {formState.errors.billing?.zip ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.zip.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-city">Ort *</Label>
                <Input
                  id="billing-city"
                  placeholder="Ort"
                  className={inputClass(Boolean(formState.errors.billing?.city))}
                  {...form.register("billing.city")}
                />
                {formState.errors.billing?.city ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.city.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-country">Land *</Label>
                <Controller
                  name="billing.country"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        void form.trigger("billing.country");
                      }}
                    >
                      <SelectTrigger
                        id="billing-country"
                        className={`w-full ${inputClass(Boolean(formState.errors.billing?.country))}`}
                        onBlur={field.onBlur}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DE">Deutschland</SelectItem>
                        <SelectItem value="AT">Österreich</SelectItem>
                        <SelectItem value="CH">Schweiz</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {formState.errors.billing?.country ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.country.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-vat">USt-ID</Label>
                <Input id="billing-vat" placeholder="USt-ID (optional)" {...form.register("billing.vatId")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="billing-phone">Telefon *</Label>
                <Input
                  id="billing-phone"
                  placeholder="Telefon"
                  className={inputClass(Boolean(formState.errors.billing?.phone))}
                  {...form.register("billing.phone")}
                />
                {formState.errors.billing?.phone ? (
                  <p className="text-xs text-destructive">{formState.errors.billing.phone.message}</p>
                ) : null}
              </div>
            </div>
            <label className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={form.watch("saveForFuture")}
                onCheckedChange={(v) => form.setValue("saveForFuture", v === true)}
              />
              Speichern für zukünftige Bestellungen
            </label>
          </div>

          <div className="rounded-[var(--radius)] border bg-surface p-5">
            <h2 className="mb-4 text-lg font-semibold">2. Lieferadresse</h2>
            <label className="mb-4 inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={separateShipping}
                onCheckedChange={(v) =>
                  form.setValue("separateShipping", v === true, { shouldValidate: true })
                }
              />
              Abweichende Lieferadresse
            </label>
            {separateShipping ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="shipping-company">Firmenname *</Label>
                  <Input
                    id="shipping-company"
                    placeholder="Firmenname"
                    className={inputClass(Boolean(formState.errors.shipping?.companyName))}
                    {...form.register("shipping.companyName")}
                  />
                  {formState.errors.shipping?.companyName ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.companyName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-contact">Kontaktperson *</Label>
                  <Input
                    id="shipping-contact"
                    placeholder="Kontaktperson"
                    className={inputClass(Boolean(formState.errors.shipping?.contactPerson))}
                    {...form.register("shipping.contactPerson")}
                  />
                  {formState.errors.shipping?.contactPerson ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.contactPerson.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-street">Straße *</Label>
                  <Input
                    id="shipping-street"
                    placeholder="Straße"
                    className={inputClass(Boolean(formState.errors.shipping?.street))}
                    {...form.register("shipping.street")}
                  />
                  {formState.errors.shipping?.street ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.street.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-zip">PLZ *</Label>
                  <Input
                    id="shipping-zip"
                    placeholder="PLZ"
                    className={inputClass(Boolean(formState.errors.shipping?.zip))}
                    {...form.register("shipping.zip")}
                  />
                  {formState.errors.shipping?.zip ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.zip.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-city">Ort *</Label>
                  <Input
                    id="shipping-city"
                    placeholder="Ort"
                    className={inputClass(Boolean(formState.errors.shipping?.city))}
                    {...form.register("shipping.city")}
                  />
                  {formState.errors.shipping?.city ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.city.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-country">Land *</Label>
                  <Controller
                    name="shipping.country"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? "DE"}
                        onValueChange={(value) => {
                          field.onChange(value);
                          void form.trigger("shipping.country");
                        }}
                      >
                        <SelectTrigger
                          id="shipping-country"
                          className={`w-full ${inputClass(Boolean(formState.errors.shipping?.country))}`}
                          onBlur={field.onBlur}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DE">Deutschland</SelectItem>
                          <SelectItem value="AT">Österreich</SelectItem>
                          <SelectItem value="CH">Schweiz</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {formState.errors.shipping?.country ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.country.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-vat">USt-ID</Label>
                  <Input id="shipping-vat" placeholder="USt-ID (optional)" {...form.register("shipping.vatId")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shipping-phone">Telefon *</Label>
                  <Input
                    id="shipping-phone"
                    placeholder="Telefon"
                    className={inputClass(Boolean(formState.errors.shipping?.phone))}
                    {...form.register("shipping.phone")}
                  />
                  {formState.errors.shipping?.phone ? (
                    <p className="text-xs text-destructive">{formState.errors.shipping.phone.message}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Lieferadresse entspricht Rechnungsadresse.</p>
            )}
          </div>

          <div className="rounded-[var(--radius)] border bg-surface p-5">
            <h2 className="mb-4 text-lg font-semibold">3. Bestellübersicht</h2>
            <div className="space-y-3">
              {(summary?.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-md bg-muted/40 p-2">
                  <div className="size-12 overflow-hidden rounded-md bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- compact checkout thumbnail
                      <img src={item.imageUrl} alt={item.productName} className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">Menge: {item.quantity}</p>
                  </div>
                  <p className="font-mono text-sm">{formatCents(item.lineTotalGrossCents)}</p>
                </div>
              ))}
            </div>
            <Link href="/warenkorb" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
              Warenkorb ändern
            </Link>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius)] border bg-surface p-5 shadow-[var(--shadow-raised)]">
            <h2 className="mb-4 text-lg font-semibold">4. Zahlungsart</h2>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => form.setValue("paymentMethod", "stripe")}
                className={`flex w-full items-center justify-between rounded-md border p-3 text-left ${paymentMethod === "stripe" ? "border-brand-600 bg-brand-50" : ""}`}
              >
                <div>
                  <p className="font-medium">Stripe (Karte/SEPA/Klarna)</p>
                  <p className="text-xs text-muted-foreground">Schnelle Bezahlung mit Stripe Checkout</p>
                </div>
                <CreditCard className="size-5 text-muted-foreground" />
              </button>

              <button
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-md border p-3 text-left opacity-60"
              >
                <div>
                  <p className="font-medium">Auf Rechnung</p>
                  <p className="text-xs text-muted-foreground">Nach Bonitätsprüfung</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Bald verfügbar</span>
              </button>
            </div>

            <div className="my-4 h-px bg-border" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="font-mono">{formatCents(summary?.subtotalNetCents ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versand</span>
                <span className="font-mono">
                  {(summary?.shippingNetCents ?? 0) > 0
                    ? formatCents(summary?.shippingNetCents ?? 0)
                    : "Kostenlos"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MwSt {(summary?.vatRatePercent ?? 19)}%</span>
                <span className="font-mono">{formatCents(summary?.vatAmountCents ?? 0)}</span>
              </div>
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between text-lg font-semibold">
                <span>Gesamt</span>
                <span className="font-mono">{formatCents(summary?.totalGrossCents ?? 0)}</span>
              </div>
            </div>

            <Controller
              name="termsAccepted"
              control={form.control}
              render={({ field }) => (
                <label className="mt-4 inline-flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(state) => {
                      field.onChange(state === true);
                    }}
                    onBlur={field.onBlur}
                  />
                  <span>
                    Ich akzeptiere die{" "}
                    <Link href="/agb" className="underline">
                      AGB
                    </Link>{" "}
                    und{" "}
                    <Link href="/datenschutz" className="underline">
                      Datenschutzerklärung
                    </Link>
                    .
                  </span>
                </label>
              )}
            />

            <Button type="submit" variant="accent" className="mt-5 h-12 w-full" disabled={!canSubmit}>
              {isRedirecting ? "Weiterleitung zu Stripe…" : "Jetzt kostenpflichtig bestellen"}
            </Button>
            {!canSubmit ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Bitte Pflichtfelder prüfen, AGB akzeptieren und sicherstellen, dass der Warenkorb nicht leer ist.
              </p>
            ) : null}
            <p className="mt-2 text-center text-xs text-muted-foreground inline-flex w-full items-center justify-center gap-1">
              <ShieldCheck className="size-3.5" />
              Sichere Verarbeitung über Stripe
            </p>
          </div>
        </aside>
      </form>
    </main>
  );
}
