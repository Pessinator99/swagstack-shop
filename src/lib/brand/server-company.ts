import "server-only";

import { brandConfig as publicBrand, type BrandConfig } from "@/lib/brand/config";

/**
 * Firmendaten für Server-only: E-Mail, PDF, Webhooks.
 * Überlagert die statische `brandConfig` mit COMPANY_* / SMTP_FROM aus der Umgebung.
 */
export function getServerCompanyProfile(): BrandConfig {
  const street = process.env.COMPANY_STREET ?? publicBrand.street;
  const zip = process.env.COMPANY_ZIP ?? publicBrand.address.zip;
  const city = process.env.COMPANY_CITY ?? publicBrand.address.city;
  const country = process.env.COMPANY_COUNTRY ?? publicBrand.address.country;
  const legalName =
    process.env.COMPANY_LEGAL_NAME ?? process.env.COMPANY_NAME ?? publicBrand.legal_name;

  return {
    ...publicBrand,
    legal_name: legalName,
    companyName: legalName,
    street,
    zipCity: `${zip} ${city}`,
    country,
    address: {
      street,
      zip,
      city,
      country,
    },
    ustId: process.env.COMPANY_UST_ID ?? process.env.COMPANY_VAT_ID ?? publicBrand.ustId,
    managingDirector: process.env.COMPANY_MANAGING_DIRECTOR ?? publicBrand.managingDirector,
    companyEmail: process.env.COMPANY_EMAIL ?? process.env.SMTP_FROM ?? publicBrand.companyEmail,
    iban: process.env.COMPANY_IBAN ?? publicBrand.iban,
    bic: process.env.COMPANY_BIC ?? publicBrand.bic,
    bankName: process.env.COMPANY_BANK_NAME ?? process.env.COMPANY_BANK ?? publicBrand.bankName,
  };
}
