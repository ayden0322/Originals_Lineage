'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser } from '@/lib/types';
import * as authApi from '@/lib/api/auth';
import { getAccessToken, setTokens, clearTokens } from '@/lib/api/client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginModuleAdmin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  loginModuleAdmin: async () => {},
  logout: async () => {},
  hasPermission: () => false,
});

/** Detect admin role from the current pathname. */
function detectAdminRole(): 'module-admin' | 'platform-admin' {
  if (typeof window === 'undefined') return 'platform-admin';
  const p = window.location.pathname;
  if (p.startsWith('/module') || p.startsWith('/originals')) return 'module-admin';
  return 'platform-admin';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      // AuthProvider is only used for admin dashboards, not player pages.
      // detectRoleFromPath (in client.ts) will pick the right token automatically.
      const role = detectAdminRole();
      const token = getAccessToken(role);
      if (!token) {
        setLoading(false);
        return;
      }

      // 統一使用 /auth/me（後端已統一）
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      const role = detectAdminRole();
      clearTokens(role);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    setTokens('platform-admin', tokens.accessToken, tokens.refreshToken);
    await fetchUser();
  };

  const loginModuleAdmin = async (email: string, password: string) => {
    const tokens = await authApi.moduleAdminLogin(email, password);
    setTokens('module-admin', tokens.accessToken, tokens.refreshToken);
    await fetchUser();
  };

  const logout = async () => {
    const role = detectAdminRole();
    try {
      // 統一使用 /auth/logout
      await authApi.logout();
    } catch {
      // ignore
    }
    clearTokens(role);
    setUser(null);
  };

  const hasPermission = (code: string) => {
    return user?.permissions?.includes(code) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginModuleAdmin, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
