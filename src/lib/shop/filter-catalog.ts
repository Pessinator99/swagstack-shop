import type { CategoryRow, ShopCatalogProduct } from "./fetch-shop-catalog";
import type { ShopUrlState } from "./shop-url";
import { expandCategorySelection } from "./category-expand";
import { SEARCH_SYNONYMS } from "./search-synonyms";

const ALLOWED_SUPPLIERS = new Set([
  "manual",
  "stricker",
  "pfconcept",
  "makito",
]);

function normalizeSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function expandSearchTerms(query: string): string[] {
  const base = normalizeSearchTerm(query);
  if (!base) return [];

  const terms = new Set<string>();
  terms.add(base);

  for (const token of base.split(/\s+/).filter(Boolean)) {
    terms.add(token);
    for (const [rawKey, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
      const normalizedKey = normalizeSearchTerm(rawKey);
      const normalizedSynonyms = synonyms.map((synonym) =>
        normalizeSearchTerm(synonym),
      );
      if (
        normalizedKey !== token &&
        !normalizedSynonyms.some((synonym) => synonym === token)
      ) {
        continue;
      }
      terms.add(normalizedKey);
      for (const synonym of normalizedSynonyms) {
        terms.add(synonym);
      }
    }
  }

  return [...terms].filter(Boolean);
}

export function filterAndSortProducts(
  products: ShopCatalogProduct[],
  state: ShopUrlState,
  categories: CategoryRow[],
): ShopCatalogProduct[] {
  let list = [...products];

  const queryTerms = expandSearchTerms(state.q);
  if (queryTerms.length) {
    list = list.filter((p) => {
      const normalizedName = normalizeSearchTerm(p.name);
      const normalizedShortDescription = normalizeSearchTerm(
        p.short_description ?? "",
      );
      const normalizedDescription = normalizeSearchTerm(p.description ?? "");
      const normalizedCategoryName = normalizeSearchTerm(p.category?.name ?? "");
      const normalizedSupplierSku = normalizeSearchTerm(p.supplier_sku ?? "");

      return queryTerms.some((term) => {
        if (!term) return false;
        return (
          normalizedName.includes(term) ||
          normalizedShortDescription.includes(term) ||
          normalizedDescription.includes(term) ||
          normalizedCategoryName.includes(term) ||
          normalizedSupplierSku === term
        );
      });
    });
  }

  if (state.categorySlugs.length) {
    const allowed = expandCategorySelection(categories, state.categorySlugs);
    list = list.filter(
      (p) => p.category?.id && allowed.has(p.category.id),
    );
  }

  if (state.colorValues.length) {
    const want = new Set(state.colorValues.map((c) => c.toLowerCase()));
    list = list.filter((p) =>
      p.variants.some(
        (v) =>
          v.variant_type === "color" &&
          want.has(v.variant_value.toLowerCase()),
      ),
    );
  }

  if (state.moqCap != null) {
    list = list.filter((p) => p.moq <= state.moqCap!);
  }

  if (state.techNames.length) {
    const want = new Set(state.techNames);
    list = list.filter((p) =>
      p.techniqueNames.some((t) => want.has(t)),
    );
  }

  if (state.supplierCodes.length) {
    const want = new Set(state.supplierCodes);
    list = list.filter((p) => want.has(p.supplier_code));
  }

  if (state.priceMinCents != null) {
    list = list.filter((p) => p.filterUnitCents >= state.priceMinCents!);
  }
  if (state.priceMaxCents != null) {
    list = list.filter((p) => p.filterUnitCents <= state.priceMaxCents!);
  }

  const { sort } = state;
  if (sort === "price_asc") {
    list.sort((a, b) => a.listUnitCents - b.listUnitCents);
  } else if (sort === "price_desc") {
    list.sort((a, b) => b.listUnitCents - a.listUnitCents);
  } else if (sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name, "de"));
  } else if (sort === "new") {
    list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  } else {
    list.sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return a.name.localeCompare(b.name, "de");
    });
  }

  return list;
}

export function priceBounds(products: ShopCatalogProduct[]): {
  min: number;
  max: number;
} {
  if (!products.length) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of products) {
    min = Math.min(min, p.filterUnitCents);
    max = Math.max(max, p.filterUnitCents);
  }
  if (min === Infinity) return { min: 0, max: 1 };
  if (min === max) return { min: Math.max(0, min - 1), max: max + 1 };
  return { min, max };
}

export type ShopColorFilterOption = { label: string; hex: string | null };

/** One row per distinct color label; hex from first variant with that label (for sidebar swatches). */
export function uniqueColorFilterOptions(
  products: ShopCatalogProduct[],
): ShopColorFilterOption[] {
  const hexByLabel = new Map<string, string | null>();
  for (const p of products) {
    for (const v of p.variants) {
      if (v.variant_type !== "color") continue;
      if (hexByLabel.has(v.variant_value)) continue;
      const raw = v.color_hex?.trim() ?? null;
      const hex =
        raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : null;
      hexByLabel.set(v.variant_value, hex);
    }
  }
  return [...hexByLabel.entries()]
    .map(([label, hex]) => ({ label, hex }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

export function uniqueColorValues(products: ShopCatalogProduct[]): string[] {
  return uniqueColorFilterOptions(products).map((o) => o.label);
}

export function uniqueTechniqueNames(
  products: ShopCatalogProduct[],
): string[] {
  const s = new Set<string>();
  for (const p of products) {
    for (const t of p.techniqueNames) s.add(t);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "de"));
}

export function suppliersPresent(
  products: ShopCatalogProduct[],
): string[] {
  const s = new Set<string>();
  for (const p of products) {
    if (ALLOWED_SUPPLIERS.has(p.supplier_code)) s.add(p.supplier_code);
  }
  return [...s].sort();
}
