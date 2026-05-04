"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ShopCatalogProduct } from "@/lib/shop/fetch-shop-catalog";
import { formatCents } from "@/lib/pricing/calculate";
import { cn } from "@/lib/utils";

export function ShopProductCard({ product }: { product: ShopCatalogProduct }) {
  const href = `/shop/${product.slug}`;
  const catName = product.category?.name ?? "Produkt";
  const priceLabel = formatCents(product.listUnitCents);
  const qty = product.listTierQty;

  return (
    <motion.article layout className="h-full">
      <Link
        href={href}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border bg-surface",
          "shadow-[var(--shadow-raised)] transition-[transform,box-shadow] duration-200",
          "hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]",
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <div className="pointer-events-none absolute inset-0 z-20">
            <span className="absolute left-2 top-2 rounded-md bg-accent-200 px-2 py-0.5 text-xs font-medium text-accent-900">
              {catName}
            </span>
          </div>
          {product.primaryImageUrl ? (
            <Image
              src={product.primaryImageUrl}
              alt={product.name}
              fill
              className={cn(
                "object-cover transition-transform duration-300",
                product.hoverImageUrl && "group-hover:scale-105",
              )}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Kein Bild
            </div>
          )}
          {product.hoverImageUrl ? (
            <Image
              src={product.hoverImageUrl}
              alt=""
              fill
              className="pointer-events-none absolute inset-0 object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <h2 className="font-heading text-base font-semibold leading-snug text-foreground">
            {product.name}
          </h2>
          <p className="text-xs text-muted-foreground">MOQ {product.moq} Stk</p>
          <p className="mt-auto font-mono text-sm font-medium text-brand-600">
            ab {priceLabel}/Stk bei {qty} Stk
          </p>
        </div>
      </Link>
    </motion.article>
  );
}
