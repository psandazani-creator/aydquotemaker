import React, { useState, useEffect } from 'react';
import './Login.css';

interface PasswordResetProps {
  onDone: () => void;
}

export function PasswordReset({ onDone }: PasswordResetProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    setToken(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!token) { setError('Invalid or missing reset token.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to update password.');
      setSuccess(true);
      setTimeout(() => {
        window.history.replaceState(null, '', '/');
        onDone();
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#6b7280' }}>Invalid or expired reset link.</p>
          <button className="auth-submit-btn" style={{ marginTop: 16 }} onClick={onDone}>Back to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-logo">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="rgba(255,255,255,0.15)" />
              <path d="M10 12h8v20h-8zM18 22h8v10h-8zM26 16h8v16h-8z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="auth-brand-name">AydQuoteMaker</h1>
          <p className="auth-brand-tagline">Professional Quote Management</p>
        </div>
        <div className="auth-brand-circle auth-brand-circle--1" />
        <div className="auth-brand-circle auth-brand-circle--2" />
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Set new password</h2>
            <p className="auth-card-sub">Choose a strong password for your account.</p>
          </div>

          {success ? (
            <div className="auth-confirm-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <strong>Password updated!</strong>
                <p>Redirecting to sign in…</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="new-pw">New password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="new-pw"
                    type={showPw ? 'text' : 'password'}
                    className="auth-input auth-input--pw"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required minLength={6}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowPw((p) => !p)} aria-label={showPw ? 'Hide' : 'Show'}>
                    {showPw ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="confirm-pw">Confirm password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="confirm-pw"
                    type={showPw ? 'text' : 'password'}
                    className="auth-input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required minLength={6}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && (
                <div className="auth-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="auth-submit-btn">
                {loading ? <><span className="auth-spinner" /> Updating…</> : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
