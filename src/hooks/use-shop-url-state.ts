"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseShopSearchParams,
  shopUrlStateToSearchParams,
  type ShopSort,
  type ShopUrlState,
} from "@/lib/shop/shop-url";

type PriceBounds = { min: number; max: number };

export function useShopUrlState(priceBounds?: PriceBounds | null) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo(
    () => parseShopSearchParams(searchParams),
    [searchParams],
  );

  const replace = useCallback(
    (next: ShopUrlState) => {
      const qs = shopUrlStateToSearchParams(next, {
        priceBounds: priceBounds ?? undefined,
      });
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname, priceBounds],
  );

  const patch = useCallback(
    (partial: Partial<ShopUrlState>, opts?: { resetPage?: boolean }) => {
      const resetPage = opts?.resetPage !== false;
      const next: ShopUrlState = {
        ...state,
        ...partial,
        page: resetPage && partial.page === undefined ? 1 : partial.page ?? state.page,
      };
      replace(next);
    },
    [state, replace],
  );

  const setCategories = useCallback(
    (slugs: string[]) => patch({ categorySlugs: slugs }),
    [patch],
  );

  const toggleCategorySlug = useCallback(
    (slug: string) => {
      const lower = slug.toLowerCase();
      const has = state.categorySlugs.some((s) => s.toLowerCase() === lower);
      const categorySlugs = has
        ? state.categorySlugs.filter((s) => s.toLowerCase() !== lower)
        : [...state.categorySlugs, slug];
      patch({ categorySlugs });
    },
    [state.categorySlugs, patch],
  );

  const setColors = useCallback(
    (colorValues: string[]) => patch({ colorValues }),
    [patch],
  );

  const toggleColor = useCallback(
    (value: string) => {
      const lower = value.toLowerCase();
      const has = state.colorValues.some((c) => c.toLowerCase() === lower);
      const colorValues = has
        ? state.colorValues.filter((c) => c.toLowerCase() !== lower)
        : [...state.colorValues, value];
      patch({ colorValues });
    },
    [state.colorValues, patch],
  );

  const setTechNames = useCallback(
    (techNames: string[]) => patch({ techNames }),
    [patch],
  );

  const toggleTech = useCallback(
    (name: string) => {
      const has = state.techNames.includes(name);
      const techNames = has
        ? state.techNames.filter((t) => t !== name)
        : [...state.techNames, name];
      patch({ techNames });
    },
    [state.techNames, patch],
  );

  const setSuppliers = useCallback(
    (supplierCodes: string[]) => patch({ supplierCodes }),
    [patch],
  );

  const toggleSupplier = useCallback(
    (code: string) => {
      const has = state.supplierCodes.includes(code);
      const supplierCodes = has
        ? state.supplierCodes.filter((s) => s !== code)
        : [...state.supplierCodes, code];
      patch({ supplierCodes });
    },
    [state.supplierCodes, patch],
  );

  const setMoqCap = useCallback(
    (moqCap: number | undefined) => patch({ moqCap }),
    [patch],
  );

  const setPriceRangeCents = useCallback(
    (min: number | undefined, max: number | undefined) =>
      patch({ priceMinCents: min, priceMaxCents: max }),
    [patch],
  );

  const setSort = useCallback(
    (sort: ShopSort) => patch({ sort }),
    [patch],
  );

  const setPage = useCallback(
    (page: number) => patch({ page }, { resetPage: false }),
    [patch],
  );

  const setQuery = useCallback(
    (q: string) => patch({ q }),
    [patch],
  );

  const setNavCategory = useCallback(
    (slug: string | null) => {
      if (!slug) patch({ categorySlugs: [] });
      else patch({ categorySlugs: [slug] });
    },
    [patch],
  );

  return {
    state,
    replace,
    patch,
    setCategories,
    toggleCategorySlug,
    setColors,
    toggleColor,
    setTechNames,
    toggleTech,
    setSuppliers,
    toggleSupplier,
    setMoqCap,
    setPriceRangeCents,
    setSort,
    setPage,
    setQuery,
    setNavCategory,
  };
}
