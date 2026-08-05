-- YKS Platform basit istatistikleri
-- Supabase SQL Editor'da çalıştırın.

create table if not exists public.yks_usage_stats (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.yks_active_sessions (
  session_id text primary key,
  last_seen timestamptz not null default now()
);

alter table public.yks_usage_stats enable row level security;
alter table public.yks_active_sessions enable row level security;

drop policy if exists "yks_usage_stats_public_read" on public.yks_usage_stats;
create policy "yks_usage_stats_public_read"
  on public.yks_usage_stats for select using (true);

drop policy if exists "yks_usage_stats_public_write" on public.yks_usage_stats;
create policy "yks_usage_stats_public_write"
  on public.yks_usage_stats for all using (true) with check (true);

drop policy if exists "yks_active_sessions_public_read" on public.yks_active_sessions;
create policy "yks_active_sessions_public_read"
  on public.yks_active_sessions for select using (true);

drop policy if exists "yks_active_sessions_public_write" on public.yks_active_sessions;
create policy "yks_active_sessions_public_write"
  on public.yks_active_sessions for all using (true) with check (true);

create or replace function public.increment_yks_stat(stat_key text, amount int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.yks_usage_stats (key, value, updated_at)
  values (stat_key, amount, now())
  on conflict (key)
  do update set
    value = public.yks_usage_stats.value + excluded.value,
    updated_at = now();
end;
$$;

grant execute on function public.increment_yks_stat(text, int) to anon, authenticated;
