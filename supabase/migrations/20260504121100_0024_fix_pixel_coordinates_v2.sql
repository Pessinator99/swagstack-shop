-- ============================================================================
-- 0024 — Logo-Koordinaten v2 (Henkel-Overlap, schmalere Flächen)
-- ============================================================================

-- COMANDER: Becher leicht von der Seite, Henkel rechts bei ~x=640
-- Vorderfläche: ungefähr x=155 bis x=620
update public.print_areas pa
set pixel_coordinates = '{
  "x": 170, "y": 270, "width": 300, "height": 200,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Körper'
  and pa.product_id = (select id from public.products where slug = 'comander-keramikbecher-370ml');

-- CINANDER: ähnliche Form wie COMANDER, etwas schlanker
update public.print_areas pa
set pixel_coordinates = '{
  "x": 175, "y": 255, "width": 290, "height": 185,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Gefäß oben'
  and pa.product_id = (select id from public.products where slug = 'cinander-keramikbecher-weiss');

-- NICKLAUS: Flasche stehend, schmaler Körper mittig im Bild
-- Flasche-Körper ca. x=270 bis x=540, mitte bei ca. y=300-550
update public.print_areas pa
set pixel_coordinates = '{
  "x": 285, "y": 310, "width": 230, "height": 240,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Körper'
  and pa.product_id = (select id from public.products where slug = 'nicklaus-edelstahlflasche-590ml');

-- CANARY: Tasche frontal, große Fläche, Henkel oben nicht bedruckbar
-- Bedruckbar ca. x=120 bis x=560, y=220 bis y=680
update public.print_areas pa
set pixel_coordinates = '{
  "x": 130, "y": 240, "width": 420, "height": 380,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Vorderseite'
  and pa.product_id = (select id from public.products where slug = 'canary-einkaufstasche-non-woven');

-- BOSTON: Fronttasche mittig, kleines Fach in der Mitte
-- Fronttasche ca. x=280 bis x=490, y=270 bis y=430
update public.print_areas pa
set pixel_coordinates = '{
  "x": 290, "y": 280, "width": 190, "height": 160,
  "image_width": 800, "image_height": 800
}'::jsonb
where pa.name = 'Vordertasche mittig'
  and pa.product_id = (select id from public.products where slug = 'boston-laptop-rucksack-17');
