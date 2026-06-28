/**
 * AuthModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Login/Guest selection modal — triggered when the user tries to submit a
 * brain dump without being authenticated.
 *
 * DESIGN CONSTRAINT: Reuses existing modal glass pattern (same as
 * CreateGoalModal / TaskDetailModal), existing input style, and existing
 * button gradients. No new colors, fonts, spacing, or components.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, LogIn, User, X, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { guestLogin, loginWithCredentials } from '../api';
import { useAuth } from '../AuthContext';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001/api';

interface AuthModalProps {
  onClose: () => void;
  onAuthenticated: () => void; // called after successful auth to continue pending action
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthenticated }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { setAuth } = useAuth();

  const [tab, setTab] = useState<'choice' | 'login'>('choice');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/auth/google/status`)
      .then(r => r.json())
      .then(d => setGoogleConfigured(d.configured))
      .catch(() => {});
  }, []);

  // ── Exact same token set used throughout the app ──────────────────────────
  const divider      = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const sectionBg    = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)';
  const sectionBorder= isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';

  const inputStyle: React.CSSProperties = {
    background:   isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    border:       isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.1)',
    color:        'var(--text-primary)',
    borderRadius: '12px',
    padding:      '10px 14px',
    width:        '100%',
    fontSize:     '13px',
    outline:      'none',
    caretColor:   '#22c55e',
    fontFamily:   'inherit',
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/auth/google`);
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError('Google Sign-In not available');
        setLoading(false);
      }
    } catch (e: any) {
      setError('Failed to initiate Google Sign-In');
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await guestLogin();
      setAuth(res.token, res.userId, 'guest');
      onAuthenticated();
    } catch (e: any) {
      setError(e.message || 'Failed to start guest session');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Enter username and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithCredentials(username.trim(), password.trim());
      setAuth(res.token, res.userId, 'demo');
      onAuthenticated();
    } catch (e: any) {
      setError(e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: isDark ? 'linear-gradient(120deg,#141b23 0%,#0f1419 100%)' : 'linear-gradient(120deg,#ffffff 0%,#f8fafc 100%)',
          border: '1px solid rgba(34,197,94,0.28)',
          boxShadow: '0 0 0 1px rgba(34,197,94,0.12), 0 30px 70px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar — identical to CreateGoalModal */}
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#22c55e,transparent)' }} />

        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <Zap size={13} className="text-green-400" />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {tab === 'choice' ? 'Welcome to Velocity' : 'Demo Login'}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {tab === 'choice' ? 'Choose how to continue' : 'Use demo credentials below'}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-faint)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <AnimatePresence mode="wait">
          {tab === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="px-5 py-5 space-y-3"
            >
              {/* Guest option */}
              <motion.button
                onClick={handleGuest}
                disabled={loading}
                whileHover={!loading ? { scale: 1.02, y: -1 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-left transition-all"
                style={{
                  background: sectionBg,
                  border: `1px solid ${sectionBorder}`,
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)' }}>
                  {loading ? (
                    <motion.div className="w-4 h-4 rounded-full border-2 border-green-400 border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                  ) : (
                    <User size={15} className="text-green-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Continue as Guest
                  </div>
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    No account needed · session resets on refresh
                  </div>
                </div>
              </motion.button>

              {/* Login option */}
              <motion.button
                onClick={() => setTab('login')}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-left transition-all"
                style={{
                  background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.22)',
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                  <LogIn size={15} style={{ color: '#000' }} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Demo Login
                  </div>
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    Pre-loaded with real tasks, goals & habits
                  </div>
                </div>
              </motion.button>

              {/* Google Sign-In — shown when OAuth is configured */}
              {googleConfigured && (
                <motion.button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02, y: -1 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-left transition-all"
                  style={{
                    background: isDark ? 'rgba(66,133,244,0.08)' : 'rgba(66,133,244,0.06)',
                    border: '1px solid rgba(66,133,244,0.28)',
                  }}
                >
                  {/* Google G logo */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.2)' }}>
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Sign in with Google
                    </div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      Real calendar sync + Google account
                    </div>
                  </div>
                </motion.button>
              )}

              {/* Tradeoff note */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <AlertCircle size={11} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  <span style={{ color: '#fbbf24' }}>Note:</span> JWT is stored in memory only. Refreshing the page will log you out — by design for this build.
                </p>
              </div>
            </motion.div>

          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="px-5 py-5"
            >
              {/* Demo credentials hint */}
              <div className="mb-4 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
                  Demo credentials
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>username: </span>
                    <span className="text-xs font-mono font-bold" style={{ color: '#22c55e' }}>demo</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>password: </span>
                    <span className="text-xs font-mono font-bold" style={{ color: '#22c55e' }}>velocity2026</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username"
                  autoFocus
                  autoComplete="username"
                  style={inputStyle}
                />

                <div className="relative">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="current-password"
                    style={{ ...inputStyle, paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }}
                    >
                      <AlertCircle size={11} className="text-red-400 shrink-0" />
                      <span className="text-[11px] font-mono text-red-400">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 pt-1">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={!loading ? { scale: 1.02 } : {}}
                    whileTap={!loading ? { scale: 0.97 } : {}}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                    style={{
                      background: loading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                      color: loading ? '#4ade80' : '#000',
                      boxShadow: loading ? 'none' : '0 0 16px rgba(34,197,94,0.2)',
                    }}
                  >
                    {loading
                      ? <motion.div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                      : <><LogIn size={14} />Login</>
                    }
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => { setTab('choice'); setError(null); }}
                    className="px-4 py-2.5 rounded-xl text-sm transition-colors"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: `1px solid ${divider}`, color: 'var(--text-muted)' }}
                  >
                    Back
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
