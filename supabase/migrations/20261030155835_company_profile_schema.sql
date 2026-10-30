-- Company profile for onboarding and tender matching. Every table is
-- scoped to a company; access goes through company_members so teammates
-- can be added later without changing policies.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  cui text check (cui is null or cui ~ '^(RO)?[0-9]{2,10}$'),
  website text check (website is null or char_length(website) <= 300),
  address text,
  county text,
  caen_main text,
  caen_secondary text[] not null default '{}',
  vat_payer boolean,
  active boolean,
  founded_year int check (founded_year is null or founded_year between 1800 and 2100),
  trades text[] not null default '{}',
  cpv_codes text[] not null default '{}',
  blacklist text[] not null default '{}',
  regions text[] not null default '{}',            -- empty = whole country
  roles text[] not null default '{}',              -- solo / consortium / subcontractor
  subcontract_out text[] not null default '{}',    -- trade keys it hands to subcontractors
  max_contract_value numeric check (max_contract_value is null or max_contract_value >= 0),
  max_contract_currency text,
  concurrent_projects int check (concurrent_projects is null or concurrent_projects >= 0),
  seap_registered boolean,
  esignature boolean,
  esignature_expires_on date,
  duae_experience boolean,
  team_eu int check (team_eu is null or team_eu >= 0),
  team_non_eu int check (team_non_eu is null or team_non_eu >= 0),
  guarantee_instruments text[] not null default '{}', -- bank / insurance / cash
  guarantee_limit numeric check (guarantee_limit is null or guarantee_limit >= 0),
  credit_line numeric check (credit_line is null or credit_line >= 0),
  cash_available numeric check (cash_available is null or cash_available >= 0),
  money_currency text not null default 'RON',
  ongoing_value numeric check (ongoing_value is null or ongoing_value >= 0),
  ongoing_until date,
  tax_debt boolean,
  insolvency boolean,
  past_termination boolean,
  has_car_insurance boolean,
  has_liability_insurance boolean,
  seap_history text check (seap_history is null or seap_history in ('none', 'bid', 'won')),
  sworn_translation boolean,
  notify_email boolean not null default true,
  notify_frequency text not null default 'daily' check (notify_frequency in ('instant', 'daily', 'weekly', 'off')),
  min_days_to_deadline int not null default 10 check (min_days_to_deadline between 0 and 90),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_owner_idx on public.companies (owner_id);

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.company_turnover (
  company_id uuid not null references public.companies (id) on delete cascade,
  year int not null check (year between 1990 and 2100),
  amount numeric not null check (amount >= 0),
  currency text not null default 'RON',
  source text not null default 'manual' check (source in ('anaf', 'manual', 'document')),
  primary key (company_id, year)
);

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes int,
  doc_type text,
  status text not null default 'uploaded' check (status in ('uploaded', 'scanning', 'scanned', 'failed')),
  extracted jsonb,
  scanned_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_documents_company_idx on public.company_documents (company_id);

create table public.company_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category text not null check (category in ('authorization', 'certification')),
  kind text not null,                 -- key in lib/construction CERTS, or 'other'
  name text not null,
  type_class text,                    -- e.g. ANRE "B", "C2A"
  number text,
  issuer text,
  holder text,
  scope text,
  issued_on date,
  expires_on date,
  document_id uuid references public.company_documents (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'document')),
  created_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create index company_credentials_company_idx on public.company_credentials (company_id);
create index company_credentials_document_idx on public.company_credentials (document_id);

create table public.company_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null default 'works' check (kind in ('works', 'services', 'supplies')),
  title text not null,
  client text,
  country text not null default 'RO',
  trades text[] not null default '{}',
  cpv_codes text[] not null default '{}',
  value numeric check (value is null or value >= 0),  -- excluding VAT
  currency text not null default 'RON',
  end_year int check (end_year is null or end_year between 1990 and 2100),
  completion_certificate boolean,     -- proces-verbal de recepție
  role text not null default 'lead' check (role in ('lead', 'subcontractor', 'partner')),
  share_pct numeric check (share_pct is null or share_pct between 0 and 100),
  document_id uuid references public.company_documents (id) on delete set null,
  created_at timestamptz not null default now()
);
create index company_contracts_company_idx on public.company_contracts (company_id);
create index company_contracts_document_idx on public.company_contracts (document_id);

create table public.company_staff (
  company_id uuid not null references public.companies (id) on delete cascade,
  role text not null check (role in ('project_manager', 'site_manager', 'rte', 'hse', 'anre_electrician', 'engineer', 'other')),
  count int not null default 0 check (count >= 0),
  primary key (company_id, role)
);

-- Membership check used by every policy. SECURITY DEFINER so policies on
-- company_members itself do not recurse.
create function public.is_company_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = cid and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_company_member(uuid) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;

-- The creator becomes the owner member.
create function public.add_company_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_members (company_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
revoke execute on function public.add_company_owner() from public, anon, authenticated;
create trigger companies_add_owner after insert on public.companies
  for each row execute function public.add_company_owner();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_turnover enable row level security;
alter table public.company_documents enable row level security;
alter table public.company_credentials enable row level security;
alter table public.company_contracts enable row level security;
alter table public.company_staff enable row level security;

create policy "members read company" on public.companies
  for select to authenticated using (public.is_company_member(id));
create policy "users create own company" on public.companies
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "members update company" on public.companies
  for update to authenticated using (public.is_company_member(id))
  with check (public.is_company_member(id));
create policy "owner deletes company" on public.companies
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "members see members" on public.company_members
  for select to authenticated using (public.is_company_member(company_id));

create policy "members manage turnover" on public.company_turnover
  for all to authenticated using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy "members manage documents" on public.company_documents
  for all to authenticated using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy "members manage credentials" on public.company_credentials
  for all to authenticated using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy "members manage contracts" on public.company_contracts
  for all to authenticated using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy "members manage staff" on public.company_staff
  for all to authenticated using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Private bucket for uploaded certificates, balance sheets and contracts.
-- Objects live under "<company_id>/...".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-documents', 'company-documents', false, 15728640,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

create policy "members read company files" on storage.objects
  for select to authenticated
  using (bucket_id = 'company-documents' and public.is_company_member(((storage.foldername(name))[1])::uuid));
create policy "members upload company files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-documents' and public.is_company_member(((storage.foldername(name))[1])::uuid));
create policy "members delete company files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'company-documents' and public.is_company_member(((storage.foldername(name))[1])::uuid));
