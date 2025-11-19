import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type User = { username: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const api = import.meta.env.VITE_API_URL as string;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = async () => {
    try {
      const res = await fetch(`${api}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setUser(data?.username ? { username: data.username as string } : null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
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
      localStorage.removeItem('auth');
      setUser(null);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, logout, setUser }),
    [user, loading]
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
