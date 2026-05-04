-- ============================================================================
-- 0002 — Enum types
-- ============================================================================
do $$ begin
  create type product_status as enum ('pending','active','inactive','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'pending','paid','in_production','shipped','delivered','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('owner','admin','editor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type supplier_code as enum ('stricker','pfconcept','makito','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type variant_type as enum ('color','size');
exception when duplicate_object then null; end $$;

do $$ begin
  create type perspective_hint as enum ('flat','cylindrical','angled');
exception when duplicate_object then null; end $$;
