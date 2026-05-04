-- ============================================================================
-- 0022 — Schätz-pixel_coordinates für ColorMatch/PDP (Referenz 800×800 px)
--        Lookup: products.slug + print_areas.name
--        JSON enthält image_width/height → Parser normalisiert auf 0–1
-- ============================================================================

-- NICKLAUS Edelstahlflasche — Druckfläche „Körper“
update public.print_areas pa
set pixel_coordinates = jsonb_build_object(
  'x', 280,
  'y', 350,
  'width', 260,
  'height', 280,
  'image_width', 800,
  'image_height', 800
)
from public.products p
where pa.product_id = p.id
  and p.slug = 'nicklaus-edelstahlflasche-590ml'
  and pa.name = 'Körper';

-- COMANDER Keramikbecher — „Körper“
update public.print_areas pa
set pixel_coordinates = jsonb_build_object(
  'x', 220,
  'y', 250,
  'width', 320,
  'height', 200,
  'image_width', 800,
  'image_height', 800
)
from public.products p
where pa.product_id = p.id
  and p.slug = 'comander-keramikbecher-370ml'
  and pa.name = 'Körper';

-- CINANDER Keramikbecher — „Gefäß oben“
update public.print_areas pa
set pixel_coordinates = jsonb_build_object(
  'x', 180,
  'y', 200,
  'width', 360,
  'height', 200,
  'image_width', 800,
  'image_height', 800
)
from public.products p
where pa.product_id = p.id
  and p.slug = 'cinander-keramikbecher-weiss'
  and pa.name = 'Gefäß oben';

-- CANARY Einkaufstasche — „Vorderseite“
update public.print_areas pa
set pixel_coordinates = jsonb_build_object(
  'x', 150,
  'y', 250,
  'width', 400,
  'height', 400,
  'image_width', 800,
  'image_height', 800
)
from public.products p
where pa.product_id = p.id
  and p.slug = 'canary-einkaufstasche-non-woven'
  and pa.name = 'Vorderseite';

-- BOSTON Laptop-Rucksack — „Vordertasche mittig“
update public.print_areas pa
set pixel_coordinates = jsonb_build_object(
  'x', 280,
  'y', 280,
  'width', 200,
  'height', 200,
  'image_width', 800,
  'image_height', 800
)
from public.products p
where pa.product_id = p.id
  and p.slug = 'boston-laptop-rucksack-17'
  and pa.name = 'Vordertasche mittig';
