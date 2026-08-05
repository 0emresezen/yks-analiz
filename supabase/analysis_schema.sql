-- YKS Analysis Database — Supabase şeması (hardened)
-- SQL Editor'da çalıştırın (usage_stats.sql'den sonra).
-- Mevcut kurulum varsa: analysis_schema_patch.sql dosyasını da çalıştırın.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Referans: program kartları (liste / filtre / sıralama)
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_programs (
  program_id text primary key,
  university text not null,
  department text not null,
  department_group text,
  faculty text,
  city text,
  full_name text,
  degree text,
  score_type text,
  language text,
  tuition_status text,
  scholarship_rate text,
  university_type text,
  last_rank integer,
  overall_rating numeric(5,1),
  rating numeric(5,2),
  scholarship_score numeric(4,1),
  trend_score numeric(4,1),
  yok_rank_score numeric(4,1),
  uniar_score numeric(4,1),
  prestige_score numeric(4,1),
  academic_score numeric(4,1),
  transport_score numeric(4,1),
  yok_data_available boolean not null default false,
  publication_year integer,
  search_text text generated always as (
    lower(coalesce(university, '') || ' ' || coalesce(department, '') || ' ' ||
         coalesce(department_group, '') || ' ' || coalesce(city, '') || ' ' ||
         coalesce(full_name, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_analysis_programs_city on public.analysis_programs (city);
create index if not exists idx_analysis_programs_degree on public.analysis_programs (degree);
create index if not exists idx_analysis_programs_university on public.analysis_programs (university);
create index if not exists idx_analysis_programs_department on public.analysis_programs (department);
create index if not exists idx_analysis_programs_department_group on public.analysis_programs (department_group);
create index if not exists idx_analysis_programs_language on public.analysis_programs (language);
create index if not exists idx_analysis_programs_tuition on public.analysis_programs (tuition_status);
create index if not exists idx_analysis_programs_rating on public.analysis_programs (overall_rating desc nulls last);
create index if not exists idx_analysis_programs_rank on public.analysis_programs (last_rank);
create index if not exists idx_analysis_programs_city_rating on public.analysis_programs (city, overall_rating desc nulls last);
create index if not exists idx_analysis_programs_search_trgm on public.analysis_programs using gin (search_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Detay: ağır alanlar JSONB
-- ---------------------------------------------------------------------------
create table if not exists public.program_details (
  program_id text primary key references public.analysis_programs(program_id) on delete cascade,
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_program_details_gin on public.program_details using gin (detail);

-- ---------------------------------------------------------------------------
-- Kullanıcı durumu (favori, not, gizleme) — auth.uid() ile RLS
-- Anonymous sign-in etkin olmalı (Supabase Dashboard → Auth → Providers)
-- ---------------------------------------------------------------------------
create table if not exists public.user_program_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id text not null references public.analysis_programs(program_id) on delete cascade,
  is_favorite boolean not null default false,
  notes text,
  is_deleted boolean not null default false,
  sort_order integer,
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);

create index if not exists idx_user_program_state_user on public.user_program_state (user_id);
create index if not exists idx_user_program_state_user_fav on public.user_program_state (user_id, is_favorite) where is_favorite = true;
create index if not exists idx_user_program_state_user_sort on public.user_program_state (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- Filtre dropdown'ları için özet cache
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_filter_options (
  key text primary key,
  values jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS — referans verisi: yalnızca SELECT (yazma yalnızca service role)
-- ---------------------------------------------------------------------------
alter table public.analysis_programs enable row level security;
alter table public.program_details enable row level security;
alter table public.user_program_state enable row level security;
alter table public.analysis_filter_options enable row level security;

drop policy if exists "analysis_programs_public_read" on public.analysis_programs;
create policy "analysis_programs_public_read"
  on public.analysis_programs for select
  to anon, authenticated
  using (true);

drop policy if exists "program_details_public_read" on public.program_details;
create policy "program_details_public_read"
  on public.program_details for select
  to anon, authenticated
  using (true);

drop policy if exists "filter_options_public_read" on public.analysis_filter_options;
create policy "filter_options_public_read"
  on public.analysis_filter_options for select
  to anon, authenticated
  using (true);

-- Kullanıcı verisi: yalnızca kendi satırları
drop policy if exists "user_state_select_own" on public.user_program_state;
create policy "user_state_select_own"
  on public.user_program_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_program_state;
create policy "user_state_insert_own"
  on public.user_program_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_program_state;
create policy "user_state_update_own"
  on public.user_program_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_state_delete_own" on public.user_program_state;
create policy "user_state_delete_own"
  on public.user_program_state for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Arama RPC — LIMIT cap + pg_trgm destekli metin araması
-- ---------------------------------------------------------------------------
create or replace function public.search_analysis_programs(
  p_search text default null,
  p_city text default null,
  p_degree text default null,
  p_language text default null,
  p_tuition text default null,
  p_min_rating numeric default null,
  p_sort text default 'rating-desc',
  p_limit integer default 100,
  p_offset integer default 0
)
returns setof public.analysis_programs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.analysis_programs p
  where
    (p_city is null or p_city = '' or p.city = p_city)
    and (p_degree is null or p_degree = '' or p.degree = p_degree)
    and (p_language is null or p_language = '' or p.language = p_language)
    and (p_tuition is null or p_tuition = '' or p.tuition_status = p_tuition)
    and (p_min_rating is null or p_min_rating <= 0 or coalesce(p.overall_rating, 0) >= p_min_rating)
    and (
      p_search is null or p_search = '' or
      p.search_text like '%' || lower(trim(p_search)) || '%'
    )
  order by
    case when p_sort = 'rating-desc' then p.overall_rating end desc nulls last,
    case when p_sort = 'rating-asc' then p.overall_rating end asc nulls last,
    case when p_sort = 'y5-asc' then p.last_rank end asc nulls last,
    case when p_sort = 'uniar-desc' then p.uniar_score end desc nulls last,
    case when p_sort = 'prestige-desc' then p.prestige_score end desc nulls last,
    case when p_sort = 'academic-desc' then p.academic_score end desc nulls last,
    case when p_sort = 'transport-desc' then p.transport_score end desc nulls last,
    p.program_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_analysis_programs(text, text, text, text, text, numeric, text, integer, integer)
  to anon, authenticated;

create or replace function public.count_analysis_programs(
  p_search text default null,
  p_city text default null,
  p_degree text default null,
  p_language text default null,
  p_tuition text default null,
  p_min_rating numeric default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.analysis_programs p
  where
    (p_city is null or p_city = '' or p.city = p_city)
    and (p_degree is null or p_degree = '' or p.degree = p_degree)
    and (p_language is null or p_language = '' or p.language = p_language)
    and (p_tuition is null or p_tuition = '' or p.tuition_status = p_tuition)
    and (p_min_rating is null or p_min_rating <= 0 or coalesce(p.overall_rating, 0) >= p_min_rating)
    and (
      p_search is null or p_search = '' or
      p.search_text like '%' || lower(trim(p_search)) || '%'
    );
$$;

grant execute on function public.count_analysis_programs(text, text, text, text, text, numeric)
  to anon, authenticated;
