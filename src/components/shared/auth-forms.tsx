"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type LoginValues,
  type RegisterValues,
  type ResetPasswordValues,
} from "@/lib/auth/schemas";
import { establishSessionAfterSignUp } from "@/lib/auth/establish-session-after-signup";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const industries = [
  { value: "tech", label: "Tech" },
  { value: "gastro", label: "Gastro" },
  { value: "sport", label: "Sport" },
  { value: "beauty", label: "Beauty" },
  { value: "bau", label: "Bau" },
  { value: "bildung", label: "Bildung" },
  { value: "events", label: "Events" },
  { value: "gesundheit", label: "Gesundheit" },
  { value: "sonstige", label: "Sonstige" },
] as const;

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/shop";
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error(error.message || "Login fehlgeschlagen.");
      return;
    }
    toast.success("Erfolgreich eingeloggt.");
    router.replace(redirect);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">E-Mail</Label>
        <Input id="login-email" type="email" autoComplete="email" {...form.register("email")} />
        <p className="text-sm text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Passwort</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        <p className="text-sm text-destructive">{form.formState.errors.password?.message}</p>
      </div>

        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-brand-700 hover:underline">
            Passwort vergessen?
          </Link>
          <Link href="/register" className="text-brand-700 hover:underline">
            Noch kein Konto?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Wird gesendet...
            </>
          ) : (
            "Einloggen"
          )}
        </Button>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      vatId: "",
      phone: "",
      industry: "tech",
      newsletter: false,
      termsAccepted: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const supabase = createSupabaseBrowserClient();
    const siteUrl = getSiteUrl();
    const signUpResult = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${siteUrl}/verify`,
        data: {
          company_name: values.companyName,
          first_name: values.firstName,
          last_name: values.lastName,
          vat_id: values.vatId || null,
          phone: values.phone || null,
          industry: values.industry,
          newsletter_optin: values.newsletter,
        },
      },
    });
    if (signUpResult.error) {
      toast.error(signUpResult.error.message || "Registrierung fehlgeschlagen.");
      return;
    }

    let established;
    try {
      established = await establishSessionAfterSignUp({
        email: values.email,
        password: values.password,
        signUpResult,
        signInWithPassword: (e, p) => supabase.auth.signInWithPassword({ email: e, password: p }),
      });
    } catch (e: any) {
      toast.error(e?.message || "Registrierung fehlgeschlagen.");
      return;
    }

    if (established.kind === "session") {
      await supabase.from("customers").upsert({
        id: established.session.user.id,
        email: values.email,
        company_name: values.companyName,
        contact_person: `${values.firstName} ${values.lastName}`,
        vat_id: values.vatId || null,
        phone: values.phone || null,
        newsletter_optin: values.newsletter,
        customer_group: values.industry,
      });
      toast.success("Konto erstellt. Willkommen im Shop!");
      router.replace("/shop");
      router.refresh();
      return;
    }

    toast.success("Konto erstellt, pruefe deine E-Mails.");
    router.replace(`/verify?email=${encodeURIComponent(values.email)}`);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="reg-company">Firmenname</Label>
          <Input id="reg-company" {...form.register("companyName")} />
          <p className="text-sm text-destructive">{form.formState.errors.companyName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-first">Vorname</Label>
          <Input id="reg-first" {...form.register("firstName")} />
          <p className="text-sm text-destructive">{form.formState.errors.firstName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-last">Nachname</Label>
          <Input id="reg-last" {...form.register("lastName")} />
          <p className="text-sm text-destructive">{form.formState.errors.lastName?.message}</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="reg-email">E-Mail</Label>
          <Input id="reg-email" type="email" autoComplete="email" {...form.register("email")} />
          <p className="text-sm text-destructive">{form.formState.errors.email?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-password">Passwort</Label>
          <Input id="reg-password" type="password" autoComplete="new-password" {...form.register("password")} />
          <p className="text-sm text-destructive">{form.formState.errors.password?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-password2">Passwort wiederholen</Label>
          <Input id="reg-password2" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-vat">USt-ID (optional)</Label>
          <Input id="reg-vat" placeholder="DE123456789" {...form.register("vatId")} />
          <p className="text-sm text-destructive">{form.formState.errors.vatId?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-phone">Telefon (optional)</Label>
          <Input id="reg-phone" {...form.register("phone")} />
          <p className="text-sm text-destructive">{form.formState.errors.phone?.message}</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Branche</Label>
          <Controller
            control={form.control}
            name="industry"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bitte wählen" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-sm text-destructive">{form.formState.errors.industry?.message}</p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-[10px] border border-border p-3">
        <Checkbox
          checked={form.watch("newsletter")}
          onCheckedChange={(v) => form.setValue("newsletter", Boolean(v))}
        />
        <span className="text-sm">
          Newsletter abonnieren
          <span className="block text-muted-foreground">
            Produktneuheiten und Preisaktionen per E-Mail.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-[10px] border border-border p-3">
        <Checkbox
          checked={form.watch("termsAccepted")}
          onCheckedChange={(v) => form.setValue("termsAccepted", Boolean(v), { shouldValidate: true })}
        />
        <span className="text-sm">
          Ich akzeptiere die{" "}
          <Link href="/agb" className="text-brand-700 hover:underline">
            AGB
          </Link>
          .
        </span>
      </label>
      <p className="text-sm text-destructive">{form.formState.errors.termsAccepted?.message}</p>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Wird gesendet...
            </>
          ) : (
            "Konto erstellen"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Bereits registriert?{" "}
          <Link href="/login" className="text-brand-700 hover:underline">
            Zum Login
          </Link>
        </p>
    </form>
  );
}

export function VerifyPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "verifying" | "done">("idle");
  const email = params.get("email");
  const tokenHash = params.get("token_hash");
  const token = params.get("token");
  const type = params.get("type");
  const code = params.get("code");

  useEffect(() => {
    const run = async () => {
      if (!tokenHash && !token && !code) return;
      setStatus("verifying");
      const supabase = createSupabaseBrowserClient();
      try {
        const effectiveHash = tokenHash || token;
        if (effectiveHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: effectiveHash,
            type: type as "signup" | "recovery" | "email_change",
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        toast.success("E-Mail bestätigt.");
        setStatus("done");
        router.replace("/shop");
      } catch (err: any) {
        toast.error(err?.message || "Verifizierung fehlgeschlagen.");
        setStatus("idle");
      }
    };
    void run();
  }, [code, tokenHash, token, type, router]);

  const onResend = async () => {
    if (!email) {
      toast.error("Keine E-Mail-Adresse gefunden.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${getSiteUrl()}/verify` },
    });
    if (error) {
      toast.error(error.message || "Erneutes Senden fehlgeschlagen.");
      return;
    }
    toast.success("Verifizierungs-E-Mail erneut gesendet.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {status === "verifying"
          ? "Wir pruefen gerade deinen Verifizierungslink."
          : "Bitte bestätige dein Konto über den Link in deiner E-Mail."}
      </p>
      {email ? (
        <p className="rounded-md bg-muted p-3 font-mono text-sm">{email}</p>
      ) : null}
      <Button onClick={onResend} variant="outline" className="w-full">
        Verifizierungs-E-Mail erneut senden
      </Button>
      <Button asChild variant="accent" className="w-full">
        <Link href="/login">Zum Login</Link>
      </Button>
    </div>
  );
}

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const [done, setDone] = useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${getSiteUrl()}/reset-password`,
    });
    if (error) {
      toast.error(error.message || "E-Mail konnte nicht versendet werden.");
      return;
    }
    toast.success("Link gesendet.");
    setDone(true);
  });

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Falls ein Konto existiert, wurde ein Reset-Link versendet.
        </p>
        <Button asChild variant="accent" className="w-full">
          <Link href="/login">Zurueck zum Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="forgot-email">E-Mail</Label>
        <Input id="forgot-email" type="email" {...form.register("email")} />
        <p className="text-sm text-destructive">{form.formState.errors.email?.message}</p>
      </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Wird gesendet...
            </>
          ) : (
            "Reset-Link senden"
          )}
        </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const token = params.get("token");
  const type = params.get("type");
  const code = params.get("code");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const effectiveHash = tokenHash || token;
        if (effectiveHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: effectiveHash,
            type: type as "recovery",
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        setReady(true);
      } catch {
        toast.error("Der Reset-Link ist ungültig oder abgelaufen.");
      }
    };
    void run();
  }, [tokenHash, token, type, code]);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      toast.error(error.message || "Passwort konnte nicht aktualisiert werden.");
      return;
    }
    toast.success("Passwort gespeichert.");
    router.replace("/login");
  });

  if (!ready) {
    return (
      <p className="text-sm text-muted-foreground">
        Wir validieren deinen Reset-Link...
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-password">Neues Passwort</Label>
        <Input id="reset-password" type="password" {...form.register("password")} />
        <p className="text-sm text-destructive">{form.formState.errors.password?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-password2">Passwort wiederholen</Label>
        <Input id="reset-password2" type="password" {...form.register("confirmPassword")} />
        <p className="text-sm text-destructive">{form.formState.errors.confirmPassword?.message}</p>
      </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            "Passwort speichern"
          )}
        </Button>
    </form>
  );
}
