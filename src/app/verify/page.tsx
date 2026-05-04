import { AuthShell } from "@/components/shared/auth-shell";
import { VerifyPanel } from "@/components/shared/auth-forms";
import { Suspense } from "react";

export default function VerifyPage() {
  return (
    <AuthShell
      title="E-Mail verifizieren"
      subtitle="Bitte bestätige dein Konto. Danach leiten wir dich direkt in den Shop."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Verifizierung wird geladen...</p>}>
        <VerifyPanel />
      </Suspense>
    </AuthShell>
  );
}
