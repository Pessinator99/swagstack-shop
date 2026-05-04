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
