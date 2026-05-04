-- ============================================================================
-- 0009 — Admin users, global settings, supplier sync logs
-- ============================================================================
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.supplier_sync_logs (
  id                uuid primary key default gen_random_uuid(),
  supplier_code     supplier_code not null,
  sync_type         text not null,                    -- 'products' | 'prices' | 'stock'
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text,                             -- 'running' | 'success' | 'failed'
  items_processed   integer not null default 0,
  items_failed      integer not null default 0,
  error_log         jsonb
);

create index if not exists idx_sync_logs_supplier_started
  on public.supplier_sync_logs(supplier_code, started_at desc);
