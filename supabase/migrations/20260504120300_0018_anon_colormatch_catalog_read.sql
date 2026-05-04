-- ============================================================================
-- 0018 — Anonymous read of active catalog slices for public ColorMatch page
--         (no price tables; same row visibility as authenticated catalog SELECT)
-- ============================================================================

drop policy if exists "products_anon_active_select" on public.products;
create policy "products_anon_active_select" on public.products
  for select to anon
  using (status = 'active');

drop policy if exists "variants_anon_active_select" on public.product_variants;
create policy "variants_anon_active_select" on public.product_variants
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists "print_areas_anon_active_select" on public.print_areas;
create policy "print_areas_anon_active_select" on public.print_areas
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );
