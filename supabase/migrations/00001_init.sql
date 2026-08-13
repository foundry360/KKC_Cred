-- Credentialing POC schema
-- Aligns with Salesforce External_Id__c upsert keys (PRV-*, FAC-*, etc.)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name text not null,
  tin text,
  org_type text check (org_type is null or org_type in ('hospital', 'clinic', 'group', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- providers (practitioners + facilities)
-- ---------------------------------------------------------------------------
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  subject_type text not null check (subject_type in ('practitioner', 'facility')),
  organization_id uuid references public.organizations (id) on delete set null,
  organization_name text,
  npi text,
  first_name text,
  last_name text,
  display_name text not null,
  specialty text,
  facility_type text,
  email text,
  phone text,
  status text not null default 'pending'
    check (status in ('active', 'inactive', 'pending', 'suspended')),
  cred_start_date date,
  cred_end_date date,
  recred_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists providers_subject_type_idx on public.providers (subject_type);
create index if not exists providers_recred_due_date_idx on public.providers (recred_due_date);
create index if not exists providers_organization_id_idx on public.providers (organization_id);

-- ---------------------------------------------------------------------------
-- credentials
-- ---------------------------------------------------------------------------
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid not null references public.providers (id) on delete cascade,
  credential_type text not null,
  credential_number text,
  issuing_authority text,
  issued_at date,
  expires_at date,
  status text not null default 'pending_verification'
    check (status in ('valid', 'expiring_soon', 'expired', 'pending_verification', 'rejected')),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credentials_provider_id_idx on public.credentials (provider_id);
create index if not exists credentials_expires_at_idx on public.credentials (expires_at);

-- ---------------------------------------------------------------------------
-- sanctions_checks (optional monitoring)
-- ---------------------------------------------------------------------------
create table if not exists public.sanctions_checks (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid not null references public.providers (id) on delete cascade,
  source text,
  checked_at date,
  result text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sanctions_checks_provider_id_idx on public.sanctions_checks (provider_id);

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid not null references public.providers (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  application_type text not null check (application_type in ('new', 'recred')),
  path text not null check (path in ('caqh', 'in_house', 'facility', 'delegated')),
  subject_type text not null check (subject_type in ('practitioner', 'facility')),
  status text not null default 'draft'
    check (status in (
      'draft',
      'incomplete',
      'in_review',
      'pending_committee',
      'approved',
      'denied',
      'termed',
      'withdrawn'
    )),
  attempt_count integer not null default 0,
  due_date date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_provider_id_idx on public.applications (provider_id);
create index if not exists applications_status_idx on public.applications (status);

-- ---------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  item_key text not null,
  label text not null,
  required boolean not null default true,
  complete boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklist_items_application_id_idx on public.checklist_items (application_id);

-- ---------------------------------------------------------------------------
-- outreach_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_attempts (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 3),
  channel text,
  notes text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists outreach_attempts_application_id_idx on public.outreach_attempts (application_id);

-- ---------------------------------------------------------------------------
-- documents (metadata stub)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid references public.providers (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  credential_id uuid references public.credentials (id) on delete set null,
  file_name text,
  content_type text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists providers_set_updated_at on public.providers;
create trigger providers_set_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

drop trigger if exists credentials_set_updated_at on public.credentials;
create trigger credentials_set_updated_at
  before update on public.credentials
  for each row execute function public.set_updated_at();

drop trigger if exists sanctions_checks_set_updated_at on public.sanctions_checks;
create trigger sanctions_checks_set_updated_at
  before update on public.sanctions_checks
  for each row execute function public.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

drop trigger if exists checklist_items_set_updated_at on public.checklist_items;
create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- POC: open read/write via anon key (tighten when auth lands)
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.providers enable row level security;
alter table public.credentials enable row level security;
alter table public.sanctions_checks enable row level security;
alter table public.applications enable row level security;
alter table public.checklist_items enable row level security;
alter table public.outreach_attempts enable row level security;
alter table public.documents enable row level security;

create policy "poc_organizations_all" on public.organizations for all using (true) with check (true);
create policy "poc_providers_all" on public.providers for all using (true) with check (true);
create policy "poc_credentials_all" on public.credentials for all using (true) with check (true);
create policy "poc_sanctions_checks_all" on public.sanctions_checks for all using (true) with check (true);
create policy "poc_applications_all" on public.applications for all using (true) with check (true);
create policy "poc_checklist_items_all" on public.checklist_items for all using (true) with check (true);
create policy "poc_outreach_attempts_all" on public.outreach_attempts for all using (true) with check (true);
create policy "poc_documents_all" on public.documents for all using (true) with check (true);
