-- ============================================================================
-- 0012 — Functions & triggers
--
--   • set_updated_at() — generic trigger to keep updated_at fresh.
--   • generate_order_number() + set_order_number() — auto order numbers.
--   • handle_new_user() — on auth.users insert:
--        - always inserts a customers row (idempotent),
--        - promotes the bootstrap admin email to owner.
--
--   The bootstrap email is stored in `settings` under key 'admin_bootstrap_email'
--   — the seed script writes it from the ADMIN_BOOTSTRAP_EMAIL env var.
-- ============================================================================

-- ---- updated_at ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_categories_updated_at            on public.categories;
drop trigger if exists trg_products_updated_at              on public.products;
drop trigger if exists trg_product_price_tiers_updated_at   on public.product_price_tiers;
drop trigger if exists trg_print_price_tiers_updated_at     on public.print_price_tiers;
drop trigger if exists trg_customers_updated_at             on public.customers;
drop trigger if exists trg_admin_users_updated_at           on public.admin_users;
drop trigger if exists trg_settings_updated_at              on public.settings;

create trigger trg_categories_updated_at          before update on public.categories            for each row execute function public.set_updated_at();
create trigger trg_products_updated_at            before update on public.products              for each row execute function public.set_updated_at();
create trigger trg_product_price_tiers_updated_at before update on public.product_price_tiers   for each row execute function public.set_updated_at();
create trigger trg_print_price_tiers_updated_at   before update on public.print_price_tiers     for each row execute function public.set_updated_at();
create trigger trg_customers_updated_at           before update on public.customers             for each row execute function public.set_updated_at();
create trigger trg_admin_users_updated_at         before update on public.admin_users           for each row execute function public.set_updated_at();
create trigger trg_settings_updated_at            before update on public.settings              for each row execute function public.set_updated_at();


-- ---- order numbers ---------------------------------------------------------
create or replace function public.generate_order_number()
returns text language plpgsql as $$
declare
  v_candidate text;
  v_try       integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_candidate :=
      'SS-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad((floor(random() * 10000))::text, 4, '0');
    exit when not exists (select 1 from public.orders where order_number = v_candidate);
    if v_try > 20 then raise exception 'could not allocate unique order number'; end if;
  end loop;
  return v_candidate;
end;
$$;

create or replace function public.set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.generate_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_order_number on public.orders;
create trigger trg_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();


-- ---- handle new auth.users --------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_bootstrap_email text;
begin
  -- 1) Always create a matching customers row (idempotent).
  insert into public.customers (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- 2) If email matches the configured bootstrap address → owner.
  select value ->> 'email' into v_bootstrap_email
  from public.settings
  where key = 'admin_bootstrap_email';

  if v_bootstrap_email is not null
     and lower(v_bootstrap_email) = lower(new.email)
  then
    insert into public.admin_users (id, role)
    values (new.id, 'owner')
    on conflict (id) do update set role = 'owner', updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
