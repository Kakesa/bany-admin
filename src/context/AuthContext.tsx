import React, { createContext, useContext, useMemo, useState } from 'react';

export const TOKEN_KEY = 'bany_blog_admin_token';

interface AuthContextValue {
  token: string;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) || '');

  const value = useMemo(
    () => ({
      token,
      setToken: (next: string) => {
        localStorage.setItem(TOKEN_KEY, next);
        setTokenState(next);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState('');
      },
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
