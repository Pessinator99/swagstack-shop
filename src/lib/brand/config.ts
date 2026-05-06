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
  name: "Werbenest",
  brandName: "Werbenest",
  tagline: "Hier wächst deine Marke",
  legal_name: "Werbenest GmbH",
  companyName: "Werbenest GmbH",
  street: "Rothenburger Straße 33",
  zipCity: "91625 Schnelldorf",
  country: "Deutschland",
  address: {
    street: "Rothenburger Straße 33",
    zip: "91625",
    city: "Schnelldorf",
    country: "Deutschland",
  },
  ustId: "DE000000000",
  managingDirector: "Geschäftsführung (Platzhalter)",
  companyEmail: "info@werbenest.de",
  iban: "DE00 0000 0000 0000 0000 00",
  bic: "COBADEBBXXX",
  bankName: "Musterbank AG",
  brandOlive: "#3A5F45",
  brandOliveLight: "#FAF6EF",
  brand900: "#1F2920",
  accent50: "#EFDCCF",
};

export const BRAND_CONFIG = {
  name: "Werbenest",
  legalName: "Werbenest GmbH",
  tagline: "Hier wächst deine Marke",
  description: "Premium B2B Werbemittel mit Charakter. Vom ersten Logo bis zur Auslieferung.",
  contact: {
    email: "info@werbenest.de",
    phone: "+49 30 1234567",
    website: "https://werbenest.de",
  },
  address: {
    street: "Rothenburger Straße 33",
    zip: "91625",
    city: "Schnelldorf",
    country: "Deutschland",
  },
  vatId: process.env.COMPANY_VAT_ID,
  iban: process.env.COMPANY_IBAN,
  bic: process.env.COMPANY_BIC,
  bank: process.env.COMPANY_BANK,
  social: {
    instagram: "@werbenest",
    linkedin: "werbenest-gmbh",
  },
  colors: {
    primary: "#3A5F45",
    accent: "#C77E58",
    background: "#FAF6EF",
    foreground: "#1F2920",
  },
} as const;

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
