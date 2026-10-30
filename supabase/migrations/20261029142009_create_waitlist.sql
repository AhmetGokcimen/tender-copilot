create extension if not exists citext with schema extensions;
create table public.waitlist (
  id bigint generated always as identity primary key,
  email extensions.citext not null unique,
  locale text not null default 'en',
  source text not null default 'landing',
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
comment on table public.waitlist is 'Pre-launch waitlist. RLS on with no policies: only the service role (Next.js server action) reads or writes.';
