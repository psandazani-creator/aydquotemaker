// src/components/Settings/SettingsPage.tsx
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useQuotes } from '../../hooks/useQuotes';
import { UserService } from '../../services/userService';
import { showNotification } from '../Notification/Notification';
import './SettingsPage.css';

export function SettingsPage() {
  const { user, setUser, logout } = useApp();
  const { clearAllDrafts } = useQuotes(user?.id);
  const [logoPreview, setLogoPreview] = useState<string>(user?.companyLogo || '');
  const [currency, setCurrency] = useState<'USD' | 'ZWG'>(user?.preferences?.currency || 'USD');
  const [vatRate, setVatRate] = useState<number>(user?.preferences?.vatRate || 15);
  const [companyName, setCompanyName] = useState<string>(user?.companyName || '');
  const [companyPhone, setCompanyPhone] = useState<string>(user?.companyPhone || '');
  const [companyAddress, setCompanyAddress] = useState<string>(user?.companyAddress || '');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64String = event.target?.result as string;
          setLogoPreview(base64String);

          await UserService.updateUserLogo(user.id, base64String);

          const updatedUser = { ...user, companyLogo: base64String };
          setUser(updatedUser);

          showNotification('Company logo updated successfully!', 'success');
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error uploading logo:', error);
        showNotification('Failed to upload logo. Please try again.', 'error');
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (user?.id) {
      try {
        setLogoPreview('');

        await UserService.updateUserLogo(user.id, undefined);

        const updatedUser = { ...user, companyLogo: undefined };
        setUser(updatedUser);

        showNotification('Company logo removed successfully!', 'success');
      } catch (error) {
        console.error('Error removing logo:', error);
        showNotification('Failed to remove logo. Please try again.', 'error');
      }
    }
  };

  const handleClearDrafts = async () => {
    if (window.confirm('Are you sure you want to clear all draft quotes? This action cannot be undone.')) {
      try {
        await clearAllDrafts();
        showNotification('All drafts have been cleared successfully!', 'success');
      } catch (error) {
        console.error('Error clearing drafts:', error);
        showNotification('Failed to clear drafts. Please try again.', 'error');
      }
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        if (logout) {
          await logout();
        }
      } catch (error) {
        console.error('Error signing out:', error);
        showNotification('Failed to sign out. Please try again.', 'error');
      }
    }
  };

  const handleExportQuotes = () => {
    showNotification('Export feature coming soon!', 'info');
  };

  const handleSavePreferences = async () => {
    if (user?.id) {
      try {
        const preferences = { currency, vatRate };

        await UserService.updateUserPreferences(user.id, preferences);

        const updatedUser = {
          ...user,
          preferences,
        };
        setUser(updatedUser);

        showNotification('Preferences saved successfully!', 'success');
      } catch (error) {
        console.error('Error saving preferences:', error);
        showNotification('Failed to save preferences. Please try again.', 'error');
      }
    }
  };

  const handleSaveCompanyProfile = async () => {
    if (user?.id) {
      try {
        const companyData = {
          companyName,
          companyPhone,
          companyAddress,
        };

        await UserService.updateUser(user.id, companyData);

        const updatedUser = {
          ...user,
          ...companyData,
        };
        setUser(updatedUser);

        showNotification('Company profile saved successfully!', 'success');
      } catch (error) {
        console.error('Error saving company profile:', error);
        showNotification('Failed to save company profile. Please try again.', 'error');
      }
    }
  };

  return (
    <div className="settings-page">
      {/* Header with title and action buttons */}
      <div className="settings-header">
        <h2>Settings</h2>

      </div>

      {/* Two-column layout for Account Info and Company Profile */}
      <div className="settings-two-columns">
        {/* Account Information */}
        <div className="settings-section">
          <h3>Account Information</h3>
          <div className="setting-item">
            <label>Name</label>
            <span>{user?.name || 'Not set'}</span>
          </div>
          <div className="setting-item">
            <label>Email</label>
            <span>{user?.email || 'Not set'}</span>
          </div>
          <div className="setting-item">
            <label>License Key</label>
            <span>{user?.licenseKey || 'Not set'}</span>
          </div>
          <div className="setting-item">
            <label>Tier</label>
            <span className={`tier-badge ${user?.tier}`}>
              {user?.tier?.toUpperCase() || 'FREE'}
            </span>
          </div>
        </div>

        {/* Company Profile */}
        <div className="settings-section">
          <h3>Company Profile</h3>
          <div className="setting-item">
            <label>Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter your company name"
            />
          </div>
          <div className="setting-item">
            <label>Phone Number</label>
            <input
              type="tel"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              placeholder="Enter company phone number"
            />
          </div>
          <div className="setting-item">
            <label>Address</label>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Enter company address"
              rows={3}
            />
          </div>
          <button className="btn btn-secondary" onClick={handleSaveCompanyProfile}>
            Save Company Profile
          </button>
        </div>
      </div>

      {/* Company Logo section - full width */}
      <div className="settings-section">
        <h3>Company Logo</h3>
        <div className="setting-item">
          <label>Upload Company Logo</label>
          <p className="setting-description">This logo will appear on all your quotations and previews</p>
          <div className="logo-upload-container">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              id="logo-input"
              style={{ display: 'none' }}
            />
            <label htmlFor="logo-input" className="btn btn-secondary">
              Choose Image
            </label>
            {logoPreview && (
              <div className="logo-preview">
                <img src={logoPreview} alt="Company Logo" />
                <button
                  type="button"
                  className="btn btn-error"
                  onClick={handleRemoveLogo}
                >
                  Remove Logo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preferences section - full width */}
      <div className="settings-section">
        <h3>Preferences</h3>
        <div className="setting-item">
          <label>Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'USD' | 'ZWG')}
          >
            <option value="USD">USD</option>
            <option value="ZWG">ZWG</option>
          </select>
        </div>
        <div className="setting-item">
          <label>Default VAT Rate</label>
          <input
            type="number"
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            min="0"
            max="100"
          />
        </div>
        <button className="btn btn-secondary" onClick={handleSavePreferences}>
          Save Preferences
        </button>
      </div>
    </div>
  );
}