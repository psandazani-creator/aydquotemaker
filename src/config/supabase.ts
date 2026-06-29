const TOKEN_KEY = 'aydqm_token';

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setStoredToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearStoredToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export async function getAuthToken(): Promise<string> {
  return getStoredToken() ?? '';
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export const auth = {
  onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  getSession: async () => ({ data: { session: null }, error: null }),
  signInWithPassword: async (_opts: any) => ({ data: null, error: new Error('Use /api/auth/login') }),
  signOut: async () => {
    clearStoredToken();
    return { error: null };
  },
  updateUser: async (_opts: any) => ({ data: null, error: new Error('Use /api/auth/change-password') }),
};
