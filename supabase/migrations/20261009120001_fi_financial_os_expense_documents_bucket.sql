-- FinancialOS expenses Stage 2: private storage bucket for receipts / invoices / bank CSVs.
-- Paths must be tenant-prefixed: {tenant_id}/expenses/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fi-financial-documents',
  'fi-financial-documents',
  false,
  15728640, -- 15 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
