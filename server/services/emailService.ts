import nodemailer from 'nodemailer';

interface EmailOptions {
  to?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

interface ActivityNotificationData {
  type: 'new_signup' | 'payment_confirmed' | 'device_blocked' | 'daily_summary';
  email?: string;
  phone?: string;
  licenseKey?: string;
  deviceName?: string;
  currentDevices?: string[];
  ipAddress?: string;
  amount?: number;
  paymentMethod?: string;
  dailyStats?: {
    newSignups: number;
    quotesGenerated: number;
    activationsBlocked: number;
    totalActiveLicenses: number;
    pendingPayments: number;
    estimatedMRR: number;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private creatorEmail: string;
  private isConfigured: boolean = false;

  constructor() {
    this.creatorEmail = process.env.CREATOR_EMAIL || '';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = process.env.EMAIL_HOST;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailHost || !emailUser || !emailPass) {
      console.warn('Email service not fully configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    this.isConfigured = true;
  }

  /**
   * Send backup zip file to creator email as attachment
   */
  async sendBackupEmail(zipBuffer: Buffer, filename: string, clientCount: number): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      console.warn('Email service not configured, skipping backup email send');
      return false;
    }

    const now = new Date();
    const subject = `QuoteMaker ZW — Automated Backup ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    const body = `
      <h2>Scheduled Backup — QuoteMaker ZW</h2>
      <p>Your automated daily backup is attached.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr style="background:#f5f5f5;">
          <td style="padding:10px;border:1px solid #ddd;"><strong>Backup Date</strong></td>
          <td style="padding:10px;border:1px solid #ddd;">${now.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;"><strong>Clients Backed Up</strong></td>
          <td style="padding:10px;border:1px solid #ddd;"><strong style="color:#28a745;">${clientCount}</strong></td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:10px;border:1px solid #ddd;"><strong>File Name</strong></td>
          <td style="padding:10px;border:1px solid #ddd;font-family:monospace;">${filename}</td>
        </tr>
      </table>
      <p style="margin-top:1.2rem;color:#666;font-size:13px;">
        Each client has their own JSON file inside the zip with their profile, license, quotes, drafts, devices, and activity log.
      </p>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: this.creatorEmail,
        subject,
        html: body,
        attachments: [
          {
            filename,
            content: zipBuffer,
            contentType: 'application/zip',
          },
        ],
      });
      console.log(`Backup email sent: ${filename} to ${this.creatorEmail}`);
      return true;
    } catch (error) {
      console.error('Backup email send failed:', error);
      return false;
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      console.warn('Email service not configured, skipping send');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: options.to || this.creatorEmail,
        subject: options.subject,
        html: options.isHtml ? options.body : `<p>${options.body}</p>`,
        text: !options.isHtml ? options.body : undefined,
      });

      console.log(`✉️ Email sent: ${options.subject} → ${options.to || this.creatorEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Email send failed:', error);
      return false;
    }
  }

  /**
   * Send activity notification to creator
   */
  async notifyActivity(data: ActivityNotificationData): Promise<boolean> {
    let subject = '';
    let body = '';

    switch (data.type) {
      case 'new_signup':
        subject = `🔔 New User: ${data.email || data.phone} - QuoteMaker ZW`;
        body = this.generateNewSignupEmail(data);
        break;

      case 'payment_confirmed':
        subject = `💰 Payment Received: ${data.email} - $${data.amount}`;
        body = this.generatePaymentConfirmedEmail(data);
        break;

      case 'device_blocked':
        subject = `🚫 BLOCKED: ${data.email} tried exceeding 2 devices`;
        body = this.generateDeviceBlockedEmail(data);
        break;

      case 'daily_summary':
        subject = `📊 QuoteMaker ZW Daily Report`;
        body = this.generateDailySummaryEmail(data);
        break;

      default:
        return false;
    }

    return this.sendEmail({
      to: this.creatorEmail,
      subject,
      body,
      isHtml: true,
    });
  }

  /**
   * Send email to user (user-facing communications)
   */
  async sendUserEmail(
    userEmail: string,
    emailType: 'welcome' | 'payment_confirmed' | 'payment_reminder' | 'device_limit' | 'license_deactivated' | 'account_deleted' | 'license_generated' | 'license_key_updated' | 'contracts_license_granted' | 'contracts_license_revoked',
    data: Record<string, any> = {}
  ): Promise<boolean> {
    let subject = '';
    let body = '';

    switch (emailType) {
      case 'welcome':
        subject = '🎉 Welcome to QuoteMaker Pro!';
        body = this.generateWelcomeEmail(data);
        break;

      case 'payment_confirmed':
        subject = '✅ Payment Confirmed - Your License is Active';
        body = this.generateUserPaymentConfirmedEmail(data);
        break;

      case 'payment_reminder':
        subject = '💳 Payment Reminder - Activate Your QuoteMaker License';
        body = this.generatePaymentReminderEmail(data);
        break;

      case 'device_limit':
        subject = '⚠️ Device Limit Reached - QuoteMaker';
        body = this.generateDeviceLimitEmail(data);
        break;

      case 'license_deactivated':
        subject = '❌ License Deactivated - QuoteMaker';
        body = this.generateLicenseDeactivatedEmail(data);
        break;

      default:
        return false;
    }

    return this.sendEmail({
      to: userEmail,
      subject,
      body,
      isHtml: true,
    });
  }

  // ============ Email Template Generators ============

  private generateNewSignupEmail(data: ActivityNotificationData): string {
    return `
      <h2>🔔 New User Signup</h2>
      <p>A new user has attempted to activate a license.</p>
      <ul>
        <li><strong>License Key:</strong> ${data.licenseKey}</li>
        <li><strong>Email:</strong> ${data.email || 'N/A'}</li>
        <li><strong>Phone:</strong> ${data.phone || 'N/A'}</li>
        <li><strong>Device:</strong> ${data.deviceName || 'Unknown'}</li>
        <li><strong>IP Address:</strong> ${data.ipAddress || 'Unknown'}</li>
        <li><strong>Payment Status:</strong> <span style="color: orange;">PENDING</span></li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p>
        <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}/admin-zw" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Dashboard</a>
      </p>
    `;
  }

  private generatePaymentConfirmedEmail(data: ActivityNotificationData): string {
    return `
      <h2>💰 Payment Confirmed!</h2>
      <p>Payment has been received and license activated.</p>
      <ul>
        <li><strong>User:</strong> ${data.email}</li>
        <li><strong>Amount:</strong> $${data.amount}</li>
        <li><strong>Payment Method:</strong> ${data.paymentMethod}</li>
        <li><strong>License Key:</strong> ${data.licenseKey}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p style="color: green;"><strong>License is now active.</strong></p>
    `;
  }

  private generateDeviceBlockedEmail(data: ActivityNotificationData): string {
    const devices = data.currentDevices?.join(', ') || 'Unknown devices';
    return `
      <h2>🚫 Device Limit Exceeded - Activation Blocked</h2>
      <p><strong>${data.email}</strong> attempted to exceed the 2-device limit.</p>
      <ul>
        <li><strong>License Key:</strong> ${data.licenseKey}</li>
        <li><strong>Attempted Device:</strong> ${data.deviceName}</li>
        <li><strong>Current Devices:</strong> ${devices}</li>
        <li><strong>IP Address:</strong> ${data.ipAddress}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p style="color: #ff6b6b;"><strong>This could be:</strong></p>
      <ul>
        <li>User got a new phone (legitimate)</li>
        <li>License sharing/piracy (block user)</li>
      </ul>
      <p>
        <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}/admin-zw" style="background: #cc0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View User in Dashboard</a>
      </p>
    `;
  }

  private generateDailySummaryEmail(data: ActivityNotificationData): string {
    const stats = (data.dailyStats || {}) as any;
    return `
      <h2>📊 Daily Activity Report</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr style="background: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>New Signups</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${stats.newSignups || 0}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Quotes Generated</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${stats.quotesGenerated || 0}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Activations Blocked</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${stats.activationsBlocked || 0}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Active Licenses</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${stats.totalActiveLicenses || 0}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Pending Payments</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;" style="color: orange;">${stats.pendingPayments || 0}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Estimated MRR</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;" style="color: green;"><strong>$${stats.estimatedMRR || 0}</strong></td>
        </tr>
      </table>
    `;
  }

  // ============ User-Facing Email Templates ============

  private generateWelcomeEmail(data: Record<string, any>): string {
    return `
      <h2>🎉 Welcome to QuoteMaker Pro!</h2>
      <p>Thank you for activating your license. You now have access to premium features:</p>
      <ul>
        <li>✅ Unlimited quote generation</li>
        <li>✅ Logo customization</li>
        <li>✅ Multiple currency support</li>
        <li>✅ VAT calculation</li>
        <li>✅ Professional PDF exports</li>
      </ul>
      <p><strong>Your License Key:</strong> ${data.licenseKey || 'N/A'}</p>
      <p>
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Open QuoteMaker</a>
      </p>
      <p style="color: #666; font-size: 12px;">Your license is valid for 1 year from activation.</p>
    `;
  }

  private generateUserPaymentConfirmedEmail(data: Record<string, any>): string {
    return `
      <h2>✅ Payment Confirmed!</h2>
      <p>We've received your payment of <strong>$${data.amount}</strong>. Your QuoteMaker Pro license is now <strong>ACTIVE</strong>.</p>
      <p><strong>License Details:</strong></p>
      <ul>
        <li>License Key: ${data.licenseKey}</li>
        <li>Valid Until: ${data.expiryDate || 'See your app'}</li>
        <li>Devices: 2</li>
      </ul>
      <p>Get started now:</p>
      <p>
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Start Generating Quotes</a>
      </p>
    `;
  }

  private generatePaymentReminderEmail(data: Record<string, any>): string {
    return `
      <h2>💳 Complete Your Payment</h2>
      <p>We've received your activation request, but your payment hasn't been confirmed yet.</p>
      <p><strong>Payment Details:</strong></p>
      <ul>
        <li>License Key: ${data.licenseKey}</li>
        <li>Amount Due: <strong>$${data.amount}</strong></li>
        <li>Payment Method: ${data.paymentMethod}</li>
        <li>Reference: ${data.reference}</li>
      </ul>
      <p>Send payment to continue. Your pro features will activate immediately upon confirmation.</p>
      <p style="color: #ff6b6b;">Your demo access expires in 3 days.</p>
    `;
  }

  private generateDeviceLimitEmail(data: Record<string, any>): string {
    return `
      <h2>⚠️ Device Limit Reached</h2>
      <p>Your QuoteMaker Pro license is already active on 2 devices. To add a new device, you need to deactivate an old one.</p>
      <p><strong>Current Devices:</strong></p>
      <ul>
        <li>${data.device1 || 'Device 1'}</li>
        <li>${data.device2 || 'Device 2'}</li>
      </ul>
      <p>Need to switch devices? Contact support or sign in on the device you want to deactivate.</p>
    `;
  }

  private generateLicenseDeactivatedEmail(data: Record<string, any>): string {
    return `
      <h2>❌ License Deactivated</h2>
      <p>Your QuoteMaker Pro license has been deactivated.</p>
      <p><strong>Reason:</strong> ${data.reason || 'Contact support for details'}</p>
      <p>If you believe this is in error, please contact support with your license key: <strong>${data.licenseKey}</strong></p>
      <p>
        <a href="mailto:${process.env.CREATOR_EMAIL || 'support@quotemakerzw.com'}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Contact Support</a>
      </p>
    `;
  }
}

export default new EmailService();
