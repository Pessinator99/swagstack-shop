-- ============================================================================
-- 0019 — Public ColorMatch / catalog reads for guests (anon)
--         - Explicit SELECT grants (some projects lack default table grants)
--         - RLS policies for products + nested product_variants + print_areas
--         - Storage: confirm product-images bucket + public read for anon
-- ============================================================================

-- ---- Table privileges (required for PostgREST + nested selects) -----------
grant select on table public.products to anon;
grant select on table public.product_variants to anon;
grant select on table public.print_areas to anon;

-- ---- RLS: active catalog only (no admin paths) -----------------------------
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

-- ---- Storage: public bucket + anon/authenticated read on objects ----------
update storage.buckets
  set public = true
  where id = 'product-images';

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');
