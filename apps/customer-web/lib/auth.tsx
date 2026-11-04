'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

export interface Me { id: string; email: string; name: string; role: string; isStaff: boolean; permissions: string[] }
interface AuthState {
  user: Me | null; loading: boolean; refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setUser(await api<Me>('/auth/me', { quiet: true })); } catch { setUser(null); }
  }, []);
  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);
  const login = async (email: string, password: string) => {
    await api('/auth/login', { method: 'POST', body: { email, password, audience: 'customer' }, quiet: true });
    await refresh();
  };
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST', quiet: true }); } catch { /* still leave */ }
    setUser(null);
  };
  return <Ctx.Provider value={{ user, loading, refresh, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
