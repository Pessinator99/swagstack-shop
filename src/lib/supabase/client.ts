import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase client for Client Components. Uses browser cookies. */
let browserClientSingleton: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserClientSingleton) return browserClientSingleton;
  browserClientSingleton = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClientSingleton;
}

export const createSupabaseBrowserClient = getSupabaseBrowserClient;
