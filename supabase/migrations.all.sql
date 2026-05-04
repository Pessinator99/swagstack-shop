-- =====================================================================
-- Swagstack Shop – combined migration bundle
-- Generated from supabase/migrations/*.sql
-- Paste into Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- ===== 20260423220000_0001_extensions.sql =====
-- ============================================================================
-- 0001 — Extensions
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ===== 20260423220100_0002_enums.sql =====
-- ============================================================================
-- 0002 — Enum types
-- ============================================================================
do $$ begin
  create type product_status as enum ('pending','active','inactive','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'pending','paid','in_production','shipped','delivered','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('owner','admin','editor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type supplier_code as enum ('stricker','pfconcept','makito','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type variant_type as enum ('color','size');
exception when duplicate_object then null; end $$;

do $$ begin
  create type perspective_hint as enum ('flat','cylindrical','angled');
exception when duplicate_object then null; end $$;

-- ===== 20260423220200_0003_categories.sql =====
-- ============================================================================
-- 0003 — Categories (tree)
-- ============================================================================
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  description      text,
  parent_id        uuid references public.categories(id) on delete set null,
  margin_percent   numeric(5,2) not null default 40.00,
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_active_sort on public.categories(is_active, sort_order);

-- ===== 20260423220300_0004_products.sql =====
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

-- ===== 20260423220400_0005_pricing.sql =====
-- ============================================================================
-- 0005 — Product price tiers (EK + VK). Customers never read this table directly
--        — only through the product_prices_public view (migration 0010).
-- ============================================================================
create table if not exists public.product_price_tiers (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products(id) on delete cascade,
  min_quantity          integer not null check (min_quantity >= 1),
  purchase_price_cents  integer not null check (purchase_price_cents >= 0),
  selling_price_cents   integer not null check (selling_price_cents >= 0),
  is_manual_override    boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint price_tiers_unique unique (product_id, min_quantity)
);

create index if not exists idx_price_tiers_product_qty
  on public.product_price_tiers(product_id, min_quantity);

-- ===== 20260423220500_0006_print.sql =====
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

-- ===== 20260423220600_0007_customers.sql =====
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

-- ===== 20260423220700_0008_orders.sql =====
-- ============================================================================
-- 0008 — Orders + Order items
-- ============================================================================
create table if not exists public.orders (
  id                           uuid primary key default gen_random_uuid(),
  customer_id                  uuid not null references public.customers(id) on delete restrict,
  order_number                 text unique,                    -- filled by trigger
  status                       order_status not null default 'pending',
  subtotal_cents               integer not null default 0,
  vat_cents                    integer not null default 0,
  shipping_cents               integer not null default 0,
  total_cents                  integer not null default 0,
  stripe_payment_intent_id     text,
  stripe_checkout_session_id   text,
  shipping_address             jsonb,
  billing_address              jsonb,
  invoice_pdf_url              text,
  notes                        text,
  created_at                   timestamptz not null default now(),
  paid_at                      timestamptz,
  shipped_at                   timestamptz
);

create index if not exists idx_orders_customer_created
  on public.orders(customer_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_stripe_session
  on public.orders(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

create table if not exists public.order_items (
  id                         uuid primary key default gen_random_uuid(),
  order_id                   uuid not null references public.orders(id) on delete cascade,
  product_id                 uuid references public.products(id) on delete set null,
  variant_id                 uuid references public.product_variants(id) on delete set null,
  print_technique_id         uuid references public.print_techniques(id) on delete set null,
  quantity                   integer not null check (quantity >= 1),
  unit_price_cents           integer not null check (unit_price_cents >= 0),
  print_setup_cents          integer not null default 0 check (print_setup_cents >= 0),
  print_unit_price_cents     integer not null default 0 check (print_unit_price_cents >= 0),
  line_total_cents           integer not null check (line_total_cents >= 0),
  logo_id                    uuid references public.customer_logos(id) on delete set null,
  product_snapshot           jsonb
);

create index if not exists idx_order_items_order on public.order_items(order_id);

-- ===== 20260423220800_0009_admin.sql =====
-- ============================================================================
-- 0009 — Admin users, global settings, supplier sync logs
-- ============================================================================
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.supplier_sync_logs (
  id                uuid primary key default gen_random_uuid(),
  supplier_code     supplier_code not null,
  sync_type         text not null,                    -- 'products' | 'prices' | 'stock'
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text,                             -- 'running' | 'success' | 'failed'
  items_processed   integer not null default 0,
  items_failed      integer not null default 0,
  error_log         jsonb
);

create index if not exists idx_sync_logs_supplier_started
  on public.supplier_sync_logs(supplier_code, started_at desc);

-- ===== 20260423220900_0010_public_views.sql =====
-- ============================================================================
-- 0010 — Public price views (NO EK/purchase_price_cents!)
--
-- Customers never read product_price_tiers or print_price_tiers directly —
-- their RLS policies deny all customer access. Instead, these views are the
-- sanctioned public interface. They:
--   1) explicitly select ONLY selling-side columns,
--   2) run with security_invoker = false (owner = postgres) so they bypass
--      the underlying tables' RLS while still only exposing safe columns,
--   3) are granted only to the authenticated role (anon has no access to
--      any pricing, by design – the shop is login-gated).
-- ============================================================================

drop view if exists public.product_prices_public cascade;

create view public.product_prices_public
with (security_invoker = false) as
select
  pt.id,
  pt.product_id,
  pt.min_quantity,
  pt.selling_price_cents
from public.product_price_tiers pt
join public.products p on p.id = pt.product_id
where p.status = 'active';

revoke all on public.product_prices_public from public, anon;
grant select on public.product_prices_public to authenticated;


drop view if exists public.print_prices_public cascade;

create view public.print_prices_public
with (security_invoker = false) as
select
  ppt.id,
  ppt.print_technique_id,
  ppt.min_quantity,
  ppt.setup_cost_cents,
  ppt.selling_price_per_unit_cents
from public.print_price_tiers ppt
join public.print_techniques pt  on pt.id = ppt.print_technique_id
join public.print_areas pa       on pa.id = pt.print_area_id
join public.products p           on p.id  = pa.product_id
where p.status = 'active';

revoke all on public.print_prices_public from public, anon;
grant select on public.print_prices_public to authenticated;

-- ===== 20260423221000_0011_rls_policies.sql =====
-- ============================================================================
-- 0011 — Row-Level-Security: policies for every table with user data.
--
-- Conventions:
--   • `is_admin()` / `is_owner()` are SECURITY DEFINER helpers — they bypass
--     RLS on admin_users internally to avoid infinite recursion.
--   • Customers always operate as the authenticated role.
--   • The service role key (used by server actions, webhooks, cron jobs,
--     seed scripts) bypasses ALL policies by default. Keep it server-side.
-- ============================================================================

-- ---- Helper functions ------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and role = 'owner'
  );
$$;

grant execute on function public.is_admin()  to authenticated, anon;
grant execute on function public.is_owner()  to authenticated, anon;


-- ---- categories ------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists "cat_public_select"  on public.categories;
drop policy if exists "cat_admin_all"      on public.categories;

create policy "cat_public_select" on public.categories
  for select
  using (is_active = true);

create policy "cat_admin_all" on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- products --------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "products_authenticated_active"  on public.products;
drop policy if exists "products_admin_all"             on public.products;

create policy "products_authenticated_active" on public.products
  for select to authenticated
  using (status = 'active');

create policy "products_admin_all" on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- product_variants ------------------------------------------------------
alter table public.product_variants enable row level security;

drop policy if exists "variants_authenticated_active"  on public.product_variants;
drop policy if exists "variants_admin_all"             on public.product_variants;

create policy "variants_authenticated_active" on public.product_variants
  for select to authenticated
  using (
    exists (select 1 from public.products p
            where p.id = product_id and p.status = 'active')
  );

create policy "variants_admin_all" on public.product_variants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- product_price_tiers ---------------------------------------------------
-- Customers NEVER read this directly. They use product_prices_public view.
alter table public.product_price_tiers enable row level security;

drop policy if exists "price_tiers_admin_only" on public.product_price_tiers;

create policy "price_tiers_admin_only" on public.product_price_tiers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- print_areas -----------------------------------------------------------
alter table public.print_areas enable row level security;

drop policy if exists "print_areas_authenticated_active"  on public.print_areas;
drop policy if exists "print_areas_admin_all"             on public.print_areas;

create policy "print_areas_authenticated_active" on public.print_areas
  for select to authenticated
  using (
    exists (select 1 from public.products p
            where p.id = product_id and p.status = 'active')
  );

create policy "print_areas_admin_all" on public.print_areas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- print_techniques ------------------------------------------------------
alter table public.print_techniques enable row level security;

drop policy if exists "print_tech_authenticated"  on public.print_techniques;
drop policy if exists "print_tech_admin_all"      on public.print_techniques;

create policy "print_tech_authenticated" on public.print_techniques
  for select to authenticated
  using (
    exists (
      select 1
      from public.print_areas pa
      join public.products p on p.id = pa.product_id
      where pa.id = print_area_id and p.status = 'active'
    )
  );

create policy "print_tech_admin_all" on public.print_techniques
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- print_price_tiers -----------------------------------------------------
-- Customers use print_prices_public view; direct access is admin-only.
alter table public.print_price_tiers enable row level security;

drop policy if exists "print_price_tiers_admin_only" on public.print_price_tiers;

create policy "print_price_tiers_admin_only" on public.print_price_tiers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- customers -------------------------------------------------------------
alter table public.customers enable row level security;

drop policy if exists "customers_self_select"  on public.customers;
drop policy if exists "customers_self_update"  on public.customers;
drop policy if exists "customers_self_insert"  on public.customers;
drop policy if exists "customers_admin_all"    on public.customers;

create policy "customers_self_select" on public.customers
  for select to authenticated
  using (id = auth.uid());

create policy "customers_self_update" on public.customers
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "customers_self_insert" on public.customers
  for insert to authenticated
  with check (id = auth.uid());

create policy "customers_admin_all" on public.customers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- customer_logos --------------------------------------------------------
alter table public.customer_logos enable row level security;

drop policy if exists "logos_self_all"   on public.customer_logos;
drop policy if exists "logos_admin_all"  on public.customer_logos;

create policy "logos_self_all" on public.customer_logos
  for all to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "logos_admin_all" on public.customer_logos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- orders ----------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists "orders_self_select"  on public.orders;
drop policy if exists "orders_self_insert"  on public.orders;
drop policy if exists "orders_admin_all"    on public.orders;

create policy "orders_self_select" on public.orders
  for select to authenticated
  using (customer_id = auth.uid());

create policy "orders_self_insert" on public.orders
  for insert to authenticated
  with check (customer_id = auth.uid());

create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- order_items -----------------------------------------------------------
alter table public.order_items enable row level security;

drop policy if exists "order_items_self_select"  on public.order_items;
drop policy if exists "order_items_self_insert"  on public.order_items;
drop policy if exists "order_items_admin_all"    on public.order_items;

create policy "order_items_self_select" on public.order_items
  for select to authenticated
  using (
    exists (select 1 from public.orders o
            where o.id = order_id and o.customer_id = auth.uid())
  );

create policy "order_items_self_insert" on public.order_items
  for insert to authenticated
  with check (
    exists (select 1 from public.orders o
            where o.id = order_id and o.customer_id = auth.uid())
  );

create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- admin_users -----------------------------------------------------------
-- Only owners can manage the admin team. Everyone authenticated can check
-- their own row (used by admin layout to gate access).
alter table public.admin_users enable row level security;

drop policy if exists "admin_users_self_select"     on public.admin_users;
drop policy if exists "admin_users_owner_manage"    on public.admin_users;

create policy "admin_users_self_select" on public.admin_users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "admin_users_owner_manage" on public.admin_users
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());


-- ---- settings --------------------------------------------------------------
alter table public.settings enable row level security;

drop policy if exists "settings_admin_only" on public.settings;

create policy "settings_admin_only" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---- supplier_sync_logs ----------------------------------------------------
alter table public.supplier_sync_logs enable row level security;

drop policy if exists "sync_logs_admin_only" on public.supplier_sync_logs;

create policy "sync_logs_admin_only" on public.supplier_sync_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== 20260423221100_0012_functions_triggers.sql =====
-- ============================================================================
-- 0012 — Functions & triggers
--
--   • set_updated_at() — generic trigger to keep updated_at fresh.
--   • generate_order_number() + set_order_number() — auto order numbers.
--   • handle_new_user() — on auth.users insert:
--        - always inserts a customers row (idempotent),
--        - promotes the bootstrap admin email to owner.
--
--   The bootstrap email is stored in `settings` under key 'admin_bootstrap_email'
--   — the seed script writes it from the ADMIN_BOOTSTRAP_EMAIL env var.
-- ============================================================================

-- ---- updated_at ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_categories_updated_at            on public.categories;
drop trigger if exists trg_products_updated_at              on public.products;
drop trigger if exists trg_product_price_tiers_updated_at   on public.product_price_tiers;
drop trigger if exists trg_print_price_tiers_updated_at     on public.print_price_tiers;
drop trigger if exists trg_customers_updated_at             on public.customers;
drop trigger if exists trg_admin_users_updated_at           on public.admin_users;
drop trigger if exists trg_settings_updated_at              on public.settings;

create trigger trg_categories_updated_at          before update on public.categories            for each row execute function public.set_updated_at();
create trigger trg_products_updated_at            before update on public.products              for each row execute function public.set_updated_at();
create trigger trg_product_price_tiers_updated_at before update on public.product_price_tiers   for each row execute function public.set_updated_at();
create trigger trg_print_price_tiers_updated_at   before update on public.print_price_tiers     for each row execute function public.set_updated_at();
create trigger trg_customers_updated_at           before update on public.customers             for each row execute function public.set_updated_at();
create trigger trg_admin_users_updated_at         before update on public.admin_users           for each row execute function public.set_updated_at();
create trigger trg_settings_updated_at            before update on public.settings              for each row execute function public.set_updated_at();


-- ---- order numbers ---------------------------------------------------------
create or replace function public.generate_order_number()
returns text language plpgsql as $$
declare
  v_candidate text;
  v_try       integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_candidate :=
      'SS-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad((floor(random() * 10000))::text, 4, '0');
    exit when not exists (select 1 from public.orders where order_number = v_candidate);
    if v_try > 20 then raise exception 'could not allocate unique order number'; end if;
  end loop;
  return v_candidate;
end;
$$;

create or replace function public.set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.generate_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_order_number on public.orders;
create trigger trg_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();


-- ---- handle new auth.users --------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_bootstrap_email text;
begin
  -- 1) Always create a matching customers row (idempotent).
  insert into public.customers (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- 2) If email matches the configured bootstrap address → owner.
  select value ->> 'email' into v_bootstrap_email
  from public.settings
  where key = 'admin_bootstrap_email';

  if v_bootstrap_email is not null
     and lower(v_bootstrap_email) = lower(new.email)
  then
    insert into public.admin_users (id, role)
    values (new.id, 'owner')
    on conflict (id) do update set role = 'owner', updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 20260424120000_0013_cart_items.sql =====
-- ============================================================================
-- 0013 — cart_items (persistent customer cart)
-- ============================================================================

create table if not exists public.cart_items (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references auth.users(id) on delete cascade,
  product_id           uuid not null references public.products(id) on delete cascade,
  variant_id           uuid references public.product_variants(id) on delete set null,
  print_technique_id   uuid references public.print_techniques(id) on delete set null,
  print_colors         integer,
  quantity             integer not null check (quantity > 0),
  added_at             timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists idx_cart_items_customer_product_variant_print
  on public.cart_items (
    customer_id,
    product_id,
    variant_id,
    print_technique_id,
    coalesce(print_colors, 0)
  );

create index if not exists idx_cart_items_customer_added
  on public.cart_items(customer_id, added_at desc);

alter table public.cart_items enable row level security;

drop policy if exists "cart_items_self_select" on public.cart_items;
drop policy if exists "cart_items_self_insert" on public.cart_items;
drop policy if exists "cart_items_self_update" on public.cart_items;
drop policy if exists "cart_items_self_delete" on public.cart_items;
drop policy if exists "cart_items_admin_all" on public.cart_items;

create policy "cart_items_self_select" on public.cart_items
  for select to authenticated
  using (customer_id = auth.uid());

create policy "cart_items_self_insert" on public.cart_items
  for insert to authenticated
  with check (customer_id = auth.uid());

create policy "cart_items_self_update" on public.cart_items
  for update to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "cart_items_self_delete" on public.cart_items
  for delete to authenticated
  using (customer_id = auth.uid());

create policy "cart_items_admin_all" on public.cart_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ===== 20260424123000_0014_settings_public_checkout.sql =====
-- ============================================================================
-- 0014 — Public checkout-related settings for authenticated users
-- ============================================================================

insert into public.settings (key, value)
values
  ('free_shipping_threshold_cents', to_jsonb(25000)),
  ('default_shipping_cents_net', to_jsonb(990)),
  ('vat_rate_percent', to_jsonb(19))
on conflict (key) do nothing;

drop policy if exists "settings_admin_only" on public.settings;
drop policy if exists "settings_authenticated_checkout_read" on public.settings;

create policy "settings_authenticated_checkout_read" on public.settings
  for select to authenticated
  using (
    key in (
      'free_shipping_threshold_cents',
      'default_shipping_cents_net',
      'vat_rate_percent'
    )
  );

create policy "settings_admin_only" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== 20260503120000_0015_email_logs.sql =====
-- ============================================================================
-- 0015 — E-Mail-Versand-Protokoll (Bestellbestätigung etc.)
-- ============================================================================
create table if not exists public.email_logs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  template    text not null,
  sent_at     timestamptz not null default now(),
  status      text not null check (status in ('sent', 'failed')),
  error       jsonb
);

create index if not exists idx_email_logs_order on public.email_logs(order_id, sent_at desc);

alter table public.email_logs enable row level security;

drop policy if exists "email_logs_admin_select" on public.email_logs;

-- Nur Admins lesen; Inserts laufen über Service-Role (bypass RLS).
create policy "email_logs_admin_select" on public.email_logs
  for select to authenticated
  using (public.is_admin());
