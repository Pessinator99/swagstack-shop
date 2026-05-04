-- ============================================================================
-- 0017 — Remove legacy Picsum demo product catalog (6 products)
--
-- Bestehende Bestellpositionen können noch FKs auf Varianten/Techniken haben.
-- Diese werden vor dem Löschen der Produkte explizit aufgelöst.
--
-- Re-populate catalog: `pnpm db:seed`
-- Upload binaries: `pnpm upload:images`
-- ============================================================================

do $$
declare
  legacy_slugs text[] := array[
    'canary-einkaufstasche-non-woven',
    'comander-keramikbecher-370ml',
    'cinander-keramikbecher-weiss',
    'cinander-keramikbecher-farbig',
    'nicklaus-edelstahlflasche-590ml',
    'boston-laptop-rucksack-17'
  ];
begin
  -- Warenkorb: Zeilen zu Demo-Produkten entfernen (product_id NOT NULL + CASCADE)
  delete from public.cart_items
  where product_id in (select id from public.products where slug = any (legacy_slugs));

  -- Bestellpositionen: FKs auflösen, bevor Druck-Stack gelöscht wird
  update public.order_items oi
  set print_technique_id = null
  where oi.print_technique_id in (
    select pt.id
    from public.print_techniques pt
    join public.print_areas pa on pa.id = pt.print_area_id
    join public.products p on p.id = pa.product_id
    where p.slug = any (legacy_slugs)
  );

  update public.order_items oi
  set variant_id = null
  where oi.variant_id in (
    select pv.id
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where p.slug = any (legacy_slugs)
  );

  update public.order_items oi
  set product_id = null
  where oi.product_id in (select id from public.products where slug = any (legacy_slugs));

  delete from public.products where slug = any (legacy_slugs);
end $$;
