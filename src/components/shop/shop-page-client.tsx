"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter } from "lucide-react";
import { ShopTopbar } from "@/components/shop/shop-topbar";
import { ShopFilterPanel } from "@/components/shop/shop-filter-panel";
import { ShopProductCard } from "@/components/shop/shop-product-card";
import { ShopPagination } from "@/components/shop/shop-pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useShopCatalogData } from "@/hooks/use-shop-catalog-data";
import { useShopUrlState } from "@/hooks/use-shop-url-state";
import { useCart } from "@/components/shop/cart-context";
import type { CategoryRow } from "@/lib/shop/fetch-shop-catalog";
import {
  filterAndSortProducts,
  priceBounds,
  suppliersPresent,
  uniqueColorFilterOptions,
  uniqueTechniqueNames,
} from "@/lib/shop/filter-catalog";
import type { ShopSort } from "@/lib/shop/shop-url";

const PER_PAGE = 12;

function ShopGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius)] border bg-surface shadow-[var(--shadow-raised)]"
        >
          <Skeleton className="aspect-square w-full rounded-none bg-muted" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-[85%] bg-muted" />
            <Skeleton className="h-3 w-1/3 bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  categories: CategoryRow[];
  email: string | null;
};

export function ShopPageClient({ categories, email }: Props) {
  const { count: cartCount } = useCart();
  const { data, isLoading, isError, error } = useShopCatalogData();
  const rawProducts = useMemo(() => data?.products ?? [], [data]);

  const boundsReady = useMemo(() => {
    if (!rawProducts.length) return null;
    return priceBounds(rawProducts);
  }, [rawProducts]);

  const url = useShopUrlState(boundsReady);
  const { state, setSort, setPage, setNavCategory, setPriceRangeCents, setColors } =
    url;

  const filtered = useMemo(
    () => filterAndSortProducts(rawProducts, state, categories),
    [rawProducts, state, categories],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  useEffect(() => {
    if (state.page > totalPages) {
      setPage(totalPages);
    }
  }, [state.page, totalPages, setPage]);

  const pageSafe = Math.min(Math.max(1, state.page), totalPages);
  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, pageSafe]);

  const colorOptions = useMemo(
    () => uniqueColorFilterOptions(rawProducts),
    [rawProducts],
  );

  useEffect(() => {
    if (isLoading || isError) return;
    if (!colorOptions.length) {
      if (state.colorValues.length && rawProducts.length) setColors([]);
      return;
    }
    const valid = new Set(colorOptions.map((c) => c.label.toLowerCase()));
    const next = state.colorValues.filter((c) => valid.has(c.toLowerCase()));
    if (next.length !== state.colorValues.length) setColors(next);
  }, [
    isLoading,
    isError,
    rawProducts.length,
    colorOptions,
    state.colorValues,
    setColors,
  ]);
  const techniques = useMemo(
    () => uniqueTechniqueNames(rawProducts),
    [rawProducts],
  );
  const suppliers = useMemo(
    () => suppliersPresent(rawProducts),
    [rawProducts],
  );

  const filterAnimKey = useMemo(
    () =>
      [
        state.categorySlugs.join("|"),
        state.colorValues.join("|"),
        state.techNames.join("|"),
        state.supplierCodes.join("|"),
        state.moqCap ?? "",
        state.priceMinCents ?? "",
        state.priceMaxCents ?? "",
        state.q,
        state.sort,
      ].join("::"),
    [
      state.categorySlugs,
      state.colorValues,
      state.techNames,
      state.supplierCodes,
      state.moqCap,
      state.priceMinCents,
      state.priceMaxCents,
      state.q,
      state.sort,
    ],
  );

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <main className="min-h-screen bg-background">
      <ShopTopbar
        categories={categories}
        searchQuery={state.q}
        onSearchQueryChange={(q) => url.setQuery(q)}
        activeCategorySlugs={state.categorySlugs}
        onNavCategory={setNavCategory}
        email={email}
        cartCount={cartCount}
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Shop
          </h1>
          <p className="text-sm text-muted-foreground">
            Filtern Sie nach Kategorie, Farbe, Preis und Veredelung — alle Filter
            sind in der URL gespeichert.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <aside className="hidden w-full shrink-0 lg:sticky lg:top-24 lg:block lg:w-72">
            <div className="rounded-[var(--radius)] border bg-surface p-5 shadow-[var(--shadow-default)]">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Filter
              </h2>
              <ShopFilterPanel
                categories={categories}
                colorOptions={colorOptions}
                techniques={techniques}
                suppliers={suppliers}
                priceBounds={boundsReady}
                state={state}
                toggleCategorySlug={url.toggleCategorySlug}
                toggleColor={url.toggleColor}
                toggleTech={url.toggleTech}
                toggleSupplier={url.toggleSupplier}
                setMoqCap={url.setMoqCap}
                setPriceRangeCents={setPriceRangeCents}
                disabled={isLoading}
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit lg:hidden"
                  >
                    <Filter className="size-4" />
                    Filter
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-md">
                  <SheetHeader>
                    <SheetTitle>Filter</SheetTitle>
                  </SheetHeader>
                  <ShopFilterPanel
                    categories={categories}
                    colorOptions={colorOptions}
                    techniques={techniques}
                    suppliers={suppliers}
                    priceBounds={boundsReady}
                    state={state}
                    toggleCategorySlug={url.toggleCategorySlug}
                    toggleColor={url.toggleColor}
                    toggleTech={url.toggleTech}
                    toggleSupplier={url.toggleSupplier}
                    setMoqCap={url.setMoqCap}
                    setPriceRangeCents={setPriceRangeCents}
                    disabled={isLoading}
                  />
                </SheetContent>
              </Sheet>

              <div className="flex flex-col items-stretch gap-3 sm:ml-auto sm:items-end">
                <p className="text-sm text-muted-foreground sm:text-right">
                  <span className="font-medium text-foreground">
                    {filtered.length}
                  </span>{" "}
                  Produkte gefunden
                </p>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Sortierung
                  </span>
                  <Select
                    disabled={isLoading}
                    value={state.sort}
                    onValueChange={(v) => setSort(v as ShopSort)}
                  >
                    <SelectTrigger className="w-full min-w-[200px] sm:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity">Beliebtheit</SelectItem>
                      <SelectItem value="price_asc">Preis aufsteigend</SelectItem>
                      <SelectItem value="price_desc">Preis absteigend</SelectItem>
                      <SelectItem value="name">Name A–Z</SelectItem>
                      <SelectItem value="new">Neu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {isError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error instanceof Error ? error.message : "Laden fehlgeschlagen."}
              </p>
            ) : isLoading ? (
              <ShopGridSkeleton />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={filterAnimKey}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.35 }}
                  transition={{ duration: 0.22 }}
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {pageSlice.length ? (
                    pageSlice.map((p) => (
                      <ShopProductCard key={p.id} product={p} />
                    ))
                  ) : (
                    <div className="col-span-full rounded-[var(--radius)] border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
                      Keine Produkte für diese Filter. Passen Sie die Auswahl an.
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            <ShopPagination
              page={pageSafe}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
