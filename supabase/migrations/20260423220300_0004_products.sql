-- ============================================================================
-- 0004 — Products + Variants
-- ============================================================================
create table if not exists public.products (
  id                       uuid primary key default gen_random_uuid(),
  supplier_sku             text,
  supplier_code            supplier_code not null default 'manual',
  slug                     text unique not null,
  name                     text not null,
  description              text,
  short_description        text,
  category_id              uuid references public.categories(id) on delete set null,
  base_images              jsonb not null default '[]'::jsonb,
  specifications           jsonb not null default '{}'::jsonb,
  moq                      integer not null default 1 check (moq >= 1),
  margin_percent_override  numeric(5,2),
  status                   product_status not null default 'pending',
  is_featured              boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint products_supplier_sku_unique unique (supplier_code, supplier_sku)
);

create index if not exists idx_products_status_category on public.products(status, category_id);
create index if not exists idx_products_supplier on public.products(supplier_code, supplier_sku);
create index if not exists idx_products_featured on public.products(is_featured) where is_featured = true;

create table if not exists public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  variant_type  variant_type not null,
  variant_value text not null,
  variant_code  text,
  sku           text,
  image_url     text,
  stock         integer not null default 0,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_variants_active on public.product_variants(product_id, is_active);
