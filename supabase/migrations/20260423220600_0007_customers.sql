-- ============================================================================
-- 0007 — Customers + customer logos
-- ============================================================================
create table if not exists public.customers (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              citext unique not null,
  company_name       text,
  vat_id             text,
  contact_person     text,
  billing_address    jsonb,
  shipping_address   jsonb,
  customer_group     text not null default 'standard',
  phone              text,
  newsletter_optin   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_customers_group on public.customers(customer_group);

create table if not exists public.customer_logos (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(id) on delete cascade,
  name               text not null,
  original_url       text not null,
  processed_url      text,
  svg_url            text,
  dominant_colors    jsonb,
  is_primary         boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists idx_logos_customer on public.customer_logos(customer_id);
create unique index if not exists idx_logos_primary_per_customer
  on public.customer_logos(customer_id) where is_primary = true;
