/**
 * AuthContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT stored in React state ONLY — not localStorage.
 * Tradeoff: refresh logs the user out. This is acceptable for hackathon scope.
 *
 * DEMO_MODE (VITE_DEMO_MODE=true):
 *   On mount, automatically calls /api/auth/guest and stores the token.
 *   This gives every visitor an instant authenticated session — zero clicks.
 *
 * Provides: token, userId, isAuthenticated, mode, setAuth, logout
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { guestLogin } from './api';

// ── Demo mode flag — read once at module load ─────────────────────────────────
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

interface AuthState {
  token: string | null;
  userId: string | null;
  mode: 'guest' | 'demo' | 'google' | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  autoAuthReady: boolean;   // true once demo auto-login has resolved
  setAuth: (token: string, userId: string, mode: 'guest' | 'demo' | 'google') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuthState] = useState<AuthState>({
    token: null,
    userId: null,
    mode: null,
  });
  const [autoAuthReady, setAutoAuthReady] = useState(!IS_DEMO_MODE);

  const setAuth = useCallback((token: string, userId: string, mode: 'guest' | 'demo' | 'google') => {
    setAuthState({ token, userId, mode });
  }, []);

  const logout = useCallback(() => {
    setAuthState({ token: null, userId: null, mode: null });
  }, []);

  // ── Demo mode: auto guest login on mount ─────────────────────────────────
  useEffect(() => {
    if (!IS_DEMO_MODE) return;
    guestLogin()
      .then(res => {
        setAuthState({ token: res.token, userId: res.userId, mode: 'guest' });
      })
      .catch(err => {
        console.warn('[DemoMode] Auto guest login failed:', err.message);
      })
      .finally(() => {
        setAutoAuthReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        isAuthenticated: !!auth.token,
        autoAuthReady,
        setAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
