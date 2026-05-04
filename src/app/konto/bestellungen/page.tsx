import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function KontoBestellungenPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/konto/bestellungen");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold">Bestellübersicht</h1>
      <p className="text-muted-foreground">
        Hier siehst du bald alle deine Bestellungen. Die Liste wird in einem späteren Schritt mit Daten aus der
        Datenbank befüllt.
      </p>
      <Button asChild variant="outline">
        <Link href="/konto">Zurück zum Konto</Link>
      </Button>
    </main>
  );
}
