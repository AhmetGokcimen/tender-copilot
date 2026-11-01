-- Invite-only signups, take two.
--
-- The first version checked raw_app_meta_data.invited in a BEFORE INSERT
-- trigger. Supabase Auth inserts the user first and writes app_metadata
-- afterwards, so the trigger never saw the flag and refused every invited
-- account ("Sign-ups are invite-only", seen in the auth logs).
--
-- Now the server action first puts the invited e-mail on a short-lived
-- allowlist that only the service role can write, then creates the user; the
-- trigger lets an insert through only if its e-mail is on the list, and uses
-- the entry up. The old app_metadata flag is still honoured (only the admin
-- API can set it).

create table if not exists private.invited_emails (
  email text primary key,
  created_at timestamptz not null default now()
);
revoke all on private.invited_emails from public, anon, authenticated;

create or replace function public.allow_invited_email(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.invited_emails where created_at < now() - interval '15 minutes';
  insert into private.invited_emails (email) values (lower(trim(p_email)))
  on conflict (email) do update set created_at = now();
$$;
revoke execute on function public.allow_invited_email(text) from public, anon, authenticated;
grant execute on function public.allow_invited_email(text) to service_role;

create or replace function private.require_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'invited', '') = 'true' then
    return new;
  end if;
  delete from private.invited_emails where created_at < now() - interval '15 minutes';
  delete from private.invited_emails where email = lower(coalesce(new.email, ''));
  if not found then
    raise exception 'Sign-ups are invite-only' using errcode = '42501';
  end if;
  return new;
end;
$$;
