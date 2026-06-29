import { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { apiFetch, getStoredToken } from '../config/supabase';

const PROFILE_KEY = (id: string) => `aydqm-profile-${id}`;
const CACHE_MAX_AGE_MS = 2 * 60 * 1000;

function getCachedProfile(id: string): User | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User & { _cachedAt?: number };
    if (Date.now() - (parsed._cachedAt ?? 0) > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {}
  return null;
}

function setCachedProfile(user: User) {
  try {
    localStorage.setItem(PROFILE_KEY(user.id), JSON.stringify({ ...user, _cachedAt: Date.now() }));
  } catch {}
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingDoneRef = useRef(false);
  const syncInProgressRef = useRef(false);

  const markLoaded = () => {
    if (!loadingDoneRef.current) {
      loadingDoneRef.current = true;
      setLoading(false);
    }
  };

  const syncProfile = async (userId: string, mounted: { current: boolean }) => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;

    const cached = getCachedProfile(userId);
    if (cached && mounted.current) setUser(cached);

    if (!navigator.onLine) {
      syncInProgressRef.current = false;
      return;
    }

    try {
      const res = await apiFetch('/api/user/profile');
      if (!mounted.current) return;

      if (res.ok) {
        const { user: userData, license: licenseData } = await res.json();
        if (userData) {
          const merged: User = {
            ...(userData as User),
            licenseKey: licenseData?.license_key ?? '',
            tier: (licenseData?.tier ?? 'free') as 'free' | 'pro' | 'lifetime',
            deviceLimit: licenseData?.device_limit ?? 2,
          };
          setCachedProfile(merged);
          if (mounted.current) setUser(merged);
          return;
        }
      }

      if (cached && mounted.current) setUser(cached);
    } catch (err) {
      console.error('[useAuth] syncProfile error:', err);
      if (cached && mounted.current) setUser(cached);
    } finally {
      syncInProgressRef.current = false;
    }
  };

  useEffect(() => {
    const mounted = { current: true };

    const token = getStoredToken();
    if (!token) {
      markLoaded();
      return;
    }

    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!mounted.current) return;
        if (res.ok) {
          const payload = await res.json();
          const cached = getCachedProfile(payload.id);
          if (cached && mounted.current) setUser(cached);
          syncProfile(payload.id, mounted);
        } else {
          try { localStorage.removeItem('aydqm_token'); } catch {}
          if (mounted.current) setUser(null);
        }
        markLoaded();
      })
      .catch(() => {
        if (mounted.current) {
          const cachedIds = Object.keys(localStorage)
            .filter((k) => k.startsWith('aydqm-profile-'))
            .map((k) => k.replace('aydqm-profile-', ''));
          if (cachedIds.length > 0) {
            const cached = getCachedProfile(cachedIds[0]);
            if (cached) setUser(cached);
          }
          markLoaded();
        }
      });

    const refreshLicense = () => {
      const tok = getStoredToken();
      if (tok && navigator.onLine) {
        apiFetch('/api/auth/me').then(async (r) => {
          if (r.ok && mounted.current) {
            const p = await r.json();
            syncProfile(p.id, mounted);
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('online', refreshLicense);
    const interval = setInterval(refreshLicense, 5 * 60 * 1000);

    return () => {
      mounted.current = false;
      window.removeEventListener('online', refreshLicense);
      clearInterval(interval);
    };
  }, []);

  return { user, loading };
}
