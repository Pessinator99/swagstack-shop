-- ============================================================================
-- 0010 — Public price views (NO EK/purchase_price_cents!)
--
-- Customers never read product_price_tiers or print_price_tiers directly —
-- their RLS policies deny all customer access. Instead, these views are the
-- sanctioned public interface. They:
--   1) explicitly select ONLY selling-side columns,
--   2) run with security_invoker = false (owner = postgres) so they bypass
--      the underlying tables' RLS while still only exposing safe columns,
--   3) are granted only to the authenticated role (anon has no access to
--      any pricing, by design – the shop is login-gated).
-- ============================================================================

drop view if exists public.product_prices_public cascade;

create view public.product_prices_public
with (security_invoker = false) as
select
  pt.id,
  pt.product_id,
  pt.min_quantity,
  pt.selling_price_cents
from public.product_price_tiers pt
join public.products p on p.id = pt.product_id
where p.status = 'active';

revoke all on public.product_prices_public from public, anon;
grant select on public.product_prices_public to authenticated;


drop view if exists public.print_prices_public cascade;

create view public.print_prices_public
with (security_invoker = false) as
select
  ppt.id,
  ppt.print_technique_id,
  ppt.min_quantity,
  ppt.setup_cost_cents,
  ppt.selling_price_per_unit_cents
from public.print_price_tiers ppt
join public.print_techniques pt  on pt.id = ppt.print_technique_id
join public.print_areas pa       on pa.id = pt.print_area_id
join public.products p           on p.id  = pa.product_id
where p.status = 'active';

revoke all on public.print_prices_public from public, anon;
grant select on public.print_prices_public to authenticated;
