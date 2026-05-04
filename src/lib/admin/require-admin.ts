import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdmin(redirectTo?: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const target = redirectTo ?? "/admin";
    redirect(`/login?redirect=${encodeURIComponent(target)}`);
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminUser) {
    redirect("/shop");
  }

  return { supabase, user, adminRole: adminUser.role as string };
}
