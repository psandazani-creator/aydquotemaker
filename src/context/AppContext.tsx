import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, User, Quote, DraftQuote } from '../types';
import { useAuth } from '../hooks/useAuth';
import { clearStoredToken, setStoredToken } from '../config/supabase';
import { GoldBoxSpinner } from '../components/Auth/GoldBoxSpinner';
import { startSync, stopSync } from '../db/syncManager';

interface AppContextType extends AppState {
  setUser: (user: User | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setCurrentQuote: (quote: Quote | DraftQuote | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [drafts, setDrafts] = useState<DraftQuote[]>([]);
  const [currentQuote, setCurrentQuote] = useState<Quote | DraftQuote | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setUser(authUser);
    if (authUser) {
      startSync(authUser.id);
    } else {
      stopSync();
    }
  }, [authUser?.id]);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Login failed.');
    }
    const { token } = await res.json();
    setStoredToken(token);
  };

  const logout = async () => {
    stopSync();
    clearStoredToken();
    setUser(null);
    Object.keys(localStorage)
      .filter((k) => k.startsWith('aydqm-profile-'))
      .forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  const value: AppContextType = {
    user,
    quotes,
    drafts,
    currentQuote,
    isOnline,
    drawerOpen,
    setUser,
    setDrawerOpen,
    setCurrentQuote,
    login,
    logout,
  };

  if (authLoading) {
    return <GoldBoxSpinner text="Loading…" />;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
