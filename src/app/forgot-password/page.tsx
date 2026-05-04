import { AuthShell } from "@/components/shared/auth-shell";
import { ForgotPasswordForm } from "@/components/shared/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Passwort vergessen"
      subtitle="Wir senden dir einen sicheren Link zum Zuruecksetzen."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
