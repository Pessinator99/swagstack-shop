import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AdminApiContext = { supabase: SupabaseClient; user: User };

export async function assertAdminApi(): Promise<
  { ok: true; ctx: AdminApiContext } | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 }) };
  }
  const { data: adminRow } = await supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle();
  if (!adminRow) {
    return { ok: false, response: NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 }) };
  }
  return { ok: true, ctx: { supabase, user } };
}
