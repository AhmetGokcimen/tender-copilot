-- Supabase grants every role broad table privileges by default. Row level
-- security already blocks rows, but TRUNCATE is not subject to RLS and the
-- public roles should hold only what the app uses.

-- Visitors (anon): insert-only, and only the columns the forms send.
revoke all on public.waitlist, public.contact_message from anon;
grant insert (email, locale, source) on public.waitlist to anon;
grant insert (subject, email, message, locale, mail_status) on public.contact_message to anon;

-- Anon has no use for the company tables at all (their policies are for signed-in users).
revoke all on
  public.companies, public.company_members, public.company_turnover, public.company_documents,
  public.company_credentials, public.company_contracts, public.company_staff
from anon;

-- Signed-in users: row access only, no TRUNCATE / TRIGGER / REFERENCES, and nothing on the visitor tables.
revoke all on public.waitlist, public.contact_message from authenticated;
revoke truncate, trigger, references on
  public.companies, public.company_members, public.company_turnover, public.company_documents,
  public.company_credentials, public.company_contracts, public.company_staff
from authenticated;

-- Tables created from now on start closed instead of open to anon.
alter default privileges in schema public revoke all on tables from anon;
