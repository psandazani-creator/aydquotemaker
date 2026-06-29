import { execute } from '../config/neondb.js';

export interface ActivityLogEntry {
  id?: string;
  licenseKey: string;
  deviceId: string;
  deviceName: string;
  action: 'activation_attempt' | 'activation_success' | 'activation_blocked' | 'deactivation' | 'quote_generated' | 'payment_confirmed';
  status: 'success' | 'blocked' | 'pending_payment';
  ipAddress: string;
  userAgent: string;
  userId?: string;
  email?: string;
  phone?: string;
  details?: Record<string, any>;
  createdAt: string;
}

class ActivityLogger {
  async logActivity(entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      await execute(
        `INSERT INTO activity_log ("licenseKey","deviceId","deviceName",action,status,"ipAddress","userAgent","userId",email,phone,details,"createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          entry.licenseKey, entry.deviceId, entry.deviceName,
          entry.action, entry.status, entry.ipAddress, entry.userAgent,
          entry.userId ?? null, entry.email ?? null, entry.phone ?? null,
          entry.details ? JSON.stringify(entry.details) : null,
          new Date().toISOString(),
        ]
      );
      console.log(`📝 Activity logged: ${entry.action} - ${entry.licenseKey}`);
      return null;
    } catch (error: any) {
      console.error('❌ Failed to log activity:', error.message);
      return null;
    }
  }

  async logActivationAttempt(licenseKey: string, deviceName: string, ipAddress: string, userAgent: string, email?: string, phone?: string) {
    return this.logActivity({ licenseKey, deviceId: this.generateDeviceId(ipAddress, userAgent), deviceName, action: 'activation_attempt', status: 'pending_payment', ipAddress, userAgent, email, phone });
  }

  async logActivationSuccess(licenseKey: string, deviceId: string, deviceName: string, ipAddress: string, userAgent: string, userId?: string) {
    return this.logActivity({ licenseKey, deviceId, deviceName, action: 'activation_success', status: 'success', ipAddress, userAgent, userId });
  }

  async logActivationBlocked(licenseKey: string, deviceName: string, ipAddress: string, userAgent: string, reason: string, userId?: string, email?: string) {
    return this.logActivity({ licenseKey, deviceId: this.generateDeviceId(ipAddress, userAgent), deviceName, action: 'activation_blocked', status: 'blocked', ipAddress, userAgent, userId, email, details: { reason } });
  }

  async logDeactivation(licenseKey: string, reason: string, userId?: string) {
    return this.logActivity({ licenseKey, deviceId: 'N/A', deviceName: 'N/A', action: 'deactivation', status: 'success', ipAddress: 'N/A', userAgent: 'N/A', userId, details: { reason } });
  }

  async logQuoteGenerated(licenseKey: string, deviceName: string, quoteDetails?: Record<string, any>) {
    return this.logActivity({ licenseKey, deviceId: 'device-id', deviceName, action: 'quote_generated', status: 'success', ipAddress: 'N/A', userAgent: 'N/A', details: quoteDetails });
  }

  async logPaymentConfirmed(licenseKey: string, amount: number, paymentMethod: string, userId?: string, email?: string) {
    return this.logActivity({ licenseKey, deviceId: 'N/A', deviceName: 'N/A', action: 'payment_confirmed', status: 'success', ipAddress: 'N/A', userAgent: 'N/A', userId, email, details: { amount, paymentMethod } });
  }

  private generateDeviceId(ipAddress: string, userAgent: string): string {
    return Buffer.from(`${ipAddress}|${userAgent}`).toString('base64').substring(0, 50);
  }
}

export default new ActivityLogger();
