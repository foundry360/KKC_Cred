-- Portal document uploads: checklist linkage + Salesforce Files sync metadata

alter table public.documents
  add column if not exists checklist_item_key text,
  add column if not exists salesforce_content_document_id text,
  add column if not exists salesforce_synced_at timestamptz;

create index if not exists documents_application_id_idx
  on public.documents (application_id);

create index if not exists documents_provider_id_idx
  on public.documents (provider_id);
