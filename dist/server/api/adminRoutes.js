import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import emailService from '../services/emailService.js';
import activityLogger from '../services/activityLogger.js';
import auditLogger from '../services/auditLogger.js';
import { query, queryOne, execute } from '../config/neondb.js';
import { generateBackupZip } from '../services/backupService.js';
const router = Router();
async function isAdmin(uid) {
    const row = await queryOne('SELECT "isAdmin" FROM users WHERE id = $1', [uid]);
    return row?.isAdmin === true;
}
function generateLicenseKey(tier = 'pro') {
    const prefixes = { free: 'FREE', pro: 'PRO', lifetime: 'LIFE' };
    const prefix = prefixes[tier] || 'LIC';
    const suffix = Math.random().toString(36).substring(2, 12).toUpperCase();
    return `${prefix}-${suffix}`;
}
// ============ VERIFY / BOOTSTRAP ADMIN ============
router.get('/verify', adminAuthMiddleware, async (req, res) => {
    try {
        const uid = req.adminUser.id;
        const email = req.adminUser.email ?? '';
        const userRow = await queryOne('SELECT "isAdmin" FROM users WHERE id = $1', [uid]);
        if (userRow?.isAdmin === true) {
            await auditLogger.logLogin(uid, email, req.ip);
            return res.json({ isAdmin: true });
        }
        if (userRow) {
            const countRow = await queryOne('SELECT COUNT(*)::int AS count FROM users WHERE "isAdmin" = true');
            if ((countRow?.count ?? 0) === 0) {
                await execute('UPDATE users SET "isAdmin" = true WHERE id = $1', [uid]);
                await auditLogger.logLogin(uid, email, req.ip);
                return res.json({ isAdmin: true, bootstrapped: true });
            }
            return res.json({ isAdmin: false });
        }
        // Row not found — insert as first admin
        const countRow = await queryOne('SELECT COUNT(*)::int AS count FROM users WHERE "isAdmin" = true');
        const makeAdmin = (countRow?.count ?? 0) === 0;
        await execute('INSERT INTO users (id, email, "isAdmin", tier) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING', [uid, email, makeAdmin, 'free']);
        return res.json({ isAdmin: makeAdmin, bootstrapped: makeAdmin });
    }
    catch (err) {
        console.error('[verify] Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ============ STATS ============
router.get('/stats', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [licenses, usersCount, todayQuotes] = await Promise.all([
            query('SELECT is_active, payment_status, payment_amount FROM licenses'),
            queryOne('SELECT COUNT(*)::int AS count FROM users'),
            query('SELECT id FROM activity_log WHERE action = $1 AND "createdAt" >= $2', ['quote_generated', today.toISOString()]),
        ]);
        const activeCount = licenses.filter((l) => l.is_active).length;
        const pendingPayments = licenses.filter((l) => l.payment_status === 'pending').length;
        const totalRevenue = licenses.filter((l) => l.payment_status === 'paid').reduce((s, l) => s + Number(l.payment_amount || 0), 0);
        res.json({ totalUsers: usersCount?.count || 0, activeLicenses: activeCount, pendingPayments, quotesToday: todayQuotes.length, totalRevenue });
    }
    catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
// ============ AUDIT LOG ============
router.get('/audit-logs', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { page = 1, limit = 50, filter = 'all' } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        let sql = `SELECT * FROM activity_log WHERE action LIKE 'admin_%'`;
        const params = [];
        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            params.push(today.toISOString());
            sql += ` AND "createdAt" >= $${params.length}`;
        }
        else if (filter === 'week') {
            params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            sql += ` AND "createdAt" >= $${params.length}`;
        }
        else if (filter === 'logins') {
            sql = `SELECT * FROM activity_log WHERE action = 'admin_login'`;
        }
        sql += ` ORDER BY "createdAt" DESC`;
        const allLogs = await query(sql, params.length ? params : undefined);
        const skip = (pageNum - 1) * limitNum;
        res.json({ data: allLogs.slice(skip, skip + limitNum), pagination: { page: pageNum, limit: limitNum, total: allLogs.length, pages: Math.ceil(allLogs.length / limitNum) } });
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});
// ============ ACTIVITY LOG ============
router.get('/activity', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { page = 1, limit = 50, filter = 'all' } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        let sql = `SELECT * FROM activity_log`;
        const params = [];
        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            params.push(today.toISOString());
            sql += ` WHERE "createdAt" >= $1`;
        }
        else if (filter === 'week') {
            params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            sql += ` WHERE "createdAt" >= $1`;
        }
        else if (filter === 'blocked') {
            sql += ` WHERE action = 'activation_blocked'`;
        }
        sql += ` ORDER BY "createdAt" DESC`;
        const all = await query(sql, params.length ? params : undefined);
        const skip = (pageNum - 1) * limitNum;
        res.json({ data: all.slice(skip, skip + limitNum), pagination: { page: pageNum, limit: limitNum, total: all.length, pages: Math.ceil(all.length / limitNum) } });
    }
    catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});
// ============ USERS ============
router.get('/users', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const [users, countRow] = await Promise.all([
            query('SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
            queryOne('SELECT COUNT(*)::int AS count FROM users'),
        ]);
        const total = countRow?.count || 0;
        let licenses = [];
        if (users.length > 0) {
            const ids = users.map((u) => u.id);
            const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
            licenses = await query(`SELECT * FROM licenses WHERE user_id IN (${placeholders})`, ids);
        }
        const usersWithLicenses = users.map((user) => ({ ...user, license: licenses.find((l) => l.user_id === user.id) || null }));
        res.json({ users: usersWithLicenses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.get('/pending-payments', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const [licenses, users] = await Promise.all([
            query(`SELECT * FROM licenses WHERE payment_status = 'pending'`),
            query('SELECT * FROM users'),
        ]);
        const usersMap = new Map(users.map((u) => [u.id, u]));
        res.json(licenses.map((l) => ({ ...l, user: usersMap.get(l.user_id) || {} })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending payments' });
    }
});
router.get('/blocked-attempts', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const data = await query(`SELECT * FROM activity_log WHERE action = 'activation_blocked' ORDER BY "createdAt" DESC`);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch blocked attempts' });
    }
});
// ============ LICENSE MANAGEMENT ============
router.post('/mark-paid', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { licenseId, amount, paymentMethod, paymentReference } = req.body;
        if (!licenseId || !amount)
            return res.status(400).json({ error: 'License ID and amount required' });
        const licenseData = await queryOne('SELECT * FROM licenses WHERE id = $1', [licenseId]);
        if (!licenseData)
            return res.status(404).json({ error: 'License not found' });
        const userData = await queryOne('SELECT * FROM users WHERE id = $1', [licenseData.user_id]);
        await execute('UPDATE licenses SET payment_status=$1, payment_amount=$2, payment_method=$3, payment_reference=$4, is_active=true WHERE id=$5', ['paid', amount, paymentMethod, paymentReference, licenseId]);
        await activityLogger.logPaymentConfirmed(licenseData.license_key, amount, paymentMethod, licenseData.user_id, userData?.email);
        await emailService.notifyActivity({ type: 'payment_confirmed', email: userData?.email, amount, paymentMethod, licenseKey: licenseData.license_key });
        await emailService.sendUserEmail(userData?.email, 'payment_confirmed', { licenseKey: licenseData.license_key, amount, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString() });
        await auditLogger.logMarkPaid(req.adminUser.id, req.adminUser.email, userData?.email, licenseData.user_id, { amount, paymentMethod, paymentReference, licenseKey: licenseData.license_key });
        res.json({ success: true, message: 'License marked as paid and user notified' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark as paid' });
    }
});
router.post('/activate-license', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { licenseId } = req.body;
        if (!licenseId)
            return res.status(400).json({ error: 'License ID required' });
        const licenseData = await queryOne('SELECT * FROM licenses WHERE id = $1', [licenseId]);
        if (!licenseData)
            return res.status(404).json({ error: 'License not found' });
        await execute('UPDATE licenses SET is_active=true, activated_at=$1 WHERE id=$2', [new Date().toISOString(), licenseId]);
        await activityLogger.logDeactivation(licenseData.license_key, 'License activated by admin', licenseData.user_id);
        await auditLogger.logActivateLicense(req.adminUser.id, req.adminUser.email, licenseData.user_id, licenseData.user_id, licenseData.license_key);
        res.json({ success: true, message: 'License activated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to activate license' });
    }
});
router.post('/deactivate-license', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { licenseId, reason = 'Admin deactivation' } = req.body;
        if (!licenseId)
            return res.status(400).json({ error: 'License ID required' });
        const licenseData = await queryOne('SELECT * FROM licenses WHERE id = $1', [licenseId]);
        if (!licenseData)
            return res.status(404).json({ error: 'License not found' });
        const userData = await queryOne('SELECT * FROM users WHERE id = $1', [licenseData.user_id]);
        await execute('UPDATE licenses SET is_active=false, deactivated_at=$1, deactivated_reason=$2 WHERE id=$3', [new Date().toISOString(), reason, licenseId]);
        await activityLogger.logDeactivation(licenseData.license_key, reason, licenseData.user_id);
        await emailService.sendUserEmail(userData?.email, 'license_deactivated', { licenseKey: licenseData.license_key, reason });
        await auditLogger.logDeactivateLicense(req.adminUser.id, req.adminUser.email, userData?.email, licenseData.user_id, { reason, licenseKey: licenseData.license_key });
        res.json({ success: true, message: 'License deactivated and user notified' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to deactivate license' });
    }
});
router.post('/deactivate-device', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { licenseId, deviceId } = req.body;
        if (!licenseId || !deviceId)
            return res.status(400).json({ error: 'License ID and Device ID required' });
        await execute('DELETE FROM devices WHERE id = $1 AND license_id = $2', [deviceId, licenseId]);
        await auditLogger.logDeactivateDevice(req.adminUser.id, req.adminUser.email, licenseId, deviceId);
        res.json({ success: true, message: 'Device removed from license' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to deactivate device' });
    }
});
router.post('/whitelist-device', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { licenseId, deviceName, reason } = req.body;
        if (!licenseId)
            return res.status(400).json({ error: 'License ID required' });
        const rows = await query(`INSERT INTO devices (license_id, name, whitelisted, reason, whitelisted_at, whitelisted_for, created_at) VALUES ($1,$2,true,$3,$4,7,$5) RETURNING id`, [licenseId, deviceName, reason, new Date().toISOString(), new Date().toISOString()]);
        await auditLogger.logWhitelistDevice(req.adminUser.id, req.adminUser.email, licenseId, deviceName);
        res.json({ success: true, message: 'Device whitelisted for 7 days', deviceId: rows[0]?.id });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to whitelist device' });
    }
});
// ============ EMAIL ============
router.post('/send-email', adminAuthMiddleware, async (req, res) => {
    try {
        const { userEmail, subject, body } = req.body;
        if (!userEmail || !subject || !body)
            return res.status(400).json({ error: 'User email, subject, and body required' });
        const success = await emailService.sendEmail({ to: userEmail, subject, body, isHtml: true });
        if (!success)
            return res.status(500).json({ error: 'Failed to send email' });
        res.json({ success: true, message: `Email sent to ${userEmail}` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to send email' });
    }
});
// ============ DAILY SUMMARY ============
router.get('/daily-summary', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        const [signups, quotes, blocked, licenses] = await Promise.all([
            query(`SELECT id FROM activity_log WHERE action='activation_attempt' AND "createdAt">=$1`, [todayISO]),
            query(`SELECT id FROM activity_log WHERE action='quote_generated' AND "createdAt">=$1`, [todayISO]),
            query(`SELECT id FROM activity_log WHERE action='activation_blocked' AND "createdAt">=$1`, [todayISO]),
            query('SELECT is_active, payment_status, payment_amount FROM licenses'),
        ]);
        res.json({
            newSignups: signups.length,
            quotesGenerated: quotes.length,
            activationsBlocked: blocked.length,
            totalActiveLicenses: licenses.filter((l) => l.is_active).length,
            pendingPayments: licenses.filter((l) => l.payment_status === 'pending').length,
            estimatedMRR: licenses.filter((l) => l.payment_status === 'paid').reduce((s, l) => s + Number(l.payment_amount || 0), 0),
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});
// ============ USER MANAGEMENT ============
router.post('/delete-user', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'User ID required' });
        if (userId === req.adminUser.id)
            return res.status(400).json({ error: 'Cannot delete your own admin account' });
        const userData = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
        if (!userData)
            return res.status(404).json({ error: 'User not found' });
        await Promise.all([
            execute('DELETE FROM licenses WHERE user_id = $1', [userId]),
            execute('DELETE FROM quotes WHERE "userId" = $1', [userId]),
            execute('DELETE FROM activity_log WHERE "userId" = $1', [userId]),
        ]);
        await execute('DELETE FROM users WHERE id = $1', [userId]);
        await activityLogger.logDeactivation(`USER_DELETE_${userId}`, 'User account deleted by admin', userId);
        await emailService.sendUserEmail(userData?.email, 'account_deleted', { userName: userData?.full_name || 'User' });
        await auditLogger.logDeleteUser(req.adminUser.id, req.adminUser.email, userId, userData?.email);
        res.json({ success: true, message: `User ${userData?.full_name} and their license have been deleted` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
router.post('/generate-license', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { userName, userEmail, tier = 'pro' } = req.body;
        if (!userName || !userEmail)
            return res.status(400).json({ error: 'User name and email required' });
        let userRow = await queryOne('SELECT id FROM users WHERE email = $1', [userEmail]);
        let userId;
        if (!userRow) {
            const rows = await query(`INSERT INTO users (email, full_name, created_at, "isAdmin", phone) VALUES ($1,$2,$3,false,'') RETURNING id`, [userEmail, userName, new Date().toISOString()]);
            userId = rows[0].id;
        }
        else {
            userId = userRow.id;
        }
        const licenseKey = generateLicenseKey(tier);
        const deviceLimit = tier === 'free' ? 2 : tier === 'pro' ? 5 : 10;
        const existingLicense = await queryOne('SELECT id, license_key FROM licenses WHERE user_id = $1', [userId]);
        let licenseId;
        if (existingLicense) {
            await execute(`UPDATE licenses SET license_key=$1, tier=$2, is_active=true, payment_status='paid', payment_method='admin_override', device_limit=$3, activated_at=$4, previous_key=$5, key_regenerated_at=$6 WHERE id=$7`, [licenseKey, tier, deviceLimit, new Date().toISOString(), existingLicense.license_key, new Date().toISOString(), existingLicense.id]);
            licenseId = existingLicense.id;
        }
        else {
            const rows = await query(`INSERT INTO licenses (user_id, license_key, tier, is_active, payment_status, payment_amount, payment_method, device_limit, devices_used, created_at, activated_at) VALUES ($1,$2,$3,true,'paid',0,'admin_override',$4,0,$5,$6) RETURNING id`, [userId, licenseKey, tier, deviceLimit, new Date().toISOString(), new Date().toISOString()]);
            licenseId = rows[0].id;
        }
        await activityLogger.logDeactivation(`LICENSE_GENERATED_${licenseKey}`, 'License generated by admin', userId);
        await emailService.sendUserEmail(userEmail, 'license_generated', { licenseKey, userName, tier, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString() });
        await auditLogger.logGenerateLicense(req.adminUser.id, req.adminUser.email, userEmail, userId, { licenseKey, tier });
        res.json({ success: true, message: 'License generated and user notified', data: { userId, licenseId, licenseKey, userEmail, tier } });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate license' });
    }
});
router.post('/regenerate-license-key', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { licenseId } = req.body;
        if (!licenseId)
            return res.status(400).json({ error: 'License ID required' });
        const licenseData = await queryOne('SELECT * FROM licenses WHERE id = $1', [licenseId]);
        if (!licenseData)
            return res.status(404).json({ error: 'License not found' });
        const newLicenseKey = generateLicenseKey(licenseData.tier);
        await execute('UPDATE licenses SET license_key=$1, key_regenerated_at=$2, previous_key=$3 WHERE id=$4', [newLicenseKey, new Date().toISOString(), licenseData.license_key, licenseId]);
        const userData = await queryOne('SELECT * FROM users WHERE id = $1', [licenseData.user_id]);
        await activityLogger.logDeactivation(`LICENSE_KEY_REGEN_${newLicenseKey}`, `License key regenerated from ${licenseData.license_key}`, licenseData.user_id);
        await emailService.sendUserEmail(userData?.email, 'license_key_updated', { newLicenseKey, oldLicenseKey: licenseData.license_key, userName: userData?.full_name });
        await auditLogger.logRegenerateKey(req.adminUser.id, req.adminUser.email, userData?.email, licenseData.user_id, { newLicenseKey, oldLicenseKey: licenseData.license_key });
        res.json({ success: true, message: 'License key regenerated and user notified', data: { licenseId, newLicenseKey, oldLicenseKey: licenseData.license_key, userEmail: userData?.email } });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to regenerate license key' });
    }
});
// ============ CONTRACTS LICENSES ============
router.get('/contracts-licenses', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const users = await query(`SELECT id, email, full_name, name, "contractsLicense", created_at, "isAdmin" FROM users WHERE "isAdmin" = false`);
        res.json(users.map((u) => ({ id: u.id, email: u.email, name: u.full_name || u.name || 'Unknown', contractsLicense: u.contractsLicense || { active: false }, createdAt: u.created_at, isAdmin: u.isAdmin || false })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch contracts licenses' });
    }
});
router.post('/grant-contracts-license', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { userId, expiresAt } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'User ID required' });
        const userData = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
        if (!userData)
            return res.status(404).json({ error: 'User not found' });
        const contractsLicense = { active: true, purchasedAt: new Date().toISOString(), expiresAt: expiresAt || null };
        await execute(`UPDATE users SET "contractsLicense" = $1 WHERE id = $2`, [JSON.stringify(contractsLicense), userId]);
        await activityLogger.logDeactivation(`CONTRACTS_LICENSE_GRANTED_${userId}`, 'Contracts feature license granted by admin', userId);
        await emailService.sendUserEmail(userData?.email, 'contracts_license_granted', { userName: userData?.full_name || 'User', expiryDate: expiresAt || 'Never' });
        await auditLogger.logGrantContracts(req.adminUser.id, req.adminUser.email, userData?.email, userId);
        res.json({ success: true, message: `Contracts license granted to ${userData?.email}`, data: { userId, email: userData?.email, licenseActive: true, expiresAt: expiresAt || null } });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to grant contracts license' });
    }
});
router.post('/revoke-contracts-license', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'User ID required' });
        const userData = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
        if (!userData)
            return res.status(404).json({ error: 'User not found' });
        await execute(`UPDATE users SET "contractsLicense" = $1 WHERE id = $2`, [JSON.stringify({ active: false, revokedAt: new Date().toISOString() }), userId]);
        await activityLogger.logDeactivation(`CONTRACTS_LICENSE_REVOKED_${userId}`, 'Contracts feature license revoked by admin', userId);
        await emailService.sendUserEmail(userData?.email, 'contracts_license_revoked', { userName: userData?.full_name || 'User' });
        await auditLogger.logRevokeContracts(req.adminUser.id, req.adminUser.email, userData?.email, userId);
        res.json({ success: true, message: `Contracts license revoked from ${userData?.email}`, data: { userId, email: userData?.email, licenseActive: false } });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to revoke contracts license' });
    }
});
// ============ BACKUP ============
router.post('/backup/download', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { buffer, filename, clientCount } = await generateBackupZip();
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('X-Client-Count', clientCount.toString());
        res.end(buffer);
        await logBackupEvent('download', filename, clientCount, req.adminUser.id);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate backup' });
    }
});
router.post('/backup/send-email', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const { buffer, filename, clientCount } = await generateBackupZip();
        const success = await emailService.sendBackupEmail(buffer, filename, clientCount);
        if (!success)
            return res.status(500).json({ error: 'Failed to send backup email' });
        await logBackupEvent('email', filename, clientCount, req.adminUser.id);
        res.json({ success: true, message: `Backup sent to your email (${clientCount} clients)` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to send backup email' });
    }
});
router.get('/backup/history', adminAuthMiddleware, async (req, res) => {
    try {
        if (!(await isAdmin(req.adminUser.id)))
            return res.status(403).json({ error: 'Access denied' });
        const data = await query(`SELECT * FROM activity_log WHERE "licenseKey" LIKE 'BACKUP_%' ORDER BY "createdAt" DESC LIMIT 50`);
        res.json(data.map((e) => ({
            id: e.id,
            type: e.details?.backupType || (e.licenseKey?.includes('SCHEDULED') ? 'scheduled' : e.licenseKey?.includes('EMAIL') ? 'email' : 'download'),
            filename: e.details?.filename || '—',
            clientCount: e.details?.clientCount ?? '—',
            createdAt: e.createdAt,
            userId: e.userId,
        })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch backup history' });
    }
});
async function logBackupEvent(type, filename, clientCount, userId) {
    const keyMap = { download: 'BACKUP_DOWNLOAD', email: 'BACKUP_EMAIL_SENT', scheduled: 'BACKUP_SCHEDULED' };
    const labelMap = { download: 'Manual download', email: 'Emailed to admin', scheduled: 'Scheduled auto-backup' };
    await execute(`INSERT INTO activity_log ("licenseKey","deviceId","deviceName",action,status,"ipAddress","userAgent","userId",details,"createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [keyMap[type], 'N/A', 'N/A', 'deactivation', 'success', 'N/A', 'N/A', userId || null, JSON.stringify({ backupType: type, filename, clientCount, label: labelMap[type] }), new Date().toISOString()]);
}
export { logBackupEvent };
export default router;
