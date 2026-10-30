-- Keep the policy helper out of the REST-exposed schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_company_member(uuid) set schema private;
alter function public.add_company_owner() set schema private;
alter function public.touch_updated_at() set schema private;
