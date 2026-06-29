import { execute } from '../config/neondb.js';
class AuditLogger {
    async log(entry) {
        try {
            await execute(`INSERT INTO activity_log ("licenseKey","deviceId","deviceName",action,status,"ipAddress","userAgent","userId",email,details,"createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
                entry.action, entry.adminId, entry.adminEmail || 'Admin',
                entry.action, 'success', entry.ipAddress || 'N/A', 'Admin Dashboard',
                entry.targetId || entry.adminId, entry.targetEmail || null,
                JSON.stringify({ adminEmail: entry.adminEmail, ...(entry.details || {}) }),
                new Date().toISOString(),
            ]);
        }
        catch (err) {
            console.error('[AuditLogger] Failed to write audit log:', err.message);
        }
    }
    async logLogin(adminId, adminEmail, ipAddress) {
        return this.log({ adminId, adminEmail, action: 'admin_login', ipAddress });
    }
    async logDeleteUser(adminId, adminEmail, targetId, targetEmail) {
        return this.log({ adminId, adminEmail, action: 'admin_delete_user', targetId, targetEmail });
    }
    async logGenerateLicense(adminId, adminEmail, targetEmail, targetId, details) {
        return this.log({ adminId, adminEmail, action: 'admin_generate_license', targetEmail, targetId, details });
    }
    async logRegenerateKey(adminId, adminEmail, targetEmail, targetId, details) {
        return this.log({ adminId, adminEmail, action: 'admin_regenerate_key', targetEmail, targetId, details });
    }
    async logActivateLicense(adminId, adminEmail, targetEmail, targetId, licenseKey) {
        return this.log({ adminId, adminEmail, action: 'admin_activate_license', targetEmail, targetId, details: { licenseKey } });
    }
    async logDeactivateLicense(adminId, adminEmail, targetEmail, targetId, details) {
        return this.log({ adminId, adminEmail, action: 'admin_deactivate_license', targetEmail, targetId, details });
    }
    async logMarkPaid(adminId, adminEmail, targetEmail, targetId, details) {
        return this.log({ adminId, adminEmail, action: 'admin_mark_paid', targetEmail, targetId, details });
    }
    async logDeactivateDevice(adminId, adminEmail, licenseId, deviceId) {
        return this.log({ adminId, adminEmail, action: 'admin_deactivate_device', details: { licenseId, deviceId } });
    }
    async logWhitelistDevice(adminId, adminEmail, licenseId, deviceName) {
        return this.log({ adminId, adminEmail, action: 'admin_whitelist_device', details: { licenseId, deviceName } });
    }
    async logGrantContracts(adminId, adminEmail, targetEmail, targetId) {
        return this.log({ adminId, adminEmail, action: 'admin_grant_contracts', targetEmail, targetId });
    }
    async logRevokeContracts(adminId, adminEmail, targetEmail, targetId) {
        return this.log({ adminId, adminEmail, action: 'admin_revoke_contracts', targetEmail, targetId });
    }
}
export default new AuditLogger();
