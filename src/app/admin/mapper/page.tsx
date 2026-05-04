"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProductImage } from "@/types/database";
import { cn } from "@/lib/utils";

type NormRect = { x: number; y: number; width: number; height: number };

type PrintAreaRow = {
  id: string;
  name: string;
  sort_order: number;
  pixel_coordinates: unknown;
};

type VariantRow = {
  id: string;
  image_url: string | null;
  additional_images: unknown;
  sort_order: number;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  base_images: unknown;
  product_variants: VariantRow[] | null;
  print_areas: PrintAreaRow[] | null;
};

function additionalImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (
      typeof x === "object" &&
      x != null &&
      "url" in x &&
      typeof (x as { url: unknown }).url === "string"
    ) {
      out.push((x as { url: string }).url);
    }
  }
  return out;
}

/** Reihenfolge: base_images URLs, dann Varianten (sort_order) mit image_url + additional_images — dedupliziert. */
function aggregateAllImageUrls(p: ProductRow): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const t = u?.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  if (Array.isArray(p.base_images)) {
    for (const x of p.base_images) {
      if (
        typeof x === "object" &&
        x != null &&
        "url" in x &&
        typeof (x as { url: unknown }).url === "string"
      ) {
        push((x as { url: string }).url);
      }
    }
  }

  const variants = [...(p.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  for (const v of variants) {
    push(v.image_url);
    for (const u of additionalImageUrls(v.additional_images)) {
      push(u);
    }
  }
  return out;
}

function parsePixelCoordinatesPayload(raw: unknown): {
  rect: NormRect | null;
  mapped_image_url: string | null;
} {
  if (!raw || typeof raw !== "object") return { rect: null, mapped_image_url: null };
  const o = raw as Record<string, unknown>;
  const mappedRaw = o.mapped_image_url;
  const mappedStr =
    typeof mappedRaw === "string" && mappedRaw.trim() ? mappedRaw.trim() : null;
  const n = (k: string) => {
    const v = o[k];
    const num = typeof v === "number" ? v : Number(v);
    return Number.isFinite(num) ? num : NaN;
  };
  if (["x", "y", "width", "height"].some((k) => Number.isNaN(n(k)))) {
    return { rect: null, mapped_image_url: mappedStr };
  }
  return {
    rect: {
      x: n("x"),
      y: n("y"),
      width: n("width"),
      height: n("height"),
    },
    mapped_image_url: mappedStr,
  };
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function rectFromPoints(ax: number, ay: number, bx: number, by: number): NormRect {
  let x = Math.min(ax, bx);
  let y = Math.min(ay, by);
  let width = Math.abs(bx - ax);
  let height = Math.abs(by - ay);
  x = clamp01(x);
  y = clamp01(y);
  width = Math.min(width, 1 - x);
  height = Math.min(height, 1 - y);
  return {
    x,
    y,
    width: Math.max(width, 0.002),
    height: Math.max(height, 0.002),
  };
}

function normFromClient(
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
): { nx: number; ny: number } {
  const r = wrap.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { nx: 0, ny: 0 };
  return {
    nx: clamp01((clientX - r.left) / r.width),
    ny: clamp01((clientY - r.top) / r.height),
  };
}

export default function AdminPrintMapperPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [productId, setProductId] = useState<string>("");
  const [printAreaId, setPrintAreaId] = useState<string>("");
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [normRect, setNormRect] = useState<NormRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ nx: number; ny: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ nx: number; ny: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        base_images,
        product_variants (
          id,
          image_url,
          additional_images,
          sort_order
        ),
        print_areas (
          id,
          name,
          sort_order,
          pixel_coordinates
        )
      `,
      )
      .order("name");
    if (error) {
      setLoadError(error.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as unknown as ProductRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const allImageUrls = useMemo(
    () => (selectedProduct ? aggregateAllImageUrls(selectedProduct) : []),
    [selectedProduct],
  );

  const printAreasSorted = useMemo(() => {
    const list = selectedProduct?.print_areas ?? [];
    return [...list].sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedProduct]);

  useEffect(() => {
    const p = products.find((x) => x.id === productId) ?? null;
    if (!p) {
      setActiveImageUrl(null);
      setNormRect(null);
      return;
    }
    const urls = aggregateAllImageUrls(p);
    if (!urls.length) {
      setActiveImageUrl(null);
      setNormRect(null);
      return;
    }

    if (!printAreaId) {
      setActiveImageUrl((prev) => (prev && urls.includes(prev) ? prev : urls[0]));
      setNormRect(null);
      return;
    }

    const area = p.print_areas?.find((a) => a.id === printAreaId);
    const { rect, mapped_image_url: mapped } = parsePixelCoordinatesPayload(area?.pixel_coordinates);
    const chosenUrl = mapped && urls.includes(mapped) ? mapped : urls[0];
    setActiveImageUrl(chosenUrl);
    if (rect && (!mapped || (urls.includes(mapped) && chosenUrl === mapped))) {
      setNormRect(rect);
    } else {
      setNormRect(null);
    }
  }, [productId, printAreaId, products]);

  const previewRect = useMemo(() => {
    if (dragging && dragStart && dragCurrent) {
      return rectFromPoints(dragStart.nx, dragStart.ny, dragCurrent.nx, dragCurrent.ny);
    }
    return normRect;
  }, [dragging, dragStart, dragCurrent, normRect]);

  const clearDrag = useCallback(() => {
    setDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, []);

  const beginDrag = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const { nx, ny } = normFromClient(el, clientX, clientY);
    setDragging(true);
    setDragStart({ nx, ny });
    setDragCurrent({ nx, ny });
  }, []);

  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging) return;
      const el = wrapRef.current;
      if (!el) return;
      setDragCurrent(normFromClient(el, clientX, clientY));
    },
    [dragging],
  );

  const endDrag = useCallback(() => {
    if (!dragging || !dragStart || !dragCurrent) {
      clearDrag();
      return;
    }
    const next = rectFromPoints(dragStart.nx, dragStart.ny, dragCurrent.nx, dragCurrent.ny);
    clearDrag();
    if (next.width < 0.008 && next.height < 0.008) {
      toast.message("Zu kleine Auswahl – bitte größeres Rechteck ziehen.");
      return;
    }
    setNormRect(next);
  }, [dragging, dragStart, dragCurrent, clearDrag]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    beginDrag(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    moveDrag(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    endDrag();
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    beginDrag(t.clientX, t.clientY);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  };

  const onTouchEnd = () => {
    endDrag();
  };

  useEffect(() => {
    if (!dragging) return;
    const onWinMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onWinUp = () => endDrag();
    const onWinTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onWinTouchEnd = () => endDrag();
    window.addEventListener("mousemove", onWinMove);
    window.addEventListener("mouseup", onWinUp);
    window.addEventListener("touchmove", onWinTouchMove, { passive: false });
    window.addEventListener("touchend", onWinTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onWinMove);
      window.removeEventListener("mouseup", onWinUp);
      window.removeEventListener("touchmove", onWinTouchMove);
      window.removeEventListener("touchend", onWinTouchEnd);
    };
  }, [dragging, moveDrag, endDrag]);

  const pickThumbnail = useCallback((url: string) => {
    clearDrag();
    setActiveImageUrl(url);
    setNormRect(null);
  }, [clearDrag]);

  const handleSave = async () => {
    if (!printAreaId || !normRect || !activeImageUrl) {
      toast.error("Bitte Druckfläche, Bild und ein Rechteck wählen.");
      return;
    }
    setSaving(true);
    const payload = {
      x: Number(normRect.x.toFixed(4)),
      y: Number(normRect.y.toFixed(4)),
      width: Number(normRect.width.toFixed(4)),
      height: Number(normRect.height.toFixed(4)),
      mapped_image_url: activeImageUrl,
    };
    const { error } = await supabase
      .from("print_areas")
      .update({ pixel_coordinates: payload })
      .eq("id", printAreaId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Koordinaten gespeichert.");
    await refreshProducts();
  };

  const previewPayload = useMemo(() => {
    if (!normRect || !activeImageUrl) return null;
    return {
      x: Number(normRect.x.toFixed(4)),
      y: Number(normRect.y.toFixed(4)),
      width: Number(normRect.width.toFixed(4)),
      height: Number(normRect.height.toFixed(4)),
      mapped_image_url: activeImageUrl,
    };
  }, [normRect, activeImageUrl]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Printflächen-Mapper
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Wähle das passende Bild (Thumbnails), ziehe die Druckfläche. Werte werden relativ (0–1)
          gespeichert; <code className="rounded bg-muted px-1 py-0.5 text-xs">mapped_image_url</code>{" "}
          verknüpft die Box mit dem Bild im Shop.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-6 rounded-[var(--radius)] border bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="mapper-product">Produkt</Label>
            <Select
              disabled={loading}
              value={productId || undefined}
              onValueChange={(v) => {
                setProductId(v);
                setPrintAreaId("");
                setActiveImageUrl(null);
                setNormRect(null);
                clearDrag();
              }}
            >
              <SelectTrigger id="mapper-product" className="w-full">
                <SelectValue placeholder={loading ? "Laden…" : "Produkt wählen"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapper-area">Druckfläche</Label>
            <Select
              disabled={!selectedProduct || printAreasSorted.length === 0}
              value={printAreaId || undefined}
              onValueChange={setPrintAreaId}
            >
              <SelectTrigger id="mapper-area" className="w-full">
                <SelectValue placeholder="Druckfläche wählen" />
              </SelectTrigger>
              <SelectContent>
                {printAreasSorted.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={!printAreaId || !normRect || !activeImageUrl || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Speichern…" : "Speichern"}
          </Button>

          {previewPayload ? (
            <pre className="rounded-md border bg-muted/50 p-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              Noch kein Rechteck – Bild wählen und mit der Maus aufziehen.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {!activeImageUrl || !allImageUrls.length ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-[var(--radius)] border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              {selectedProduct
                ? "Keine Bild-URLs (base_images / Varianten) – bitte anderes Produkt wählen."
                : "Bitte zuerst ein Produkt wählen."}
            </div>
          ) : (
            <div
              className={cn(
                "rounded-[var(--radius)] border bg-muted/40 p-4",
                !printAreaId && "pointer-events-none opacity-60",
              )}
            >
              <p className="mb-3 text-xs text-muted-foreground">
                {!printAreaId
                  ? "Druckfläche wählen, um zu zeichnen."
                  : "Anderes Bild: Thumbnail anklicken (Rechteck wird zurückgesetzt). Dann Rechteck ziehen."}
              </p>
              <div className="flex justify-center overflow-auto">
                <div
                  ref={wrapRef}
                  className="relative inline-block max-w-full cursor-crosshair touch-none select-none"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <Image
                    key={activeImageUrl}
                    src={activeImageUrl}
                    alt={selectedProduct?.name ?? "Produkt"}
                    width={1200}
                    height={1200}
                    draggable={false}
                    className="block max-h-[min(72vh,820px)] w-auto max-w-full object-contain"
                  />
                  {previewRect ? (
                    <div
                      className="pointer-events-none absolute border-2 border-brand-600 bg-brand-500/25 shadow-sm ring-1 ring-brand-600/40"
                      style={{
                        left: `${previewRect.x * 100}%`,
                        top: `${previewRect.y * 100}%`,
                        width: `${previewRect.width * 100}%`,
                        height: `${previewRect.height * 100}%`,
                      }}
                    />
                  ) : null}
                </div>
              </div>

              {allImageUrls.length > 0 ? (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Bilder</p>
                  <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                    {allImageUrls.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => pickThumbnail(url)}
                        className={cn(
                          "relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-shadow",
                          url === activeImageUrl
                            ? "border-brand-600 ring-2 ring-brand-600/30"
                            : "border-transparent hover:border-border",
                        )}
                        title={url}
                      >
                        <Image src={url} alt="" fill className="object-cover" sizes="64px" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
