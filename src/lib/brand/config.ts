/**
 * Öffentliche Marken-/Firmendaten für UI (Client + Server).
 * Keine COMPANY_*-Env hier — verhindert Hydration-Mismatches (Server vs. Client-Bundle).
 *
 * Für E-Mail/PDF mit echten Deploy-Daten: `getServerCompanyProfile()` aus `./server-company`.
 */
export type BrandConfig = {
  name: string;
  brandName: string;
  tagline: string;
  legal_name: string;
  companyName: string;
  street: string;
  zipCity: string;
  country: string;
  address: { street: string; zip: string; city: string; country: string };
  ustId: string;
  managingDirector: string;
  companyEmail: string;
  iban: string;
  bic: string;
  bankName: string;
  brandOlive: string;
  brandOliveLight: string;
  brand900: string;
  accent50: string;
};

export const brandConfig: BrandConfig = {
  name: "Swagstack",
  brandName: "Swagstack",
  tagline: "Qualität, die sich sehen lässt.",
  legal_name: "Swagstack GmbH",
  companyName: "Swagstack GmbH",
  street: "Musterstraße 1",
  zipCity: "70173 Stuttgart",
  country: "Deutschland",
  address: {
    street: "Musterstraße 1",
    zip: "70173",
    city: "Stuttgart",
    country: "Deutschland",
  },
  ustId: "DE000000000",
  managingDirector: "Geschäftsführung (Platzhalter)",
  companyEmail: "info@swagstack.local",
  iban: "DE00 0000 0000 0000 0000 00",
  bic: "COBADEBBXXX",
  bankName: "Musterbank AG",
  brandOlive: "#3D4A2A",
  brandOliveLight: "#FAFAF7",
  brand900: "#1a1f14",
  accent50: "#f4f6ef",
};

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
