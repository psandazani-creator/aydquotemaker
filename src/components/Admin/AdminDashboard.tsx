// src/components/Admin/AdminDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getStoredToken } from '../../config/supabase';
import { showNotification } from '../Notification/Notification';
import './AdminDashboard.css';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  activeLicenses: number;
  pendingPayments: number;
  quotesToday: number;
  totalRevenue: number;
}

interface License {
  id: string;
  license_key: string;
  tier: string;
  is_active: boolean;
  payment_status: string;
  payment_amount: number;
  payment_method?: string;
  device_limit: number;
  devices_used: number;
}

interface ContractsLicense {
  active: boolean;
  purchasedAt?: string;
  expiresAt?: string | null;
  revokedAt?: string;
}

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  companyName?: string;
  tier: string;
  createdAt: string;
  created_at?: string;
  isAdmin?: boolean;
  license?: License | null;
  contractsLicense?: ContractsLicense | null;
}

interface Activity {
  id: string;
  action: string;
  userId?: string;
  details?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────

async function adminFetch(path: string) {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated — please log in first');
  const res = await fetch(`/api/admin${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function adminPost(path: string, body: object) {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '—';

const fmtAction = (a: string) =>
  a.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function userName(u: AdminUser) {
  return u.full_name || u.name || u.email.split('@')[0];
}

function actionIcon(action: string) {
  if (action.includes('quote'))                              return '📄';
  if (action.includes('login') || action.includes('sign'))   return '🔐';
  if (action.includes('license') || action.includes('activate')) return '🔑';
  if (action.includes('payment') || action.includes('paid')) return '💳';
  if (action.includes('block'))                              return '🚫';
  if (action.includes('user'))                               return '👤';
  if (action.includes('contract'))                           return '📋';
  return '📌';
}

// ─────────────────────────────────────────────────
// Main AdminDashboard component
// ─────────────────────────────────────────────────

export function AdminDashboard() {
  const [stats, setStats]         = useState<Stats | null>(null);
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [activity, setActivity]   = useState<Activity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'activity'>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [error, setError]         = useState<string | null>(null);

  // Modals
  const [optionsUser, setOptionsUser]           = useState<AdminUser | null>(null);
  const [manageLicenseUser, setManageLicenseUser] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, u, a] = await Promise.all([
        adminFetch('/stats'),
        adminFetch('/users'),
        adminFetch('/activity?limit=30'),
      ]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : u.users ?? []);
      setActivity(a.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load admin data');
      showNotification(e.message || 'Admin access denied', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    userName(u).toLowerCase().includes(userSearch.toLowerCase()) ||
    u.companyName?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Close modals and reload after an action
  const afterAction = async () => {
    setOptionsUser(null);
    setManageLicenseUser(null);
    await load();
  };

  // ── Loading / error guards ─────────────────────

  if (loading) return (
    <div className="adm-loading">
      <div className="adm-spinner" />
      <p>Loading admin dashboard…</p>
    </div>
  );

  if (error) return (
    <div className="adm-error">
      <span className="adm-error-icon">🔒</span>
      <h3>Access Denied</h3>
      <p>{error}</p>
      <p className="adm-error-hint">Make sure your account has <code>isAdmin: true</code> in the database.</p>
      <button className="adm-retry-btn" onClick={load}>Retry</button>
    </div>
  );

  // ── Render ──────────────────────────────────────

  return (
    <div className="adm-wrap">

      {/* Header */}
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Admin Dashboard</h1>
          <p className="adm-subtitle">AydQuoteMaker — system overview</p>
        </div>
        <button className="adm-refresh-btn" onClick={load} title="Refresh">
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 10a6 6 0 1110.83-3.5M4 10V6M4 10H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="adm-stats">
          <StatCard icon="👥" label="Total Users"      value={stats.totalUsers}                      color="blue"   />
          <StatCard icon="🔑" label="Active Licenses"  value={stats.activeLicenses}                  color="gold"   />
          <StatCard icon="⏳" label="Pending Payments" value={stats.pendingPayments}                  color="orange" />
          <StatCard icon="📄" label="Quotes Today"     value={stats.quotesToday}                     color="green"  />
          <StatCard icon="💰" label="Total Revenue"    value={`$${stats.totalRevenue.toFixed(2)}`}   color="purple" />
        </div>
      )}

      {/* Tab bar */}
      <div className="adm-tabs">
        {(['overview', 'users', 'activity'] as const).map(t => (
          <button key={t} className={`adm-tab ${activeTab === t ? 'adm-tab--active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'overview' && '📊 '}
            {t === 'users'    && '👥 '}
            {t === 'activity' && '📋 '}
            {t === 'overview' ? 'Overview' : t === 'users' ? 'Manage Users' : 'Activity'}
            {t === 'users'    && <span className="adm-tab-count">{users.filter(u => !u.isAdmin).length}</span>}
            {t === 'activity' && <span className="adm-tab-count">{activity.length}</span>}
          </button>
        ))}
      </div>

      {/* ══ Overview ════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="adm-section">
          <h3 className="adm-section-title">Quick Summary</h3>
          <div className="adm-overview-grid">
            <div className="adm-overview-item">
              <span className="adm-ov-label">Free users</span>
              <span className="adm-ov-value">{users.filter(u => u.tier === 'free').length}</span>
            </div>
            <div className="adm-overview-item">
              <span className="adm-ov-label">Pro users</span>
              <span className="adm-ov-value adm-ov-gold">{users.filter(u => u.tier === 'pro').length}</span>
            </div>
            <div className="adm-overview-item">
              <span className="adm-ov-label">Lifetime users</span>
              <span className="adm-ov-value adm-ov-purple">{users.filter(u => u.tier === 'lifetime').length}</span>
            </div>
            <div className="adm-overview-item">
              <span className="adm-ov-label">Admins</span>
              <span className="adm-ov-value adm-ov-red">{users.filter(u => u.isAdmin).length}</span>
            </div>
          </div>
          <h3 className="adm-section-title" style={{ marginTop: 24 }}>Recent Activity</h3>
          <div className="adm-activity-list">
            {activity.slice(0, 8).map(a => (
              <div key={a.id} className="adm-activity-row">
                <span className="adm-act-icon">{actionIcon(a.action)}</span>
                <div className="adm-act-body">
                  <span className="adm-act-label">{fmtAction(a.action)}</span>
                  {a.details && <span className="adm-act-detail">{a.details}</span>}
                </div>
                <span className="adm-act-time">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="adm-empty">No recent activity.</p>}
          </div>
        </div>
      )}

      {/* ══ Manage Users ════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="adm-section">
          <div className="adm-table-header">
            <h3 className="adm-section-title">Manage Users</h3>
            <input
              className="adm-search"
              placeholder="Search by name, email or company…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
          </div>
          <p className="adm-hint">Click a user row to view management options.</p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Company</th>
                  <th>Tier</th>
                  <th>License</th>
                  <th>Contracts</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.filter(u => !u.isAdmin).map(u => (
                  <tr
                    key={u.id}
                    className="adm-table-row--clickable"
                    onClick={() => setOptionsUser(u)}
                    title="Click to manage this user"
                  >
                    <td>
                      <div className="adm-user-cell">
                        <div className="adm-user-avatar">{userName(u)[0].toUpperCase()}</div>
                        <div>
                          <div className="adm-user-name">{userName(u)}</div>
                          <div className="adm-user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="adm-muted">{u.companyName || '—'}</td>
                    <td>
                      <span className={`adm-badge adm-badge--${u.tier || 'free'}`}>
                        {(u.tier || 'free').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {u.license ? (
                        <span className={`adm-badge ${u.license.is_active ? 'adm-badge--active' : 'adm-badge--inactive'}`}>
                          {u.license.is_active ? '✓ Active' : '✗ Inactive'}
                        </span>
                      ) : <span className="adm-muted">None</span>}
                    </td>
                    <td>
                      {u.contractsLicense?.active
                        ? <span className="adm-badge adm-badge--active">✓ Active</span>
                        : <span className="adm-muted">—</span>}
                    </td>
                    <td className="adm-muted">{fmtDate(u.createdAt || u.created_at)}</td>
                  </tr>
                ))}
                {filteredUsers.filter(u => !u.isAdmin).length === 0 && (
                  <tr><td colSpan={6} className="adm-empty">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Activity ════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="adm-section">
          <h3 className="adm-section-title">Activity Log</h3>
          <div className="adm-activity-list">
            {activity.map(a => (
              <div key={a.id} className="adm-activity-row">
                <span className="adm-act-icon">{actionIcon(a.action)}</span>
                <div className="adm-act-body">
                  <span className="adm-act-label">{fmtAction(a.action)}</span>
                  {a.details && <span className="adm-act-detail">{a.details}</span>}
                  {a.userId && <span className="adm-act-uid">uid: {a.userId.slice(0, 8)}…</span>}
                </div>
                <span className="adm-act-time">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="adm-empty">No activity recorded yet.</p>}
          </div>
        </div>
      )}

      {/* ══ User Options Modal ══════════════════════ */}
      {optionsUser && (
        <UserOptionsModal
          user={optionsUser}
          onClose={() => setOptionsUser(null)}
          onManageLicense={() => { setManageLicenseUser(optionsUser); setOptionsUser(null); }}
          onAfterAction={afterAction}
        />
      )}

      {/* ══ Manage License Modal ════════════════════ */}
      {manageLicenseUser && (
        <ManageLicenseModal
          user={manageLicenseUser}
          onClose={() => setManageLicenseUser(null)}
          onAfterAction={afterAction}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className={`adm-stat-card adm-stat-card--${color}`}>
      <span className="adm-stat-icon">{icon}</span>
      <div>
        <div className="adm-stat-value">{value}</div>
        <div className="adm-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// UserOptionsModal
// Appears when a user row is clicked. Shows profile
// summary + quick action buttons.
// ─────────────────────────────────────────────────

function UserOptionsModal({
  user, onClose, onManageLicense, onAfterAction,
}: {
  user: AdminUser;
  onClose: () => void;
  onManageLicense: () => void;
  onAfterAction: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      showNotification(`${label} succeeded`, 'success');
      await onAfterAction();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const licenseId = user.license?.id;
  const isActive  = user.license?.is_active;

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal" onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="adm-modal-header">
          <div className="adm-modal-avatar">{userName(user)[0].toUpperCase()}</div>
          <div>
            <div className="adm-modal-username">{userName(user)}</div>
            <div className="adm-modal-email">{user.email}</div>
          </div>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* License + tier summary */}
        <div className="adm-modal-info-row">
          <div className="adm-modal-info-item">
            <span className="adm-modal-info-label">Tier</span>
            <span className={`adm-badge adm-badge--${user.tier || 'free'}`}>{(user.tier || 'free').toUpperCase()}</span>
          </div>
          <div className="adm-modal-info-item">
            <span className="adm-modal-info-label">License</span>
            {user.license
              ? <span className={`adm-badge ${isActive ? 'adm-badge--active' : 'adm-badge--inactive'}`}>{isActive ? '✓ Active' : '✗ Inactive'}</span>
              : <span className="adm-muted">None</span>}
          </div>
          <div className="adm-modal-info-item">
            <span className="adm-modal-info-label">Contracts</span>
            {user.contractsLicense?.active
              ? <span className="adm-badge adm-badge--active">✓ Active</span>
              : <span className="adm-muted">—</span>}
          </div>
        </div>

        {/* License key display */}
        {user.license?.license_key && (
          <div className="adm-modal-key-row">
            <span className="adm-modal-info-label">License key</span>
            <code className="adm-license-key">{user.license.license_key}</code>
          </div>
        )}

        {/* Action buttons */}
        <div className="adm-modal-actions">

          {/* Primary: open Manage License modal */}
          <button className="adm-modal-btn adm-modal-btn--primary" onClick={onManageLicense}>
            📋 Manage License & Contracts
          </button>

          {/* Toggle license active state */}
          {licenseId && isActive && (
            <button
              className="adm-modal-btn adm-modal-btn--danger"
              disabled={!!busy}
              onClick={() => run('Block license', () => adminPost('/deactivate-license', { licenseId, reason: 'Blocked by admin' }))}
            >
              {busy === 'Block license' ? '…' : '🚫 Block License'}
            </button>
          )}
          {licenseId && !isActive && (
            <button
              className="adm-modal-btn adm-modal-btn--success"
              disabled={!!busy}
              onClick={() => run('Activate license', () => adminPost('/activate-license', { licenseId }))}
            >
              {busy === 'Activate license' ? '…' : '✅ Activate License'}
            </button>
          )}

          {/* Regenerate license key */}
          {licenseId && (
            <button
              className="adm-modal-btn adm-modal-btn--secondary"
              disabled={!!busy}
              onClick={() => run('Regenerate key', () => adminPost('/regenerate-license-key', { licenseId }))}
            >
              {busy === 'Regenerate key' ? '…' : '🔄 Regenerate Key'}
            </button>
          )}

          {/* Delete user — requires confirmation */}
          <button
            className="adm-modal-btn adm-modal-btn--danger"
            disabled={!!busy}
            onClick={() => {
              if (!window.confirm(`Permanently delete "${userName(user)}" and all their data? This cannot be undone.`)) return;
              run('Delete user', () => adminPost('/delete-user', { userId: user.id }));
            }}
          >
            {busy === 'Delete user' ? '…' : '🗑️ Delete User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// ManageLicenseModal
// Two-tab modal: License | Contracts
// ─────────────────────────────────────────────────

function ManageLicenseModal({
  user, onClose, onAfterAction,
}: {
  user: AdminUser;
  onClose: () => void;
  onAfterAction: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'license' | 'contracts'>('license');
  const [busy, setBusy]           = useState(false);
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  // License form state
  const [tier, setTier]                   = useState(user.license?.tier || user.tier || 'pro');
  const [payAmount, setPayAmount]         = useState('');
  const [payMethod, setPayMethod]         = useState('EcoCash');
  const [payRef, setPayRef]               = useState('');

  // Contracts form state
  const [contractExpiry, setContractExpiry] = useState('');

  const licenseId = user.license?.id;

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      setMsg({ text: res.message || 'Done', ok: true });
      showNotification(res.message || 'Done', 'success');
      await onAfterAction();
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
      showNotification(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const generateLicense = () => run(() =>
    adminPost('/generate-license', { userName: userName(user), userEmail: user.email, tier })
  );

  const regenKey = () => run(() =>
    adminPost('/regenerate-license-key', { licenseId })
  );

  const markPaid = () => {
    if (!payAmount) { setMsg({ text: 'Enter a payment amount', ok: false }); return; }
    run(() => adminPost('/mark-paid', {
      licenseId, amount: Number(payAmount), paymentMethod: payMethod, paymentReference: payRef,
    }));
  };

  const grantContracts = () => run(() =>
    adminPost('/grant-contracts-license', { userId: user.id, expiresAt: contractExpiry || null })
  );

  const revokeContracts = () => {
    if (!window.confirm(`Revoke contracts license for ${userName(user)}?`)) return;
    run(() => adminPost('/revoke-contracts-license', { userId: user.id }));
  };

  const contractsActive = user.contractsLicense?.active;

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal adm-modal--wide" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="adm-modal-header">
          <div className="adm-modal-avatar">{userName(user)[0].toUpperCase()}</div>
          <div>
            <div className="adm-modal-username">Manage — {userName(user)}</div>
            <div className="adm-modal-email">{user.email}</div>
          </div>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Inline tabs */}
        <div className="adm-modal-tabs">
          <button className={`adm-modal-tab ${activeTab === 'license' ? 'adm-modal-tab--active' : ''}`} onClick={() => setActiveTab('license')}>
            🔑 License
          </button>
          <button className={`adm-modal-tab ${activeTab === 'contracts' ? 'adm-modal-tab--active' : ''}`} onClick={() => setActiveTab('contracts')}>
            📋 Contracts
          </button>
        </div>

        {/* Status message */}
        {msg && (
          <div className={`adm-modal-msg ${msg.ok ? 'adm-modal-msg--ok' : 'adm-modal-msg--err'}`}>
            {msg.ok ? '✓' : '✗'} {msg.text}
          </div>
        )}

        {/* ── LICENSE TAB ─────────────────────────── */}
        {activeTab === 'license' && (
          <div className="adm-modal-body">

            {/* Current license status */}
            <div className="adm-form-section">
              <div className="adm-form-section-title">Current License</div>
              {user.license ? (
                <div className="adm-info-grid">
                  <div className="adm-info-item">
                    <span className="adm-info-label">Key</span>
                    <code className="adm-license-key">{user.license.license_key}</code>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Tier</span>
                    <span className={`adm-badge adm-badge--${user.license.tier}`}>{user.license.tier?.toUpperCase()}</span>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Status</span>
                    <span className={`adm-badge ${user.license.is_active ? 'adm-badge--active' : 'adm-badge--inactive'}`}>
                      {user.license.is_active ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Devices</span>
                    <span>{user.license.devices_used ?? 0} / {user.license.device_limit ?? '—'}</span>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Payment</span>
                    <span className={`adm-badge ${user.license.payment_status === 'paid' ? 'adm-badge--active' : 'adm-badge--inactive'}`}>
                      {user.license.payment_status ?? 'pending'}
                    </span>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Amount</span>
                    <span>{user.license.payment_amount ? `$${user.license.payment_amount}` : '—'}</span>
                  </div>
                </div>
              ) : (
                <p className="adm-empty" style={{ textAlign: 'left', padding: '8px 0' }}>No license yet — generate one below.</p>
              )}
            </div>

            {/* Generate / update license */}
            <div className="adm-form-section">
              <div className="adm-form-section-title">{user.license ? 'Change Tier / Regenerate' : 'Generate License'}</div>
              <div className="adm-form-row">
                <label className="adm-form-label">Tier</label>
                <select className="adm-form-select" value={tier} onChange={e => setTier(e.target.value)}>
                  <option value="free">Free — 2 devices</option>
                  <option value="pro">Pro — 5 devices</option>
                  <option value="lifetime">Lifetime — 10 devices</option>
                </select>
              </div>
              <div className="adm-form-actions">
                <button className="adm-form-btn adm-form-btn--primary" disabled={busy} onClick={generateLicense}>
                  {busy ? '…' : user.license ? '🔄 Update License' : '✨ Generate License'}
                </button>
                {licenseId && (
                  <button className="adm-form-btn adm-form-btn--secondary" disabled={busy} onClick={regenKey}>
                    {busy ? '…' : '🔑 New Key Only'}
                  </button>
                )}
              </div>
            </div>

            {/* Mark payment as paid */}
            {licenseId && (
              <div className="adm-form-section">
                <div className="adm-form-section-title">Confirm Payment</div>
                <div className="adm-form-row">
                  <label className="adm-form-label">Amount (USD)</label>
                  <input className="adm-form-input" type="number" min="0" step="0.01" placeholder="e.g. 25.00"
                    value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-form-label">Method</label>
                  <select className="adm-form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    <option>EcoCash</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>InnBucks</option>
                    <option>OneMoney</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="adm-form-row">
                  <label className="adm-form-label">Reference / Note</label>
                  <input className="adm-form-input" type="text" placeholder="Transaction ID or note"
                    value={payRef} onChange={e => setPayRef(e.target.value)} />
                </div>
                <div className="adm-form-actions">
                  <button className="adm-form-btn adm-form-btn--success" disabled={busy} onClick={markPaid}>
                    {busy ? '…' : '💰 Mark as Paid & Activate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTRACTS TAB ─────────────────────── */}
        {activeTab === 'contracts' && (
          <div className="adm-modal-body">

            {/* Current contracts status */}
            <div className="adm-form-section">
              <div className="adm-form-section-title">Contracts License Status</div>
              {contractsActive ? (
                <div className="adm-info-grid">
                  <div className="adm-info-item">
                    <span className="adm-info-label">Status</span>
                    <span className="adm-badge adm-badge--active">✓ Active</span>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Granted</span>
                    <span>{fmtDate(user.contractsLicense?.purchasedAt)}</span>
                  </div>
                  <div className="adm-info-item">
                    <span className="adm-info-label">Expires</span>
                    <span>{user.contractsLicense?.expiresAt ? fmtDate(user.contractsLicense.expiresAt) : 'Never'}</span>
                  </div>
                </div>
              ) : (
                <p className="adm-empty" style={{ textAlign: 'left', padding: '8px 0' }}>
                  No contracts license — grant one below to enable the Contracts feature for this user.
                </p>
              )}
            </div>

            {/* Grant contracts license */}
            <div className="adm-form-section">
              <div className="adm-form-section-title">{contractsActive ? 'Renew / Extend' : 'Grant Contracts License'}</div>
              <div className="adm-form-row">
                <label className="adm-form-label">Expiry date <span className="adm-form-optional">(leave blank for lifetime)</span></label>
                <input className="adm-form-input" type="date"
                  value={contractExpiry} onChange={e => setContractExpiry(e.target.value)} />
              </div>
              <div className="adm-form-actions">
                <button className="adm-form-btn adm-form-btn--primary" disabled={busy} onClick={grantContracts}>
                  {busy ? '…' : contractsActive ? '🔄 Renew Contracts License' : '📋 Grant Contracts License'}
                </button>
                {contractsActive && (
                  <button className="adm-form-btn adm-form-btn--danger" disabled={busy} onClick={revokeContracts}>
                    {busy ? '…' : '🚫 Revoke Contracts License'}
                  </button>
                )}
              </div>
            </div>

            {/* Info note */}
            <div className="adm-form-note">
              <strong>What is the Contracts License?</strong><br />
              Enables the Contracts module for this user — lets them create, sign, and manage client contracts inside AydQuoteMaker.
              Granting it saves the record to the database immediately and emails the user.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
