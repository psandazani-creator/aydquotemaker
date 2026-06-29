import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserService } from '../../services/userService';
import { showNotification } from '../Notification/Notification';
import { apiFetch } from '../../config/supabase';
import './ProfilePage.css';

export function ProfilePage() {
    const { user, setUser } = useApp();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.companyPhone || '',
        company: user?.companyName || '',
    });

    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [pwLoading, setPwLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [pwExpanded, setPwExpanded] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEdit = () => {
        setFormData({
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.companyPhone || '',
            company: user?.companyName || '',
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (user?.id) {
            setIsSaving(true);
            try {
                const updateData = {
                    name: formData.name,
                    companyPhone: formData.phone,
                    companyName: formData.company,
                };
                await UserService.updateUser(user.id, updateData);
                setUser({ ...user, ...updateData });
                setIsEditing(false);
                showNotification('Profile updated successfully!', 'success');
            } catch (error) {
                showNotification('Failed to update profile. Please try again.', 'error');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwForm.next !== pwForm.confirm) {
            showNotification('New passwords do not match.', 'error');
            return;
        }
        if (pwForm.next.length < 6) {
            showNotification('New password must be at least 6 characters.', 'error');
            return;
        }
        setPwLoading(true);
        try {
            const res = await apiFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Failed to change password.');
            showNotification('Password changed successfully!', 'success');
            setPwForm({ current: '', next: '', confirm: '' });
            setPwExpanded(false);
        } catch (err: any) {
            showNotification(err.message || 'Failed to change password.', 'error');
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <div className="profile-page">
            <h2>Profile</h2>

            <div className="profile-section">
                <div className="profile-header">
                    <div className="avatar">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="profile-actions">
                        {!isEditing ? (
                            <button className="btn btn-secondary" onClick={handleEdit} disabled={isSaving}>
                                Edit Profile
                            </button>
                        ) : (
                            <div className="edit-actions">
                                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? '⟳ Saving...' : 'Save'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="profile-info">
                    <div className="info-group">
                        <label>Name</label>
                        {isEditing ? (
                            <input type="text" name="name" value={formData.name} onChange={handleChange} />
                        ) : (
                            <p>{user?.name || 'Not set'}</p>
                        )}
                    </div>

                    <div className="info-group">
                        <label>Email</label>
                        {isEditing ? (
                            <input type="email" name="email" value={formData.email} onChange={handleChange} />
                        ) : (
                            <p>{user?.email || 'Not set'}</p>
                        )}
                    </div>

                    <div className="info-group">
                        <label>Phone</label>
                        {isEditing ? (
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
                        ) : (
                            <p>{user?.companyPhone || 'Not set'}</p>
                        )}
                    </div>

                    <div className="info-group">
                        <label>Company</label>
                        {isEditing ? (
                            <input type="text" name="company" value={formData.company} onChange={handleChange} />
                        ) : (
                            <p>{user?.companyName || 'Not set'}</p>
                        )}
                    </div>

                    <div className="info-group">
                        <label>License Key</label>
                        <p className="license-key">{user?.licenseKey || 'Not set'}</p>
                    </div>

                    <div className="info-group">
                        <label>Tier</label>
                        <p className={`tier-badge ${user?.tier}`}>
                            {user?.tier?.toUpperCase() || 'FREE'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Change Password ─────────────────────────────────────────────── */}
            <div className="profile-section profile-pw-section">
                <div className="profile-pw-header" onClick={() => setPwExpanded((v) => !v)}>
                    <div className="profile-pw-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span>Change Password</span>
                    </div>
                    <svg
                        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ transform: pwExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    >
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>

                {pwExpanded && (
                    <form onSubmit={handleChangePassword} className="profile-pw-form">
                        <div className="info-group">
                            <label>Current Password</label>
                            <div className="pw-input-wrap">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={pwForm.current}
                                    onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                                    placeholder="Enter current password"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <div className="info-group">
                            <label>New Password</label>
                            <div className="pw-input-wrap">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={pwForm.next}
                                    onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                                    placeholder="Min. 6 characters"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="info-group">
                            <label>Confirm New Password</label>
                            <div className="pw-input-wrap">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={pwForm.confirm}
                                    onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                                    placeholder="Re-enter new password"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="pw-form-actions">
                            <label className="pw-show-toggle">
                                <input
                                    type="checkbox"
                                    checked={showPw}
                                    onChange={(e) => setShowPw(e.target.checked)}
                                />
                                Show passwords
                            </label>

                            <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                                {pwLoading ? '⟳ Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
