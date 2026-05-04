-- ============================================================================
-- 0016 — Storage bucket "product-images" + product print/variant extensions
-- ============================================================================

-- ---- public schema: columns used by Stricker catalog -----------------------
alter table public.product_variants
  add column if not exists color_hex text,
  add column if not exists additional_images jsonb not null default '[]'::jsonb,
  add column if not exists sku text;

alter table public.print_areas
  add column if not exists max_width_mm integer,
  add column if not exists max_height_mm integer,
  add column if not exists pixel_coordinates jsonb;

alter table public.print_techniques
  add column if not exists is_full_color boolean not null default false,
  add column if not exists is_engraving boolean not null default false;

comment on column public.print_areas.pixel_coordinates is 'Optional ColorMatch overlay coords; NULL until configured.';

-- ---- storage bucket ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  52428800,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS policies on storage.objects (bucket is public read; writes restricted)
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
  );

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
