import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { MoodboardClient } from "@/components/shop/moodboard-client";

export const metadata: Metadata = {
  title: "Marketing-Bild-Generator",
  description: "Logo, Produkt und Szene – KI erstellt dein Marketingfoto.",
};

export default function MoodboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24" aria-busy="true" aria-label="Laden">
          <Loader2 className="size-10 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MoodboardClient />
    </Suspense>
  );
}
