// server/api/adminRoutes.ts
//
// All admin API endpoints, mounted at /api/admin/* in server/index.ts.
//
// Every route is protected by two layers:
//   1. adminAuthMiddleware  — verifies the Bearer JWT and populates req.adminUser
//   2. isAdmin(uid)         — queries the DB to confirm isAdmin=true for that user
//
// This double-check means that even if someone forges a valid JWT for a
// non-admin account they still cannot call these endpoints.
//
// Route map:
//   GET  /verify                  — bootstrap or confirm admin status
//   GET  /stats                   — dashboard KPI counters
//   GET  /audit-logs              — paginated admin-action audit trail
//   GET  /activity                — paginated full activity log
//   GET  /users                   — paginated user list with joined licenses
//   GET  /pending-payments        — licenses awaiting manual payment confirmation
//   GET  /blocked-attempts        — activation_blocked events
//   POST /mark-paid               — confirm a manual payment and activate license
//   POST /activate-license        — activate a license without a payment record
//   POST /deactivate-license      — deactivate a license and email the user
//   POST /deactivate-device       — remove a specific device from a license
//   POST /whitelist-device        — add a temporary (7-day) whitelisted device slot
//   POST /send-email              — send a free-form email to any user address
//   GET  /daily-summary           — today's signups, quotes, blocks, MRR snapshot
//   POST /delete-user             — permanently delete a user and all their data
//   POST /generate-license        — create or replace a license for any user
//   POST /regenerate-license-key  — rotate the license key and email the new one
//   GET  /contracts-licenses      — list all users' contracts add-on status
//   POST /grant-contracts-license — enable the contracts add-on for a user
//   POST /revoke-contracts-license — disable the contracts add-on for a user
//   POST /backup/download         — stream a ZIP backup of all client data
//   POST /backup/send-email       — email the ZIP backup to the admin address
//   GET  /backup/history          — list past backup events from the activity log

import express, { Router, Request, Response } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import emailService from '../services/emailService.js';
import activityLogger from '../services/activityLogger.js';
import auditLogger from '../services/auditLogger.js';
import { query, queryOne, execute } from '../config/neondb.js';
import { generateBackupZip } from '../services/backupService.js';

const router = Router();

/** Extends Express Request with the JWT payload injected by adminAuthMiddleware */
interface AdminRequest extends Request {
  adminUser?: any;
}

// ─────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────

/**
 * Checks the DB to confirm a user has the isAdmin flag set.
 * Called inside every route handler as a second safety check after
 * the middleware has already verified the token is valid.
 */
async function isAdmin(uid: string): Promise<boolean> {
  const row = await queryOne<{ isAdmin: boolean }>('SELECT "isAdmin" FROM users WHERE id = $1', [uid]);
  return row?.isAdmin === true;
}

/**
 * Generates a unique, tier-prefixed license key.
 * Format: <PREFIX>-<10-char alphanumeric>
 * e.g. PRO-A1B2C3D4E5
 */
function generateLicenseKey(tier: string = 'pro'): string {
  const prefixes: Record<string, string> = { free: 'FREE', pro: 'PRO', lifetime: 'LIFE' };
  const prefix = prefixes[tier] || 'LIC';
  const suffix = Math.random().toString(36).substring(2, 12).toUpperCase();
  return `${prefix}-${suffix}`;
}

// ─────────────────────────────────────────────────
// VERIFY / BOOTSTRAP ADMIN
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/verify
 *
 * Verifies whether the currently authenticated user is an admin.
 * Self-bootstrapping logic:
 *   - If there are zero admins in the DB, the first user to call this
 *     endpoint is automatically promoted to admin (useful for initial setup).
 *   - If the user row doesn't exist yet, it is inserted on the fly.
 *
 * Returns: { isAdmin: boolean, bootstrapped?: true }
 */
router.get('/verify', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    const uid = req.adminUser!.id;
    const email = req.adminUser!.email ?? '';

    const userRow = await queryOne<{ isAdmin: boolean }>('SELECT "isAdmin" FROM users WHERE id = $1', [uid]);

    if (userRow?.isAdmin === true) {
      // Existing confirmed admin — log the login and return.
      await auditLogger.logLogin(uid, email, req.ip);
      return res.json({ isAdmin: true });
    }

    if (userRow) {
      // User exists but is not admin. Promote only if no admin exists yet.
      const countRow = await queryOne<{ count: number }>('SELECT COUNT(*)::int AS count FROM users WHERE "isAdmin" = true');
      if ((countRow?.count ?? 0) === 0) {
        await execute('UPDATE users SET "isAdmin" = true WHERE id = $1', [uid]);
        await auditLogger.logLogin(uid, email, req.ip);
        return res.json({ isAdmin: true, bootstrapped: true });
      }
      return res.json({ isAdmin: false });
    }

    // User row not found — insert it, and make them admin only if no admin exists.
    const countRow = await queryOne<{ count: number }>('SELECT COUNT(*)::int AS count FROM users WHERE "isAdmin" = true');
    const makeAdmin = (countRow?.count ?? 0) === 0;
    await execute(
      'INSERT INTO users (id, email, "isAdmin", tier) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [uid, email, makeAdmin, 'free']
    );
    return res.json({ isAdmin: makeAdmin, bootstrapped: makeAdmin });
  } catch (err) {
    console.error('[verify] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 *
 * Returns aggregate KPI counters for the dashboard header tiles:
 *   - totalUsers        : total rows in the users table
 *   - activeLicenses    : licenses with is_active = true
 *   - pendingPayments   : licenses with payment_status = 'pending'
 *   - quotesToday       : quote_generated events logged since midnight (local time)
 *   - totalRevenue      : sum of payment_amount for all 'paid' licenses
 */
router.get('/stats', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });

    // Midnight boundary for the "today" quota count.
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [licenses, usersCount, todayQuotes] = await Promise.all([
      query('SELECT is_active, payment_status, payment_amount FROM licenses'),
      queryOne<{ count: number }>('SELECT COUNT(*)::int AS count FROM users'),
      query('SELECT id FROM activity_log WHERE action = $1 AND "createdAt" >= $2', ['quote_generated', today.toISOString()]),
    ]);

    // Compute derived metrics from the licenses array in memory (avoids multiple DB round-trips).
    const activeCount    = licenses.filter((l: any) => l.is_active).length;
    const pendingPayments = licenses.filter((l: any) => l.payment_status === 'pending').length;
    const totalRevenue   = licenses
      .filter((l: any) => l.payment_status === 'paid')
      .reduce((s: number, l: any) => s + Number(l.payment_amount || 0), 0);

    res.json({
      totalUsers: usersCount?.count || 0,
      activeLicenses: activeCount,
      pendingPayments,
      quotesToday: todayQuotes.length,
      totalRevenue,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs
 *
 * Returns paginated admin-only audit entries (rows whose action starts with 'admin_').
 * Query params:
 *   page   — page number (default 1)
 *   limit  — rows per page (default 50)
 *   filter — 'all' | 'today' | 'week' | 'logins'
 *
 * Note: pagination is performed in application code (slice) rather than in SQL
 * to avoid multiple COUNT queries; this is fine for the expected admin log volume.
 */
router.get('/audit-logs', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });

    const { page = 1, limit = 50, filter = 'all' } = req.query;
    const pageNum  = parseInt(page as string)  || 1;
    const limitNum = parseInt(limit as string) || 50;

    let sql = `SELECT * FROM activity_log WHERE action LIKE 'admin_%'`;
    const params: any[] = [];

    if (filter === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      params.push(today.toISOString());
      sql += ` AND "createdAt" >= $${params.length}`;
    } else if (filter === 'week') {
      params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      sql += ` AND "createdAt" >= $${params.length}`;
    } else if (filter === 'logins') {
      // Override the base query to return only login events.
      sql = `SELECT * FROM activity_log WHERE action = 'admin_login'`;
    }

    sql += ` ORDER BY "createdAt" DESC`;
    const allLogs = await query(sql, params.length ? params : undefined);
    const skip = (pageNum - 1) * limitNum;
    res.json({
      data: allLogs.slice(skip, skip + limitNum),
      pagination: { page: pageNum, limit: limitNum, total: allLogs.length, pages: Math.ceil(allLogs.length / limitNum) },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ─────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/activity
 *
 * Returns paginated rows from the activity_log table (all action types).
 * Query params:
 *   page   — page number (default 1)
 *   limit  — rows per page (default 50)
 *   filter — 'all' | 'today' | 'week' | 'blocked'
 *              'blocked' shows only activation_blocked events (licence sharing alerts)
 */
router.get('/activity', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });

    const { page = 1, limit = 50, filter = 'all' } = req.query;
    const pageNum  = parseInt(page as string)  || 1;
    const limitNum = parseInt(limit as string) || 50;

    let sql = `SELECT * FROM activity_log`;
    const params: any[] = [];

    if (filter === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      params.push(today.toISOString());
      sql += ` WHERE "createdAt" >= $1`;
    } else if (filter === 'week') {
      params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      sql += ` WHERE "createdAt" >= $1`;
    } else if (filter === 'blocked') {
      // License-sharing security alerts only.
      sql += ` WHERE action = 'activation_blocked'`;
    }

    sql += ` ORDER BY "createdAt" DESC`;
    const all  = await query(sql, params.length ? params : undefined);
    const skip = (pageNum - 1) * limitNum;
    res.json({
      data: all.slice(skip, skip + limitNum),
      pagination: { page: pageNum, limit: limitNum, total: all.length, pages: Math.ceil(all.length / limitNum) },
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ─────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/users
 *
 * Returns a paginated list of all users, each with their associated license
 * record attached (or null if they have no license yet).
 *
 * Query params:
 *   page  — page number (default 1)
 *   limit — rows per page, capped at 100 (default 20)
 *
 * The license join is done in application code: we fetch user IDs, then query
 * the licenses table with an IN clause, then merge in memory.  This avoids a
 * potentially slow LEFT JOIN on large datasets.
 */
router.get('/users', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });

    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [users, countRow] = await Promise.all([
      query('SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      queryOne<{ count: number }>('SELECT COUNT(*)::int AS count FROM users'),
    ]);
    const total = countRow?.count || 0;

    // Fetch only the licenses for the current page of users to keep the query small.
    let licenses: any[] = [];
    if (users.length > 0) {
      const ids          = users.map((u: any) => u.id);
      const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(',');
      licenses = await query(`SELECT * FROM licenses WHERE user_id IN (${placeholders})`, ids);
    }

    // Merge each user with its license record (or null).
    const usersWithLicenses = users.map((user: any) => ({
      ...user,
      license: licenses.find((l: any) => l.user_id === user.id) || null,
    }));

    res.json({
      users: usersWithLicenses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/pending-payments
 *
 * Returns all licenses with payment_status = 'pending', each enriched with the
 * associated user record so the admin can identify who needs to be chased.
 */
router.get('/pending-payments', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const [licenses, users] = await Promise.all([
      query(`SELECT * FROM licenses WHERE payment_status = 'pending'`),
      query('SELECT * FROM users'),
    ]);
    // Build a Map for O(1) user lookups when merging.
    const usersMap = new Map(users.map((u: any) => [u.id, u]));
    res.json(licenses.map((l: any) => ({ ...l, user: usersMap.get(l.user_id) || {} })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

/**
 * GET /api/admin/blocked-attempts
 *
 * Returns all activation_blocked log entries, newest-first.
 * These indicate suspected license sharing (a device fingerprint tried to
 * activate on more devices than the license allows).
 */
router.get('/blocked-attempts', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const data = await query(`SELECT * FROM activity_log WHERE action = 'activation_blocked' ORDER BY "createdAt" DESC`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blocked attempts' });
  }
});

// ─────────────────────────────────────────────────
// LICENSE MANAGEMENT
// ─────────────────────────────────────────────────

/**
 * POST /api/admin/mark-paid
 *
 * Confirms a manual payment for a license and simultaneously activates it.
 * Used for EcoCash, bank transfer, and other local payment methods where
 * there is no automated webhook.
 *
 * Body: { licenseId, amount, paymentMethod, paymentReference }
 *
 * Side effects:
 *   - Updates licenses: payment_status='paid', is_active=true
 *   - Logs to activity_log via activityLogger
 *   - Sends an admin notification email
 *   - Sends a payment_confirmed email to the user
 *   - Writes to the audit_log via auditLogger
 */
router.post('/mark-paid', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { licenseId, amount, paymentMethod, paymentReference } = req.body;
    if (!licenseId || !amount) return res.status(400).json({ error: 'License ID and amount required' });

    const licenseData = await queryOne<any>('SELECT * FROM licenses WHERE id = $1', [licenseId]);
    if (!licenseData) return res.status(404).json({ error: 'License not found' });
    const userData = await queryOne<any>('SELECT * FROM users WHERE id = $1', [licenseData.user_id]);

    await execute(
      'UPDATE licenses SET payment_status=$1, payment_amount=$2, payment_method=$3, payment_reference=$4, is_active=true WHERE id=$5',
      ['paid', amount, paymentMethod, paymentReference, licenseId]
    );

    // Notify both the admin and the user.
    await activityLogger.logPaymentConfirmed(licenseData.license_key, amount, paymentMethod, licenseData.user_id, userData?.email);
    await emailService.notifyActivity({ type: 'payment_confirmed', email: userData?.email, amount, paymentMethod, licenseKey: licenseData.license_key });
    await emailService.sendUserEmail(userData?.email, 'payment_confirmed', {
      licenseKey: licenseData.license_key,
      amount,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    });
    await auditLogger.logMarkPaid(req.adminUser!.id, req.adminUser!.email, userData?.email, licenseData.user_id, { amount, paymentMethod, paymentReference, licenseKey: licenseData.license_key });
    res.json({ success: true, message: 'License marked as paid and user notified' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as paid' });
  }
});

/**
 * POST /api/admin/activate-license
 *
 * Activates a license without requiring a payment confirmation.
 * Useful for granting trial extensions, fixing stuck licenses, or comping a user.
 *
 * Body: { licenseId }
 *
 * Side effects:
 *   - Sets is_active=true and activated_at=now
 *   - Logs to activity_log and audit_log
 */
router.post('/activate-license', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { licenseId } = req.body;
    if (!licenseId) return res.status(400).json({ error: 'License ID required' });

    const licenseData = await queryOne<any>('SELECT * FROM licenses WHERE id = $1', [licenseId]);
    if (!licenseData) return res.status(404).json({ error: 'License not found' });

    await execute('UPDATE licenses SET is_active=true, activated_at=$1 WHERE id=$2', [new Date().toISOString(), licenseId]);
    await activityLogger.logDeactivation(licenseData.license_key, 'License activated by admin', licenseData.user_id);
    await auditLogger.logActivateLicense(req.adminUser!.id, req.adminUser!.email, licenseData.user_id, licenseData.user_id, licenseData.license_key);
    res.json({ success: true, message: 'License activated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate license' });
  }
});

/**
 * POST /api/admin/deactivate-license
 *
 * Deactivates a license and emails the user to explain why.
 *
 * Body: { licenseId, reason? }
 *
 * Side effects:
 *   - Sets is_active=false, deactivated_at=now, deactivated_reason
 *   - Sends license_deactivated email to the user
 *   - Logs to activity_log and audit_log
 */
router.post('/deactivate-license', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { licenseId, reason = 'Admin deactivation' } = req.body;
    if (!licenseId) return res.status(400).json({ error: 'License ID required' });

    const licenseData = await queryOne<any>('SELECT * FROM licenses WHERE id = $1', [licenseId]);
    if (!licenseData) return res.status(404).json({ error: 'License not found' });
    const userData = await queryOne<any>('SELECT * FROM users WHERE id = $1', [licenseData.user_id]);

    await execute('UPDATE licenses SET is_active=false, deactivated_at=$1, deactivated_reason=$2 WHERE id=$3', [new Date().toISOString(), reason, licenseId]);
    await activityLogger.logDeactivation(licenseData.license_key, reason, licenseData.user_id);
    await emailService.sendUserEmail(userData?.email, 'license_deactivated', { licenseKey: licenseData.license_key, reason });
    await auditLogger.logDeactivateLicense(req.adminUser!.id, req.adminUser!.email, userData?.email, licenseData.user_id, { reason, licenseKey: licenseData.license_key });
    res.json({ success: true, message: 'License deactivated and user notified' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate license' });
  }
});

/**
 * POST /api/admin/deactivate-device
 *
 * Removes a specific registered device from a license.
 * Frees up a device slot so the user can activate on a new machine
 * (e.g. after a hardware replacement).
 *
 * Body: { licenseId, deviceId }
 */
router.post('/deactivate-device', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { licenseId, deviceId } = req.body;
    if (!licenseId || !deviceId) return res.status(400).json({ error: 'License ID and Device ID required' });
    await execute('DELETE FROM devices WHERE id = $1 AND license_id = $2', [deviceId, licenseId]);
    await auditLogger.logDeactivateDevice(req.adminUser!.id, req.adminUser!.email, licenseId, deviceId);
    res.json({ success: true, message: 'Device removed from license' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate device' });
  }
});

/**
 * POST /api/admin/whitelist-device
 *
 * Inserts a pre-approved device row into the devices table with
 * whitelisted=true and a 7-day expiry window.  This lets a user activate
 * on an extra device temporarily (e.g. a borrowed laptop) without
 * permanently raising their device limit.
 *
 * Body: { licenseId, deviceName, reason? }
 */
router.post('/whitelist-device', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { licenseId, deviceName, reason } = req.body;
    if (!licenseId) return res.status(400).json({ error: 'License ID required' });
    const rows = await query(
      `INSERT INTO devices (license_id, name, whitelisted, reason, whitelisted_at, whitelisted_for, created_at)
       VALUES ($1,$2,true,$3,$4,7,$5) RETURNING id`,
      [licenseId, deviceName, reason, new Date().toISOString(), new Date().toISOString()]
    );
    await auditLogger.logWhitelistDevice(req.adminUser!.id, req.adminUser!.email, licenseId, deviceName);
    res.json({ success: true, message: 'Device whitelisted for 7 days', deviceId: rows[0]?.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to whitelist device' });
  }
});

// ─────────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────────

/**
 * POST /api/admin/send-email
 *
 * Sends an arbitrary HTML email to any user address.
 * Intended for manual outreach (payment reminders, onboarding nudges, etc.).
 *
 * Body: { userEmail, subject, body }
 *
 * Note: this route does NOT have the secondary isAdmin DB check because it
 * is guarded by adminAuthMiddleware alone. Consider adding the check if the
 * endpoint is ever exposed to non-admin JWT holders.
 */
router.post('/send-email', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { userEmail, subject, body } = req.body;
    if (!userEmail || !subject || !body) return res.status(400).json({ error: 'User email, subject, and body required' });
    const success = await emailService.sendEmail({ to: userEmail, subject, body, isHtml: true });
    if (!success) return res.status(500).json({ error: 'Failed to send email' });
    res.json({ success: true, message: `Email sent to ${userEmail}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ─────────────────────────────────────────────────
// DAILY SUMMARY
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/daily-summary
 *
 * Returns a snapshot of today's key business metrics.
 * Consumed by the cron job (see server/index.ts) to send the daily email
 * digest, and can also be polled by the dashboard for a quick MRR view.
 *
 * Returns:
 *   newSignups          — activation_attempt events today (proxy for new sign-ups)
 *   quotesGenerated     — quote_generated events today
 *   activationsBlocked  — licence sharing alerts today
 *   totalActiveLicenses — all-time active license count
 *   pendingPayments     — all-time pending payment count
 *   estimatedMRR        — cumulative revenue from all paid licenses
 */
router.get('/daily-summary', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [signups, quotes, blocked, licenses] = await Promise.all([
      query(`SELECT id FROM activity_log WHERE action='activation_attempt' AND "createdAt">=$1`, [todayISO]),
      query(`SELECT id FROM activity_log WHERE action='quote_generated'    AND "createdAt">=$1`, [todayISO]),
      query(`SELECT id FROM activity_log WHERE action='activation_blocked' AND "createdAt">=$1`, [todayISO]),
      query('SELECT is_active, payment_status, payment_amount FROM licenses'),
    ]);

    res.json({
      newSignups:          signups.length,
      quotesGenerated:     quotes.length,
      activationsBlocked:  blocked.length,
      totalActiveLicenses: licenses.filter((l: any) => l.is_active).length,
      pendingPayments:     licenses.filter((l: any) => l.payment_status === 'pending').length,
      estimatedMRR:        licenses.filter((l: any) => l.payment_status === 'paid').reduce((s: number, l: any) => s + Number(l.payment_amount || 0), 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ─────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────

/**
 * POST /api/admin/delete-user
 *
 * Permanently deletes a user and all their associated data.
 * This is an irreversible hard delete — no soft-delete flag is used.
 *
 * Body: { userId }
 *
 * Guards:
 *   - Cannot delete your own admin account.
 *   - Cascades to: licenses, quotes, activity_log rows for that userId.
 *
 * Side effects:
 *   - Sends account_deleted email to the user before removing their record.
 *   - Writes to activity_log and audit_log.
 */
router.post('/delete-user', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    if (userId === req.adminUser!.id) return res.status(400).json({ error: 'Cannot delete your own admin account' });

    const userData = await queryOne<any>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userData) return res.status(404).json({ error: 'User not found' });

    // Delete child records before the parent to respect FK constraints.
    await Promise.all([
      execute('DELETE FROM licenses     WHERE user_id = $1',  [userId]),
      execute('DELETE FROM quotes       WHERE "userId" = $1', [userId]),
      execute('DELETE FROM activity_log WHERE "userId" = $1', [userId]),
    ]);
    await execute('DELETE FROM users WHERE id = $1', [userId]);

    await activityLogger.logDeactivation(`USER_DELETE_${userId}`, 'User account deleted by admin', userId);
    await emailService.sendUserEmail(userData?.email, 'account_deleted', { userName: userData?.full_name || 'User' });
    await auditLogger.logDeleteUser(req.adminUser!.id, req.adminUser!.email, userId, userData?.email);
    res.json({ success: true, message: `User ${userData?.full_name} and their license have been deleted` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * POST /api/admin/generate-license
 *
 * Creates or replaces a license for a user (identified by email).
 * If the email doesn't match an existing user, a new user record is created.
 *
 * Body: { userName, userEmail, tier? }
 *   tier defaults to 'pro'; valid values: 'free' | 'pro' | 'lifetime'
 *
 * Device limits by tier:
 *   free     → 2 devices
 *   pro      → 5 devices
 *   lifetime → 10 devices
 *
 * Side effects:
 *   - Upserts a license record (INSERT or UPDATE if one already exists).
 *   - Sends license_generated email to the user.
 *   - Logs to activity_log and audit_log.
 */
router.post('/generate-license', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { userName, userEmail, tier = 'pro' } = req.body;
    if (!userName || !userEmail) return res.status(400).json({ error: 'User name and email required' });

    // Find or create the user.
    let userRow = await queryOne<any>('SELECT id FROM users WHERE email = $1', [userEmail]);
    let userId: string;

    if (!userRow) {
      const rows = await query(
        `INSERT INTO users (email, full_name, created_at, "isAdmin", phone) VALUES ($1,$2,$3,false,'') RETURNING id`,
        [userEmail, userName, new Date().toISOString()]
      );
      userId = rows[0].id;
    } else {
      userId = userRow.id;
    }

    const licenseKey  = generateLicenseKey(tier);
    const deviceLimit = tier === 'free' ? 2 : tier === 'pro' ? 5 : 10;

    // If a license already exists, rotate the key (store the old one in previous_key).
    const existingLicense = await queryOne<any>('SELECT id, license_key FROM licenses WHERE user_id = $1', [userId]);
    let licenseId: string;
    if (existingLicense) {
      await execute(
        `UPDATE licenses SET license_key=$1, tier=$2, is_active=true, payment_status='paid',
         payment_method='admin_override', device_limit=$3, activated_at=$4,
         previous_key=$5, key_regenerated_at=$6 WHERE id=$7`,
        [licenseKey, tier, deviceLimit, new Date().toISOString(), existingLicense.license_key, new Date().toISOString(), existingLicense.id]
      );
      licenseId = existingLicense.id;
    } else {
      const rows = await query(
        `INSERT INTO licenses
         (user_id, license_key, tier, is_active, payment_status, payment_amount, payment_method, device_limit, devices_used, created_at, activated_at)
         VALUES ($1,$2,$3,true,'paid',0,'admin_override',$4,0,$5,$6) RETURNING id`,
        [userId, licenseKey, tier, deviceLimit, new Date().toISOString(), new Date().toISOString()]
      );
      licenseId = rows[0].id;
    }

    await activityLogger.logDeactivation(`LICENSE_GENERATED_${licenseKey}`, 'License generated by admin', userId);
    await emailService.sendUserEmail(userEmail, 'license_generated', {
      licenseKey, userName, tier,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    });
    await auditLogger.logGenerateLicense(req.adminUser!.id, req.adminUser!.email, userEmail, userId, { licenseKey, tier });
    res.json({ success: true, message: 'License generated and user notified', data: { userId, licenseId, licenseKey, userEmail, tier } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate license' });
  }
});

/**
 * POST /api/admin/regenerate-license-key
 *
 * Issues a brand-new license key for an existing license (e.g. if the key
 * was shared or compromised), invalidating the old one.
 * The old key is saved in the previous_key column for audit purposes.
 *
 * Body: { licenseId }
 *
 * Side effects:
 *   - Updates license_key and key_regenerated_at.
 *   - Sends license_key_updated email to the user with both old and new keys.
 *   - Logs to activity_log and audit_log.
 */
router.post('/regenerate-license-key', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { licenseId } = req.body;
    if (!licenseId) return res.status(400).json({ error: 'License ID required' });

    const licenseData = await queryOne<any>('SELECT * FROM licenses WHERE id = $1', [licenseId]);
    if (!licenseData) return res.status(404).json({ error: 'License not found' });

    const newLicenseKey = generateLicenseKey(licenseData.tier);
    await execute(
      'UPDATE licenses SET license_key=$1, key_regenerated_at=$2, previous_key=$3 WHERE id=$4',
      [newLicenseKey, new Date().toISOString(), licenseData.license_key, licenseId]
    );

    const userData = await queryOne<any>('SELECT * FROM users WHERE id = $1', [licenseData.user_id]);
    await activityLogger.logDeactivation(`LICENSE_KEY_REGEN_${newLicenseKey}`, `License key regenerated from ${licenseData.license_key}`, licenseData.user_id);
    await emailService.sendUserEmail(userData?.email, 'license_key_updated', { newLicenseKey, oldLicenseKey: licenseData.license_key, userName: userData?.full_name });
    await auditLogger.logRegenerateKey(req.adminUser!.id, req.adminUser!.email, userData?.email, licenseData.user_id, { newLicenseKey, oldLicenseKey: licenseData.license_key });
    res.json({ success: true, message: 'License key regenerated and user notified', data: { licenseId, newLicenseKey, oldLicenseKey: licenseData.license_key, userEmail: userData?.email } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate license key' });
  }
});

// ─────────────────────────────────────────────────
// CONTRACTS ADD-ON LICENSES
// ─────────────────────────────────────────────────

/**
 * GET /api/admin/contracts-licenses
 *
 * Returns all non-admin users together with their contractsLicense JSON column.
 * The contracts feature is an optional paid add-on stored as a JSONB blob
 * ({ active, purchasedAt, expiresAt }) directly on the users row.
 */
router.get('/contracts-licenses', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const users = await query(
      `SELECT id, email, full_name, name, "contractsLicense", created_at, "isAdmin"
       FROM users WHERE "isAdmin" = false`
    );
    res.json(users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.full_name || u.name || 'Unknown',
      contractsLicense: u.contractsLicense || { active: false },
      createdAt: u.created_at,
      isAdmin: u.isAdmin || false,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contracts licenses' });
  }
});

/**
 * POST /api/admin/grant-contracts-license
 *
 * Enables the contracts add-on for a user by writing
 * { active: true, purchasedAt, expiresAt } into the contractsLicense column.
 *
 * Body: { userId, expiresAt? }
 *   expiresAt is an ISO date string; omit for a perpetual grant.
 *
 * Side effects:
 *   - Sends contracts_license_granted email to the user.
 *   - Logs to activity_log and audit_log.
 */
router.post('/grant-contracts-license', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { userId, expiresAt } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const userData = await queryOne<any>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userData) return res.status(404).json({ error: 'User not found' });

    const contractsLicense = {
      active:      true,
      purchasedAt: new Date().toISOString(),
      expiresAt:   expiresAt || null,
    };
    await execute(`UPDATE users SET "contractsLicense" = $1 WHERE id = $2`, [JSON.stringify(contractsLicense), userId]);

    await activityLogger.logDeactivation(`CONTRACTS_LICENSE_GRANTED_${userId}`, 'Contracts feature license granted by admin', userId);
    await emailService.sendUserEmail(userData?.email, 'contracts_license_granted', { userName: userData?.full_name || 'User', expiryDate: expiresAt || 'Never' });
    await auditLogger.logGrantContracts(req.adminUser!.id, req.adminUser!.email, userData?.email, userId);
    res.json({ success: true, message: `Contracts license granted to ${userData?.email}`, data: { userId, email: userData?.email, licenseActive: true, expiresAt: expiresAt || null } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to grant contracts license' });
  }
});

/**
 * POST /api/admin/revoke-contracts-license
 *
 * Disables the contracts add-on for a user by writing
 * { active: false, revokedAt } into the contractsLicense column.
 *
 * Body: { userId }
 *
 * Side effects:
 *   - Sends contracts_license_revoked email to the user.
 *   - Logs to activity_log and audit_log.
 */
router.post('/revoke-contracts-license', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const userData = await queryOne<any>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userData) return res.status(404).json({ error: 'User not found' });

    await execute(
      `UPDATE users SET "contractsLicense" = $1 WHERE id = $2`,
      [JSON.stringify({ active: false, revokedAt: new Date().toISOString() }), userId]
    );
    await activityLogger.logDeactivation(`CONTRACTS_LICENSE_REVOKED_${userId}`, 'Contracts feature license revoked by admin', userId);
    await emailService.sendUserEmail(userData?.email, 'contracts_license_revoked', { userName: userData?.full_name || 'User' });
    await auditLogger.logRevokeContracts(req.adminUser!.id, req.adminUser!.email, userData?.email, userId);
    res.json({ success: true, message: `Contracts license revoked from ${userData?.email}`, data: { userId, email: userData?.email, licenseActive: false } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke contracts license' });
  }
});

// ─────────────────────────────────────────────────
// BACKUP
// ─────────────────────────────────────────────────

/**
 * POST /api/admin/backup/download
 *
 * Generates a ZIP archive of all client quote data and streams it to the
 * admin's browser as a file download.
 *
 * The backup is produced by backupService.generateBackupZip(), which
 * queries all relevant tables and serialises them into a structured ZIP.
 *
 * Response headers:
 *   Content-Type        : application/zip
 *   Content-Disposition : attachment; filename="<timestamp>.zip"
 *   X-Client-Count      : number of client records included
 */
router.post('/backup/download', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { buffer, filename, clientCount } = await generateBackupZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Client-Count', clientCount.toString());
    res.end(buffer);
    // Log the event after the response is sent so a slow log write doesn't delay the download.
    await logBackupEvent('download', filename, clientCount, req.adminUser!.id);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate backup' });
  }
});

/**
 * POST /api/admin/backup/send-email
 *
 * Generates the same ZIP backup and emails it to the admin's configured
 * email address instead of triggering a browser download.
 * Useful for automating off-site storage of backups.
 */
router.post('/backup/send-email', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const { buffer, filename, clientCount } = await generateBackupZip();
    const success = await emailService.sendBackupEmail(buffer, filename, clientCount);
    if (!success) return res.status(500).json({ error: 'Failed to send backup email' });
    await logBackupEvent('email', filename, clientCount, req.adminUser!.id);
    res.json({ success: true, message: `Backup sent to your email (${clientCount} clients)` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send backup email' });
  }
});

/**
 * GET /api/admin/backup/history
 *
 * Returns the last 50 backup events from the activity_log.
 * Backup events are identified by a BACKUP_* prefix in the licenseKey column
 * (a convention used by logBackupEvent below).
 */
router.get('/backup/history', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.adminUser!.id))) return res.status(403).json({ error: 'Access denied' });
    const data = await query(
      `SELECT * FROM activity_log WHERE "licenseKey" LIKE 'BACKUP_%' ORDER BY "createdAt" DESC LIMIT 50`
    );
    res.json(data.map((e: any) => ({
      id:          e.id,
      // Derive the backup type from the stored details or the licenseKey prefix.
      type:        e.details?.backupType || (e.licenseKey?.includes('SCHEDULED') ? 'scheduled' : e.licenseKey?.includes('EMAIL') ? 'email' : 'download'),
      filename:    e.details?.filename    || '—',
      clientCount: e.details?.clientCount ?? '—',
      createdAt:   e.createdAt,
      userId:      e.userId,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backup history' });
  }
});

// ─────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────

/**
 * Writes a backup event to the activity_log table.
 * Uses the licenseKey column (an existing text field) as a type prefix carrier
 * so backup events can be filtered without a schema change.
 *
 * Exported so that server/index.ts can call it from the scheduled cron backup job.
 */
async function logBackupEvent(
  type: 'download' | 'email' | 'scheduled',
  filename: string,
  clientCount: number,
  userId?: string,
): Promise<void> {
  const keyMap   = { download: 'BACKUP_DOWNLOAD', email: 'BACKUP_EMAIL_SENT', scheduled: 'BACKUP_SCHEDULED' };
  const labelMap = { download: 'Manual download', email: 'Emailed to admin', scheduled: 'Scheduled auto-backup' };
  await execute(
    `INSERT INTO activity_log
     ("licenseKey","deviceId","deviceName",action,status,"ipAddress","userAgent","userId",details,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [keyMap[type], 'N/A', 'N/A', 'deactivation', 'success', 'N/A', 'N/A', userId || null,
     JSON.stringify({ backupType: type, filename, clientCount, label: labelMap[type] }),
     new Date().toISOString()]
  );
}

export { logBackupEvent };
export default router;
