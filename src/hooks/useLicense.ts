// src/hooks/useLicense.ts
import { useState, useEffect } from 'react';
import { User } from '../types';

export function useLicense(licenseKey?: string) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!licenseKey) {
      setLoading(false);
      return;
    }

    const validateLicense = async () => {
      try {
        const res = await fetch(`/api/user/license`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          setIsValid(false);
          return;
        }

        const { license } = await res.json();

        if (!license || !license.is_active) {
          setIsValid(false);
          return;
        }

        setIsValid(true);
      } catch (error) {
        console.error('License validation error:', error);
        setIsValid(false);
      }
      setLoading(false);
    };

    validateLicense();
  }, [licenseKey]);

  return { isValid, user, loading };
}
