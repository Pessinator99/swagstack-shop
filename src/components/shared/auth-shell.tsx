import type { ReactNode } from "react";
import { SiteLogo } from "@/components/shared/site-logo";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-brand-900 px-8 py-10 text-white md:flex lg:px-12">
          <SiteLogo className="text-white [&_span:last-child]:text-white" />
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.18em] text-zinc-300">
              Swagstack B2B
            </p>
            <h1 className="text-4xl leading-tight font-semibold">
              Werbemittel-Einkauf auf das nächste Level.
            </h1>
            <p className="max-w-md text-zinc-300">
              Einkauf, Preisstaffeln und Veredelung in einem durchgängigen
              B2B-Workflow.
            </p>
          </div>
          <p className="text-xs text-zinc-400">Secure by Supabase Auth</p>
        </section>
        <section className="flex items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-xl rounded-[var(--radius)] border border-border bg-surface p-6 shadow-[var(--shadow-raised)] sm:p-8">
            <header className="mb-6 space-y-2">
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </header>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
