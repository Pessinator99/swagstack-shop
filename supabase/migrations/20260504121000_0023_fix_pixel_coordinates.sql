-- ============================================================================
-- 0023 — Feintuning pixel_coordinates (Marketing / Becher / weitere Artikel)
-- ============================================================================

update public.print_areas pa
set pixel_coordinates = '{
  "x": 170, "y": 270, "width": 380, "height": 220,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Gefäß oben'
  and pa.product_id = (select id from public.products where slug = 'cinander-keramikbecher-weiss');

update public.print_areas pa
set pixel_coordinates = '{
  "x": 160, "y": 260, "width": 400, "height": 230,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Körper'
  and pa.product_id = (select id from public.products where slug = 'comander-keramikbecher-370ml');

update public.print_areas pa
set pixel_coordinates = '{
  "x": 250, "y": 320, "width": 280, "height": 260,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Körper'
  and pa.product_id = (select id from public.products where slug = 'nicklaus-edelstahlflasche-590ml');

update public.print_areas pa
set pixel_coordinates = '{
  "x": 130, "y": 220, "width": 440, "height": 420,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Vorderseite'
  and pa.product_id = (select id from public.products where slug = 'canary-einkaufstasche-non-woven');

update public.print_areas pa
set pixel_coordinates = '{
  "x": 260, "y": 260, "width": 220, "height": 220,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Vordertasche mittig'
  and pa.product_id = (select id from public.products where slug = 'boston-laptop-rucksack-17');
