-- Run this in the Supabase SQL Editor to set up the database.

create table if not exists public.shortlisted_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_name text not null,
  university_location text,
  course_name text not null,
  course_level text,
  course_type text,
  specialization text,
  country text,
  qs_world_ranking integer,
  tuition_fee text,
  admission_requirements text,
  course_url text,
  duration text,
  language text,
  intake_period text,
  scholarship_info text,
  notes text,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial release; keeps existing databases in sync.
alter table public.shortlisted_courses
  add column if not exists duration text,
  add column if not exists language text,
  add column if not exists intake_period text,
  add column if not exists scholarship_info text;

-- Important application/scholarship/session dates found on the university
-- website via Brave Search, stored per shortlisted course.
alter table public.shortlisted_courses
  add column if not exists important_dates jsonb,
  add column if not exists important_dates_checked_at timestamptz;

create index if not exists shortlisted_courses_user_id_idx
  on public.shortlisted_courses (user_id);

-- One row per university/course per user. Deliberately ignores course_url: the
-- same course can come back from different searches with a different link, and
-- that is still a duplicate.
drop index if exists public.shortlisted_courses_user_course_idx;
create unique index if not exists shortlisted_courses_user_course_idx
  on public.shortlisted_courses (user_id, university_name, course_name);

create table if not exists public.search_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  criteria jsonb not null,
  results jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_sessions_user_id_idx
  on public.search_sessions (user_id);

alter table public.shortlisted_courses enable row level security;
alter table public.search_sessions enable row level security;

drop policy if exists "Users can view own shortlisted courses" on public.shortlisted_courses;
create policy "Users can view own shortlisted courses"
  on public.shortlisted_courses for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own shortlisted courses" on public.shortlisted_courses;
create policy "Users can insert own shortlisted courses"
  on public.shortlisted_courses for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own shortlisted courses" on public.shortlisted_courses;
create policy "Users can update own shortlisted courses"
  on public.shortlisted_courses for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own shortlisted courses" on public.shortlisted_courses;
create policy "Users can delete own shortlisted courses"
  on public.shortlisted_courses for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own search sessions" on public.search_sessions;
create policy "Users can view own search sessions"
  on public.search_sessions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own search sessions" on public.search_sessions;
create policy "Users can insert own search sessions"
  on public.search_sessions for insert
  with check ((select auth.uid()) = user_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shortlisted_courses_updated_at on public.shortlisted_courses;
create trigger shortlisted_courses_updated_at
  before update on public.shortlisted_courses
  for each row execute function public.handle_updated_at();
