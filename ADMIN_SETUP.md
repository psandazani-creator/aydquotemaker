# QuoteMaker ZW Admin Dashboard & API Setup

## Environment Variables (.env)

```env
# SERVER
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_session_secret_key_here

# FIREBASE CONFIG
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

# FIREBASE ADMIN SDK (Service Account)
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# ADMIN AUTHENTICATION
ADMIN_PASSWORD=your_super_secret_password_here

# EMAIL NOTIFICATIONS (Gmail/SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here  # Use App Password, not Gmail password
CREATOR_EMAIL=your_email@gmail.com

# SITE URLs (for email links)
SITE_URL=https://quotemakerzw.com
DASHBOARD_URL=https://quotemakerzw.com/admin-zw
```

## Firebase Service Account Setup

To enable server-side Firebase operations (admin authentication, Firestore operations), you need to set up a Firebase service account:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`aydquotemaker-zw`)
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate new private key**
5. Download the JSON file
6. Copy the `private_key` and `client_email` values to your `.env` file:
   - `FIREBASE_PRIVATE_KEY`: The entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
   - `FIREBASE_CLIENT_EMAIL`: The service account email (usually `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`)

**Security Note**: Never commit the service account JSON file or private key to version control.

## File Structure

```
src/
├── server.ts                    # Main Express server
├── api/
│   └── adminRoutes.ts          # All admin API endpoints
├── services/
│   ├── emailService.ts         # Email notifications
│   └── activityLogger.ts       # Activity logging to Firestore
└── middleware/
    └── adminAuth.ts            # Admin authentication

public/
└── admin/
    └── index.html              # Admin dashboard UI

```

## Installation & Setup

### 1. Install Dependencies

```bash
npm install express express-session firebase dotenv nodemailer
npm install --save-dev typescript @types/express @types/node
```

### 2. Initialize Firebase

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init
```

### 3. Create Firebase Firestore Data Structure

Ensure these collections exist in Firestore:
- `users` - User accounts
- `licenses` - License information
- `activity_log` - All user activities
- `licenses/{licenseId}/devices` - Registered devices per license

### 4. Configure Gmail for Email Notifications

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an **App Password**: https://myaccount.google.com/apppasswords
3. Add to `.env` as `EMAIL_PASS`

## API Endpoints

### Authentication
- `POST /api/admin/login` - Login with password
- `POST /api/admin/logout` - Logout
- `GET /api/admin/check-auth` - Check authentication status

### Dashboard Stats
- `GET /api/admin/stats` - Get overview stats
- `GET /api/admin/daily-summary` - Get daily summary

### Activity Logs
- `GET /api/admin/activity?page=1&limit=50&filter=today|week|blocked` - Activity log

### Users & Licenses
- `GET /api/admin/users` - Get all users with licenses
- `GET /api/admin/pending-payments` - Get unpaid licenses
- `GET /api/admin/blocked-attempts` - Get blocked activations

### License Management
- `POST /api/admin/mark-paid` - Mark license as paid
- `POST /api/admin/deactivate-license` - Deactivate a license
- `POST /api/admin/deactivate-device` - Remove device from license
- `POST /api/admin/whitelist-device` - Temporarily allow 3rd device

### Email
- `POST /api/admin/send-email` - Send email to user

## Usage

### In Your License Activation Flow

When user activates a license, log the activity:

```typescript
import activityLogger from './services/activityLogger';

// When activation is attempted
await activityLogger.logActivationAttempt(
  licenseKey,
  deviceName,
  ipAddress,
  userAgent,
  email,
  phone
);

// Send notification to creator
await emailService.notifyActivity({
  type: 'new_signup',
  email,
  phone,
  licenseKey,
  deviceName,
  ipAddress
});

// When activation succeeds
await activityLogger.logActivationSuccess(
  licenseKey,
  deviceId,
  deviceName,
  ipAddress,
  userAgent
);

// When activation is blocked (device limit exceeded)
await activityLogger.logActivationBlocked(
  licenseKey,
  deviceName,
  ipAddress,
  userAgent,
  'Device limit exceeded',
  userId,
  email
);

// Send alert to creator
await emailService.notifyActivity({
  type: 'device_blocked',
  email,
  licenseKey,
  deviceName,
  currentDevices: ['Device 1', 'Device 2'],
  ipAddress
});
```

### Send Notification to User (After Payment)

```typescript
import emailService from './services/emailService';

await emailService.sendUserEmail(userEmail, 'payment_confirmed', {
  licenseKey,
  amount: 12.00,
  expiryDate: '2025-04-14'
});
```

### Send Daily Summary

```typescript
// Call this endpoint at 8 PM daily (via cron or scheduled task)
const summaryRes = await fetch('http://localhost:3000/api/admin/daily-summary');
const stats = await summaryRes.json();

await emailService.notifyActivity({
  type: 'daily_summary',
  dailyStats: stats
});
```

## Security Notes

⚠️ **Important:**
- Change `ADMIN_PASSWORD` to something strong
- Use `SESSION_SECRET` - generate a random string
- Never commit `.env` to Git (add to `.gitignore`)
- Use HTTPS in production (set `secure: true` in session cookie)
- Change `EMAIL_PASS` to Gmail App Password (not your main password)

## Running the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Dashboard Access

Open your browser and go to:
```
http://localhost:3000/admin-zw
```

Enter your `ADMIN_PASSWORD` to login.

## Features

✅ Real-time admin notifications for new signups
✅ One-click license payment management
✅ Activity log with filtering (today, week, blocked)
✅ User & license management
✅ Blocked device attempts tracking
✅ Email templates for user communication
✅ Daily summary reports
✅ Mobile-friendly dashboard interface

