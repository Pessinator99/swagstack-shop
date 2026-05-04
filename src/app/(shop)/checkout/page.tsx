import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutPageClient } from "@/components/shop/checkout-page-client";

export default async function CheckoutPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/checkout");

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, email, company_name, contact_person, vat_id, phone, billing_address, shipping_address",
    )
    .eq("id", user.id)
    .maybeSingle();

  return (
    <CheckoutPageClient
      prefill={{
        id: user.id,
        email: user.email ?? "",
        company_name: customer?.company_name ?? null,
        contact_person: customer?.contact_person ?? null,
        vat_id: customer?.vat_id ?? null,
        phone: customer?.phone ?? null,
        billing_address: (customer?.billing_address as Record<string, unknown> | null) ?? null,
        shipping_address: (customer?.shipping_address as Record<string, unknown> | null) ?? null,
      }}
    />
  );
}
