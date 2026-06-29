import { execute } from '../config/neondb.js';

export type AdminAction =
  | 'admin_login' | 'admin_delete_user' | 'admin_generate_license'
  | 'admin_regenerate_key' | 'admin_activate_license' | 'admin_deactivate_license'
  | 'admin_mark_paid' | 'admin_deactivate_device' | 'admin_whitelist_device'
  | 'admin_grant_contracts' | 'admin_revoke_contracts';

export interface AuditEntry {
  adminId: string;
  adminEmail?: string;
  action: AdminAction;
  targetEmail?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

class AuditLogger {
  async log(entry: AuditEntry): Promise<void> {
    try {
      await execute(
        `INSERT INTO activity_log ("licenseKey","deviceId","deviceName",action,status,"ipAddress","userAgent","userId",email,details,"createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          entry.action, entry.adminId, entry.adminEmail || 'Admin',
          entry.action, 'success', entry.ipAddress || 'N/A', 'Admin Dashboard',
          entry.targetId || entry.adminId, entry.targetEmail || null,
          JSON.stringify({ adminEmail: entry.adminEmail, ...(entry.details || {}) }),
          new Date().toISOString(),
        ]
      );
    } catch (err: any) {
      console.error('[AuditLogger] Failed to write audit log:', err.message);
    }
  }

  async logLogin(adminId: string, adminEmail: string, ipAddress?: string) {
    return this.log({ adminId, adminEmail, action: 'admin_login', ipAddress });
  }
  async logDeleteUser(adminId: string, adminEmail: string, targetId: string, targetEmail: string) {
    return this.log({ adminId, adminEmail, action: 'admin_delete_user', targetId, targetEmail });
  }
  async logGenerateLicense(adminId: string, adminEmail: string, targetEmail: string, targetId: string, details: Record<string, any>) {
    return this.log({ adminId, adminEmail, action: 'admin_generate_license', targetEmail, targetId, details });
  }
  async logRegenerateKey(adminId: string, adminEmail: string, targetEmail: string, targetId: string, details: Record<string, any>) {
    return this.log({ adminId, adminEmail, action: 'admin_regenerate_key', targetEmail, targetId, details });
  }
  async logActivateLicense(adminId: string, adminEmail: string, targetEmail: string, targetId: string, licenseKey: string) {
    return this.log({ adminId, adminEmail, action: 'admin_activate_license', targetEmail, targetId, details: { licenseKey } });
  }
  async logDeactivateLicense(adminId: string, adminEmail: string, targetEmail: string, targetId: string, details: Record<string, any>) {
    return this.log({ adminId, adminEmail, action: 'admin_deactivate_license', targetEmail, targetId, details });
  }
  async logMarkPaid(adminId: string, adminEmail: string, targetEmail: string, targetId: string, details: Record<string, any>) {
    return this.log({ adminId, adminEmail, action: 'admin_mark_paid', targetEmail, targetId, details });
  }
  async logDeactivateDevice(adminId: string, adminEmail: string, licenseId: string, deviceId: string) {
    return this.log({ adminId, adminEmail, action: 'admin_deactivate_device', details: { licenseId, deviceId } });
  }
  async logWhitelistDevice(adminId: string, adminEmail: string, licenseId: string, deviceName: string) {
    return this.log({ adminId, adminEmail, action: 'admin_whitelist_device', details: { licenseId, deviceName } });
  }
  async logGrantContracts(adminId: string, adminEmail: string, targetEmail: string, targetId: string) {
    return this.log({ adminId, adminEmail, action: 'admin_grant_contracts', targetEmail, targetId });
  }
  async logRevokeContracts(adminId: string, adminEmail: string, targetEmail: string, targetId: string) {
    return this.log({ adminId, adminEmail, action: 'admin_revoke_contracts', targetEmail, targetId });
  }
}

export default new AuditLogger();
