-- Demographics on providers + provider addresses (home / work / mailing)

alter table public.providers
  add column if not exists middle_name text,
  add column if not exists name_suffix text,
  add column if not exists date_of_birth date,
  add column if not exists gender text
    check (gender is null or gender in (
      'male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'
    )),
  add column if not exists ssn_last4 text
    check (ssn_last4 is null or ssn_last4 ~ '^[0-9]{4}$'),
  add column if not exists birth_country text,
  add column if not exists preferred_languages text,
  add column if not exists caqh_id text,
  add column if not exists mobile_phone text,
  add column if not exists practice_state text;

create table if not exists public.provider_addresses (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  provider_id uuid not null references public.providers (id) on delete cascade,
  address_type text not null
    check (address_type in ('home', 'work', 'mailing')),
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country text default 'US',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, address_type)
);

create index if not exists provider_addresses_provider_id_idx
  on public.provider_addresses (provider_id);

drop trigger if exists provider_addresses_set_updated_at on public.provider_addresses;
create trigger provider_addresses_set_updated_at
  before update on public.provider_addresses
  for each row execute function public.set_updated_at();

alter table public.provider_addresses enable row level security;

drop policy if exists "poc_provider_addresses_all" on public.provider_addresses;
create policy "poc_provider_addresses_all" on public.provider_addresses
  for all using (true) with check (true);
