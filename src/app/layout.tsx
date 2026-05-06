import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: {
    default: "Werbenest – Premium Werbemittel für deine Marke",
    template: "%s | Werbenest",
  },
  description:
    "Werbemittel mit Charakter. Vom Logo-Upload bis zur Auslieferung – professionelle B2B-Werbeartikel für Unternehmen, Vereine und Agenturen.",
  keywords: [
    "Werbemittel",
    "Werbeartikel",
    "B2B",
    "Logo bedrucken",
    "Firmengeschenke",
    "Corporate Merchandise",
    "Werbenest",
  ],
  openGraph: {
    title: "Werbenest – Hier wächst deine Marke",
    description: "Premium Werbemittel mit Logo, KI-Marketingfotos und schneller Lieferung.",
    locale: "de_DE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
