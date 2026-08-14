-- Expand provider identity numbers used by expanded intake checklist
alter table public.providers
  add column if not exists federal_tax_id text,
  add column if not exists medicaid_number text,
  add column if not exists medicare_number text;
