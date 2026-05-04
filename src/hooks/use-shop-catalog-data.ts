import { useQuery } from "@tanstack/react-query";
import type { ShopCatalogProduct } from "@/lib/shop/fetch-shop-catalog";

export function useShopCatalogData() {
  return useQuery({
    queryKey: ["shop-catalog"],
    queryFn: async (): Promise<{ products: ShopCatalogProduct[] }> => {
      const res = await fetch("/api/shop/catalog", { method: "GET" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Katalog konnte nicht geladen werden.");
      }
      return res.json() as Promise<{ products: ShopCatalogProduct[] }>;
    },
    staleTime: 60_000,
  });
}
