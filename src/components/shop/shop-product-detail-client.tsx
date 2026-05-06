"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Info,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { removeLogoBackground } from "@/app/actions/removeBg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePriceCalculation } from "@/hooks/use-price-calculation";
import { useCart } from "@/components/shop/cart-context";
import { scaledLogoOverlayRect } from "@/lib/colormatch/pixel-coordinates";
import { saveMoodboardPrefillToSession } from "@/lib/moodboard/prefill";
import { formatCents } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  variant_type: "color" | "size";
  variant_value: string;
  variant_code?: string | null;
  image_url: string | null;
  color_hex?: string | null;
  sort_order?: number;
  additionalImageUrls: string[];
};

type PrintTechnique = {
  id: string;
  technique_name: string;
  max_width_mm: number | null;
  max_height_mm: number | null;
  max_colors: string | null;
};

type LogoOverlayRect = { x: number; y: number; width: number; height: number };

type PrintArea = {
  id: string;
  name: string;
  mockup_image_url: string | null;
  /** pixel_coordinates dieser Druckfläche (normiert), sonst null. */
  overlayRect: LogoOverlayRect | null;
  /** Referenzbild aus dem Admin-Mapper (`mapped_image_url` im JSON), sonst null. */
  mappedImageUrl: string | null;
  techniques: PrintTechnique[];
};

const PDP_LOGO_MAX_BYTES = 10 * 1024 * 1024;

/** Stricker-Dateiname: `{id}_{farbcode}{-suffix}.jpg` (Suffix z. B. -a, -logo). */
const STRICKER_MAPPED_FILENAME =
  /^(\d+)_(\d+)(-[a-z0-9]+)?\.(jpg|jpeg|webp)$/i;

/**
 * Leitet die Mapper-Referenz-URL auf die aktuelle Farbvariante um (gleiche Perspektive/Suffix).
 * Lieferanten-Farbcode kommt aus `variant_code` (z. B. 103 → 104 für Navy).
 */
function deriveVariantMappedImageUrl(
  mappedImageUrl: string | null | undefined,
  variantCode: string | null | undefined,
): string | null {
  const mapped = mappedImageUrl?.trim();
  if (!mapped || !variantCode?.trim()) return mapped ?? null;
  const newCode = variantCode.trim();
  try {
    const url = new URL(mapped);
    const slash = url.pathname.lastIndexOf("/");
    const filename = slash >= 0 ? url.pathname.slice(slash + 1) : url.pathname;
    const m = filename.match(STRICKER_MAPPED_FILENAME);
    if (!m) return mapped;
    const strickerId = m[1];
    const suffix = m[3] ?? "";
    const ext = m[4].toLowerCase();
    const newFilename = `${strickerId}_${newCode}${suffix}.${ext}`;
    url.pathname = slash >= 0 ? `${url.pathname.slice(0, slash + 1)}${newFilename}` : `/${newFilename}`;
    return url.toString();
  } catch {
    return mapped;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(file);
  });
}

type ProductDetailData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  specifications: Record<string, unknown>;
  moq: number;
  category: { slug: string; name: string } | null;
  baseImages: string[];
  variants: Variant[];
  priceTiers: Array<{ min_quantity: number; selling_price_cents: number }>;
  printAreas: PrintArea[];
};

function pickInitialColorSelection(
  product: ProductDetailData,
  initialVariantCode: string | null | undefined,
): { variantId: string | undefined; mainImage: string } {
  const colors = [...product.variants]
    .filter((v) => v.variant_type === "color")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const code = initialVariantCode?.trim();
  const fromQuery = code ? colors.find((v) => v.variant_code === code) : undefined;
  const pick = fromQuery ?? colors[0];
  const mainImage =
    pick?.image_url?.trim() ??
    pick?.additionalImageUrls?.find(Boolean) ??
    product.baseImages.find(Boolean) ??
    "";
  return { variantId: pick?.id, mainImage };
}

function PdpLogoOverlayImg({
  dataUrl,
  rect,
}: {
  dataUrl: string;
  rect: LogoOverlayRect;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL overlay */}
      <img
        src={dataUrl}
        alt=""
        className="pointer-events-none absolute z-[1] object-contain opacity-95 drop-shadow-sm"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
        }}
      />
    </>
  );
}

export function ShopProductDetailClient({
  product,
  deliveryText,
  isLoggedIn,
  initialVariantCode,
}: {
  product: ProductDetailData;
  deliveryText: string;
  /** Wenn false: kein Warenkorb-CTA; stattdessen Login-Hinweis. */
  isLoggedIn: boolean;
  /** Lieferanten-Farbcode aus URL (?color=), z. B. von ColorMatch. */
  initialVariantCode?: string | null;
}) {
  const { count: cartCount, addItem } = useCart();
  const colorVariants = useMemo(
    () =>
      [...product.variants]
        .filter((v) => v.variant_type === "color")
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [product.variants],
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(() =>
    pickInitialColorSelection(product, initialVariantCode).variantId,
  );
  const [quantityDraft, setQuantityDraft] = useState(String(product.moq));
  const quantity = Math.max(1, Number.parseInt(quantityDraft || "1", 10) || 1);

  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>(
    product.printAreas[0]?.id,
  );
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | undefined>(
    product.printAreas[0]?.techniques[0]?.id,
  );
  const [withoutPrint, setWithoutPrint] = useState(
    !product.printAreas.some((area) => area.techniques.length > 0),
  );
  const selectedArea = product.printAreas.find((a) => a.id === selectedAreaId);

  const selectedTechnique = selectedArea?.techniques.find(
    (t) => t.id === selectedTechniqueId,
  );

  const router = useRouter();
  const [pdpLogoStripBackground, setPdpLogoStripBackground] = useState(true);

  const activeLogoOverlayRect = useMemo(() => {
    if (withoutPrint) return null;
    const r = selectedArea?.overlayRect ?? null;
    if (!r) return null;
    return scaledLogoOverlayRect(r);
  }, [withoutPrint, selectedArea?.overlayRect]);

  const [printColors, setPrintColors] = useState<number>(1);
  const [uploadedLogoDataUrl, setUploadedLogoDataUrl] = useState<string | null>(null);
  const [logoUploadBusy, setLogoUploadBusy] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  /** Alle Bilder aller Farbvarianten, danach gemeinsame Basisbilder. Parallel: welche Variante „gehört“ zum Bild (null = gemeinsames Marketingbild). */
  const { galleryUrls, ownerVariantIds } = useMemo(() => {
    const urls: string[] = [];
    const owners: (string | null)[] = [];
    const seen = new Set<string>();
    for (const v of colorVariants) {
      const main = v.image_url?.trim();
      if (main && !seen.has(main)) {
        seen.add(main);
        urls.push(main);
        owners.push(v.id);
      }
      for (const u of v.additionalImageUrls ?? []) {
        const t = u?.trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        urls.push(t);
        owners.push(v.id);
      }
    }
    for (const u of product.baseImages) {
      const t = u?.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      urls.push(t);
      owners.push(null);
    }
    return { galleryUrls: urls, ownerVariantIds: owners };
  }, [colorVariants, product.baseImages]);

  const [mainImage, setMainImage] = useState<string>(() =>
    pickInitialColorSelection(product, initialVariantCode).mainImage,
  );

  /** Index in `galleryUrls`, oder -1 wenn `mainImage` ein externes Referenzbild (Mapper) ist. */
  const slideIndexInGallery = useMemo(() => galleryUrls.indexOf(mainImage), [galleryUrls, mainImage]);

  const heroFallbackUrl = useMemo(() => {
    const v = colorVariants.find((x) => x.id === selectedVariantId);
    return (
      v?.image_url?.trim() ??
      v?.additionalImageUrls?.find(Boolean) ??
      product.baseImages.find(Boolean) ??
      ""
    );
  }, [colorVariants, selectedVariantId, product.baseImages]);

  /** Angezeigte Hero-/Lightbox-URL (nach 404-Fallback auf Varianten-Hauptbild). */
  const [heroDisplaySrc, setHeroDisplaySrc] = useState(mainImage);
  useEffect(() => {
    setHeroDisplaySrc(mainImage);
  }, [mainImage]);

  const applyPrintArea = useCallback(
    (area: PrintArea) => {
      setSelectedAreaId(area.id);
      setSelectedTechniqueId(area.techniques[0]?.id);
      setWithoutPrint(false);
      if (!area.mappedImageUrl) return;
      const v = colorVariants.find((x) => x.id === selectedVariantId);
      const url = deriveVariantMappedImageUrl(area.mappedImageUrl, v?.variant_code ?? null);
      if (url) setMainImage(url);
    },
    [colorVariants, selectedVariantId],
  );

  const goToIndex = useCallback(
    (idx: number) => {
      if (!galleryUrls.length) return;
      const n = galleryUrls.length;
      const i = ((idx % n) + n) % n;
      const url = galleryUrls[i];
      if (!url) return;
      setMainImage(url);
      const owner = ownerVariantIds[i];
      if (owner) setSelectedVariantId(owner);
    },
    [galleryUrls, ownerVariantIds],
  );

  const goNext = useCallback(() => {
    if (galleryUrls.length < 2) return;
    const i = galleryUrls.indexOf(mainImage);
    const from = i >= 0 ? i : 0;
    goToIndex(from + 1);
  }, [galleryUrls, mainImage, goToIndex]);

  const goPrev = useCallback(() => {
    if (galleryUrls.length < 2) return;
    const i = galleryUrls.indexOf(mainImage);
    const from = i >= 0 ? i : 0;
    goToIndex(from - 1);
  }, [galleryUrls, mainImage, goToIndex]);

  const selectColorVariant = useCallback(
    (variantId: string) => {
      setSelectedVariantId(variantId);
      const v = colorVariants.find((x) => x.id === variantId);
      const area = product.printAreas.find((a) => a.id === selectedAreaId);
      if (!withoutPrint && area?.mappedImageUrl && v?.variant_code?.trim()) {
        const derived = deriveVariantMappedImageUrl(area.mappedImageUrl, v.variant_code);
        if (derived) {
          setMainImage(derived);
          return;
        }
      }
      const next =
        v?.image_url?.trim() ??
        v?.additionalImageUrls?.find(Boolean) ??
        product.baseImages.find(Boolean) ??
        "";
      if (next) setMainImage(next);
    },
    [withoutPrint, selectedAreaId, product.printAreas, colorVariants, product.baseImages],
  );

  const handleGalleryKeyNav = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (galleryUrls.length < 2) return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest(
          "input, textarea, [contenteditable], [data-slot='select-content']",
        )
      )
        return;
      e.preventDefault();
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    },
    [galleryUrls.length, goPrev, goNext],
  );

  const swipeStartX = useRef<number | null>(null);
  const onGalleryTouchStart = useCallback((e: TouchEvent) => {
    swipeStartX.current = e.changedTouches[0]?.clientX ?? null;
  }, []);
  const onGalleryTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (galleryUrls.length < 2 || swipeStartX.current == null) return;
      const endX = e.changedTouches[0]?.clientX ?? swipeStartX.current;
      const dx = endX - swipeStartX.current;
      swipeStartX.current = null;
      if (dx > 56) goPrev();
      else if (dx < -56) goNext();
    },
    [galleryUrls.length, goPrev, goNext],
  );

  const priceQuery = usePriceCalculation({
    productId: product.id,
    variantId: selectedVariantId,
    quantity,
    printTechniqueId: withoutPrint ? undefined : selectedTechniqueId,
    printColors:
      withoutPrint || !selectedTechniqueId
        ? undefined
        : selectedTechnique?.max_colors === "1"
          ? 1
          : printColors,
  });

  const pricing = priceQuery.data;
  const isMoqSatisfied = pricing?.isMoqSatisfied ?? quantity >= product.moq;

  const processLogoFile = useCallback(
    async (file: File) => {
      if (!activeLogoOverlayRect || withoutPrint) return;
      if (file.size > PDP_LOGO_MAX_BYTES) {
        toast.error("Datei zu groß (max. 10 MB).");
        return;
      }
      setLogoUploadBusy(true);
      try {
        let dataUrl: string;
        if (pdpLogoStripBackground) {
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
        setUploadedLogoDataUrl(dataUrl);
        toast.success(
          pdpLogoStripBackground ? "Logo freigestellt — Vorschau aktiv." : "Logo geladen — Vorschau aktiv.",
        );
      } catch (e) {
        console.error(e);
        toast.error("Logo konnte nicht verarbeitet werden.");
      } finally {
        setLogoUploadBusy(false);
        if (logoFileInputRef.current) logoFileInputRef.current.value = "";
      }
    },
    [activeLogoOverlayRect, pdpLogoStripBackground, withoutPrint],
  );

  const onLogoFileSelected = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      await processLogoFile(file);
    },
    [processLogoFile],
  );

  const openMoodboardPrefill = useCallback(() => {
    if (!uploadedLogoDataUrl) return;
    const variant = colorVariants.find((v) => v.id === selectedVariantId);
    const area = selectedArea;
    let mapped: string | undefined;
    if (area?.mappedImageUrl) {
      const derived = deriveVariantMappedImageUrl(area.mappedImageUrl, variant?.variant_code ?? null);
      mapped = (derived ?? area.mappedImageUrl).trim() || undefined;
    }
    try {
      saveMoodboardPrefillToSession({
        productSlug: product.slug,
        variantCode: variant?.variant_code?.trim() || undefined,
        printAreaName: area?.name?.trim() || undefined,
        logoDataUrl: uploadedLogoDataUrl,
        mappedImageUrl: mapped,
      });
    } catch {
      toast.error("Daten konnten nicht übernommen werden.");
      return;
    }
    const q = new URLSearchParams({ product: product.slug });
    const code = variant?.variant_code?.trim();
    if (code) q.set("variant", code);
    router.push(`/moodboard?${q.toString()}`);
  }, [
    uploadedLogoDataUrl,
    colorVariants,
    selectedVariantId,
    selectedArea,
    product.slug,
    router,
  ]);

  const onAddToCart = async () => {
    if (!pricing || !isMoqSatisfied) return;
    const variant = colorVariants.find((v) => v.id === selectedVariantId);
    await addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      quantity,
      variantId: selectedVariantId,
      variantLabel: variant?.variant_value,
      printTechniqueId: withoutPrint ? undefined : selectedTechniqueId,
      printTechniqueName: withoutPrint ? undefined : selectedTechnique?.technique_name,
      printColors:
        withoutPrint || !selectedTechniqueId
          ? undefined
          : selectedTechnique?.max_colors === "1"
            ? 1
            : printColors,
    });
    toast.success("Zum Warenkorb hinzugefügt");
  };

  const specEntries = Object.entries(product.specifications ?? {});

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b pb-3">
        <Link href="/shop" className="text-sm text-muted-foreground hover:text-foreground">
          Zur Shop-Übersicht
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href="/warenkorb" className="relative gap-2">
            <ShoppingCart className="size-4" />
            Warenkorb
            {cartCount > 0 ? (
              <Badge className="ml-1 rounded-full px-1.5 text-[10px] tabular-nums">
                {cartCount > 99 ? "99+" : cartCount}
              </Badge>
            ) : null}
          </Link>
        </Button>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div
          className="space-y-3 lg:sticky lg:top-24 lg:self-start outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-[var(--radius)]"
          data-product-gallery
          tabIndex={0}
          role="region"
          aria-label="Produktbilder"
          onKeyDown={handleGalleryKeyNav}
        >
          <Dialog>
            <div
              className="group/hero relative aspect-square w-full overflow-hidden rounded-[var(--radius)] border bg-muted shadow-[var(--shadow-default)]"
              onTouchStart={onGalleryTouchStart}
              onTouchEnd={onGalleryTouchEnd}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="absolute inset-0 z-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`${product.name} – Bild vergrößern`}
                >
                  {mainImage ? (
                    <motion.div
                      key={mainImage}
                      initial={{ opacity: 0.45 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="relative size-full"
                    >
                      <Image
                        src={heroDisplaySrc}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        onError={() => {
                          if (heroFallbackUrl && heroDisplaySrc !== heroFallbackUrl) {
                            setHeroDisplaySrc(heroFallbackUrl);
                          }
                        }}
                      />
                      {uploadedLogoDataUrl && activeLogoOverlayRect ? (
                        <PdpLogoOverlayImg
                          dataUrl={uploadedLogoDataUrl}
                          rect={activeLogoOverlayRect}
                        />
                      ) : null}
                    </motion.div>
                  ) : null}
                </button>
              </DialogTrigger>
              {galleryUrls.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-border/60 bg-background/85 opacity-100 shadow-md backdrop-blur-sm transition-opacity duration-200 hover:bg-background sm:opacity-0 sm:group-hover/hero:opacity-100 sm:group-focus-within/hero:opacity-100"
                    aria-label="Vorheriges Bild"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      goPrev();
                    }}
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-border/60 bg-background/85 opacity-100 shadow-md backdrop-blur-sm transition-opacity duration-200 hover:bg-background sm:opacity-0 sm:group-hover/hero:opacity-100 sm:group-focus-within/hero:opacity-100"
                    aria-label="Nächstes Bild"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      goNext();
                    }}
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                  <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-medium text-white opacity-100 shadow-sm backdrop-blur-md transition-opacity duration-200 tabular-nums sm:opacity-0 sm:group-hover/hero:opacity-100 sm:group-focus-within/hero:opacity-100">
                    {slideIndexInGallery >= 0
                      ? `${slideIndexInGallery + 1} / ${galleryUrls.length}`
                      : "Referenzbild"}
                  </div>
                </>
              ) : null}
            </div>
            <DialogContent
              className="max-w-4xl gap-0 border-0 bg-transparent p-3 shadow-none sm:max-w-4xl"
              onKeyDown={handleGalleryKeyNav}
            >
              <DialogTitle className="sr-only">
                Produktbild: {product.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Pfeiltasten wechseln die Ansicht. Escape schließt die Vorschau.
              </DialogDescription>
              <div className="group/lightbox relative overflow-hidden rounded-xl border border-white/10 bg-black/90 p-2 shadow-2xl ring-1 ring-white/10">
                <div className="relative aspect-square w-full min-h-[min(80vh,720px)] bg-muted/20">
                  {mainImage ? (
                    <motion.div
                      key={`lightbox-${mainImage}`}
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="relative size-full"
                    >
                      <Image
                        src={heroDisplaySrc}
                        alt={product.name}
                        fill
                        className="object-contain"
                        sizes="(min-width: 1024px) 896px, 95vw"
                        onError={() => {
                          if (heroFallbackUrl && heroDisplaySrc !== heroFallbackUrl) {
                            setHeroDisplaySrc(heroFallbackUrl);
                          }
                        }}
                      />
                      {uploadedLogoDataUrl && activeLogoOverlayRect ? (
                        <PdpLogoOverlayImg
                          dataUrl={uploadedLogoDataUrl}
                          rect={activeLogoOverlayRect}
                        />
                      ) : null}
                    </motion.div>
                  ) : null}
                  {galleryUrls.length > 1 ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-0 bg-white/90 text-foreground opacity-100 shadow-lg transition-opacity duration-200 hover:bg-white sm:opacity-0 sm:group-hover/lightbox:opacity-100 sm:group-focus-within/lightbox:opacity-100"
                        aria-label="Vorheriges Bild"
                        onClick={goPrev}
                      >
                        <ChevronLeft className="size-6" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute top-1/2 right-12 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-0 bg-white/90 text-foreground opacity-100 shadow-lg transition-opacity duration-200 hover:bg-white sm:opacity-0 sm:group-hover/lightbox:opacity-100 sm:group-focus-within/lightbox:opacity-100"
                        aria-label="Nächstes Bild"
                        onClick={goNext}
                      >
                        <ChevronRight className="size-6" />
                      </Button>
                      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white opacity-100 backdrop-blur-sm transition-opacity duration-200 tabular-nums sm:opacity-0 sm:group-hover/lightbox:opacity-100 sm:group-focus-within/lightbox:opacity-100">
                        {slideIndexInGallery >= 0
                          ? `${slideIndexInGallery + 1} / ${galleryUrls.length}`
                          : "Referenzbild"}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {galleryUrls.length > 1 ? (
            <div
              className="flex flex-wrap items-center justify-center gap-2 px-0.5"
              role="tablist"
              aria-label="Bildauswahl"
            >
              {galleryUrls.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === slideIndexInGallery}
                  aria-label={`Bild ${i + 1} von ${galleryUrls.length}`}
                  onClick={() => goToIndex(i)}
                  className={cn(
                    "size-2.5 shrink-0 rounded-full transition-all duration-200",
                    i === slideIndexInGallery
                      ? "scale-125 bg-brand-600 ring-2 ring-brand-600/30"
                      : "bg-muted-foreground/35 hover:bg-muted-foreground/60",
                  )}
                />
              ))}
            </div>
          ) : null}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {galleryUrls.map((img, i) => (
              <button
                key={`${img}-thumb-${i}`}
                type="button"
                onClick={() => goToIndex(i)}
                className={cn(
                  "relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted",
                  mainImage === img && "border-brand-600 ring-2 ring-brand-600/30",
                )}
              >
                <Image src={img} alt="" fill className="object-cover" sizes="80px" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            <Link href="/">Home</Link>{" "}
            {product.category ? (
              <>
                <span>→</span>{" "}
                <Link href={`/shop?cat=${product.category.slug}`}>{product.category.name}</Link>{" "}
              </>
            ) : null}
            <span>→</span> <span className="text-foreground">{product.name}</span>
          </div>

          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight lg:text-4xl">
              {product.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {product.short_description ?? product.description ?? ""}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Farbauswahl</p>
            <div className="flex flex-wrap gap-2">
              {colorVariants.map((variant) => {
                const hex = variant.color_hex?.trim();
                const showSwatch = Boolean(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex));
                return (
                  <button
                    key={variant.id}
                    type="button"
                    title={variant.variant_value}
                    onClick={() => selectColorVariant(variant.id)}
                    className={cn(
                      "flex min-h-11 min-w-11 items-center gap-2 rounded-full border px-2 py-1 text-sm transition-colors",
                      selectedVariantId === variant.id
                        ? "border-brand-600 ring-2 ring-brand-600/30"
                        : "border-border bg-muted hover:bg-muted/80",
                    )}
                  >
                    {showSwatch ? (
                      <span
                        className="size-7 shrink-0 rounded-full border border-black/10 shadow-inner"
                        style={{ backgroundColor: hex }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="max-w-[10rem] truncate">{variant.variant_value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Menge</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setQuantityDraft(String(Math.max(1, quantity - 1)))}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                value={quantityDraft}
                onChange={(e) => setQuantityDraft(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => setQuantityDraft(String(Math.max(1, quantity)))}
                className="h-12 max-w-40 font-mono text-2xl"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setQuantityDraft(String(quantity + 1))}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {!isMoqSatisfied ? (
              <div className="rounded-md bg-accent-200 px-3 py-2 text-sm text-brand-900">
                Mindestmenge {product.moq} Stk – unterhalb nicht bestellbar
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-[var(--radius)] border p-4">
            <p className="text-sm font-semibold">Staffelpreise</p>
            <div className="space-y-1">
              {(pricing?.tiers ?? []).slice(0, 5).map((tier, i, arr) => {
                const previous = arr[i - 1];
                const diff = previous ? previous.unitNetCents - tier.unitNetCents : 0;
                return (
                  <Tooltip key={tier.minQuantity}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between rounded px-2 py-1 text-sm",
                          tier.active && "bg-accent-200",
                        )}
                      >
                        <span>ab {tier.minQuantity} Stk</span>
                        <span className="font-mono">{formatCents(tier.unitNetCents)}/Stk</span>
                      </div>
                    </TooltipTrigger>
                    {!tier.active && previous && diff > 0 ? (
                      <TooltipContent sideOffset={8}>
                        Spart {formatCents(diff)}/Stk ggü. vorheriger Staffel
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-[var(--radius)] border p-4">
            <p className="text-sm font-semibold">Veredelung</p>
            <button
              type="button"
              onClick={() => {
                setWithoutPrint((prev) => {
                  const next = !prev;
                  if (next) {
                    setUploadedLogoDataUrl(null);
                    const v = colorVariants.find((x) => x.id === selectedVariantId);
                    const img =
                      v?.image_url?.trim() ??
                      v?.additionalImageUrls?.find(Boolean) ??
                      product.baseImages.find(Boolean) ??
                      "";
                    if (img) setMainImage(img);
                  }
                  return next;
                });
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
                withoutPrint
                  ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/30"
                  : "bg-muted/40 hover:bg-muted/70",
              )}
            >
              <CircleOff className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Ohne Druck bestellen</p>
                <p className="text-xs text-muted-foreground">
                  Produkt ohne Veredelung in den Warenkorb legen
                </p>
              </div>
            </button>
            <div>
              <p className="mb-2 text-xs uppercase text-muted-foreground">Druckfläche</p>
              <div
                className={cn(
                  "flex gap-2 overflow-x-auto",
                  withoutPrint && "pointer-events-none opacity-50",
                )}
              >
                {product.printAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => applyPrintArea(area)}
                    className={cn(
                      "min-w-44 rounded-md border p-2 text-left",
                      selectedAreaId === area.id && "border-brand-600 ring-2 ring-brand-600/30",
                    )}
                  >
                    <p className="text-sm font-medium">{area.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {area.techniques.length} Technik(en)
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {!withoutPrint && selectedArea ? (
              <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                <Label className="text-sm font-medium">
                  Logo auf „{selectedArea.name}“ platzieren
                </Label>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Hintergrund</span>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1.5 font-medium transition-colors",
                      pdpLogoStripBackground
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setPdpLogoStripBackground(true)}
                  >
                    Ohne Hintergrund
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1.5 font-medium transition-colors",
                      !pdpLogoStripBackground
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setPdpLogoStripBackground(false)}
                  >
                    Mit Hintergrund
                  </button>
                </div>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="sr-only"
                  onChange={(e) => void onLogoFileSelected(e.target.files)}
                />
                <button
                  type="button"
                  disabled={logoUploadBusy || !selectedArea.overlayRect}
                  onClick={() => logoFileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void processLogoFile(f);
                  }}
                  className={cn(
                    "flex h-[120px] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "border-muted-foreground/30 bg-muted/30",
                    selectedArea.overlayRect &&
                      !logoUploadBusy &&
                      "hover:border-muted-foreground/50 hover:bg-muted/40",
                    (!selectedArea.overlayRect || logoUploadBusy) && "cursor-not-allowed opacity-60",
                  )}
                >
                  {logoUploadBusy ? (
                    <Loader2 className="size-7 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                  ) : (
                    <Upload className="size-7 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="text-xs text-muted-foreground">
                    Klicken oder Datei hierher ziehen · PNG, JPEG, WebP · max. 10 MB
                  </span>
                </button>
                {!selectedArea.overlayRect ? (
                  <p className="text-xs text-muted-foreground">
                    Für diese Druckfläche liegt noch kein Mapping vor — Vorschau nicht möglich.
                  </p>
                ) : null}
                {uploadedLogoDataUrl && activeLogoOverlayRect ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      onClick={() => setUploadedLogoDataUrl(null)}
                    >
                      Logo entfernen
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => openMoodboardPrefill()}
                    >
                      <Sparkles className="size-3.5" aria-hidden />
                      Präsentationsbild erstellen
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Technik</p>
                <Select
                  value={selectedTechniqueId}
                  onValueChange={(value) => {
                    setSelectedTechniqueId(value);
                    setWithoutPrint(false);
                  }}
                  disabled={withoutPrint}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Technik wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedArea?.techniques ?? []).map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.technique_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Farben-Anzahl</p>
                <Select
                  value={String(printColors)}
                  onValueChange={(value) => setPrintColors(Number(value))}
                  disabled={
                    withoutPrint || !selectedTechnique || selectedTechnique.max_colors === "1"
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: Math.max(1, Number(selectedTechnique?.max_colors || 4)) },
                      (_, idx) => idx + 1,
                    ).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} Farbe(n)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {withoutPrint ? (
              <div className="flex items-start gap-2 rounded-md bg-accent-50 p-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-[14px] shrink-0" />
                <span>Veredelung deaktiviert – Produkt wird roh bestellt.</span>
              </div>
            ) : null}
          </div>

          <motion.div
            key={pricing?.totalGrossCents ?? 0}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="sticky bottom-2 rounded-[var(--radius)] border bg-surface p-4 shadow-[var(--shadow-raised)]"
          >
            {pricing ? (
              <>
                <p className="text-sm text-muted-foreground">Menge</p>
                <p className="font-mono text-2xl font-semibold">{pricing.quantity} Stk</p>
                <div className="mt-3 space-y-1 font-mono text-sm">
                  <div className="flex justify-between">
                    <span>Produkt netto:</span>
                    <span>{formatCents(pricing.productUnitNetCents)}/Stk</span>
                  </div>
                  {pricing.printSetupNetCents > 0 || pricing.printUnitNetCents > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <span>Veredelung Setup:</span>
                        <span>{formatCents(pricing.printSetupNetCents)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Veredelung netto:</span>
                        <span>{formatCents(pricing.printUnitNetCents)}/Stk</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between">
                    <span>Zwischensumme netto:</span>
                    <span>{formatCents(pricing.subtotalNetCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MwSt 19%:</span>
                    <span>{formatCents(pricing.vatCents)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-xl font-bold">
                    <span>GESAMT brutto:</span>
                    <span>{formatCents(pricing.totalGrossCents)}</span>
                  </div>
                </div>
                {isLoggedIn ? (
                  <Button
                    type="button"
                    variant="accent"
                    className="mt-4 h-12 w-full"
                    onClick={onAddToCart}
                    disabled={!isMoqSatisfied}
                  >
                    In den Warenkorb
                  </Button>
                ) : (
                  <Button type="button" variant="default" className="mt-4 h-12 w-full" asChild>
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/shop/${product.slug}`)}`}
                    >
                      Anmelden zum Bestellen
                    </Link>
                  </Button>
                )}
                {!isMoqSatisfied ? (
                  <p className="mt-2 text-sm">
                    <Link className="underline" href="mailto:info@werbenest.de">
                      Angebot per E-Mail anfragen
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="space-y-2">
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-muted" />
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <section>
        <Tabs defaultValue="beschreibung">
          <TabsList variant="line">
            <TabsTrigger value="beschreibung">Beschreibung</TabsTrigger>
            <TabsTrigger value="tech">Technische Daten</TabsTrigger>
            <TabsTrigger value="veredelung">Veredelungsmöglichkeiten</TabsTrigger>
            <TabsTrigger value="lieferung">Lieferung</TabsTrigger>
          </TabsList>
          <TabsContent value="beschreibung" className="rounded-[var(--radius)] border p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {product.description ?? "Keine Beschreibung vorhanden."}
            </p>
          </TabsContent>
          <TabsContent value="tech" className="rounded-[var(--radius)] border p-4">
            <dl className="grid gap-2 sm:grid-cols-2">
              {specEntries.map(([k, v]) => (
                <div key={k} className="rounded bg-muted/50 px-3 py-2">
                  <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                  <dd className="text-sm">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
          <TabsContent value="veredelung" className="grid gap-3 sm:grid-cols-2">
            {product.printAreas.map((area) => (
              <div key={area.id} className="rounded-[var(--radius)] border p-4">
                <p className="font-medium">{area.name}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {area.techniques.map((tech) => (
                    <li key={tech.id}>
                      {tech.technique_name}
                      {(tech.max_width_mm || tech.max_height_mm) &&
                      ` (${tech.max_width_mm ?? "?"}x${tech.max_height_mm ?? "?"} mm)`}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="lieferung" className="rounded-[var(--radius)] border p-4">
            <p className="text-sm text-muted-foreground">{deliveryText}</p>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
