import { brandConfig } from "@/lib/brand/config";

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">Impressum</h1>
      <p className="text-muted-foreground">
        Platzhalterseite. Vollständige Rechtstexte folgen in der finalen Version.
      </p>
      <div className="rounded-[var(--radius)] border bg-surface p-6">
        <p className="font-medium">{brandConfig.legal_name}</p>
        <p className="text-sm text-muted-foreground">
          {brandConfig.address.street}
          <br />
          {brandConfig.address.zip} {brandConfig.address.city}
          <br />
          {brandConfig.address.country}
        </p>
      </div>
    </main>
  );
}
