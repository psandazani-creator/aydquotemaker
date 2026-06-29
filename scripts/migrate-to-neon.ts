/**
 * QuoteMaker ZW — Supabase → Neon DB migration
 *
 * Usage:  npx tsx scripts/migrate-to-neon.ts
 *
 * Reads every table from Supabase (bypassing RLS via service-role key) and
 * upserts the rows into Neon.  Safe to run multiple times — uses ON CONFLICT
 * DO NOTHING / DO UPDATE where appropriate.
 */
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import ws from 'ws';

// ── Connections ──────────────────────────────────────────────────────────────

const sbUrl = process.env.SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!sbUrl || !sbKey) {
  console.error('\n❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n');
  process.exit(1);
}

const supabase = createClient(sbUrl, sbKey, {
  auth: { persistSession: false },
  realtime: { transport: ws as any },
});

const neon = new Pool({
  host:     process.env.NEON_HOST,
  database: process.env.NEON_DATABASE,
  user:     process.env.NEON_USER,
  password: process.env.NEON_DATABASE_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  max: 5,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function j(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;          // already a JSON string
  return JSON.stringify(v);
}

function ts(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function bool(v: unknown): boolean {
  return v === true || v === 'true';
}

async function fetchAll(table: string): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`[${table}] Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

async function runBatch(client: any, sqls: Array<{ sql: string; params: any[] }>) {
  for (const { sql, params } of sqls) {
    try {
      await client.query(sql, params);
    } catch (err: any) {
      console.warn(`  ⚠️  Row skipped: ${err.message.slice(0, 120)}`);
    }
  }
}

// ── Table migrations ──────────────────────────────────────────────────────────

async function migrateUsers(client: any): Promise<number> {
  const rows = await fetchAll('users');
  if (rows.length === 0) return 0;

  const sqls = rows.map((r) => ({
    sql: `
      INSERT INTO users
        (id, email, name, full_name, "licenseKey", tier, "deviceLimit", "isAdmin",
         "companyLogo", "companyName", "companyPhone", "companyAddress",
         preferences, "contractsLicense", phone, created_at, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        email          = EXCLUDED.email,
        name           = EXCLUDED.name,
        full_name      = EXCLUDED.full_name,
        tier           = EXCLUDED.tier,
        "isAdmin"      = EXCLUDED."isAdmin",
        "companyName"  = EXCLUDED."companyName",
        "companyPhone" = EXCLUDED."companyPhone",
        "companyAddress" = EXCLUDED."companyAddress",
        preferences    = EXCLUDED.preferences,
        "contractsLicense" = EXCLUDED."contractsLicense",
        phone          = EXCLUDED.phone,
        "updatedAt"    = EXCLUDED."updatedAt"
    `,
    params: [
      str(r.id), str(r.email), str(r.name), str(r.full_name),
      str(r.licenseKey), str(r.tier) || 'free', num(r.deviceLimit) ?? 2,
      bool(r.isAdmin), str(r.companyLogo), str(r.companyName),
      str(r.companyPhone), str(r.companyAddress),
      j(r.preferences) ?? '{"currency":"USD","vatRate":15}',
      j(r.contractsLicense) ?? '{"active":false}',
      str(r.phone), ts(r.created_at) ?? new Date().toISOString(),
      ts(r.createdAt), ts(r.updatedAt),
    ],
  }));

  const c = await client.query('BEGIN');
  await runBatch(client, sqls);
  await client.query('COMMIT');
  return rows.length;
}

async function migrateSettings(client: any): Promise<number> {
  const rows = await fetchAll('settings');

  // Always ensure the app_settings row exists
  await client.query(`
    INSERT INTO settings (id, "lastQuoteNumber", "lastInvoiceNumber", "createdAt", "updatedAt")
    VALUES ('app_settings', 1000, 1000, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  if (rows.length === 0) return 0;

  const sqls = rows.map((r) => ({
    sql: `
      INSERT INTO settings (id, "lastQuoteNumber", "lastInvoiceNumber", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET
        "lastQuoteNumber"   = EXCLUDED."lastQuoteNumber",
        "lastInvoiceNumber" = EXCLUDED."lastInvoiceNumber",
        "updatedAt"         = EXCLUDED."updatedAt"
    `,
    params: [
      str(r.id), num(r.lastQuoteNumber) ?? 1000,
      num(r.lastInvoiceNumber) ?? num(r.lastQuoteNumber) ?? 1000,
      ts(r.createdAt) ?? new Date().toISOString(),
      ts(r.updatedAt) ?? new Date().toISOString(),
    ],
  }));

  await runBatch(client, sqls);
  return rows.length;
}

async function migrateLicenses(client: any): Promise<number> {
  const rows = await fetchAll('licenses');
  if (rows.length === 0) return 0;

  const sqls = rows.map((r) => ({
    sql: `
      INSERT INTO licenses
        (id, user_id, license_key, tier, is_active, payment_status, payment_amount,
         payment_method, payment_reference, device_limit, devices_used,
         deactivated_at, deactivated_reason, key_regenerated_at, previous_key,
         created_at, activated_at, "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        is_active        = EXCLUDED.is_active,
        payment_status   = EXCLUDED.payment_status,
        payment_amount   = EXCLUDED.payment_amount,
        devices_used     = EXCLUDED.devices_used,
        deactivated_at   = EXCLUDED.deactivated_at,
        deactivated_reason = EXCLUDED.deactivated_reason,
        "updatedAt"      = EXCLUDED."updatedAt"
    `,
    params: [
      str(r.id), str(r.user_id), str(r.license_key),
      str(r.tier) || 'pro', bool(r.is_active),
      str(r.payment_status) || 'pending', num(r.payment_amount),
      str(r.payment_method), str(r.payment_reference),
      num(r.device_limit) ?? 2, num(r.devices_used) ?? 0,
      ts(r.deactivated_at), str(r.deactivated_reason),
      ts(r.key_regenerated_at), str(r.previous_key),
      ts(r.created_at) ?? new Date().toISOString(),
      ts(r.activated_at), ts(r.updatedAt),
    ],
  }));

  await client.query('BEGIN');
  await runBatch(client, sqls);
  await client.query('COMMIT');
  return rows.length;
}

async function migrateDevices(client: any): Promise<number> {
  const rows = await fetchAll('devices');
  if (rows.length === 0) return 0;

  const sqls = rows.map((r) => ({
    sql: `
      INSERT INTO devices
        (id, license_id, name, device_id, ip_address, user_agent,
         whitelisted, reason, whitelisted_at, whitelisted_for, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO NOTHING
    `,
    params: [
      str(r.id), str(r.license_id), str(r.name), str(r.device_id),
      str(r.ip_address), str(r.user_agent), bool(r.whitelisted),
      str(r.reason), ts(r.whitelisted_at), num(r.whitelisted_for),
      ts(r.created_at) ?? new Date().toISOString(),
    ],
  }));

  await client.query('BEGIN');
  await runBatch(client, sqls);
  await client.query('COMMIT');
  return rows.length;
}

async function migrateQuotes(client: any): Promise<number> {
  const rows = await fetchAll('quotes');
  if (rows.length === 0) return 0;

  const sqls = rows.map((r) => ({
    sql: `
      INSERT INTO quotes
        (id, "userId", "quoteNumber", customer, details, "lineItems", notes,
         "templateId", status, total, subtotal, tax, currency,
         "companyLogo", "isOffline", "syncedAt", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        customer     = EXCLUDED.customer,
        details      = EXCLUDED.details,
        "lineItems"  = EXCLUDED."lineItems",
        status       = EXCLUDED.status,
        total        = EXCLUDED.total,
        subtotal     = EXCLUDED.subtotal,
        tax          = EXCLUDED.tax,
        "updatedAt"  = EXCLUDED."updatedAt"
    `,
    params: [
      str(r.id), str(r.userId), str(r.quoteNumber),
      j(r.customer) ?? '{}', j(r.details) ?? '{}',
      j(r.lineItems) ?? '[]', str(r.notes), str(r.templateId),
      str(r.status) || 'draft',
      num(r.total) ?? 0, num(r.subtotal) ?? 0, num(r.tax) ?? 0,
      str(r.currency) || 'USD', str(r.companyLogo),
      bool(r.isOffline), ts(r.syncedAt),
      ts(r.createdAt) ?? new Date().toISOString(),
      ts(r.updatedAt) ?? new Date().toISOString(),
    ],
  }));

  await client.query('BEGIN');
  await runBatch(client, sqls);
  await client.query('COMMIT');
  return rows.length;
}

async function migrateContracts(client: any): Promise<number> {
  const [live, drafts] = await Promise.all([
    fetchAll('contracts'),
    fetchAll('contract_drafts'),
  ]);

  const insertContract = (r: any, table: string) => ({
    sql: `
      INSERT INTO ${table}
        (id, "userId", title, content, "senderParty", "receiverParty",
         "senderSignature", "receiverSignature", "senderSignedAt", "receiverSignedAt",
         status, "isOffline", "syncedAt", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        title              = EXCLUDED.title,
        content            = EXCLUDED.content,
        "senderParty"      = EXCLUDED."senderParty",
        "receiverParty"    = EXCLUDED."receiverParty",
        "senderSignature"  = EXCLUDED."senderSignature",
        "receiverSignature"= EXCLUDED."receiverSignature",
        "senderSignedAt"   = EXCLUDED."senderSignedAt",
        "receiverSignedAt" = EXCLUDED."receiverSignedAt",
        status             = EXCLUDED.status,
        "updatedAt"        = EXCLUDED."updatedAt"
    `,
    params: [
      str(r.id), str(r.userId), str(r.title) || 'Contract Agreement',
      str(r.content), j(r.senderParty) ?? '{}', j(r.receiverParty) ?? '{}',
      str(r.senderSignature), str(r.receiverSignature),
      ts(r.senderSignedAt), ts(r.receiverSignedAt),
      str(r.status) || 'draft', bool(r.isOffline), ts(r.syncedAt),
      ts(r.createdAt) ?? new Date().toISOString(),
      ts(r.updatedAt) ?? new Date().toISOString(),
    ],
  });

  await client.query('BEGIN');
  await runBatch(client, live.map((r) => insertContract(r, 'contracts')));
  await runBatch(client, drafts.map((r) => insertContract(r, 'contract_drafts')));
  await client.query('COMMIT');

  return live.length + drafts.length;
}

async function migrateActivityLog(client: any): Promise<number> {
  const rows = await fetchAll('activity_log');
  if (rows.length === 0) return 0;

  const sqls = rows.map((r) => ({
    sql: `
      INSERT INTO activity_log
        (id, "licenseKey", "deviceId", "deviceName", action, status,
         "ipAddress", "userAgent", "userId", email, phone, details, "createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO NOTHING
    `,
    params: [
      str(r.id), str(r.licenseKey), str(r.deviceId), str(r.deviceName),
      str(r.action) || 'deactivation', str(r.status) || 'success',
      str(r.ipAddress), str(r.userAgent), str(r.userId),
      str(r.email), str(r.phone), j(r.details),
      ts(r.createdAt) ?? new Date().toISOString(),
    ],
  }));

  // Insert in batches of 200 to avoid memory/timeout issues on large logs
  const BATCH = 200;
  for (let i = 0; i < sqls.length; i += BATCH) {
    await client.query('BEGIN');
    await runBatch(client, sqls.slice(i, i + BATCH));
    await client.query('COMMIT');
    process.stdout.write(`  activity_log  ${Math.min(i + BATCH, sqls.length)}/${sqls.length}\r`);
  }

  return rows.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  QuoteMaker ZW — Supabase → Neon DB Migration   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const client = await neon.connect();

  try {
    const steps: Array<{ name: string; fn: (c: any) => Promise<number> }> = [
      { name: 'users',        fn: migrateUsers        },
      { name: 'settings',     fn: migrateSettings     },
      { name: 'licenses',     fn: migrateLicenses     },
      { name: 'devices',      fn: migrateDevices      },
      { name: 'quotes',       fn: migrateQuotes       },
      { name: 'contracts',    fn: migrateContracts    },
      { name: 'activity_log', fn: migrateActivityLog  },
    ];

    const results: Record<string, number> = {};

    for (const step of steps) {
      process.stdout.write(`  Migrating ${step.name.padEnd(15)}`);
      try {
        const count = await step.fn(client);
        results[step.name] = count;
        console.log(`✓  ${count} rows`);
      } catch (err: any) {
        console.log(`✗  FAILED — ${err.message}`);
        results[step.name] = -1;
      }
    }

    console.log('\n────────────────────────────────────────────────────');
    console.log('  Migration complete!\n');
    console.log('  Table              Rows migrated');
    console.log('  ─────────────────────────────────');
    for (const [table, count] of Object.entries(results)) {
      const icon = count === -1 ? '✗' : '✓';
      console.log(`  ${icon}  ${table.padEnd(18)} ${count === -1 ? 'ERROR' : count}`);
    }
    console.log('');
  } finally {
    client.release();
    await neon.end();
  }
}

main().catch((err) => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
