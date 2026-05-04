import { AuthShell } from "@/components/shared/auth-shell";
import { LoginForm } from "@/components/shared/auth-forms";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <AuthShell
      title="Willkommen zurueck"
      subtitle="Logge dich ein, um Preise und Produkte im B2B-Shop zu sehen."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Lade Login...</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
