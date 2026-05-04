import type { ReadonlyURLSearchParams } from "next/navigation";

export type ShopSort = "popularity" | "price_asc" | "price_desc" | "name" | "new";

export type ShopUrlState = {
  categorySlugs: string[];
  colorValues: string[];
  techNames: string[];
  supplierCodes: string[];
  /** MOQ filter: max product MOQ allowed (undefined = no cap). */
  moqCap?: number;
  priceMinCents?: number;
  priceMaxCents?: number;
  sort: ShopSort;
  page: number;
  q: string;
};

const DEFAULT_SORT: ShopSort = "popularity";

export function parseShopSearchParams(
  sp: ReadonlyURLSearchParams,
): ShopUrlState {
  const split = (key: string) =>
    (sp.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const moqRaw = sp.get("moq");
  let moqCap: number | undefined;
  if (moqRaw === "50") moqCap = 50;
  else if (moqRaw === "100") moqCap = 100;
  else if (moqRaw === "250") moqCap = 250;
  else moqCap = undefined;

  const sort = (sp.get("sort") as ShopSort | null) ?? DEFAULT_SORT;
  const safeSort: ShopSort = [
    "popularity",
    "price_asc",
    "price_desc",
    "name",
    "new",
  ].includes(sort)
    ? sort
    : DEFAULT_SORT;

  const pageRaw = Number(sp.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const pmin = sp.get("pmin");
  const pmax = sp.get("pmax");
  const priceMinCents =
    pmin != null && pmin !== "" ? Math.max(0, Number(pmin)) : undefined;
  const priceMaxCents =
    pmax != null && pmax !== "" ? Math.max(0, Number(pmax)) : undefined;

  return {
    categorySlugs: split("cat"),
    colorValues: split("color"),
    techNames: split("tech"),
    supplierCodes: split("sup"),
    moqCap,
    priceMinCents: Number.isFinite(priceMinCents!) ? priceMinCents : undefined,
    priceMaxCents: Number.isFinite(priceMaxCents!) ? priceMaxCents : undefined,
    sort: safeSort,
    page,
    q: (sp.get("q") ?? "").trim(),
  };
}

export function shopUrlStateToSearchParams(
  state: ShopUrlState,
  opts?: { priceBounds?: { min: number; max: number } },
): URLSearchParams {
  const p = new URLSearchParams();

  if (state.categorySlugs.length)
    p.set("cat", state.categorySlugs.join(","));
  if (state.colorValues.length) p.set("color", state.colorValues.join(","));
  if (state.techNames.length) p.set("tech", state.techNames.join(","));
  if (state.supplierCodes.length) p.set("sup", state.supplierCodes.join(","));
  if (state.moqCap != null) p.set("moq", String(state.moqCap));
  if (state.q) p.set("q", state.q);
  if (state.sort !== DEFAULT_SORT) p.set("sort", state.sort);
  if (state.page > 1) p.set("page", String(state.page));

  const { priceBounds } = opts ?? {};
  if (
    state.priceMinCents != null &&
    (!priceBounds || state.priceMinCents > priceBounds.min)
  ) {
    p.set("pmin", String(Math.round(state.priceMinCents)));
  }
  if (
    state.priceMaxCents != null &&
    (!priceBounds || state.priceMaxCents < priceBounds.max)
  ) {
    p.set("pmax", String(Math.round(state.priceMaxCents)));
  }

  return p;
}
