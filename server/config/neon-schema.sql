-- QuoteMaker ZW — Neon DB Schema
-- Run once to create all tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           text UNIQUE NOT NULL,
  name            text,
  full_name       text,
  "licenseKey"    text,
  tier            text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'lifetime')),
  "deviceLimit"   integer NOT NULL DEFAULT 2,
  "isAdmin"       boolean NOT NULL DEFAULT false,
  "companyLogo"   text,
  "companyName"   text,
  "companyPhone"  text,
  "companyAddress" text,
  preferences     jsonb DEFAULT '{"currency":"USD","vatRate":15}'::jsonb,
  "contractsLicense" jsonb DEFAULT '{"active":false}'::jsonb,
  phone           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  "createdAt"     timestamptz,
  "updatedAt"     timestamptz
);

CREATE TABLE IF NOT EXISTS public.settings (
  id                   text PRIMARY KEY,
  "lastQuoteNumber"    integer NOT NULL DEFAULT 1000,
  "lastInvoiceNumber"  integer NOT NULL DEFAULT 1000,
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (id, "lastQuoteNumber", "lastInvoiceNumber")
VALUES ('app_settings', 1000, 1000)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.quotes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"      uuid REFERENCES public.users(id) ON DELETE CASCADE,
  "quoteNumber" text,
  customer      jsonb NOT NULL DEFAULT '{}'::jsonb,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "lineItems"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes         text,
  "templateId"  text,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  total         numeric(12,2) NOT NULL DEFAULT 0,
  subtotal      numeric(12,2) NOT NULL DEFAULT 0,
  tax           numeric(12,2) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'ZWG')),
  "companyLogo" text,
  "isOffline"   boolean NOT NULL DEFAULT false,
  "syncedAt"    timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id                  text PRIMARY KEY,
  "userId"            uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title               text NOT NULL DEFAULT 'Contract Agreement',
  content             text,
  "senderParty"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "receiverParty"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "senderSignature"   text,
  "receiverSignature" text,
  "senderSignedAt"    timestamptz,
  "receiverSignedAt"  timestamptz,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'executed')),
  "isOffline"         boolean NOT NULL DEFAULT false,
  "syncedAt"          timestamptz,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_drafts (
  id                  text PRIMARY KEY,
  "userId"            uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title               text NOT NULL DEFAULT 'Contract Agreement',
  content             text,
  "senderParty"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "receiverParty"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "senderSignature"   text,
  "receiverSignature" text,
  "senderSignedAt"    timestamptz,
  "receiverSignedAt"  timestamptz,
  status              text NOT NULL DEFAULT 'draft',
  "isOffline"         boolean NOT NULL DEFAULT true,
  "syncedAt"          timestamptz,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              uuid REFERENCES public.users(id) ON DELETE CASCADE,
  license_key          text UNIQUE NOT NULL,
  tier                 text NOT NULL DEFAULT 'pro' CHECK (tier IN ('free', 'pro', 'lifetime')),
  is_active            boolean NOT NULL DEFAULT false,
  payment_status       text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_amount       numeric(10,2),
  payment_method       text,
  payment_reference    text,
  device_limit         integer NOT NULL DEFAULT 2,
  devices_used         integer NOT NULL DEFAULT 0,
  deactivated_at       timestamptz,
  deactivated_reason   text,
  key_regenerated_at   timestamptz,
  previous_key         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  activated_at         timestamptz,
  "updatedAt"          timestamptz
);

CREATE TABLE IF NOT EXISTS public.devices (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id     uuid REFERENCES public.licenses(id) ON DELETE CASCADE,
  name           text,
  device_id      text,
  ip_address     text,
  user_agent     text,
  whitelisted    boolean NOT NULL DEFAULT false,
  reason         text,
  whitelisted_at timestamptz,
  whitelisted_for integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "licenseKey" text,
  "deviceId"   text,
  "deviceName" text,
  action       text NOT NULL,
  status       text NOT NULL,
  "ipAddress"  text,
  "userAgent"  text,
  "userId"     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email        text,
  phone        text,
  details      jsonb,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_userId        ON public.quotes("userId");
CREATE INDEX IF NOT EXISTS idx_quotes_status        ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_contracts_userId     ON public.contracts("userId");
CREATE INDEX IF NOT EXISTS idx_contract_drafts_userId ON public.contract_drafts("userId");
CREATE INDEX IF NOT EXISTS idx_licenses_user_id     ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_devices_license_id   ON public.devices(license_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_userId  ON public.activity_log("userId");
CREATE INDEX IF NOT EXISTS idx_activity_log_createdAt ON public.activity_log("createdAt");
