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
