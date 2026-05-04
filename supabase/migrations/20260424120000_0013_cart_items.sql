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
