-- ============================================================================
-- 0006 — Print areas, techniques, and print price tiers
-- ============================================================================
create table if not exists public.print_areas (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  name               text not null,
  position_code      text,
  detected_coords    jsonb,
  perspective_hint   perspective_hint,
  mockup_image_url   text,
  is_default         boolean not null default false,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_print_areas_product on public.print_areas(product_id);
create unique index if not exists idx_print_areas_default_per_product
  on public.print_areas(product_id) where is_default = true;

create table if not exists public.print_techniques (
  id              uuid primary key default gen_random_uuid(),
  print_area_id   uuid not null references public.print_areas(id) on delete cascade,
  technique_code  text not null,
  technique_name  text not null,
  max_width_mm    integer,
  max_height_mm   integer,
  max_colors      text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_print_techniques_area on public.print_techniques(print_area_id);

create table if not exists public.print_price_tiers (
  id                                uuid primary key default gen_random_uuid(),
  print_technique_id                uuid not null references public.print_techniques(id) on delete cascade,
  min_quantity                      integer not null check (min_quantity >= 1),
  setup_cost_cents                  integer not null default 0 check (setup_cost_cents >= 0),
  purchase_price_per_unit_cents     integer not null check (purchase_price_per_unit_cents >= 0),
  selling_price_per_unit_cents      integer not null check (selling_price_per_unit_cents >= 0),
  is_manual_override                boolean not null default false,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),
  constraint print_price_tiers_unique unique (print_technique_id, min_quantity)
);

create index if not exists idx_print_price_tiers_tech_qty
  on public.print_price_tiers(print_technique_id, min_quantity);
