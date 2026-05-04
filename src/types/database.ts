/**
 * Shared domain types for the B2B shop.
 * Full Supabase-generated types are added in SCHRITT 2 after the migration runs
 * (via `supabase gen types typescript`).
 */

export type ProductStatus = "pending" | "active" | "inactive" | "archived";
export type OrderStatus =
  | "pending"
  | "paid"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";
export type AdminRole = "owner" | "admin" | "editor";
export type SupplierCode = "stricker" | "pfconcept" | "makito" | "manual";

export type Address = {
  company?: string;
  first_name: string;
  last_name: string;
  street: string;
  street_extra?: string;
  zip: string;
  city: string;
  country: string;
  phone?: string;
  vat_id?: string;
};

export type ProductImage = {
  url: string;
  alt?: string;
  is_primary?: boolean;
  color_variant_id?: string | null;
};
