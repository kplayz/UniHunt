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

-- Dream / Reach / Target, set from the candidate profile and overridable later.
alter table public.shortlisted_courses
  add column if not exists fit text,
  add column if not exists fit_reason text,
  add column if not exists fit_source text;

alter table public.shortlisted_courses
  drop constraint if exists shortlisted_courses_fit_check;
alter table public.shortlisted_courses
  add constraint shortlisted_courses_fit_check
  check (fit is null or fit in ('dream', 'reach', 'target'));

alter table public.shortlisted_courses
  drop constraint if exists shortlisted_courses_fit_source_check;
alter table public.shortlisted_courses
  add constraint shortlisted_courses_fit_source_check
  check (fit_source is null or fit_source in ('auto', 'manual'));

create or replace function public.prevent_shortlist_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot change';
  end if;
  return new;
end;
$$;

drop trigger if exists shortlisted_courses_owner_lock on public.shortlisted_courses;
create trigger shortlisted_courses_owner_lock
  before update on public.shortlisted_courses
  for each row execute function public.prevent_shortlist_owner_change();

-- One share grants access to the owner's whole wishlist.
create table if not exists public.shortlist_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  invite_email text not null,
  permission text not null,
  created_at timestamptz not null default now(),
  constraint shortlist_shares_permission_check
    check (permission in ('read', 'comment', 'edit', 'delete')),
  constraint shortlist_shares_email_check
    check (invite_email = lower(invite_email) and owner_email = lower(owner_email))
);

create unique index if not exists shortlist_shares_owner_email_idx
  on public.shortlist_shares (owner_id, invite_email);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shortlist_shares_owner_email_key'
  ) then
    alter table public.shortlist_shares
      add constraint shortlist_shares_owner_email_key
      unique using index shortlist_shares_owner_email_idx;
  end if;
end $$;

create index if not exists shortlist_shares_invite_email_idx
  on public.shortlist_shares (invite_email);

alter table public.shortlist_shares enable row level security;

-- Highest permission the current user has on an owner's wishlist.
-- security invoker: reads only share rows the caller is already allowed to see.
create or replace function public.share_permission(owner uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when owner = (select auth.uid()) then 'owner'
    else (
      select s.permission
      from public.shortlist_shares s
      where s.owner_id = owner
        and lower(s.invite_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      order by array_position(array['read', 'comment', 'edit', 'delete'], s.permission) desc
      limit 1
    )
  end;
$$;

drop policy if exists "Owners manage their shares" on public.shortlist_shares;
create policy "Owners manage their shares"
  on public.shortlist_shares for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Invitees can read their shares" on public.shortlist_shares;
create policy "Invitees can read their shares"
  on public.shortlist_shares for select
  using (lower(invite_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

drop policy if exists "Editors can view a shared wishlist" on public.shortlisted_courses;
create policy "Editors can view a shared wishlist"
  on public.shortlisted_courses for select
  using (public.share_permission(user_id) is not null);

drop policy if exists "Editors can update a shared wishlist" on public.shortlisted_courses;
create policy "Editors can update a shared wishlist"
  on public.shortlisted_courses for update
  using (public.share_permission(user_id) in ('owner', 'edit', 'delete'))
  with check (public.share_permission(user_id) in ('owner', 'edit', 'delete'));

drop policy if exists "Delete permission can remove shared courses" on public.shortlisted_courses;
create policy "Delete permission can remove shared courses"
  on public.shortlisted_courses for delete
  using (public.share_permission(user_id) in ('owner', 'delete'));

drop policy if exists "Editors can add courses to a shared wishlist" on public.shortlisted_courses;
create policy "Editors can add courses to a shared wishlist"
  on public.shortlisted_courses for insert
  with check (public.share_permission(user_id) in ('edit', 'delete'));

create table if not exists public.shortlist_comments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.shortlisted_courses(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint shortlist_comments_body_check check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists shortlist_comments_course_id_idx
  on public.shortlist_comments (course_id, created_at);

alter table public.shortlist_comments enable row level security;

drop policy if exists "Readers can view comments" on public.shortlist_comments;
create policy "Readers can view comments"
  on public.shortlist_comments for select
  using (
    exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) is not null
    )
  );

drop policy if exists "Commenters can add comments" on public.shortlist_comments;
create policy "Commenters can add comments"
  on public.shortlist_comments for insert
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) in ('owner', 'comment', 'edit', 'delete')
    )
  );

drop policy if exists "Authors can delete own comments" on public.shortlist_comments;
create policy "Authors can delete own comments"
  on public.shortlist_comments for delete
  using (author_id = (select auth.uid()));

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.shortlisted_courses(id) on delete cascade,
  label text not null,
  details text,
  required boolean not null default true,
  storage_path text,
  file_name text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint application_documents_label_check check (char_length(btrim(label)) between 1 and 120)
);

create unique index if not exists application_documents_course_label_idx
  on public.application_documents (course_id, label);

alter table public.application_documents enable row level security;

drop policy if exists "Readers can view document checklist" on public.application_documents;
create policy "Readers can view document checklist"
  on public.application_documents for select
  using (
    exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) is not null
    )
  );

drop policy if exists "Editors can add checklist items" on public.application_documents;
create policy "Editors can add checklist items"
  on public.application_documents for insert
  with check (
    exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) in ('owner', 'edit', 'delete')
    )
  );

drop policy if exists "Editors can update checklist items" on public.application_documents;
create policy "Editors can update checklist items"
  on public.application_documents for update
  using (
    exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) in ('owner', 'edit', 'delete')
    )
  )
  with check (
    exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) in ('owner', 'edit', 'delete')
    )
  );

drop policy if exists "Editors can delete checklist items" on public.application_documents;
create policy "Editors can delete checklist items"
  on public.application_documents for delete
  using (
    exists (
      select 1
      from public.shortlisted_courses c
      where c.id = course_id
        and public.share_permission(c.user_id) in ('owner', 'edit', 'delete')
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Readers can download shared application documents" on storage.objects;
create policy "Readers can download shared application documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and public.share_permission(((storage.foldername(name))[1])::uuid) is not null
  );

drop policy if exists "Editors can upload application documents" on storage.objects;
create policy "Editors can upload application documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and public.share_permission(((storage.foldername(name))[1])::uuid) in ('owner', 'edit', 'delete')
  );

drop policy if exists "Editors can replace application documents" on storage.objects;
create policy "Editors can replace application documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'application-documents'
    and public.share_permission(((storage.foldername(name))[1])::uuid) in ('owner', 'edit', 'delete')
  )
  with check (
    bucket_id = 'application-documents'
    and public.share_permission(((storage.foldername(name))[1])::uuid) in ('owner', 'edit', 'delete')
  );

drop policy if exists "Editors can delete application documents" on storage.objects;
create policy "Editors can delete application documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'application-documents'
    and public.share_permission(((storage.foldername(name))[1])::uuid) in ('owner', 'edit', 'delete')
  );
