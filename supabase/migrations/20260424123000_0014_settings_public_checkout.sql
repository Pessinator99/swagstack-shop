-- ============================================================================
-- 0014 — Public checkout-related settings for authenticated users
-- ============================================================================

insert into public.settings (key, value)
values
  ('free_shipping_threshold_cents', to_jsonb(25000)),
  ('default_shipping_cents_net', to_jsonb(990)),
  ('vat_rate_percent', to_jsonb(19))
on conflict (key) do nothing;

drop policy if exists "settings_admin_only" on public.settings;
drop policy if exists "settings_authenticated_checkout_read" on public.settings;

create policy "settings_authenticated_checkout_read" on public.settings
  for select to authenticated
  using (
    key in (
      'free_shipping_threshold_cents',
      'default_shipping_cents_net',
      'vat_rate_percent'
    )
  );

create policy "settings_admin_only" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
