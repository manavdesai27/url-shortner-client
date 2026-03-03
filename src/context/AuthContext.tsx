import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type User = { username: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  setAccessToken: (t: string | null) => void;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const api =
  (import.meta.env.VITE_API_BASE as string) ||
  (import.meta.env.DEV ? (import.meta.env.VITE_API_URL as string) : '/api');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const callMe = async (token: string | null): Promise<User | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${api}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return data?.username ? { username: String(data.username) } : null;
    } catch {
      return null;
    }
  };

  const tryRefresh = async (): Promise<{ token: string | null; user: User | null }> => {
    try {
      const res = await fetch(`${api}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // sends httpOnly refresh cookie if available
      });
      if (!res.ok) return { token: null, user: null };
      const data = await res.json().catch(() => ({}));
      const token = typeof data?.accessToken === 'string' ? data.accessToken : null;
      const newUser = data?.username ? { username: String(data.username) } : null;
      if (token) setAccessToken(token);
      if (newUser) setUser(newUser);
      return { token, user: newUser };
    } catch {
      return { token: null, user: null };
    }
  };

  const refresh = async () => {
    try {
      // Fast path: if we already have both token and user, avoid any network call
      if (accessToken && user) {
        return;
      }
      let token = accessToken;
      if (!token) {
        const { token: t, user: u } = await tryRefresh();
        token = t;
        if (u) {
          return; // we already have fresh user from refresh response
        }
      }
      if (token && !user) {
        const u = await callMe(token);
        setUser(u);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${api}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    } finally {
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem('auth');
    }
  };

  // Wrapper around fetch that injects Authorization header and retries once on 401 after refresh
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const doFetch = async (token: string | null, retry: boolean): Promise<Response> => {
      const headers = new Headers(init?.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401 && retry) {
        const { token: newToken } = await tryRefresh();
        if (newToken) {
          // retry once with new token
          const retryHeaders = new Headers(init?.headers || {});
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          return fetch(input, { ...init, headers: retryHeaders });
        } else {
          // refresh failed; ensure logged out
          setAccessToken(null);
          setUser(null);
        }
      }
      return res;
    };
    return doFetch(accessToken, true);
  };

  useEffect(() => {
    // Bootstrap: attempt refresh -> me
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, logout, setUser, setAccessToken, apiFetch }),
    [user, loading, accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}