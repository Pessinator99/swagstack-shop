"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getColor } from "colorthief";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { removeLogoBackground } from "@/app/actions/removeBg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeHex, hexDistance } from "@/lib/colormatch/hex-distance";
import {
  parsePrintAreaPixelPayload,
  scaledLogoOverlayRect,
  type NormRect,
} from "@/lib/colormatch/pixel-coordinates";
import { COLORMATCH_DOMINANT_HEX_KEY } from "@/lib/moodboard/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/database";

type VariantRow = {
  id: string;
  variant_type: string;
  variant_value: string;
  variant_code: string | null;
  image_url: string | null;
  color_hex: string | null;
  is_active: boolean;
  sort_order: number;
};

type PrintAreaRow = {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  pixel_coordinates: unknown;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  base_images: unknown;
  product_variants: VariantRow[] | null;
  print_areas: PrintAreaRow[] | null;
};

type CardVariant = {
  id: string;
  variantCode: string | null;
  label: string;
  colorHex: string | null;
  imageUrl: string;
};

type CardModel = {
  productId: string;
  slug: string;
  name: string;
  rect: NormRect;
  variants: CardVariant[];
  bestMatchIndex: number;
};

function parseBaseImages(raw: unknown): ProductImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is ProductImage =>
      typeof x === "object" &&
      x != null &&
      "url" in x &&
      typeof (x as { url: unknown }).url === "string",
  ) as ProductImage[];
}

function primaryBaseImage(raw: unknown): string | null {
  const imgs = parseBaseImages(raw);
  return imgs.find((i) => i.is_primary)?.url ?? imgs[0]?.url ?? null;
}

function sortPrintAreas(areas: PrintAreaRow[]): PrintAreaRow[] {
  return [...areas].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

function sortColorVariants(variants: VariantRow[]): VariantRow[] {
  return variants
    .filter((v) => v.is_active && v.variant_type === "color")
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Index der Variante mit minimalem RGB-Abstand zur Logo-Farbe; ohne gültige Hex-Werte → 0. */
function bestColorVariantIndex(sortedColors: VariantRow[], dominantHex: string | null): number {
  if (!sortedColors.length) return 0;
  if (!dominantHex) return 0;
  const dom = normalizeHex(dominantHex) ?? dominantHex;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  sortedColors.forEach((v, i) => {
    const ch = v.color_hex ? normalizeHex(v.color_hex) : null;
    if (!ch) return;
    const d = hexDistance(dom, ch);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function buildCardModels(products: ProductRow[], dominantHex: string | null): CardModel[] {
  const out: CardModel[] = [];
  for (const p of products) {
    const areas = sortPrintAreas(p.print_areas ?? []);
    let rect: NormRect | null = null;
    let mapped: string | null = null;
    for (const a of areas) {
      const parsed = parsePrintAreaPixelPayload(a.pixel_coordinates);
      if (parsed.overlayRect) {
        rect = parsed.overlayRect;
        mapped = parsed.mappedImageUrl;
        break;
      }
    }
    if (!rect) continue;
    const sorted = sortColorVariants(p.product_variants ?? []);
    if (!sorted.length) continue;
    const baseUrl = primaryBaseImage(p.base_images);
    const variants: CardVariant[] = sorted.map((v) => ({
      id: v.id,
      variantCode: v.variant_code,
      label: v.variant_value,
      colorHex: v.color_hex,
      imageUrl: mapped ?? v.image_url?.trim() ?? baseUrl ?? "",
    }));
    if (!variants.some((v) => v.imageUrl)) continue;
    const bestMatchIndex = Math.min(
      bestColorVariantIndex(sorted, dominantHex),
      variants.length - 1,
    );
    out.push({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      rect,
      variants,
      bestMatchIndex,
    });
  }
  return out;
}

async function decodeLogoForColorExtraction(dataUrl: string): Promise<HTMLImageElement> {
  const img = document.createElement("img");
  img.decoding = "async";
  img.src = dataUrl;
  if (img.complete && img.naturalWidth > 0) return img;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Logo konnte nicht geladen werden."));
  });
  return img;
}

/** Max. 8 Slots in einer Zeile; bei >8 Varianten: 7 Punkte + „+X“-Badge. */
function colormatchVisibleSwatchIndices(variantCount: number, selectedIdx: number): number[] {
  if (variantCount <= 8) return Array.from({ length: variantCount }, (_, i) => i);
  if (selectedIdx > 6) return [0, 1, 2, 3, 4, 5, selectedIdx];
  return [0, 1, 2, 3, 4, 5, 6];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(file);
  });
}

export default function ColorMatchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [stripBackground, setStripBackground] = useState(true);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [dominantHex, setDominantHex] = useState<string | null>(null);
  const [variantOverrideByProduct, setVariantOverrideByProduct] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          slug,
          name,
          base_images,
          product_variants ( id, variant_type, variant_value, variant_code, image_url, color_hex, is_active, sort_order ),
          print_areas ( id, name, sort_order, is_default, pixel_coordinates )
        `,
        )
        .eq("status", "active")
        .order("name");
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("Produkte konnten nicht geladen werden.");
        setProducts([]);
      } else {
        setProducts((data ?? []) as ProductRow[]);
      }
      setProductsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dominantHex) return;
    try {
      localStorage.setItem(COLORMATCH_DOMINANT_HEX_KEY, dominantHex);
    } catch {
      /* ignore */
    }
  }, [dominantHex]);

  const cardModels = useMemo(
    () => buildCardModels(products, dominantHex),
    [products, dominantHex],
  );

  const getSelectedIndex = useCallback(
    (m: CardModel) => {
      const o = variantOverrideByProduct[m.productId];
      if (typeof o === "number" && o >= 0 && o < m.variants.length) return o;
      return Math.min(m.bestMatchIndex, m.variants.length - 1);
    },
    [variantOverrideByProduct],
  );

  const runPipeline = useCallback(async (file: File) => {
    setProcessing(true);
    setLogoDataUrl(null);
    setDominantHex(null);
    setVariantOverrideByProduct({});
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
      setLogoDataUrl(dataUrl);

      const img = await decodeLogoForColorExtraction(dataUrl);
      const color = await getColor(img);
      const hex = color?.hex() ?? "#808080";
      setDominantHex(hex);
      toast.success(
        stripBackground
          ? "Logo freigestellt — Vorschau wird geladen."
          : "Logo geladen — Vorschau mit Original-Hintergrund.",
      );
    } catch (e) {
      console.error(e);
      toast.error("Verarbeitung fehlgeschlagen.");
    } finally {
      setProcessing(false);
    }
  }, [stripBackground]);

  const onFile = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void runPipeline(file);
    },
    [runPipeline],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Live-Vorschau
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          ColorMatch
        </h1>
        <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
          Logo hochladen, optional Hintergrund entfernen und auf alle Produkte mit hinterlegter
          Druckfläche projizieren — inklusive Farbabgleich der Produktvariante.
        </p>
        <Button variant="link" asChild className="mt-2">
          <Link href="/shop">Zurück zum Shop</Link>
        </Button>
      </div>

      <Card className="mx-auto max-w-xl border-dashed shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Logo-Upload</CardTitle>
          <CardDescription>PNG, JPEG oder WebP · max. 10 MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap items-center justify-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm"
            role="group"
            aria-label="Hintergrundbehandlung"
          >
            <span className="text-muted-foreground">Logo</span>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors",
                stripBackground
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setStripBackground(true)}
            >
              Ohne Hintergrund
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors",
                !stripBackground
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setStripBackground(false)}
            >
              Mit Hintergrund
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            „Mit Hintergrund“ nutzt die Originaldatei (kein remove.bg) — sinnvoll bei bereits
            transparenten Logos.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="sr-only"
            onChange={(e) => onFile(e.target.files)}
          />
          <button
            type="button"
            disabled={processing}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
              "min-h-[200px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              processing && "pointer-events-none opacity-60",
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
            {processing ? (
              <>
                <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
                <span className="text-sm font-medium">
                  {stripBackground ? "Hintergrund wird entfernt …" : "Logo wird geladen …"}
                </span>
              </>
            ) : (
              <>
                <span className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <Upload className="size-7 text-muted-foreground" aria-hidden />
                </span>
                <span className="text-sm text-muted-foreground">
                  Datei hierher ziehen oder klicken zum Auswählen
                </span>
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {!productsLoading && cardModels.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          Keine aktiven Produkte mit gültigen{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">pixel_coordinates</code>{" "}
          gefunden.
        </p>
      ) : (
        <div className="mt-10">
          {dominantHex ? (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-4 text-sm">
              <span className="text-muted-foreground">Dominante Farbe</span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs">
                <span
                  className="size-4 rounded-full border shadow-sm"
                  style={{ backgroundColor: dominantHex }}
                  aria-hidden
                />
                {dominantHex}
              </span>
            </div>
          ) : (
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Ohne Logo-Upload: Vorschau in der Standard-Farbe pro Produkt. Nach Upload wird die
              farblich passendste Variante vorselektiert.
            </p>
          )}

          {productsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardModels.map((m) => {
                const idx = getSelectedIndex(m);
                const v = m.variants[idx] ?? m.variants[0];
                const overlayRect = scaledLogoOverlayRect(m.rect);
                const pdpHref =
                  v?.variantCode != null && v.variantCode !== ""
                    ? `/shop/${m.slug}?color=${encodeURIComponent(v.variantCode)}`
                    : `/shop/${m.slug}`;
                return (
                  <li key={m.productId} className="flex flex-col rounded-xl border bg-card shadow-sm">
                    <Link
                      href={pdpHref}
                      className="group block min-w-0 rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-t-xl bg-muted">
                        <Image
                          src={v.imageUrl}
                          alt=""
                          fill
                          className="object-contain p-2"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        {logoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data: URL
                          <img
                            src={logoDataUrl}
                            alt=""
                            className="pointer-events-none absolute object-contain opacity-95 drop-shadow-sm"
                            style={{
                              left: `${overlayRect.x * 100}%`,
                              top: `${overlayRect.y * 100}%`,
                              width: `${overlayRect.width * 100}%`,
                              height: `${overlayRect.height * 100}%`,
                            }}
                          />
                        ) : null}
                      </div>
                      <p className="truncate px-3 py-2 text-sm font-medium group-hover:underline">
                        {m.name}
                      </p>
                    </Link>

                    {m.variants.length > 1 ? (
                      <div
                        className="flex flex-nowrap items-center justify-center gap-2 overflow-hidden px-3 pb-2"
                        role="list"
                        aria-label="Produktfarben"
                      >
                        {colormatchVisibleSwatchIndices(m.variants.length, idx).map((i) => {
                          const cv = m.variants[i];
                          if (!cv) return null;
                          const selected = i === idx;
                          const isBest = i === m.bestMatchIndex;
                          const swatch = (
                            <button
                              type="button"
                              role="listitem"
                              className={cn(
                                "relative size-4 shrink-0 rounded-full border-2 border-white shadow-md outline-none transition-transform",
                                "hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                                isBest && !selected && "ring-1 ring-muted-foreground/40 ring-offset-1",
                              )}
                              style={{
                                backgroundColor: cv.colorHex ?? "#ccc",
                              }}
                              aria-pressed={selected}
                              aria-label={cv.label}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setVariantOverrideByProduct((prev) => ({
                                  ...prev,
                                  [m.productId]: i,
                                }));
                              }}
                            />
                          );
                          return (
                            <Tooltip key={`${m.productId}-${cv.id}-${i}`}>
                              <TooltipTrigger asChild>{swatch}</TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[220px]">
                                <p className="text-xs font-medium">{cv.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {m.variants.length > 8 ? (
                          <span
                            className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground"
                            aria-label={`${m.variants.length - 7} weitere Farben`}
                          >
                            +{m.variants.length - 7}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-auto border-t px-3 py-2">
                      <Link
                        href={pdpHref}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Produkt ansehen →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
