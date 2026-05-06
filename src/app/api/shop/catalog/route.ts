import { NextResponse } from "next/server";
import { fetchShopCatalog } from "@/lib/shop/fetch-shop-catalog";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Öffentlicher Katalog (ohne Browser-Supabase / anon-GRANT-Probleme).
 * Nutzt Service Role nur serverseitig; gleiche Projektion wie fetchShopCatalog.
 */
export async function GET() {
  console.log("[catalog] Starting fetch");
  console.log("[catalog] SUPABASE_URL exists:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("[catalog] SERVICE_ROLE exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const supabase = createSupabaseServiceRoleClient();
    const data = await fetchShopCatalog(supabase);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    console.error("[catalog] ERROR:", e);
    console.error("[GET /api/shop/catalog]", e);
    return NextResponse.json(
      { error: "Katalog konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
