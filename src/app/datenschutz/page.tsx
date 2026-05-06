import { brandConfig } from "@/lib/brand/config";

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">Datenschutz</h1>
      <p className="text-muted-foreground">
        Platzhaltertext für die Datenschutzerklärung. Vor Produktivstart wird
        dieser Abschnitt durch den finalen Rechtstext ersetzt.
      </p>
      <article className="rounded-[var(--radius)] border bg-surface p-6 text-sm text-muted-foreground">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean vitae
        neque arcu. Etiam tincidunt eros ac dictum pharetra.
      </article>
      <p className="text-sm text-muted-foreground">
        Verantwortliche Stelle: {brandConfig.legal_name}, {brandConfig.companyEmail}, https://werbenest.de
      </p>
    </main>
  );
}
