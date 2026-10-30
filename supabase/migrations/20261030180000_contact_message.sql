create table public.contact_message (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  subject text not null check (char_length(subject) between 1 and 150),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 5000),
  locale text not null default 'en' check (char_length(locale) <= 8)
);
alter table public.contact_message enable row level security;
create policy "anon can send contact message" on public.contact_message
  for insert to anon with check (true);
grant insert (subject, email, message, locale) on public.contact_message to anon;
comment on table public.contact_message is 'Landing-page contact form. Public (anon) may only INSERT; no select/update/delete policy, so only the service role can read messages. Each message is also forwarded by email.';
