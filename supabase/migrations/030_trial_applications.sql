-- Trial applications (manual approval)
create table if not exists public.trial_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  salon_id uuid null,
  salon_name text not null,
  owner_name text not null,
  email text not null,
  phone text null,
  city text null,
  website text null,
  instagram text null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','registered')),
  approval_token uuid not null default gen_random_uuid(),
  register_token uuid not null default gen_random_uuid(),
  approved_at timestamptz null,
  registered_at timestamptz null
);

create unique index if not exists trial_applications_approval_token_idx on public.trial_applications(approval_token);
create unique index if not exists trial_applications_register_token_idx on public.trial_applications(register_token);
create index if not exists trial_applications_status_idx on public.trial_applications(status);
create index if not exists trial_applications_email_idx on public.trial_applications(email);

alter table public.trial_applications enable row level security;
