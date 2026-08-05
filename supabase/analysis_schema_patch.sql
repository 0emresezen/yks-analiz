-- Mevcut analysis_schema.sql kurulumunu güçlendirmek için patch.
-- SQL Editor'da analysis_schema.sql çalıştırıldıktan SONRA bunu çalıştırın.

create extension if not exists pg_trgm;

drop policy if exists "user_state_select_own" on public.user_program_state;
drop policy if exists "user_state_insert_own" on public.user_program_state;
drop policy if exists "user_state_update_own" on public.user_program_state;
drop policy if exists "user_state_delete_own" on public.user_program_state;

alter table public.user_program_state drop constraint if exists user_program_state_session_id_program_id_key;
alter table public.user_program_state drop column if exists session_id;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_program_state'
      and column_name = 'user_id'
      and is_nullable = 'YES'
  ) then
    delete from public.user_program_state where user_id is null;
    alter table public.user_program_state alter column user_id set not null;
  end if;
end $$;

alter table public.user_program_state
  drop constraint if exists user_program_state_user_id_program_id_key;

alter table public.user_program_state
  add constraint user_program_state_user_id_program_id_key unique (user_id, program_id);

alter table public.user_program_state
  add column if not exists sort_order integer;

create index if not exists idx_analysis_programs_department on public.analysis_programs (department);
create index if not exists idx_analysis_programs_department_group on public.analysis_programs (department_group);
create index if not exists idx_analysis_programs_language on public.analysis_programs (language);
create index if not exists idx_analysis_programs_tuition on public.analysis_programs (tuition_status);
create index if not exists idx_analysis_programs_city_rating on public.analysis_programs (city, overall_rating desc nulls last);
create index if not exists idx_analysis_programs_search_trgm on public.analysis_programs using gin (search_text gin_trgm_ops);
drop index if exists idx_analysis_programs_search;

create index if not exists idx_user_program_state_user_fav on public.user_program_state (user_id, is_favorite) where is_favorite = true;
create index if not exists idx_user_program_state_user_sort on public.user_program_state (user_id, sort_order);

create policy "user_state_select_own"
  on public.user_program_state for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_state_insert_own"
  on public.user_program_state for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_state_update_own"
  on public.user_program_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_state_delete_own"
  on public.user_program_state for delete
  to authenticated
  using (auth.uid() = user_id);

-- RPC: LIMIT cap 200
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
