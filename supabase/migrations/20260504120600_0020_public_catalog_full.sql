-- ============================================================================
-- 0020 — Public catalog (anon): full read for shop browsing + VK price views
--
--  • Katalog-Tabellen: GRANT SELECT + RLS für Rolle anon (nur aktive Produkte).
--  • Preise (VK) für Gäste: product_prices_public + print_prices_public
--    (keine purchase_* / EK-Spalten).
--  • KEIN direkter anon-SELECT auf product_price_tiers / print_price_tiers:
--    dort liegen purchase_price_cents / purchase_price_per_unit_cents (EK).
--  • settings: nur Zeile delivery_info für PDP-Lieferhinweis.
-- ============================================================================

-- ---- Privileges -----------------------------------------------------------
grant select on table public.categories to anon;
grant select on table public.products to anon;
grant select on table public.product_variants to anon;
grant select on table public.print_areas to anon;
grant select on table public.print_techniques to anon;
grant select on table public.product_prices_public to anon;
grant select on table public.print_prices_public to anon;

-- ---- products (status = 'active' — Projekt-Enum product_status) ------------
drop policy if exists "products_anon_active_select" on public.products;
create policy "products_anon_active_select" on public.products
  for select to anon
  using (status = 'active');

-- ---- product_variants -----------------------------------------------------
drop policy if exists "variants_anon_active_select" on public.product_variants;
create policy "variants_anon_active_select" on public.product_variants
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

-- ---- print_areas ----------------------------------------------------------
drop policy if exists "print_areas_anon_active_select" on public.print_areas;
create policy "print_areas_anon_active_select" on public.print_areas
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

-- ---- print_techniques -----------------------------------------------------
drop policy if exists "print_techniques_anon_active_select" on public.print_techniques;
create policy "print_techniques_anon_active_select" on public.print_techniques
  for select to anon
  using (
    exists (
      select 1
      from public.print_areas pa
      join public.products p on p.id = pa.product_id
      where pa.id = print_area_id and p.status = 'active'
    )
  );

-- ---- settings: Lieferinfo für PDP (keine anderen Keys) --------------------
drop policy if exists "settings_delivery_info_public_select" on public.settings;
create policy "settings_delivery_info_public_select" on public.settings
  for select to anon, authenticated
  using (key = 'delivery_info');
