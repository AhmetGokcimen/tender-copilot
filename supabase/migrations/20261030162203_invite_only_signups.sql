-- Accounts are invite-only. The invite server action creates users through
-- the admin API with app_metadata.invited = true; a public sign-up cannot
-- set app_metadata, so it is rejected here, whatever the dashboard setting.
create function private.require_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'invited', '') <> 'true' then
    raise exception 'Sign-ups are invite-only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.require_invite() from public, anon, authenticated;

create trigger require_invite before insert on auth.users
  for each row execute function private.require_invite();
