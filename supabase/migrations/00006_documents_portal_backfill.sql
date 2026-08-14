-- Backfill portal document columns if 00004 was skipped
alter table public.documents
  add column if not exists checklist_item_key text,
  add column if not exists salesforce_content_document_id text,
  add column if not exists salesforce_synced_at timestamptz;
