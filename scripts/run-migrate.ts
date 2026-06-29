import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const sqlPath = path.join(__dirname, 'migrate.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// Split on statement-ending semicolons, skip blank lines and comments
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`\n🚀 Running QuoteMaker ZW migration against ${supabaseUrl}`);
console.log(`📋 ${statements.length} statements to execute\n`);

let passed = 0;
let failed = 0;

for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
  try {
    const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' }).single();
    if (error) {
      // Supabase REST doesn't expose exec_sql — fall through to pg approach
      throw error;
    }
    console.log(`  ✅ ${preview}…`);
    passed++;
  } catch {
    // Supabase JS client can't run raw DDL directly.
    // We print what would be run and let the user paste it in the SQL Editor.
    console.log(`  ⚠️  ${preview}…  (needs SQL Editor — see below)`);
    failed++;
  }
}

if (failed > 0) {
  console.log(`
⚠️  The Supabase JS client cannot execute DDL statements (CREATE TABLE, etc.)
   directly over the REST API — that requires direct postgres access.

✅ HOW TO APPLY THE MIGRATION:
   1. Open your Supabase dashboard → SQL Editor
      https://supabase.com/dashboard/project/burvwjzimfqjldmmzbfr/sql/new
   2. Copy and paste the contents of:  scripts/migrate.sql
   3. Click "Run"

   Everything in that file is idempotent (uses IF NOT EXISTS / ON CONFLICT)
   so it is safe to run multiple times.
`);
} else {
  console.log(`\n✅ Migration complete — ${passed} statements applied successfully.\n`);
}
