-- Intelligent Credentialing Intake + PSV POC
-- Reuses applications as CredentialingCase; providers as Applicant.
-- Adds requirements, extraction, verifications, evidence, exceptions.

-- ---------------------------------------------------------------------------
-- applications: case metadata for PSV workflow
-- ---------------------------------------------------------------------------
alter table public.applications
  add column if not exists credentialing_action text
    check (credentialing_action is null or credentialing_action in (
      'initial', 'recredentialing', 'update'
    )),
  add column if not exists profession text,
  add column if not exists subspecialty text,
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists requesting_organization text,
  add column if not exists readiness_score integer
    check (readiness_score is null or (readiness_score >= 0 and readiness_score <= 100)),
  add column if not exists psv_status text
    check (psv_status is null or psv_status in (
      'not_started',
      'in_progress',
      'verified',
      'exception',
      'human_review',
      'credentialing_ready'
    )),
  add column if not exists psv_ran_at timestamptz;

update public.applications
set credentialing_action = case
  when application_type = 'recred' then 'recredentialing'
  else 'initial'
end
where credentialing_action is null;

-- ---------------------------------------------------------------------------
-- documents: extraction lifecycle
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists document_type text,
  add column if not exists status text
    check (status is null or status in (
      'uploaded',
      'processing',
      'extracted',
      'needs_review',
      'accepted',
      'rejected'
    )),
  add column if not exists uploaded_at timestamptz;

update public.documents
set status = coalesce(status, 'uploaded'),
    uploaded_at = coalesce(uploaded_at, created_at)
where status is null or uploaded_at is null;

-- ---------------------------------------------------------------------------
-- credential_requirements
-- ---------------------------------------------------------------------------
create table if not exists public.credential_requirements (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  requirement_type text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'required'
    check (status in (
      'required',
      'received',
      'pending_verification',
      'verified',
      'exception',
      'human_review',
      'not_applicable',
      'clear'
    )),
  verification_method text
    check (verification_method is null or verification_method in (
      'live',
      'poc',
      'document',
      'manual',
      'none'
    )),
  psv_provider text,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credential_requirements_application_id_idx
  on public.credential_requirements (application_id);

-- ---------------------------------------------------------------------------
-- extracted_credential_data (AI extraction — NOT verification)
-- ---------------------------------------------------------------------------
create table if not exists public.extracted_credential_data (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  field_name text not null,
  field_value text,
  confidence numeric(5,4),
  source_document text,
  extractor text not null default 'DocumentExtractionService',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists extracted_credential_data_application_id_idx
  on public.extracted_credential_data (application_id);

-- ---------------------------------------------------------------------------
-- verifications
-- ---------------------------------------------------------------------------
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  requirement_id uuid references public.credential_requirements (id) on delete set null,
  verification_type text not null,
  provider text not null,
  source_name text not null,
  source_url text,
  source_mode text not null default 'poc'
    check (source_mode in ('live', 'poc')),
  status text not null
    check (status in (
      'verified',
      'clear',
      'pending',
      'exception',
      'human_review',
      'not_verified',
      'failed'
    )),
  result_summary text,
  matched_fields jsonb not null default '[]'::jsonb,
  unmatched_fields jsonb not null default '[]'::jsonb,
  normalized_result jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verifications_application_id_idx
  on public.verifications (application_id);

-- ---------------------------------------------------------------------------
-- verification_evidence
-- ---------------------------------------------------------------------------
create table if not exists public.verification_evidence (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  requirement_id uuid references public.credential_requirements (id) on delete set null,
  verification_id uuid references public.verifications (id) on delete cascade,
  provider text not null,
  verification_type text not null,
  source_name text not null,
  source_url text,
  request_timestamp timestamptz not null default now(),
  response_timestamp timestamptz,
  result text,
  matched_fields jsonb not null default '[]'::jsonb,
  unmatched_fields jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  raw_response_reference text,
  verified_by text,
  verification_method text not null
    check (verification_method in ('live', 'poc', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists verification_evidence_application_id_idx
  on public.verification_evidence (application_id);
create index if not exists verification_evidence_verification_id_idx
  on public.verification_evidence (verification_id);

-- ---------------------------------------------------------------------------
-- credentialing_exceptions
-- ---------------------------------------------------------------------------
create table if not exists public.credentialing_exceptions (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid not null references public.applications (id) on delete cascade,
  requirement_id uuid references public.credential_requirements (id) on delete set null,
  exception_type text not null
    check (exception_type in (
      'missing',
      'expired',
      'mismatch',
      'verification_failure',
      'human_review',
      'other'
    )),
  severity text not null default 'warning'
    check (severity in ('informational', 'warning', 'critical')),
  description text not null,
  source text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'waived')),
  assigned_to text,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists credentialing_exceptions_application_id_idx
  on public.credentialing_exceptions (application_id);

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  application_id uuid references public.applications (id) on delete cascade,
  event_type text not null,
  actor text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_application_id_idx
  on public.audit_events (application_id);

-- ---------------------------------------------------------------------------
-- triggers + RLS (POC open policies)
-- ---------------------------------------------------------------------------
drop trigger if exists credential_requirements_set_updated_at on public.credential_requirements;
create trigger credential_requirements_set_updated_at
  before update on public.credential_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists extracted_credential_data_set_updated_at on public.extracted_credential_data;
create trigger extracted_credential_data_set_updated_at
  before update on public.extracted_credential_data
  for each row execute function public.set_updated_at();

drop trigger if exists verifications_set_updated_at on public.verifications;
create trigger verifications_set_updated_at
  before update on public.verifications
  for each row execute function public.set_updated_at();

drop trigger if exists credentialing_exceptions_set_updated_at on public.credentialing_exceptions;
create trigger credentialing_exceptions_set_updated_at
  before update on public.credentialing_exceptions
  for each row execute function public.set_updated_at();

alter table public.credential_requirements enable row level security;
alter table public.extracted_credential_data enable row level security;
alter table public.verifications enable row level security;
alter table public.verification_evidence enable row level security;
alter table public.credentialing_exceptions enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "poc_credential_requirements_all" on public.credential_requirements;
create policy "poc_credential_requirements_all" on public.credential_requirements
  for all using (true) with check (true);

drop policy if exists "poc_extracted_credential_data_all" on public.extracted_credential_data;
create policy "poc_extracted_credential_data_all" on public.extracted_credential_data
  for all using (true) with check (true);

drop policy if exists "poc_verifications_all" on public.verifications;
create policy "poc_verifications_all" on public.verifications
  for all using (true) with check (true);

drop policy if exists "poc_verification_evidence_all" on public.verification_evidence;
create policy "poc_verification_evidence_all" on public.verification_evidence
  for all using (true) with check (true);

drop policy if exists "poc_credentialing_exceptions_all" on public.credentialing_exceptions;
create policy "poc_credentialing_exceptions_all" on public.credentialing_exceptions
  for all using (true) with check (true);

drop policy if exists "poc_audit_events_all" on public.audit_events;
create policy "poc_audit_events_all" on public.audit_events
  for all using (true) with check (true);
