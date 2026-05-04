import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { calculateCartSummaryForCustomer } from "@/lib/cart/calculate-cart-summary";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const computed = await calculateCartSummaryForCustomer({
    authSupabase: supabase as any,
    serviceSupabase: createSupabaseServiceRoleClient() as any,
    customerId: user.id,
  });

  if (!computed.summary) {
    return NextResponse.json(
      { error: computed.error ?? "Warenkorb konnte nicht geladen werden." },
      { status: computed.status ?? 500 },
    );
  }

  return NextResponse.json(computed.summary);
}
