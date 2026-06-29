// src/components/Onboarding/Onboarding.tsx
import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { UserService } from '../../services/userService';
import './Onboarding.css';

const STEPS = ['Welcome', 'Your Company', 'Pick a Template', "You're Ready"];

const TEMPLATES = [
  {
    id: 'template1',
    name: 'Classic White',
    description: 'Clean & minimal',
    tier: 'free',
    accent: '#1B3A6B',
    bg: '#ffffff',
    preview: ['#1B3A6B', '#ffffff', '#f5f5f5'],
  },
  {
    id: 'template2',
    name: 'Monochrome Elite',
    description: 'Bold black & white',
    tier: 'free',
    accent: '#111111',
    bg: '#ffffff',
    preview: ['#111111', '#ffffff', '#e0e0e0'],
  },
  {
    id: 'template3',
    name: 'Navy Executive',
    description: 'Deep navy authority',
    tier: 'pro',
    accent: '#1B3A6B',
    bg: '#f0f4ff',
    preview: ['#1B3A6B', '#C9A84C', '#f0f4ff'],
  },
  {
    id: 'template4',
    name: 'Forest Premium',
    description: 'Rich earth tones',
    tier: 'pro',
    accent: '#1B4332',
    bg: '#f6fff8',
    preview: ['#1B4332', '#74C69D', '#f6fff8'],
  },
  {
    id: 'template5',
    name: 'Crimson Prestige',
    description: 'Bold & commanding',
    tier: 'pro',
    accent: '#7B1D1D',
    bg: '#fff8f8',
    preview: ['#7B1D1D', '#C0392B', '#fff8f8'],
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { user, setUser } = useApp();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>(user?.companyLogo || '');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [companyPhone, setCompanyPhone] = useState(user?.companyPhone || '');
  const [companyAddress, setCompanyAddress] = useState(user?.companyAddress || '');
  const [selectedTemplate, setSelectedTemplate] = useState('template1');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const progress = ((step) / (STEPS.length - 1)) * 100;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && !companyName.trim()) {
      setError('Please enter your company name to continue.');
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleFinish = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updatedPreferences = {
        ...(user.preferences || { currency: 'USD' as const, vatRate: 15 }),
        defaultTemplate: selectedTemplate,
      };
      const updates = {
        companyName: companyName.trim(),
        companyPhone: companyPhone.trim(),
        companyAddress: companyAddress.trim(),
        companyLogo: logoPreview || null,
        preferences: updatedPreferences,
      };
      await UserService.updateUser(user.id, updates);
      setUser({ ...user, ...updates });
      localStorage.setItem(`onboarding-${user.id}`, 'done');
      onComplete();
    } catch {
      setError('Something went wrong saving your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (user?.id) localStorage.setItem(`onboarding-${user.id}`, 'done');
    onComplete();
  };

  return (
    <div className="ob-wrap">
      {/* Left brand strip */}
      <aside className="ob-brand">
        <div className="ob-brand-inner">
          <div className="ob-logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.15)" />
              <rect x="6" y="8" width="20" height="3" rx="1.5" fill="white" />
              <rect x="6" y="14" width="14" height="3" rx="1.5" fill="white" />
              <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" />
            </svg>
          </div>
          <h2 className="ob-brand-name">AydQuoteMaker</h2>
          <p className="ob-brand-tag">Professional Quote Management</p>

          <div className="ob-steps-nav">
            {STEPS.map((label, i) => (
              <div key={i} className={`ob-step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="ob-step-dot">
                  {i < step ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className="ob-step-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ob-brand-circles">
          <div className="ob-circle ob-circle-1" />
          <div className="ob-circle ob-circle-2" />
        </div>
      </aside>

      {/* Right content panel */}
      <main className="ob-main">
        <div className="ob-progress-bar">
          <div className="ob-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="ob-content">
          {/* ─── Step 0: Welcome ─── */}
          {step === 0 && (
            <div className="ob-panel ob-welcome">
              <div className="ob-welcome-icon">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="28" cy="28" r="28" fill="#EEF3FB" />
                  <path d="M20 36c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#1B3A6B" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="28" cy="22" r="5" stroke="#1B3A6B" strokeWidth="2" />
                </svg>
              </div>
              <h1 className="ob-heading">
                Welcome to AydQuoteMaker
                {user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
              </h1>
              <p className="ob-sub">
                Let's take 60 seconds to set up your workspace. You'll be
                sending professional quotes in no time.
              </p>

              <div className="ob-feature-list">
                {[
                  ['📄', 'Beautiful professional templates'],
                  ['💰', 'Track quotes & revenue in real time'],
                  ['📤', 'Export polished PDFs instantly'],
                ].map(([icon, text]) => (
                  <div key={text} className="ob-feature-item">
                    <span className="ob-feature-icon">{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <div className="ob-btn-row">
                <button className="ob-btn ob-btn-primary" onClick={handleNext}>
                  Get started
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className="ob-btn ob-btn-ghost" onClick={handleSkip}>
                  Skip setup
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 1: Company Profile ─── */}
          {step === 1 && (
            <div className="ob-panel ob-company">
              <h1 className="ob-heading">Your Company</h1>
              <p className="ob-sub">This information will appear on every quote you create.</p>

              {/* Logo upload */}
              <div className="ob-logo-area">
                <div className="ob-logo-preview" onClick={() => fileRef.current?.click()}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" />
                  ) : (
                    <div className="ob-logo-placeholder">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <path d="M6 22l7-9 5 6 3-4 5 7H6z" stroke="#1B3A6B" strokeWidth="1.5" strokeLinejoin="round" />
                        <circle cx="22" cy="11" r="3" stroke="#1B3A6B" strokeWidth="1.5" />
                      </svg>
                      <span>Upload logo</span>
                    </div>
                  )}
                  <div className="ob-logo-overlay">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M3 12v3h3l8-8-3-3L3 12z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M12 3l3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="ob-file-input" onChange={handleLogoUpload} />
                <div className="ob-logo-meta">
                  <p className="ob-logo-hint">Click to upload your company logo</p>
                  <p className="ob-logo-hint-sub">PNG, JPG up to 2 MB</p>
                </div>
              </div>

              <div className="ob-field-group">
                <label className="ob-label">
                  Company name <span className="ob-required">*</span>
                </label>
                <input
                  className="ob-input"
                  type="text"
                  placeholder="e.g. Ayd Solutions Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="ob-field-row">
                <div className="ob-field-group">
                  <label className="ob-label">Phone number</label>
                  <input
                    className="ob-input"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="ob-field-group">
                <label className="ob-label">Business address</label>
                <input
                  className="ob-input"
                  type="text"
                  placeholder="123 Main Street, City, Country"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                />
              </div>

              {error && <p className="ob-error">{error}</p>}

              <div className="ob-btn-row">
                <button className="ob-btn ob-btn-ghost ob-btn-back" onClick={handleBack}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
                <button className="ob-btn ob-btn-primary" onClick={handleNext}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Template ─── */}
          {step === 2 && (
            <div className="ob-panel ob-templates">
              <h1 className="ob-heading">Pick a Default Template</h1>
              <p className="ob-sub">Choose the look and feel for your quotes. You can change this anytime.</p>

              <div className="ob-template-grid">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    className={`ob-tpl-card ${selectedTemplate === tpl.id ? 'selected' : ''} ${tpl.tier === 'pro' && user?.tier === 'free' ? 'locked' : ''}`}
                    onClick={() => {
                      if (tpl.tier === 'pro' && user?.tier === 'free') return;
                      setSelectedTemplate(tpl.id);
                    }}
                  >
                    {/* Mini document preview */}
                    <div className="ob-tpl-preview" style={{ background: tpl.bg }}>
                      <div className="ob-tpl-header" style={{ background: tpl.preview[0] }} />
                      <div className="ob-tpl-lines">
                        <div className="ob-tpl-line long" style={{ background: tpl.preview[2] }} />
                        <div className="ob-tpl-line short" style={{ background: tpl.preview[2] }} />
                        <div className="ob-tpl-line accent" style={{ background: tpl.preview[1] }} />
                        <div className="ob-tpl-line long" style={{ background: tpl.preview[2] }} />
                        <div className="ob-tpl-line med" style={{ background: tpl.preview[2] }} />
                      </div>
                    </div>
                    <div className="ob-tpl-info">
                      <span className="ob-tpl-name">{tpl.name}</span>
                      <span className="ob-tpl-desc">{tpl.description}</span>
                    </div>
                    {tpl.tier === 'pro' && (
                      <span className="ob-tpl-badge">PRO</span>
                    )}
                    {selectedTemplate === tpl.id && (
                      <div className="ob-tpl-check">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="ob-btn-row">
                <button className="ob-btn ob-btn-ghost ob-btn-back" onClick={handleBack}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
                <button className="ob-btn ob-btn-primary" onClick={handleNext}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: All Done ─── */}
          {step === 3 && (
            <div className="ob-panel ob-done">
              <div className="ob-done-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="32" fill="#EEF3FB" />
                  <circle cx="32" cy="32" r="20" fill="#1B3A6B" />
                  <path d="M22 32l7 7 13-13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="ob-heading">You're all set!</h1>
              <p className="ob-sub">
                Your workspace is ready. Time to create your first professional quote.
              </p>

              <div className="ob-summary-card">
                {logoPreview && (
                  <img className="ob-summary-logo" src={logoPreview} alt="Logo" />
                )}
                <div className="ob-summary-info">
                  <p className="ob-summary-company">{companyName || 'Your Company'}</p>
                  {companyPhone && <p className="ob-summary-detail">{companyPhone}</p>}
                  {companyAddress && <p className="ob-summary-detail">{companyAddress}</p>}
                </div>
                <div className="ob-summary-tpl">
                  <p className="ob-summary-tpl-label">Template</p>
                  <p className="ob-summary-tpl-name">
                    {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                  </p>
                </div>
              </div>

              {error && <p className="ob-error">{error}</p>}

              <div className="ob-btn-col">
                <button className="ob-btn ob-btn-primary ob-btn-large" onClick={handleFinish} disabled={saving}>
                  {saving ? 'Saving…' : 'Create my first quote →'}
                </button>
                <button className="ob-btn ob-btn-ghost" onClick={handleFinish} disabled={saving}>
                  Go to dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
