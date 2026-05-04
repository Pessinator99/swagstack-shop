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
