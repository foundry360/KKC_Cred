-- Education and work history for practitioners (and optional facility ops history)

create table if not exists public.education_history (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid not null references public.providers (id) on delete cascade,
  institution_name text not null,
  degree_type text not null
    check (degree_type in (
      'md', 'do', 'mbbs', 'phd', 'masters', 'bachelors',
      'residency', 'fellowship', 'internship', 'other'
    )),
  field_of_study text,
  start_date date,
  end_date date,
  graduation_year integer,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists education_history_provider_id_idx
  on public.education_history (provider_id);

create table if not exists public.work_history (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid not null references public.providers (id) on delete cascade,
  employer_name text not null,
  title text,
  department text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_history_provider_id_idx
  on public.work_history (provider_id);

drop trigger if exists education_history_set_updated_at on public.education_history;
create trigger education_history_set_updated_at
  before update on public.education_history
  for each row execute function public.set_updated_at();

drop trigger if exists work_history_set_updated_at on public.work_history;
create trigger work_history_set_updated_at
  before update on public.work_history
  for each row execute function public.set_updated_at();

alter table public.education_history enable row level security;
alter table public.work_history enable row level security;

drop policy if exists "poc_education_history_all" on public.education_history;
create policy "poc_education_history_all" on public.education_history
  for all using (true) with check (true);

drop policy if exists "poc_work_history_all" on public.work_history;
create policy "poc_work_history_all" on public.work_history
  for all using (true) with check (true);
