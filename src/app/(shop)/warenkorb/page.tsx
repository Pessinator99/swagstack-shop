import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CartPageClient } from "@/components/shop/cart-page-client";

type Props = { searchParams: Promise<{ canceled?: string }> };

export default async function WarenkorbPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/warenkorb");

  const sp = await searchParams;
  const canceledCheckout = sp.canceled === "1";

  return <CartPageClient canceledCheckout={canceledCheckout} />;
}
