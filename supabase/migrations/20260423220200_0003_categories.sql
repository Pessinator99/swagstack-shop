-- ============================================================================
-- 0003 — Categories (tree)
-- ============================================================================
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  description      text,
  parent_id        uuid references public.categories(id) on delete set null,
  margin_percent   numeric(5,2) not null default 40.00,
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_active_sort on public.categories(is_active, sort_order);
