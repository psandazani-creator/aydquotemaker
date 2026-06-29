import React, { useState } from 'react';
import { setStoredToken } from '../../config/supabase';
import { Loader } from './Loader';
import './Login.css';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!navigator.onLine) {
      setError(isLogin
        ? 'You are offline. An internet connection is required to sign in.'
        : 'You are offline. An internet connection is required to create an account.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Sign in failed. Please try again.');
        setStoredToken(body.token);
        onLogin();
        window.location.reload();
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, firstName: firstName.trim(), lastName: lastName.trim() }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (body.error || '').toLowerCase();
          if (res.status === 409 || msg.includes('already') || msg.includes('exists')) {
            throw new Error('An account with this email already exists. Try signing in instead.');
          }
          throw new Error(body.error || 'Sign-up failed. Please try again.');
        }
        setStoredToken(body.token);
        onLogin();
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage('');
    setResetSuccess(false);
    setResetLink('');
    try {
      if (!resetEmail.trim()) { setResetMessage('Please enter your email address.'); return; }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, redirectTo: window.location.origin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to send reset email.');

      setResetSuccess(true);
      if (body.link) {
        setResetLink(body.link);
        setResetMessage('Email not configured — use the link below to reset your password:');
      } else {
        setResetMessage('Reset link sent! Check your inbox.');
        setResetEmail('');
        setTimeout(() => setShowForgotPassword(false), 3000);
      }
    } catch (err: any) {
      setResetMessage(err?.message || 'Failed to send reset email.');
      setResetSuccess(false);
    } finally {
      setResetLoading(false);
    }
  };

  const features = [
    { icon: '📄', text: 'Beautiful professional templates' },
    { icon: '📊', text: 'Track quotes & revenue in real time' },
    { icon: '⬇️', text: 'Export polished PDFs instantly' },
  ];

  return (
    <div className="auth-wrap">
      {loading && <Loader isVisible={loading} message="Authenticating…" />}

      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-logo">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="44" height="44" rx="10" fill="rgba(255,255,255,0.15)" />
              <path d="M10 12h8v20h-8zM18 22h8v10h-8zM26 16h8v16h-8z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="auth-brand-name">AydQuoteMaker</h1>
          <p className="auth-brand-tagline">Professional Quote Management</p>

          <ul className="auth-feature-list">
            {features.map((f, i) => (
              <li key={i} className="auth-feature-item">
                <span className="auth-feature-icon">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-brand-circle auth-brand-circle--1" />
        <div className="auth-brand-circle auth-brand-circle--2" />
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">{isLogin ? 'Welcome back' : 'Create account'}</h2>
            <p className="auth-card-sub">{isLogin ? 'Sign in to manage your quotes' : 'Get started — it only takes a minute'}</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${isLogin ? 'auth-tab--active' : ''}`} onClick={() => { setIsLogin(true); setError(''); }}>Sign In</button>
            <button className={`auth-tab ${!isLogin ? 'auth-tab--active' : ''}`} onClick={() => { setIsLogin(false); setError(''); }}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="auth-name-row">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-firstname">First name</label>
                  <div className="auth-input-wrap">
                    <input id="auth-firstname" type="text" className="auth-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="John" autoComplete="given-name" />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-lastname">Last name</label>
                  <div className="auth-input-wrap">
                    <input id="auth-lastname" type="text" className="auth-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Doe" autoComplete="family-name" />
                  </div>
                </div>
              </div>
            )}
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">Email address</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input id="auth-email" type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="auth-password">Password</label>
                {isLogin && <button type="button" className="auth-forgot-link" onClick={() => setShowForgotPassword(true)}>Forgot password?</button>}
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input auth-input--pw"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={isLogin ? 'Enter your password' : 'Min. 6 characters'}
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword((p) => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
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

            {error && (
              <div className="auth-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? <><span className="auth-spinner" /> Please wait…</> : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="auth-terms">By continuing, you agree to our <span className="auth-terms-link">Terms of Service</span></p>
        </div>
      </div>

      {showForgotPassword && (
        <div className="auth-modal-overlay" onClick={() => setShowForgotPassword(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={() => setShowForgotPassword(false)} aria-label="Close">×</button>

            <div className="auth-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <h2 className="auth-modal-title">Reset your password</h2>
            <p className="auth-modal-desc">Enter your email and we'll send you a secure reset link.</p>

            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="reset-email">Email address</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <input id="reset-email" type="email" className="auth-input" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" disabled={resetLoading} />
                </div>
              </div>

              {resetMessage && (
                <div className={`auth-reset-msg ${resetSuccess ? 'auth-reset-msg--ok' : 'auth-reset-msg--err'}`}>{resetMessage}</div>
              )}

              {resetLink && (
                <a href={resetLink} className="auth-reset-link-btn" target="_blank" rel="noreferrer">Click here to reset your password →</a>
              )}

              <div className="auth-modal-btns">
                <button type="submit" disabled={resetLoading} className="auth-submit-btn">{resetLoading ? 'Sending…' : 'Send Reset Link'}</button>
                <button type="button" className="auth-cancel-btn" onClick={() => setShowForgotPassword(false)} disabled={resetLoading}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
