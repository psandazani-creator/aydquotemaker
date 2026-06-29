-- ============================================================
-- QuoteMaker ZW — Supabase Database Migration
-- Run this in your Supabase SQL Editor to create all tables
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  name          text,
  full_name     text,
  "licenseKey"  text,
  tier          text not null default 'free' check (tier in ('free', 'pro', 'lifetime')),
  "deviceLimit" integer not null default 2,
  "isAdmin"     boolean not null default false,
  "companyLogo" text,
  "companyName" text,
  "companyPhone" text,
  "companyAddress" text,
  preferences   jsonb default '{"currency":"USD","vatRate":15}'::jsonb,
  "contractsLicense" jsonb default '{"active":false}'::jsonb,
  phone         text,
  created_at    timestamptz not null default now(),
  "createdAt"   timestamptz,
  "updatedAt"   timestamptz
);

-- ============================================================
-- SETTINGS  (global app settings, e.g. quote counter)
-- ============================================================
create table if not exists public.settings (
  id                 text primary key,
  "lastQuoteNumber"  integer not null default 1000,
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now()
);

-- Seed the initial settings row
insert into public.settings (id, "lastQuoteNumber")
values ('app_settings', 1000)
on conflict (id) do nothing;

-- ============================================================
-- QUOTES
-- ============================================================
create table if not exists public.quotes (
  id            uuid primary key default uuid_generate_v4(),
  "userId"      uuid references public.users(id) on delete cascade,
  "quoteNumber" text,
  customer      jsonb not null default '{}'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  "lineItems"   jsonb not null default '[]'::jsonb,
  notes         text,
  "templateId"  text,
  status        text not null default 'draft' check (status in ('draft', 'final')),
  total         numeric(12,2) not null default 0,
  subtotal      numeric(12,2) not null default 0,
  tax           numeric(12,2) not null default 0,
  currency      text not null default 'USD' check (currency in ('USD', 'ZWG')),
  "companyLogo" text,
  "isOffline"   boolean not null default false,
  "syncedAt"    timestamptz,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

-- ============================================================
-- DRAFTS  (offline quote drafts stored separately)
-- ============================================================
create table if not exists public.drafts (
  id            uuid primary key default uuid_generate_v4(),
  "userId"      uuid references public.users(id) on delete cascade,
  "quoteNumber" text,
  customer      jsonb not null default '{}'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  "lineItems"   jsonb not null default '[]'::jsonb,
  notes         text,
  "templateId"  text,
  status        text not null default 'draft',
  total         numeric(12,2) not null default 0,
  subtotal      numeric(12,2) not null default 0,
  tax           numeric(12,2) not null default 0,
  currency      text not null default 'USD',
  "companyLogo" text,
  "isOffline"   boolean not null default true,
  "syncedAt"    timestamptz,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

-- ============================================================
-- CONTRACTS
-- ============================================================
create table if not exists public.contracts (
  id                  text primary key,
  "userId"            uuid references public.users(id) on delete cascade,
  title               text not null default 'Contract Agreement',
  content             text,
  "senderParty"       jsonb not null default '{}'::jsonb,
  "receiverParty"     jsonb not null default '{}'::jsonb,
  "senderSignature"   text,
  "receiverSignature" text,
  "senderSignedAt"    timestamptz,
  "receiverSignedAt"  timestamptz,
  status              text not null default 'draft' check (status in ('draft', 'sent', 'signed', 'executed')),
  "isOffline"         boolean not null default false,
  "syncedAt"          timestamptz,
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);

-- ============================================================
-- CONTRACT DRAFTS  (offline contract drafts)
-- ============================================================
create table if not exists public.contract_drafts (
  id                  text primary key,
  "userId"            uuid references public.users(id) on delete cascade,
  title               text not null default 'Contract Agreement',
  content             text,
  "senderParty"       jsonb not null default '{}'::jsonb,
  "receiverParty"     jsonb not null default '{}'::jsonb,
  "senderSignature"   text,
  "receiverSignature" text,
  "senderSignedAt"    timestamptz,
  "receiverSignedAt"  timestamptz,
  status              text not null default 'draft',
  "isOffline"         boolean not null default true,
  "syncedAt"          timestamptz,
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);

-- ============================================================
-- LICENSES
-- ============================================================
create table if not exists public.licenses (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references public.users(id) on delete cascade,
  license_key          text unique not null,
  tier                 text not null default 'pro' check (tier in ('free', 'pro', 'lifetime')),
  is_active            boolean not null default false,
  payment_status       text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_amount       numeric(10,2),
  payment_method       text,
  payment_reference    text,
  device_limit         integer not null default 2,
  devices_used         integer not null default 0,
  deactivated_at       timestamptz,
  deactivated_reason   text,
  key_regenerated_at   timestamptz,
  previous_key         text,
  created_at           timestamptz not null default now(),
  activated_at         timestamptz,
  "updatedAt"          timestamptz
);

-- ============================================================
-- DEVICES  (devices registered to a license)
-- ============================================================
create table if not exists public.devices (
  id             uuid primary key default uuid_generate_v4(),
  license_id     uuid references public.licenses(id) on delete cascade,
  name           text,
  device_id      text,
  ip_address     text,
  user_agent     text,
  whitelisted    boolean not null default false,
  reason         text,
  whitelisted_at timestamptz,
  whitelisted_for integer,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
create table if not exists public.activity_log (
  id           uuid primary key default uuid_generate_v4(),
  "licenseKey" text,
  "deviceId"   text,
  "deviceName" text,
  action       text not null check (action in (
    'activation_attempt',
    'activation_success',
    'activation_blocked',
    'deactivation',
    'quote_generated',
    'payment_confirmed'
  )),
  status       text not null check (status in ('success', 'blocked', 'pending_payment')),
  "ipAddress"  text,
  "userAgent"  text,
  "userId"     uuid references public.users(id) on delete set null,
  email        text,
  phone        text,
  details      jsonb,
  "createdAt"  timestamptz not null default now()
);

-- ============================================================
-- INDEXES  (for common query patterns)
-- ============================================================
create index if not exists idx_quotes_userId        on public.quotes("userId");
create index if not exists idx_quotes_status        on public.quotes(status);
create index if not exists idx_drafts_userId        on public.drafts("userId");
create index if not exists idx_contracts_userId     on public.contracts("userId");
create index if not exists idx_contract_drafts_userId on public.contract_drafts("userId");
create index if not exists idx_licenses_user_id     on public.licenses(user_id);
create index if not exists idx_licenses_license_key on public.licenses(license_key);
create index if not exists idx_devices_license_id   on public.devices(license_id);
create index if not exists idx_activity_log_action  on public.activity_log(action);
create index if not exists idx_activity_log_createdAt on public.activity_log("createdAt");
create index if not exists idx_activity_log_userId  on public.activity_log("userId");

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.users           enable row level security;
alter table public.settings        enable row level security;
alter table public.quotes          enable row level security;
alter table public.drafts          enable row level security;
alter table public.contracts       enable row level security;
alter table public.contract_drafts enable row level security;
alter table public.licenses        enable row level security;
alter table public.devices         enable row level security;
alter table public.activity_log    enable row level security;

-- ---- users: each user can see/update only their own row ----
create policy "users: select own" on public.users
  for select using (auth.uid() = id);

create policy "users: insert own" on public.users
  for insert with check (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- ---- settings: anyone authenticated can read ----
create policy "settings: read" on public.settings
  for select using (auth.role() = 'authenticated');

create policy "settings: write" on public.settings
  for all using (auth.role() = 'authenticated');

-- ---- quotes: users manage their own ----
create policy "quotes: select own" on public.quotes
  for select using (auth.uid() = "userId");

create policy "quotes: insert own" on public.quotes
  for insert with check (auth.uid() = "userId");

create policy "quotes: update own" on public.quotes
  for update using (auth.uid() = "userId");

create policy "quotes: delete own" on public.quotes
  for delete using (auth.uid() = "userId");

-- ---- drafts: users manage their own ----
create policy "drafts: select own" on public.drafts
  for select using (auth.uid() = "userId");

create policy "drafts: insert own" on public.drafts
  for insert with check (auth.uid() = "userId");

create policy "drafts: update own" on public.drafts
  for update using (auth.uid() = "userId");

create policy "drafts: delete own" on public.drafts
  for delete using (auth.uid() = "userId");

-- ---- contracts: users manage their own ----
create policy "contracts: select own" on public.contracts
  for select using (auth.uid() = "userId");

create policy "contracts: insert own" on public.contracts
  for insert with check (auth.uid() = "userId");

create policy "contracts: update own" on public.contracts
  for update using (auth.uid() = "userId");

create policy "contracts: delete own" on public.contracts
  for delete using (auth.uid() = "userId");

-- ---- contract_drafts: users manage their own ----
create policy "contract_drafts: select own" on public.contract_drafts
  for select using (auth.uid() = "userId");

create policy "contract_drafts: insert own" on public.contract_drafts
  for insert with check (auth.uid() = "userId");

create policy "contract_drafts: update own" on public.contract_drafts
  for update using (auth.uid() = "userId");

create policy "contract_drafts: delete own" on public.contract_drafts
  for delete using (auth.uid() = "userId");

-- ---- licenses: users can read their own license ----
create policy "licenses: select own" on public.licenses
  for select using (auth.uid() = user_id);

-- ---- devices: users can read devices linked to their license ----
create policy "devices: select via license" on public.devices
  for select using (
    exists (
      select 1 from public.licenses l
      where l.id = devices.license_id
        and l.user_id = auth.uid()
    )
  );

-- ---- activity_log: users can read their own log entries ----
create policy "activity_log: select own" on public.activity_log
  for select using (auth.uid() = "userId");

-- Service role (used by the server) bypasses RLS automatically.
-- No additional policies needed for the backend.
