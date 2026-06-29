import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { PassThrough } from 'stream';
import { query } from '../config/neondb.js';

export interface ClientBackupData {
  user: Record<string, any>;
  license: Record<string, any> | null;
  quotes: Record<string, any>[];
  devices: Record<string, any>[];
  activityLog: Record<string, any>[];
  exportedAt: string;
}

export interface BackupResult {
  buffer: Buffer;
  filename: string;
  clientCount: number;
}

async function fetchAllData() {
  const [users, licenses, quotes, devices, activityLog] = await Promise.all([
    query('SELECT * FROM users'),
    query('SELECT * FROM licenses'),
    query('SELECT * FROM quotes'),
    query('SELECT * FROM devices'),
    query('SELECT * FROM activity_log ORDER BY "createdAt" DESC'),
  ]);
  return { users, licenses, quotes, devices, activityLog };
}

export async function generateBackupZip(): Promise<BackupResult> {
  const { users, licenses, quotes, devices, activityLog } = await fetchAllData();

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const filename = `quotemaker-backup-${dateStr}_${timeStr}.zip`;
  const bufferChunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const passThrough = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    passThrough.on('data', (chunk: Buffer) => bufferChunks.push(chunk));
    passThrough.on('end', resolve);
    passThrough.on('error', reject);
    archive.on('error', reject);
    archive.pipe(passThrough);

    const nonAdminUsers = users.filter((u: any) => !u.isAdmin);

    for (const user of nonAdminUsers) {
      const userId = user.id;
      const safeEmail = (user.email || userId).replace(/[^a-zA-Z0-9@._-]/g, '_');
      const userLicense = licenses.find((l: any) => l.user_id === userId) || null;
      const userDevices = devices.filter((d: any) => userLicense && d.license_id === userLicense.id);
      const userQuotes = quotes.filter((q: any) => q.userId === userId);
      const userActivity = activityLog.filter((a: any) => a.userId === userId);

      const clientData: ClientBackupData = {
        user: { id: user.id, email: user.email, full_name: user.full_name, name: user.name, companyName: user.companyName, companyPhone: user.companyPhone, companyAddress: user.companyAddress, phone: user.phone, tier: user.tier, isAdmin: user.isAdmin, created_at: user.created_at, preferences: user.preferences, contractsLicense: user.contractsLicense },
        license: userLicense ? { id: userLicense.id, license_key: userLicense.license_key, tier: userLicense.tier, is_active: userLicense.is_active, payment_status: userLicense.payment_status, payment_amount: userLicense.payment_amount, payment_method: userLicense.payment_method, device_limit: userLicense.device_limit, devices_used: userLicense.devices_used, created_at: userLicense.created_at, activated_at: userLicense.activated_at } : null,
        quotes: userQuotes,
        devices: userDevices,
        activityLog: userActivity,
        exportedAt: now.toISOString(),
      };

      archive.append(JSON.stringify(clientData, null, 2), { name: `clients/${safeEmail}.json` });
    }

    const summaryData = {
      exportedAt: now.toISOString(),
      totalUsers: nonAdminUsers.length,
      totalLicenses: licenses.length,
      totalQuotes: quotes.length,
      activeLicenses: licenses.filter((l: any) => l.is_active).length,
      pendingPayments: licenses.filter((l: any) => l.payment_status === 'pending').length,
    };
    archive.append(JSON.stringify(summaryData, null, 2), { name: 'summary.json' });
    archive.finalize();
  });

  return {
    buffer: Buffer.concat(bufferChunks),
    filename,
    clientCount: users.filter((u: any) => !u.isAdmin).length,
  };
}
