import { AuthShell } from "@/components/shared/auth-shell";
import { ResetPasswordForm } from "@/components/shared/auth-forms";
import { Suspense } from "react";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Neues Passwort setzen"
      subtitle="Lege ein neues Passwort für dein Konto fest."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Reset wird geladen...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
