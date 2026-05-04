"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { removeLogoBackground } from "@/app/actions/removeBg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMarketingMockupCanvas } from "@/lib/moodboard/create-marketing-mockup-canvas";
import type { MarketingCatalogProduct, MarketingCatalogVariant } from "@/lib/moodboard/marketing-types";
import { consumeMoodboardPrefillFromSession } from "@/lib/moodboard/prefill";
import { cn } from "@/lib/utils";

const INDUSTRY_QUICK_CHIPS = [
  "IT-Unternehmen",
  "Arztpraxis",
  "Hochschule",
  "Handwerksbetrieb",
  "Restaurant",
  "Sportverein",
] as const;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function findCatalogVariantBySupplierCode(
  variants: MarketingCatalogVariant[],
  code: string,
): MarketingCatalogVariant | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return variants.find((t) => {
    const vcc = (t.variant_code ?? "").trim().toLowerCase();
    const svc = (t.supplier_variant_code ?? "").trim().toLowerCase();
    return vcc === c || (svc.length > 0 && svc === c);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(file);
  });
}

export function MoodboardClient() {
  const searchParams = useSearchParams();
  const prefillFromPdpDone = useRef(false);
  /** Variante, für die PDP-Prefill (mappedImageUrl) gilt; bei anderer Farbwahl → Katalog-Bild. */
  const prefillVariantIdRef = useRef<string | null>(null);
  /** PDP-gewählte Druckfläche (Name), nur für Prefill-Produkt relevant. */
  const prefillPrintAreaNameRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stripBackground, setStripBackground] = useState(true);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoProcessedDataUrl, setLogoProcessedDataUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [catalog, setCatalog] = useState<MarketingCatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const [industryText, setIndustryText] = useState("");

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [generateBusy, setGenerateBusy] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<"gemini" | "imagen" | "mockup_fallback" | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/moodboard/catalog");
        if (!res.ok) throw new Error("Katalog");
        const data = (await res.json()) as { products?: MarketingCatalogProduct[] };
        if (!cancelled) setCatalog(data.products ?? []);
      } catch {
        if (!cancelled) {
          toast.error("Produkte konnten nicht geladen werden.");
          setCatalog([]);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const prefillProductSlug = searchParams.get("product")?.trim() ?? "";
  const prefillVariantCode = searchParams.get("variant")?.trim() ?? "";

  const [prefillMappedProductImageUrl, setPrefillMappedProductImageUrl] = useState<string | null>(
    null,
  );

  useLayoutEffect(() => {
    if (prefillFromPdpDone.current || catalogLoading || !prefillProductSlug) return;
    const p = catalog.find((x) => x.slug === prefillProductSlug);
    if (!p) return;
    const stored = consumeMoodboardPrefillFromSession();
    prefillFromPdpDone.current = true;

    console.log("[prefill]", stored);
    console.log("[catalog variants]", p.variants);

    const vc = (prefillVariantCode || stored?.variantCode?.trim() || "").trim();
    const matched = vc ? findCatalogVariantBySupplierCode(p.variants, vc) : undefined;
    console.log("[matching]", matched, "for code", vc || "(none)");

    const mapped = stored?.mappedImageUrl?.trim();
    const pan = stored?.printAreaName?.trim();
    prefillPrintAreaNameRef.current = pan || null;

    setSelectedProductId(p.id);
    if (matched) {
      setSelectedVariantId(matched.id);
      prefillVariantIdRef.current = matched.id;
    } else if (p.variants[0]) {
      setSelectedVariantId(p.variants[0].id);
    }
    if (mapped && !prefillVariantIdRef.current && p.variants[0]) {
      prefillVariantIdRef.current = p.variants[0].id;
    }
    if (stored?.logoDataUrl?.startsWith("data:image")) {
      setLogoProcessedDataUrl(stored.logoDataUrl);
    }
    if (mapped) setPrefillMappedProductImageUrl(mapped);
  }, [catalog, catalogLoading, prefillProductSlug, prefillVariantCode]);

  const selectedProduct = useMemo(
    () => catalog.find((p) => p.id === selectedProductId) ?? null,
    [catalog, selectedProductId],
  );

  useEffect(() => {
    if (!prefillProductSlug || !selectedProductId) return;
    const p = catalog.find((x) => x.id === selectedProductId);
    if (!p || p.slug !== prefillProductSlug) {
      setPrefillMappedProductImageUrl(null);
      prefillVariantIdRef.current = null;
      prefillPrintAreaNameRef.current = null;
    }
  }, [catalog, selectedProductId, prefillProductSlug]);

  const selectedVariant = useMemo(() => {
    if (!selectedProduct || !selectedVariantId) return null;
    return selectedProduct.variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [selectedProduct, selectedVariantId]);

  useEffect(() => {
    if (selectedProduct && selectedProduct.variants[0] && !selectedVariantId) {
      setSelectedVariantId(selectedProduct.variants[0].id);
    }
  }, [selectedProduct, selectedVariantId]);

  const effectiveOverlayRect = useMemo(() => {
    if (!selectedProduct) return null;
    const name = prefillPrintAreaNameRef.current?.trim();
    if (name && selectedProduct.slug === prefillProductSlug) {
      const pa = selectedProduct.printAreas.find(
        (a) => a.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (pa) return pa.overlayRect;
    }
    return selectedProduct.overlayRect;
  }, [selectedProduct, prefillProductSlug]);

  const variantImageUrl = useMemo(() => {
    if (!selectedProduct || !selectedVariant) return null;
    const mapped = prefillMappedProductImageUrl?.trim();
    const slugMatches = Boolean(prefillProductSlug) && selectedProduct.slug === prefillProductSlug;
    const variantMatches =
      prefillVariantIdRef.current !== null && selectedVariant.id === prefillVariantIdRef.current;
    if (slugMatches && variantMatches && mapped) return mapped;
    return selectedVariant.image_url?.trim() || selectedProduct.primaryImageUrl || null;
  }, [
    selectedProduct,
    selectedVariant,
    prefillMappedProductImageUrl,
    prefillProductSlug,
  ]);

  useEffect(() => {
    if (!selectedProduct || !variantImageUrl) {
      setPreviewDataUrl(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setPreviewBusy(true);
        try {
          if (!effectiveOverlayRect) return;
          const url = await createMarketingMockupCanvas({
            productImageUrl: variantImageUrl,
            logoDataUrl: logoProcessedDataUrl,
            overlayRect: effectiveOverlayRect,
          });
          if (!cancelled) setPreviewDataUrl(url);
        } catch (e) {
          console.error(e);
          if (!cancelled) {
            setPreviewDataUrl(null);
            toast.error("Vorschau konnte nicht erstellt werden (z. B. CORS beim Produktbild).");
          }
        } finally {
          if (!cancelled) setPreviewBusy(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [selectedProduct, variantImageUrl, logoProcessedDataUrl, effectiveOverlayRect]);

  const runLogoPipeline = useCallback(async (file: File) => {
    setLogoBusy(true);
    setLogoProcessedDataUrl(null);
    try {
      let dataUrl: string;
      if (stripBackground) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await removeLogoBackground(fd);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        dataUrl = `data:image/png;base64,${result.base64Png}`;
      } else {
        dataUrl = await readFileAsDataUrl(file);
      }
      setLogoProcessedDataUrl(dataUrl);
      toast.success(stripBackground ? "Logo freigestellt." : "Logo geladen.");
    } catch (e) {
      console.error(e);
      toast.error("Logo-Verarbeitung fehlgeschlagen.");
    } finally {
      setLogoBusy(false);
    }
  }, [stripBackground]);

  const onFile = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        toast.error("Datei zu groß (max. 10 MB).");
        return;
      }
      void runLogoPipeline(file);
    },
    [runLogoPipeline],
  );

  const resetAll = useCallback(() => {
    setLogoProcessedDataUrl(null);
    setSelectedProductId(null);
    setSelectedVariantId(null);
    setIndustryText("");
    setPreviewDataUrl(null);
    setResultImageUrl(null);
    setResultSource(null);
    setResultMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const canGenerate =
    Boolean(logoProcessedDataUrl) &&
    Boolean(selectedProduct) &&
    Boolean(selectedVariant) &&
    industryText.trim().length > 0 &&
    Boolean(variantImageUrl);

  const generate = useCallback(async () => {
    if (!canGenerate || !selectedProduct || !selectedVariant || !variantImageUrl || !logoProcessedDataUrl) return;
    setGenerateBusy(true);
    setResultImageUrl(null);
    setResultSource(null);
    setResultMessage(null);
    try {
      if (!effectiveOverlayRect) return;
      const mockup = await createMarketingMockupCanvas({
        productImageUrl: variantImageUrl,
        logoDataUrl: logoProcessedDataUrl,
        overlayRect: effectiveOverlayRect,
      });
      const res = await fetch("/api/moodboard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mockupDataUrl: mockup,
          logoDataUrl: logoProcessedDataUrl,
          industry: industryText.trim(),
          productName: selectedProduct.name,
          variantName: selectedVariant.variant_value,
        }),
      });
      const raw = (await res.json()) as {
        imageDataUrl?: string;
        source?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(typeof raw.error === "string" ? raw.error : "Generierung fehlgeschlagen.");
        return;
      }
      if (!raw.imageDataUrl) {
        toast.error("Keine Bilddaten in der Antwort.");
        return;
      }
      setResultImageUrl(raw.imageDataUrl);
      setResultSource(
        raw.source === "mockup_fallback"
          ? "mockup_fallback"
          : raw.source === "imagen"
            ? "imagen"
            : "gemini",
      );
      setResultMessage(typeof raw.message === "string" ? raw.message : null);
      if (raw.source === "mockup_fallback" && raw.message) {
        toast.message("Hinweis", { description: raw.message });
      } else {
        toast.success("Marketingfoto erstellt.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Netzwerkfehler bei der Generierung.");
    } finally {
      setGenerateBusy(false);
    }
  }, [
    canGenerate,
    selectedProduct,
    selectedVariant,
    variantImageUrl,
    logoProcessedDataUrl,
    industryText,
    effectiveOverlayRect,
  ]);

  const downloadResult = useCallback(() => {
    if (!resultImageUrl) return;
    const a = document.createElement("a");
    a.href = resultImageUrl;
    a.download = "marketing-bild.png";
    a.click();
  }, [resultImageUrl]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap justify-center gap-3 text-sm">
        <Button variant="link" asChild className="h-auto p-0">
          <Link href="/shop">Zurück zum Shop</Link>
        </Button>
        <span className="text-muted-foreground">·</span>
        <Button variant="link" asChild className="h-auto p-0">
          <Link href="/colormatch">ColorMatch</Link>
        </Button>
      </div>

      <header className="mb-10 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          Marketing-Bild-Generator
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Logo hochladen, Produkt wählen, Einsatzgebiet beschreiben – KI erstellt dein Marketingfoto.
        </p>
      </header>

      <div className="space-y-10">
        {/* SECTION 1 */}
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Logo</h2>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Hintergrund</span>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors",
                stripBackground ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
              )}
              onClick={() => setStripBackground(true)}
            >
              Ohne Hintergrund
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors",
                !stripBackground ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
              )}
              onClick={() => setStripBackground(false)}
            >
              Mit Hintergrund
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="sr-only"
            onChange={(e) => onFile(e.target.files)}
          />
          <button
            type="button"
            disabled={logoBusy}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              logoBusy && "pointer-events-none opacity-60",
            )}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              onFile(e.dataTransfer.files);
            }}
          >
            {logoBusy ? (
              <>
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                <span className="text-sm">Verarbeitung …</span>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground">
                  PNG, JPEG oder WebP · max. 10 MB · Klicken oder hierher ziehen
                </span>
              </>
            )}
          </button>
          <div className="mt-4 flex items-center gap-3">
            {logoProcessedDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
                <img
                  src={logoProcessedDataUrl}
                  alt=""
                  className="size-[60px] shrink-0 rounded-md border object-contain bg-muted"
                />
                <p className="text-sm font-medium text-brand-700">Logo bereit ✓</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Noch kein Logo hochgeladen.</p>
            )}
          </div>
        </section>

        {/* SECTION 2 */}
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Produkt wählen</h2>
          {catalogLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Produkte mit Druckflächen-Koordinaten verfügbar.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {catalog.map((p) => {
                const active = p.id === selectedProductId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setSelectedVariantId(p.variants[0]?.id ?? null);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors",
                      active
                        ? "border-accent-500 bg-brand-50 shadow-sm ring-2 ring-brand-600/20 dark:bg-brand-950/30"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span className="relative block size-[120px] shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.primaryImageUrl ? (
                        <Image
                          src={p.primaryImageUrl}
                          alt=""
                          fill
                          className="object-contain p-1"
                          sizes="120px"
                        />
                      ) : null}
                      {active ? (
                        <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-brand-700 text-white shadow">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                      ) : null}
                    </span>
                    <span className="line-clamp-2 min-h-[2.5rem] text-xs font-medium leading-snug">{p.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 3 + 4 */}
        {selectedProduct && selectedVariant ? (
          <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
            <div>
              <h2 className="mb-3 text-lg font-semibold">Farbe wählen</h2>
              <p className="mb-2 text-xs text-muted-foreground">Farbe</p>
              <div className="flex flex-wrap gap-2">
                {selectedProduct.variants.map((v) => {
                  const sel = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      title={v.variant_value}
                      className={cn(
                        "size-8 rounded-full border-2 border-white shadow-md outline-none transition-transform",
                        "hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                        sel && "ring-2 ring-primary ring-offset-2",
                      )}
                      style={{ backgroundColor: v.color_hex ?? "#ccc" }}
                      onClick={() => setSelectedVariantId(v.id)}
                    />
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold">Vorschau-Mockup</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Vorschau der Druckfläche – KI platziert das Produkt in einer realen Szene.
              </p>
              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl border bg-muted">
                {previewBusy ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : previewDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL
                  <img src={previewDataUrl} alt="" className="size-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                    Vorschau wird berechnet …
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* SECTION 5 */}
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Szene</h2>
          <div>
            <Label htmlFor="industry">Branche / Einsatzgebiet</Label>
            <Input
              id="industry"
              placeholder="z.B. IT-Unternehmen, Tierarztpraxis, Bäckerei, Hochschule, Sportverein…"
              maxLength={100}
              value={industryText}
              onChange={(e) => setIndustryText(e.target.value)}
              className="mt-2 max-w-xl"
            />
            <p className="mt-1 text-xs text-muted-foreground">Je genauer, desto besser das KI-Ergebnis</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {INDUSTRY_QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => setIndustryText(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 6 */}
        <Button
          type="button"
          variant="accent"
          className="h-12 w-full text-base font-semibold"
          disabled={!canGenerate || generateBusy}
          onClick={() => void generate()}
        >
          {generateBusy ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              KI generiert dein Marketingfoto…
            </>
          ) : (
            <>
              <Sparkles className="size-5" aria-hidden />
              Marketing-Bild generieren
            </>
          )}
        </Button>

        {/* SECTION 7 */}
        {resultImageUrl ? (
          <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Ergebnis</h2>
            {resultSource === "mockup_fallback" && resultMessage ? (
              <p className="text-xs text-muted-foreground">{resultMessage}</p>
            ) : null}
            <div className="mx-auto max-w-[800px] overflow-hidden rounded-xl border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
              <img src={resultImageUrl} alt="Generiertes Marketingfoto" className="w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={downloadResult}>
                Bild speichern
              </Button>
              <Button type="button" variant="outline" onClick={resetAll}>
                Neues Bild generieren
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
