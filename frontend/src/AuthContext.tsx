/**
 * AuthContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT is persisted in localStorage with a 24-hour TTL so that page refreshes
 * don't kill the session — critical for demo/judging scenarios.
 *
 * On mount:
 *   1. Check localStorage for a non-expired saved session and restore it.
 *   2. If DEMO_MODE and no saved session, auto guest-login.
 *
 * Provides: token, userId, isAuthenticated, mode, setAuth, logout
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { guestLogin, setApiToken } from './api';

// ── Demo mode flag — read once at module load ─────────────────────────────────
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// ── Session persistence helpers ───────────────────────────────────────────────
const SESSION_KEY = 'velocity_session';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

interface PersistedSession {
  token: string;
  userId: string;
  mode: 'guest' | 'demo' | 'google';
  expiresAt: number; // epoch ms
}

function saveSession(token: string, userId: string, mode: 'guest' | 'demo' | 'google') {
  try {
    const session: PersistedSession = {
      token,
      userId,
      mode,
      expiresAt: Date.now() + SESSION_TTL,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage blocked (private browsing edge cases) — silently ignore
  }
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: PersistedSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// ── Context types ─────────────────────────────────────────────────────────────
interface AuthState {
  token: string | null;
  userId: string | null;
  mode: 'guest' | 'demo' | 'google' | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  autoAuthReady: boolean;
  setAuth: (token: string, userId: string, mode: 'guest' | 'demo' | 'google') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Eagerly sync any saved token into api.ts at module load time ──────────────
// This runs synchronously before any component mounts, so API calls made
// during the first render already have the token in the request headers.
const _earlySession = loadSession();
if (_earlySession) {
  setApiToken(_earlySession.token);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to restore a saved session immediately so the initial state is correct
  const saved = _earlySession;

  const [auth, setAuthState] = useState<AuthState>({
    token:  saved?.token  ?? null,
    userId: saved?.userId ?? null,
    mode:   saved?.mode   ?? null,
  });

  // autoAuthReady: true if we already have a token OR demo-mode auto-login has resolved
  const [autoAuthReady, setAutoAuthReady] = useState<boolean>(
    !IS_DEMO_MODE || !!saved?.token
  );

  const setAuth = useCallback((token: string, userId: string, mode: 'guest' | 'demo' | 'google') => {
    setAuthState({ token, userId, mode });
    saveSession(token, userId, mode);
    setApiToken(token);
  }, []);

  const logout = useCallback(() => {
    setAuthState({ token: null, userId: null, mode: null });
    clearSession();
    setApiToken(null);
  }, []);

  // ── Demo mode: auto guest login only if no saved session exists ───────────
  useEffect(() => {
    if (!IS_DEMO_MODE) return;
    if (saved?.token) return; // already restored — skip auto-login

    guestLogin()
      .then(res => {
        setAuth(res.token, res.userId, 'guest');
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
