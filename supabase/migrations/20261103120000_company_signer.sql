-- Who signs the bid documents, and the signature image placed on them.
-- The signature is a small PNG data URL (resized in the browser); the row is
-- already protected by the companies RLS policies.
alter table public.companies
  add column if not exists legal_rep_name text,
  add column if not exists legal_rep_role text,
  add column if not exists signature_png text;
