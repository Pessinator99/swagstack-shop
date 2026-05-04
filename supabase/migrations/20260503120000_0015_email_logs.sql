-- ============================================================================
-- 0015 — E-Mail-Versand-Protokoll (Bestellbestätigung etc.)
-- ============================================================================
create table if not exists public.email_logs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  template    text not null,
  sent_at     timestamptz not null default now(),
  status      text not null check (status in ('sent', 'failed')),
  error       jsonb
);

create index if not exists idx_email_logs_order on public.email_logs(order_id, sent_at desc);

alter table public.email_logs enable row level security;

drop policy if exists "email_logs_admin_select" on public.email_logs;

-- Nur Admins lesen; Inserts laufen über Service-Role (bypass RLS).
create policy "email_logs_admin_select" on public.email_logs
  for select to authenticated
  using (public.is_admin());
