import { AuthShell } from "@/components/shared/auth-shell";
import { RegisterForm } from "@/components/shared/auth-forms";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Neu registrieren"
      subtitle="Lege dein Firmenkonto an und starte mit dem B2B-Einkauf."
    >
      <RegisterForm />
    </AuthShell>
  );
}
