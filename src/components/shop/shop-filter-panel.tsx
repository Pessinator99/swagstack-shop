"use client";

import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CategoryRow } from "@/lib/shop/fetch-shop-catalog";
import { categoryNavItems } from "@/lib/shop/category-expand";
import { shopColorSwatchCss } from "@/lib/shop/color-swatch";
import type { ShopColorFilterOption } from "@/lib/shop/filter-catalog";
import { formatCents } from "@/lib/pricing/calculate";
import { cn } from "@/lib/utils";
import type { ShopUrlState } from "@/lib/shop/shop-url";

const SUPPLIER_LABEL: Record<string, string> = {
  manual: "Manuell",
  stricker: "Stricker",
  pfconcept: "PF Concept",
  makito: "Makito",
};

function childrenOf(
  cats: CategoryRow[],
  parentId: string | null,
): CategoryRow[] {
  return cats
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function CategoryBranch({
  cats,
  parentId,
  depth,
  state,
  onToggle,
}: {
  cats: CategoryRow[];
  parentId: string | null;
  depth: number;
  state: ShopUrlState;
  onToggle: (slug: string) => void;
}) {
  const nodes = childrenOf(cats, parentId);
  if (!nodes.length) return null;
  return (
    <ul className={cn("space-y-2", depth > 0 && "mt-2 border-l pl-3")}>
      {nodes.map((c) => {
        const checked = state.categorySlugs.some(
          (s) => s.toLowerCase() === c.slug.toLowerCase(),
        );
        return (
          <li key={c.id} className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(c.slug)}
                className="mt-0.5"
              />
              <span>{c.name}</span>
            </label>
            <CategoryBranch
              cats={cats}
              parentId={c.id}
              depth={depth + 1}
              state={state}
              onToggle={onToggle}
            />
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  categories: CategoryRow[];
  colorOptions: ShopColorFilterOption[];
  techniques: string[];
  suppliers: string[];
  priceBounds: { min: number; max: number } | null;
  state: ShopUrlState;
  toggleCategorySlug: (slug: string) => void;
  toggleColor: (value: string) => void;
  toggleTech: (name: string) => void;
  toggleSupplier: (code: string) => void;
  setMoqCap: (cap: number | undefined) => void;
  setPriceRangeCents: (min: number | undefined, max: number | undefined) => void;
  disabled?: boolean;
};

export function ShopFilterPanel({
  categories,
  colorOptions,
  techniques,
  suppliers,
  priceBounds,
  state,
  toggleCategorySlug,
  toggleColor,
  toggleTech,
  toggleSupplier,
  setMoqCap,
  setPriceRangeCents,
  disabled,
}: Props) {
  const roots = useMemo(() => categoryNavItems(categories), [categories]);

  const sliderKey = priceBounds
    ? `${priceBounds.min}-${priceBounds.max}-${state.priceMinCents ?? ""}-${state.priceMaxCents ?? ""}`
    : "none";

  const sliderDefault = priceBounds
    ? ([
        state.priceMinCents ?? priceBounds.min,
        state.priceMaxCents ?? priceBounds.max,
      ] as [number, number])
    : ([0, 1] as [number, number]);

  const moqSelectValue =
    state.moqCap == null
      ? "all"
      : String(state.moqCap) as "50" | "100" | "250";

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Kategorie</h3>
        {roots.length ? (
          <ul className="space-y-2">
            {roots.map((c) => {
              const checked = state.categorySlugs.some(
                (s) => s.toLowerCase() === c.slug.toLowerCase(),
              );
              return (
                <li key={c.id} className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleCategorySlug(c.slug)}
                      className="mt-0.5"
                    />
                    <span>{c.name}</span>
                  </label>
                  <CategoryBranch
                    cats={categories}
                    parentId={c.id}
                    depth={1}
                    state={state}
                    onToggle={toggleCategorySlug}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Kategorien.</p>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Farbe</h3>
        {colorOptions.length ? (
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((opt) => {
              const active = state.colorValues.some(
                (c) => c.toLowerCase() === opt.label.toLowerCase(),
              );
              return (
                <button
                  key={opt.label}
                  type="button"
                  title={opt.label}
                  disabled={disabled}
                  onClick={() => toggleColor(opt.label)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2 transition-shadow",
                    active
                      ? "border-brand-600 ring-2 ring-brand-600/30"
                      : "border-border hover:border-brand-400",
                  )}
                >
                  <span
                    className="size-6 rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: shopColorSwatchCss(opt.hex, opt.label) }}
                  />
                  <span className="sr-only">{opt.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Preis (Staffel-Spitze / Stk.)
        </h3>
        {!priceBounds || priceBounds.max <= priceBounds.min ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-3 px-0.5">
            <Slider
              key={sliderKey}
              disabled={disabled}
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              defaultValue={sliderDefault}
              onValueCommit={(v) => {
                if (v.length !== 2 || !priceBounds) return;
                const [a, b] = v as [number, number];
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                if (lo <= priceBounds.min && hi >= priceBounds.max) {
                  setPriceRangeCents(undefined, undefined);
                } else {
                  setPriceRangeCents(lo, hi);
                }
              }}
            />
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>
                {formatCents(state.priceMinCents ?? priceBounds.min)}
              </span>
              <span>
                {formatCents(state.priceMaxCents ?? priceBounds.max)}
              </span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-semibold">MOQ</Label>
        <Select
          disabled={disabled}
          value={moqSelectValue}
          onValueChange={(v) => {
            if (v === "all") setMoqCap(undefined);
            else setMoqCap(Number(v));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="MOQ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ab 1 Stk (alle)</SelectItem>
            <SelectItem value="50">ab 50 Stk</SelectItem>
            <SelectItem value="100">ab 100 Stk</SelectItem>
            <SelectItem value="250">ab 250 Stk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Veredelungsart
        </h3>
        {techniques.length ? (
          <ul className="space-y-2">
            {techniques.map((t) => (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={state.techNames.includes(t)}
                    onCheckedChange={() => toggleTech(t)}
                  />
                  <span>{t}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Lieferant</h3>
        {suppliers.length ? (
          <ul className="space-y-2">
            {suppliers.map((code) => (
              <li key={code}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={state.supplierCodes.includes(code)}
                    onCheckedChange={() => toggleSupplier(code)}
                  />
                  <span>{SUPPLIER_LABEL[code] ?? code}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}
