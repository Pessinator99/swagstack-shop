import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SiteLogo } from "@/components/shared/site-logo";
import { AccountDropdown } from "@/components/shop/account-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function KontoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/konto");

  const { data: customer } = await supabase
    .from("customers")
    .select("company_name, email, contact_person, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-12">
          <SiteLogo />
          <AccountDropdown email={user.email ?? null} />
        </div>
      </header>
      <section className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10 sm:px-8">
        <h1 className="text-3xl font-semibold">Konto</h1>
        <Card>
          <CardHeader>
            <CardTitle>Profil (Block 2 Platzhalter)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Firma: {customer?.company_name || "Nicht gesetzt"}</p>
            <p>Kontakt: {customer?.contact_person || "Nicht gesetzt"}</p>
            <p>E-Mail: {customer?.email || user.email}</p>
            <p>Telefon: {customer?.phone || "Nicht gesetzt"}</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
