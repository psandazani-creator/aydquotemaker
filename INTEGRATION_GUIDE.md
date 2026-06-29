# Complete Admin Dashboard & API Guide for Supabase + PowerSync

Here's your complete, ready-to-paste documentation for your project.

---

# QuoteMaker ZW - Supabase + PowerSync Admin Dashboard

## Quick Start

### 1. Database Setup

Run this entire script in your **Supabase SQL Editor**:

```sql
-- ============================================
-- COMPLETE SUPABASE SETUP FOR QUOTEMAKER ZW
-- ============================================

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'expired', 'refunded')),
  payment_amount DECIMAL(10,2),
  payment_method TEXT CHECK (payment_method IN ('ecocash', 'paynow', 'manual', 'card')),
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivated_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fingerprint TEXT UNIQUE NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  whitelisted BOOLEAN DEFAULT false,
  whitelisted_for INTEGER,
  whitelisted_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT REFERENCES public.licenses(license_key),
  license_id UUID REFERENCES public.licenses(id),
  device_id UUID REFERENCES public.devices(id),
  device_name TEXT,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  status TEXT,
  ip_address TEXT,
  user_agent TEXT,
  email TEXT,
  phone TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'app_settings',
  last_quote_number INTEGER DEFAULT 0,
  admin_email TEXT,
  company_name TEXT DEFAULT 'QuoteMaker ZW',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read own licenses" ON public.licenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own devices" ON public.devices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own devices" ON public.devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own activity" ON public.activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read settings" ON public.settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Create functions and triggers
CREATE OR REPLACE FUNCTION get_next_quote_number()
RETURNS INTEGER AS $$
DECLARE next_number INTEGER;
BEGIN
  UPDATE public.settings
  SET last_quote_number = last_quote_number + 1,
      updated_at = NOW()
  WHERE id = 'app_settings'
  RETURNING last_quote_number INTO next_number;
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_device_user_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT user_id INTO NEW.user_id
  FROM public.licenses
  WHERE id = NEW.license_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS set_device_user_id_trigger ON public.devices;
CREATE TRIGGER set_device_user_id_trigger
  BEFORE INSERT ON public.devices
  FOR EACH ROW EXECUTE FUNCTION set_device_user_id();

-- 6. Insert default settings
INSERT INTO public.settings (id, last_quote_number, admin_email, company_name)
VALUES ('app_settings', 0, 'admin@quotemakerzw.com', 'QuoteMaker ZW')
ON CONFLICT (id) DO NOTHING;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_payment_status ON public.licenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_devices_license_id ON public.devices(license_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON public.devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_license_key ON public.activity_log(license_key);

-- 8. Create PowerSync publication
DROP PUBLICATION IF EXISTS powersync;
CREATE PUBLICATION powersync FOR TABLE public.users, public.licenses, public.devices, public.activity_log, public.settings;
```

---

## 2. Environment Variables (.env)

Create a `.env` file in your project root:

```env
# SERVER
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_random_secret_key_here

# SUPABASE
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ADMIN AUTHENTICATION
ADMIN_PASSWORD=your_super_secret_password_here

# EMAIL NOTIFICATIONS (Gmail/SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
CREATOR_EMAIL=your_email@gmail.com

# SITE URLs
SITE_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:3000/admin-zw

# POWERSYNC
POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
```

---

## 3. File Structure

```
quotemaker-zw/
├── .env
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts
│   ├── api/
│   │   └── adminRoutes.ts
│   ├── services/
│   │   ├── emailService.ts
│   │   ├── activityLogger.ts
│   │   └── supabaseClient.ts
│   └── middleware/
│       └── adminAuth.ts
├── public/
│   └── admin/
│       └── index.html
└── powersync-sync-rules.yaml
```

---

## 4. Core Files

### src/services/supabaseClient.ts

```typescript
import { createClient } from '@supabase/supabase-js';

// Regular client for frontend (uses anon key + RLS)
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Admin client for backend (bypasses RLS)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

### src/middleware/adminAuth.ts

```typescript
import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    adminLoggedIn: boolean;
  }
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.adminLoggedIn) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

export const adminLogin = async (req: Request, res: Response) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    req.session!.adminLoggedIn = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
};

export const adminLogout = (req: Request, res: Response) => {
  req.session!.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
};

export const checkAuth = async (req: Request, res: Response) => {
  res.json({ authenticated: !!req.session?.adminLoggedIn });
};
```

### src/services/emailService.ts

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const emailService = {
  async sendUserEmail(to: string, type: string, data: any) {
    let subject = '';
    let html = '';

    switch (type) {
      case 'payment_confirmed':
        subject = 'Your QuoteMaker ZW License is Active!';
        html = `
          <h2>Payment Confirmed ✅</h2>
          <p>Your license <strong>${data.licenseKey}</strong> is now active.</p>
          <p>Amount paid: $${data.amount}</p>
          <p>Thank you for choosing QuoteMaker ZW!</p>
        `;
        break;
      case 'welcome':
        subject = 'Welcome to QuoteMaker ZW!';
        html = `<h2>Welcome!</h2><p>Start creating professional quotes today.</p>`;
        break;
      default:
        subject = data.subject || 'Update from QuoteMaker ZW';
        html = data.message;
    }

    await transporter.sendMail({
      from: `"QuoteMaker ZW" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  },

  async notifyActivity(activity: any) {
    const creatorEmail = process.env.CREATOR_EMAIL;
    if (!creatorEmail) return;

    let subject = '';
    let html = '';

    switch (activity.type) {
      case 'new_signup':
        subject = '🔔 New License Activation Request';
        html = `
          <h3>New User Signup</h3>
          <p><strong>Email:</strong> ${activity.email}</p>
          <p><strong>Phone:</strong> ${activity.phone}</p>
          <p><strong>License Key:</strong> ${activity.licenseKey}</p>
          <p><strong>Device:</strong> ${activity.deviceName}</p>
          <p><strong>IP:</strong> ${activity.ipAddress}</p>
          <p><a href="${process.env.DASHBOARD_URL}">Go to Admin Dashboard</a></p>
        `;
        break;
      case 'device_blocked':
        subject = '⚠️ Device Blocked - License Sharing Detected';
        html = `
          <h3>Device Blocked</h3>
          <p><strong>Email:</strong> ${activity.email}</p>
          <p><strong>License:</strong> ${activity.licenseKey}</p>
          <p><strong>Attempted Device:</strong> ${activity.deviceName}</p>
          <p><strong>Current Devices:</strong> ${activity.currentDevices?.join(', ')}</p>
        `;
        break;
      case 'daily_summary':
        subject = `📊 Daily Summary - ${activity.dailyStats.date}`;
        html = `
          <h3>Daily Report</h3>
          <ul>
            <li>New Users: ${activity.dailyStats.newUsers}</li>
            <li>New Activations: ${activity.dailyStats.newActivations}</li>
            <li>Blocked Attempts: ${activity.dailyStats.blockedAttempts}</li>
            <li>Quotes Generated: ${activity.dailyStats.quotesGenerated}</li>
            <li>Revenue Today: $${activity.dailyStats.revenueToday}</li>
          </ul>
        `;
        break;
    }

    await transporter.sendMail({
      from: `"QuoteMaker ZW Admin" <${process.env.EMAIL_USER}>`,
      to: creatorEmail,
      subject,
      html,
    });
  },

  templates: {
    welcome: (data: any) => `<h2>Welcome ${data.name || 'User'}!</h2><p>Your account is ready.</p>`,
    paymentConfirmed: (data: any) => `<h2>Payment Confirmed</h2><p>License: ${data.licenseKey}</p>`,
  },
};

export default emailService;
```

### src/services/activityLogger.ts

```typescript
import { supabaseAdmin } from './supabaseClient';

export const activityLogger = {
  async logActivationAttempt(
    licenseKey: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string,
    email?: string,
    phone?: string
  ) {
    return await supabaseAdmin.from('activity_log').insert({
      license_key: licenseKey,
      device_name: deviceName,
      action: 'activation_attempt',
      status: 'pending_payment',
      ip_address: ipAddress,
      user_agent: userAgent,
      email,
      phone,
      created_at: new Date().toISOString()
    });
  },

  async logActivationSuccess(
    licenseKey: string,
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string
  ) {
    return await supabaseAdmin.from('activity_log').insert({
      license_key: licenseKey,
      device_id: deviceId,
      device_name: deviceName,
      action: 'activation_success',
      status: 'success',
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    });
  },

  async logActivationBlocked(
    licenseKey: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string,
    reason: string,
    userId?: string,
    email?: string
  ) {
    return await supabaseAdmin.from('activity_log').insert({
      license_key: licenseKey,
      device_name: deviceName,
      action: 'activation_blocked',
      status: 'blocked',
      ip_address: ipAddress,
      user_agent: userAgent,
      user_id: userId,
      email,
      details: { reason },
      created_at: new Date().toISOString()
    });
  },

  async logQuoteGenerated(
    licenseKey: string,
    deviceName: string,
    details: any
  ) {
    return await supabaseAdmin.from('activity_log').insert({
      license_key: licenseKey,
      device_name: deviceName,
      action: 'quote_generated',
      status: 'success',
      details,
      created_at: new Date().toISOString()
    });
  },

  async logPaymentConfirmed(licenseKey: string, amount: number, method: string) {
    return await supabaseAdmin.from('activity_log').insert({
      license_key: licenseKey,
      action: 'payment_confirmed',
      status: 'success',
      details: { amount, method },
      created_at: new Date().toISOString()
    });
  }
};
```

### src/api/adminRoutes.ts

```typescript
import { Router } from 'express';
import { supabaseAdmin } from '../services/supabaseClient';
import { adminAuth, adminLogin, adminLogout, checkAuth } from '../middleware/adminAuth';
import emailService from '../services/emailService';
import { activityLogger } from '../services/activityLogger';

const router = Router();

// ============================================
// AUTHENTICATION
// ============================================
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/check-auth', checkAuth);

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: activeLicenses } = await supabaseAdmin
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .eq('is_active', true);

    const { count: pendingPayments } = await supabaseAdmin
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'pending');

    const { data: revenueData } = await supabaseAdmin
      .from('licenses')
      .select('payment_amount')
      .eq('payment_status', 'paid');

    const totalRevenue = revenueData?.reduce((sum, l) => sum + (l.payment_amount || 0), 0) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: quotesToday } = await supabaseAdmin
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'quote_generated')
      .gte('created_at', today.toISOString());

    res.json({ totalUsers, activeLicenses, pendingPayments, totalRevenue, quotesToday });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// ACTIVITY LOGS
// ============================================
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const filter = req.query.filter as string;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('activity_log')
      .select('*, users(email, full_name), licenses(license_key)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (filter === 'blocked') {
      query = query.eq('status', 'blocked');
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({ activities: data, total: count, page, totalPages: Math.ceil((count || 0) / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// ============================================
// USERS & LICENSES
// ============================================
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*, licenses(*, devices(*))')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/pending-payments', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('licenses')
      .select('*, users:user_id(email, phone, full_name)')
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ pending: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

router.get('/blocked-attempts', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('activity_log')
      .select('*, users(email, full_name), licenses(license_key)')
      .eq('action', 'activation_blocked')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ blockedAttempts: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blocked attempts' });
  }
});

// ============================================
// LICENSE MANAGEMENT
// ============================================
router.post('/mark-paid', adminAuth, async (req, res) => {
  const { licenseId, licenseKey, amount, method, userEmail } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('licenses')
      .update({
        payment_status: 'paid',
        payment_amount: amount,
        payment_method: method,
        paid_at: new Date().toISOString(),
        is_active: true
      })
      .eq('id', licenseId);

    if (error) throw error;

    await activityLogger.logPaymentConfirmed(licenseKey, amount, method);
    await emailService.sendUserEmail(userEmail, 'payment_confirmed', { licenseKey, amount });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark license as paid' });
  }
});

router.post('/deactivate-license', adminAuth, async (req, res) => {
  const { licenseId, reason } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('licenses')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_reason: reason
      })
      .eq('id', licenseId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate license' });
  }
});

router.post('/deactivate-device', adminAuth, async (req, res) => {
  const { deviceId } = req.body;

  try {
    const { error } = await supabaseAdmin.from('devices').delete().eq('id', deviceId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate device' });
  }
});

router.post('/send-email', adminAuth, async (req, res) => {
  const { email, subject, message } = req.body;

  try {
    await emailService.sendUserEmail(email, 'custom', { subject, message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.get('/daily-summary', adminAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: newUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    const { count: newActivations } = await supabaseAdmin
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'activation_success')
      .gte('created_at', today.toISOString());

    const { count: blockedAttempts } = await supabaseAdmin
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'activation_blocked')
      .gte('created_at', today.toISOString());

    const { count: quotesGenerated } = await supabaseAdmin
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'quote_generated')
      .gte('created_at', today.toISOString());

    const { data: payments } = await supabaseAdmin
      .from('licenses')
      .select('payment_amount')
      .eq('payment_status', 'paid')
      .gte('paid_at', today.toISOString());

    const revenueToday = payments?.reduce((sum, p) => sum + (p.payment_amount || 0), 0) || 0;

    const summary = {
      date: today.toISOString().split('T')[0],
      newUsers,
      newActivations,
      blockedAttempts,
      quotesGenerated,
      revenueToday
    };

    await emailService.notifyActivity({ type: 'daily_summary', dailyStats: summary });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate daily summary' });
  }
});

export default router;
```

### src/server.ts

```typescript
import express from 'express';
import session from 'express-session';
import path from 'path';
import adminRoutes from './api/adminRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.get('/admin-zw', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin-zw`);
});
```

---

## 5. PowerSync Sync Rules (powersync-sync-rules.yaml)

```yaml
bucket_definitions:
  user_data:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM users WHERE id = bucket.user_id
      - SELECT * FROM licenses WHERE user_id = bucket.user_id
      - SELECT * FROM devices WHERE user_id = bucket.user_id
      - SELECT * FROM activity_log WHERE user_id = bucket.user_id
```

---

## 6. License Activation Endpoint Example

Add this to your main app:

```typescript
app.post('/api/license/activate', async (req, res) => {
  const { licenseKey, email, phone, deviceName, deviceFingerprint } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];

  await activityLogger.logActivationAttempt(licenseKey, deviceName, ipAddress, userAgent, email, phone);

  const { data: license, error } = await supabaseAdmin
    .from('licenses')
    .select('*, user:users(*)')
    .eq('license_key', licenseKey)
    .single();

  if (!license) {
    await activityLogger.logActivationBlocked(licenseKey, deviceName, ipAddress, userAgent, 'License not found', undefined, email);
    return res.status(404).json({ error: 'License not found' });
  }

  if (license.payment_status !== 'paid') {
    await emailService.notifyActivity({ type: 'new_signup', email, phone, licenseKey, deviceName, ipAddress });
    return res.status(402).json({ error: 'Payment required', requiresPayment: true });
  }

  const { data: devices } = await supabaseAdmin.from('devices').select('*').eq('license_id', license.id);
  const deviceExists = devices?.find(d => d.fingerprint === deviceFingerprint);

  if (!deviceExists && devices && devices.length >= 2) {
    await activityLogger.logActivationBlocked(licenseKey, deviceName, ipAddress, userAgent, 'Device limit exceeded', license.user_id, email);
    await emailService.notifyActivity({ type: 'device_blocked', email, licenseKey, deviceName, currentDevices: devices.map(d => d.name), ipAddress });
    return res.status(403).json({ error: 'Device limit exceeded. Maximum 2 devices allowed.' });
  }

  if (!deviceExists) {
    await supabaseAdmin.from('devices').insert({ license_id: license.id, name: deviceName, fingerprint: deviceFingerprint, ip_address: ipAddress, user_agent: userAgent });
  } else {
    await supabaseAdmin.from('devices').update({ last_active: new Date().toISOString() }).eq('id', deviceExists.id);
  }

  await activityLogger.logActivationSuccess(licenseKey, deviceFingerprint, deviceName, ipAddress, userAgent);

  res.json({ success: true, license: { key: license.license_key, tier: license.tier } });
});
```

---

## 7. Installation Commands

```bash
# Create project directory
mkdir quotemaker-zw
cd quotemaker-zw

# Initialize package.json
npm init -y

# Install dependencies
npm install express express-session @supabase/supabase-js nodemailer

# Install dev dependencies
npm install --save-dev typescript @types/express @types/express-session @types/node

# Create required directories
mkdir -p src/api src/services src/middleware public/admin

# Copy all the files above into their respective locations

# Start the server
npx ts-node src/server.ts

# Or use tsx for faster development
npm install -D tsx
npx tsx src/server.ts
```

---

## 8. Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

---

