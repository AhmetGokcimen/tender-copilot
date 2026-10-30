alter table public.waitlist
  add constraint waitlist_email_len check (char_length(email) between 3 and 254),
  add constraint waitlist_locale_len check (char_length(locale) <= 8),
  add constraint waitlist_source_ok check (source in ('hero', 'closing', 'landing'));
create policy "anon can join waitlist" on public.waitlist
  for insert to anon with check (true);
grant insert (email, locale, source) on public.waitlist to anon;
comment on table public.waitlist is 'Pre-launch waitlist. Public (anon) may only INSERT email/locale/source; no select/update/delete policy, so only the service role can read the list.';
