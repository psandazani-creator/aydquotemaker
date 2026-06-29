import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cron from 'node-cron';
import adminRoutes from './api/adminRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import './config/neondb.js';
import { query, queryOne, execute } from './config/neondb.js';
import { generateBackupZip } from './services/backupService.js';
import emailService from './services/emailService.js';
import { logBackupEvent } from './api/adminRoutes.js';
import { verifyToken, signToken } from './config/jwt.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const distRoot = path.join(__dirname, '../');

app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 },
}));

if (!isProduction) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const allowed = ['http://localhost:5000', 'http://localhost:5173', 'http://localhost:3000'];
    const origin = req.headers.origin || '';
    res.header('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
}

if (isProduction) {
  app.use(express.static(distRoot, { index: false }));
}

// ── Auth helper: verify JWT and return user ──────────────────────────────────
function getAuthUser(req: Request): { id: string; email: string; isAdmin: boolean } | null {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return null;
  return verifyToken(token);
}

// ── DB migration: ensure auth columns exist ──────────────────────────────────
async function ensureAuthColumns() {
  try {
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
    await execute(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)`);
  } catch (err: any) {
    console.warn('[DB] ensureAuthColumns warning:', err.message);
  }
}
ensureAuthColumns();

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public config ─────────────────────────────────────────────────────────────
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const existing = await queryOne<any>('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const password_hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    await execute(
      `INSERT INTO users (id, email, password_hash, name, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, email.toLowerCase(), password_hash, name, now, now]
    );
    const token = signToken({ id, email: email.toLowerCase(), isAdmin: false });
    return res.json({ id, email: email.toLowerCase(), token });
  } catch (err: any) {
    console.error('[signup]', err.message);
    return res.status(500).json({ error: 'Sign-up failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  try {
    const user = await queryOne<any>('SELECT id, email, password_hash, "isAdmin" FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken({ id: user.id, email: user.email, isAdmin: !!user.isAdmin });
    return res.json({ id: user.id, email: user.email, isAdmin: !!user.isAdmin, token });
  } catch (err: any) {
    console.error('[login]', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json(user);
});

app.post('/api/auth/change-password', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  try {
    const user = await queryOne<any>('SELECT id, password_hash FROM users WHERE id=$1', [authUser.id]);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'User not found.' });
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    await execute(`UPDATE users SET password_hash=$1, "updatedAt"=$2 WHERE id=$3`, [hash, new Date().toISOString(), authUser.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  const { email, redirectTo } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const user = await queryOne<any>('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (!user) {
      return res.json({ success: true });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await execute(`UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE id=$3`, [token, expires, user.id]);

    const origin = redirectTo || req.headers.origin || 'http://localhost:5000';
    const resetLink = `${origin}/reset-password?token=${token}`;

    const emailConfigured = !!(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.EMAIL_USER);
    if (emailConfigured) {
      await emailService.sendEmail({
        to: email,
        subject: 'AydQuoteMaker — Reset your password',
        isHtml: true,
        body: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;"><h2 style="color:#1B3A6B;">Reset your password</h2><p style="color:#6b7280;">Click the button below to set a new password.</p><a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#1B3A6B;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Reset Password</a><p style="color:#9ca3af;font-size:12px;margin-top:24px;">This link expires in 1 hour.</p></div>`,
      });
      return res.json({ success: true });
    }
    return res.json({ success: true, link: resetLink });
  } catch (err: any) {
    console.error('[reset-password]', err.message);
    return res.status(500).json({ error: 'Failed to process reset request.' });
  }
});

app.post('/api/auth/reset-password/confirm', async (req: Request, res: Response) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const user = await queryOne<any>(
      `SELECT id, email FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (!user) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

    const hash = await bcrypt.hash(password, 12);
    await execute(
      `UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL, "updatedAt"=$2 WHERE id=$3`,
      [hash, new Date().toISOString(), user.id]
    );
    const jwtToken = signToken({ id: user.id, email: user.email, isAdmin: false });
    return res.json({ success: true, token: jwtToken });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ── User: license ─────────────────────────────────────────────────────────────
app.get('/api/user/license', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let license = await queryOne<any>(
      `SELECT license_key, tier, device_limit, is_active FROM licenses WHERE user_id=$1 AND is_active=true ORDER BY activated_at DESC LIMIT 1`,
      [authUser.id]
    );

    if (!license && authUser.email) {
      const userRow = await queryOne<any>('SELECT id FROM users WHERE email=$1 LIMIT 1', [authUser.email]);
      if (userRow && userRow.id !== authUser.id) {
        license = await queryOne<any>(
          `SELECT license_key, tier, device_limit, is_active FROM licenses WHERE user_id=$1 AND is_active=true ORDER BY activated_at DESC LIMIT 1`,
          [userRow.id]
        );
      }
    }
    return res.json({ license: license ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── User: profile ─────────────────────────────────────────────────────────────
app.get('/api/user/profile', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [userRow, licenseRow] = await Promise.all([
      queryOne<any>('SELECT * FROM users WHERE id=$1', [authUser.id]),
      queryOne<any>(`SELECT license_key, tier, device_limit, is_active FROM licenses WHERE user_id=$1 AND is_active=true ORDER BY activated_at DESC LIMIT 1`, [authUser.id]),
    ]);
    res.json({ user: userRow ?? null, license: licenseRow ?? null });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/user/profile', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

  const { name, companyName, companyPhone, companyAddress, companyLogo, preferences, phone } = req.body;
  try {
    const existing = await queryOne<any>('SELECT id FROM users WHERE id=$1', [authUser.id]);
    if (!existing) {
      await execute(
        `INSERT INTO users (id, email, name, "companyName", "companyPhone", "companyAddress", "companyLogo", preferences, phone, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [authUser.id, authUser.email, name, companyName, companyPhone, companyAddress, companyLogo, preferences ? JSON.stringify(preferences) : null, phone, new Date().toISOString(), new Date().toISOString()]
      );
    } else {
      const fields: string[] = [];
      const vals: any[] = [];
      const set = (col: string, val: any) => { if (val !== undefined) { vals.push(typeof val === 'object' ? JSON.stringify(val) : val); fields.push(`"${col}"=$${vals.length}`); } };
      set('name', name); set('companyName', companyName); set('companyPhone', companyPhone);
      set('companyAddress', companyAddress); set('companyLogo', companyLogo);
      set('preferences', preferences); set('phone', phone);
      if (fields.length > 0) {
        vals.push(new Date().toISOString()); fields.push(`"updatedAt"=$${vals.length}`);
        vals.push(authUser.id);
        await execute(`UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Quotes ────────────────────────────────────────────────────────────────────
app.get('/api/quotes', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const rows = await query('SELECT * FROM quotes WHERE "userId"=$1 ORDER BY "createdAt" DESC', [authUser.id]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/quotes/upsert', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  const row = req.body;
  if (!row.id) return res.status(400).json({ error: 'id required' });
  try {
    await execute(
      `INSERT INTO quotes (id,"userId","quoteNumber",customer,details,"lineItems",notes,"templateId",status,total,subtotal,tax,currency,"companyLogo","isOffline","syncedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET "quoteNumber"=EXCLUDED."quoteNumber",customer=EXCLUDED.customer,details=EXCLUDED.details,"lineItems"=EXCLUDED."lineItems",notes=EXCLUDED.notes,"templateId"=EXCLUDED."templateId",status=EXCLUDED.status,total=EXCLUDED.total,subtotal=EXCLUDED.subtotal,tax=EXCLUDED.tax,currency=EXCLUDED.currency,"companyLogo"=EXCLUDED."companyLogo","isOffline"=EXCLUDED."isOffline","syncedAt"=EXCLUDED."syncedAt","updatedAt"=EXCLUDED."updatedAt"`,
      [row.id, authUser.id, row.quoteNumber, JSON.stringify(row.customer||{}), JSON.stringify(row.details||{}), JSON.stringify(row.lineItems||[]), row.notes||null, row.templateId||null, row.status||'draft', row.total||0, row.subtotal||0, row.tax||0, row.currency||'USD', row.companyLogo||null, row.isOffline||false, row.syncedAt||null, row.createdAt||new Date().toISOString(), new Date().toISOString()]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/quotes/:id', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await execute('DELETE FROM quotes WHERE id=$1 AND "userId"=$2', [req.params.id, authUser.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Settings / counters ───────────────────────────────────────────────────────
app.get('/api/settings', async (_req: Request, res: Response) => {
  try {
    const row = await queryOne<any>('SELECT * FROM settings WHERE id=$1', ['app_settings']);
    res.json(row ?? { id: 'app_settings', lastQuoteNumber: 1000, lastInvoiceNumber: 1000 });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/settings/next-quote-number', async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `INSERT INTO settings (id, "lastQuoteNumber", "lastInvoiceNumber", "createdAt", "updatedAt") VALUES ('app_settings',1001,1000,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET "lastQuoteNumber"=settings."lastQuoteNumber"+1, "updatedAt"=NOW() RETURNING "lastQuoteNumber"`,
    );
    res.json({ number: rows[0]?.lastQuoteNumber ?? 1001 });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/settings/preview-quote-number', async (_req: Request, res: Response) => {
  try {
    const row = await queryOne<any>('SELECT "lastQuoteNumber" FROM settings WHERE id=$1', ['app_settings']);
    res.json({ number: (row?.lastQuoteNumber ?? 1000) + 1 });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/settings/next-invoice-number', async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `INSERT INTO settings (id, "lastQuoteNumber", "lastInvoiceNumber", "createdAt", "updatedAt") VALUES ('app_settings',1000,1001,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET "lastInvoiceNumber"=settings."lastInvoiceNumber"+1, "updatedAt"=NOW() RETURNING "lastInvoiceNumber"`,
    );
    res.json({ number: rows[0]?.lastInvoiceNumber ?? 1001 });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/settings/preview-invoice-number', async (_req: Request, res: Response) => {
  try {
    const row = await queryOne<any>('SELECT "lastInvoiceNumber" FROM settings WHERE id=$1', ['app_settings']);
    res.json({ number: (row?.lastInvoiceNumber ?? 1000) + 1 });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Contracts ─────────────────────────────────────────────────────────────────
app.get('/api/contracts', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
  const offset = (page - 1) * limit;
  try {
    const [contracts, drafts, countRow] = await Promise.all([
      query(`SELECT * FROM contracts WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`, [authUser.id, limit, offset]),
      query(`SELECT * FROM contract_drafts WHERE "userId"=$1 ORDER BY "createdAt" DESC`, [authUser.id]),
      queryOne<{ count: number }>(`SELECT COUNT(*)::int AS count FROM contracts WHERE "userId"=$1`, [authUser.id]),
    ]);
    res.json({ contracts, drafts, total: countRow?.count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/contracts', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  const c = req.body;
  if (!c.id) return res.status(400).json({ error: 'id required' });
  const table = c.status === 'draft' ? 'contract_drafts' : 'contracts';
  try {
    await execute(
      `INSERT INTO ${table} (id,"userId",title,content,"senderParty","receiverParty","senderSignature","receiverSignature","senderSignedAt","receiverSignedAt",status,"isOffline","syncedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,"senderParty"=EXCLUDED."senderParty","receiverParty"=EXCLUDED."receiverParty","senderSignature"=EXCLUDED."senderSignature","receiverSignature"=EXCLUDED."receiverSignature","senderSignedAt"=EXCLUDED."senderSignedAt","receiverSignedAt"=EXCLUDED."receiverSignedAt",status=EXCLUDED.status,"isOffline"=EXCLUDED."isOffline","syncedAt"=EXCLUDED."syncedAt","updatedAt"=EXCLUDED."updatedAt"`,
      [c.id, authUser.id, c.title||'Contract Agreement', c.content||null, JSON.stringify(c.senderParty||{}), JSON.stringify(c.receiverParty||{}), c.senderSignature||null, c.receiverSignature||null, c.senderSignedAt||null, c.receiverSignedAt||null, c.status||'draft', c.isOffline||false, c.syncedAt||null, c.createdAt||new Date().toISOString(), new Date().toISOString()]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/contracts/:id', async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await Promise.all([
      execute(`DELETE FROM contracts WHERE id=$1 AND "userId"=$2`, [req.params.id, authUser.id]),
      execute(`DELETE FROM contract_drafts WHERE id=$1 AND "userId"=$2`, [req.params.id, authUser.id]),
    ]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────
app.use('/api/admin', adminRoutes);

// ── Admin dashboard ───────────────────────────────────────────────────────────
app.get('/admin', (_req: Request, res: Response) => {
  const adminIndex = isProduction ? path.join(distRoot, 'admin/index.html') : path.join(__dirname, '../public/admin/index.html');
  res.sendFile(adminIndex);
});
app.get('/admin-zw', (_req: Request, res: Response) => {
  const adminIndex = isProduction ? path.join(distRoot, 'admin/index.html') : path.join(__dirname, '../public/admin/index.html');
  res.sendFile(adminIndex);
});

// ── SPA catch-all ─────────────────────────────────────────────────────────────
app.get('*', (req: Request, res: Response) => {
  if (isProduction) return res.sendFile(path.join(distRoot, 'index.html'));
  res.status(404).json({ error: `Dev mode — frontend runs on port 5000. Route not found: ${req.method} ${req.url}` });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin-zw`);
});

cron.schedule('0 18 * * *', async () => {
  console.log('\n[CRON] Running scheduled 6PM backup...');
  try {
    const { buffer, filename, clientCount } = await generateBackupZip();
    const success = await emailService.sendBackupEmail(buffer, filename, clientCount);
    if (success) {
      console.log(`[CRON] Backup emailed: ${filename} (${clientCount} clients)`);
      await logBackupEvent('scheduled', filename, clientCount);
    }
  } catch (err) {
    console.error('[CRON] Scheduled backup failed:', err);
  }
}, { timezone: 'Africa/Harare' });

export default app;
