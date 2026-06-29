// src/components/Drawer/Drawer.tsx
import React from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../config/supabase';
import { showNotification } from '../Notification/Notification';
import './Drawer.css';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BASE_NAV = [
  { path: '/quotations', label: 'Quotations', icon: <QuotationsIcon /> },
  { path: '/invoices', label: 'Invoices', icon: <InvoicesIcon /> },
  { path: '/contracts', label: 'Contracts', icon: <ContractsIcon /> },
  { path: '/profile', label: 'Profile', icon: <ProfileIcon /> },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  { path: '/help', label: 'Help', icon: <HelpIcon /> },
];

function getInitials(name: string, companyName?: string) {
  const source = companyName || name || '?';
  return source
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

export function Drawer({ isOpen, onClose }: DrawerProps) {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleSignOut = async () => {
    try {
      const { error } = await auth.signOut();
      if (error) throw error;
      setUser(null);
      onClose();
      navigate('/');
    } catch (error) {
      console.error('[Drawer] Sign out error:', error);
      showNotification('Failed to sign out. Please try again.', 'error');
    }
  };

  const NAV_ITEMS = user?.isAdmin
    ? [...BASE_NAV, { path: '/admin', label: 'Admin', icon: <AdminIcon /> }]
    : BASE_NAV;

  const displayName = user?.companyName || user?.name || 'My Company';
  const initials = getInitials(user?.name || '', user?.companyName);
  const tierLabel = (user?.tier || 'free').toUpperCase();

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`drawer ${isOpen ? 'open' : ''}`} role="navigation" aria-label="Main menu">
        <div className="drawer-content">

          {/* ── App brand ── */}
          <div className="drawer-brand">
            <span className="drawer-brand-dot" />
            <span className="drawer-brand-name">AydQuoteMaker</span>
          </div>

          {/* ── Profile card ── */}
          <div className="drawer-profile-card">
            <div className="drawer-avatar-wrap">
              {user?.companyLogo ? (
                <img
                  src={user.companyLogo}
                  alt={displayName}
                  className="drawer-avatar-img"
                />
              ) : (
                <div className="drawer-avatar-initials">
                  {initials}
                </div>
              )}
              <span className={`drawer-tier-dot drawer-tier-dot--${user?.tier || 'free'}`} />
            </div>

            <div className="drawer-profile-info">
              <p className="drawer-company-name">{displayName}</p>
              <p className="drawer-user-email">{user?.email || ''}</p>
              <span className={`drawer-tier-badge drawer-tier-badge--${user?.tier || 'free'}`}>
                {tierLabel}
              </span>
            </div>
          </div>

          {/* ── Nav ── */}
          <nav className="drawer-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.path}
                className={`drawer-nav-item ${location.pathname === item.path ? 'drawer-nav-item--active' : ''}`}
                onClick={() => handleNavigation(item.path)}
              >
                <span className="drawer-nav-icon">{item.icon}</span>
                <span className="drawer-nav-label">{item.label}</span>
                {location.pathname === item.path && <span className="drawer-nav-indicator" />}
              </button>
            ))}
          </nav>

          {/* ── Footer ── */}
          <div className="drawer-footer">
            <button className="drawer-signout-btn" onClick={handleSignOut}>
              <SignOutIcon />
              Sign Out
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

/* ── SVG icons ────────────────────────────────── */
function QuotationsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function InvoicesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 6h6M7 9h4M7 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 14l1.5 1.5L15 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ContractsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 14l1.5 1.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7.5 7.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14.5" r="0.75" fill="currentColor"/>
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M13 3h2a2 2 0 012 2v10a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 13l4-4-4-4M13 10H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function AdminIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.3l-4.8 2.5.9-5.3L2.2 7.7l5.4-.8L10 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}
