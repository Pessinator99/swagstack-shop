import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/lib/shop/fetch-shop-catalog";
import { ShopPageClient } from "@/components/shop/shop-page-client";
import { ShopCatalogSkeleton } from "@/components/shop/shop-catalog-skeleton";

export default async function ShopPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name, parent_id, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <Suspense fallback={<ShopCatalogSkeleton />}>
      <ShopPageClient
        categories={(categories ?? []) as CategoryRow[]}
        email={user?.email ?? null}
      />
    </Suspense>
  );
}
