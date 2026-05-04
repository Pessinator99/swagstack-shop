-- ============================================================================
-- 0021 — Repair: anon SELECT on public price views (REST 401 ohne diese Grants)
--        Idempotent; ergänzt 0020 falls Views nach 0010 ohne anon-Recht blieben.
-- ============================================================================

grant select on public.product_prices_public to anon;
grant select on public.print_prices_public to anon;
