/**
 * HeroSection.tsx — clean hero with big search bar + ChaosScanner below
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, CheckCircle2, Zap } from 'lucide-react';
import { useTheme } from '../../../ThemeContext';
import { useAuth } from '../../../AuthContext';
import { loginWithCredentials, setApiToken } from '../../../api';
import BrainDumpInput from '../../BrainDumpInput';
import { Task } from '../../../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001/api';

export interface HeroSectionProps {
  onEnterDemo: () => void | Promise<void>;
  onSeeHowItWorks: () => void;
  reducedMotion: boolean;
  onNavigateDashboard?: () => void;
}

const HINT_CHIPS = ['React Lab due Friday', 'DBMS homework', 'Study for midterm', 'Research draft'];

const Spinner: React.FC = () => (
  <motion.span
    className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent"
    animate={{ rotate: 360 }}
    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
    aria-hidden="true"
  />
);

const HeroSection: React.FC<HeroSectionProps> = ({
  onEnterDemo,
  onSeeHowItWorks,
  reducedMotion,
  onNavigateDashboard,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isAuthenticated, setAuth } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [hintValue, setHintValue] = useState('');
  const [cinematicLogin, setCinematicLogin] = useState(false);
  const [cinematicStep, setCinematicStep] = useState(0);
  const [typedUser, setTypedUser] = useState('');
  const [typedPass, setTypedPass] = useState('');
  const [googleConfigured, setGoogleConfigured] = useState(false);

  // Check if Google OAuth is configured so we can show the Sign-In button
  useEffect(() => {
    fetch(`${BASE_URL}/auth/google/status`)
      .then(r => r.json())
      .then(d => setGoogleConfigured(d.configured))
      .catch(() => {});
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/google`);
      const data = await res.json();
      if (data.authUrl) window.location.href = data.authUrl;
    } catch { /* silently ignore */ }
  };

  const runCinematicLogin = () => {
    if (isLoading || cinematicLogin) return;
    if (isAuthenticated) {
      setIsLoading(true);
      setTimeout(() => { setIsLoading(false); onNavigateDashboard?.(); }, 600);
      return;
    }
    const DEMO_USER = 'demo';
    const DEMO_PASS = 'velocity2026';
    setCinematicLogin(true);
    setCinematicStep(0);
    setTypedUser('');
    setTypedPass('');
    setTimeout(() => { setCinematicStep(1); }, 300);
    setTimeout(() => {
      let i = 0;
      const typeUser = setInterval(() => {
        i++;
        setTypedUser(DEMO_USER.slice(0, i));
        if (i >= DEMO_USER.length) {
          clearInterval(typeUser);
          setCinematicStep(2);
          setTimeout(() => {
            let j = 0;
            const typePass = setInterval(() => {
              j++;
              setTypedPass(DEMO_PASS.slice(0, j));
              if (j >= DEMO_PASS.length) {
                clearInterval(typePass);
                setCinematicStep(3);
                setTimeout(async () => {
                  try {
                    const res = await loginWithCredentials(DEMO_USER, DEMO_PASS);
                    setApiToken(res.token);
                    setAuth(res.token, res.userId, res.mode as 'demo' | 'guest');
                    setCinematicStep(4);
                    setTimeout(() => {
                      setCinematicLogin(false);
                      setIsLoading(true);
                      setTimeout(() => { setIsLoading(false); onNavigateDashboard?.(); }, 400);
                    }, 700);
                  } catch {
                    setCinematicLogin(false);
                    onEnterDemo();
                  }
                }, 600);
              }
            }, 20);
          }, 300);
        }
      }, 20);
    }, 600);
  };

  const handleSearchSubmit = (_text: string) => runCinematicLogin();
  const handleTasksExtracted = (_tasks: Task[]) => runCinematicLogin();

  const motionProps = reducedMotion ? {} : { whileHover: { scale: 1.03, y: -2 }, whileTap: { scale: 0.97 } };

  // stagger helper
  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] },
  });


  return (
    <section
      id="hero"
      className="relative flex flex-col items-center justify-center min-h-[100svh] px-5 sm:px-8 py-20 text-center"
    >
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-5">

        {/* ── Badge ─────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0)}>
          <span
            className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-full"
            style={{ color: '#4ade80', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"
            />
            AI-Powered Productivity Engine
          </span>
        </motion.div>

        {/* ── Headline ──────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.08)} className="space-y-1">
          <h1
            className="font-bold tracking-tight leading-[1.1]"
            style={{
              fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
              color: 'var(--text-primary)',
              fontFamily: '"Cal Sans", "Bricolage Grotesque", "Plus Jakarta Sans", Inter, sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            Your AI agent for{' '}
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              deadline survival.
            </span>
          </h1>
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: 'var(--text-secondary)', maxWidth: '34rem', margin: '0 auto' }}
          >
            Dump your tasks, track pace in real time, and when deadlines clash —
            make the real call instead of silently dropping something.
          </p>
        </motion.div>

        {/* ── Search bar ────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.18)} className="w-full">
          <BrainDumpInput
            onSubmit={handleSearchSubmit}
            onTasksExtracted={handleTasksExtracted}
            loading={isLoading}
            isDark={isDark}
            showCalendar={true}
            defaultValue={hintValue}
            placeholder="React lab due Friday, physics essay tomorrow, email prof Chen..."
          />
        </motion.div>

        {/* ── Hint chips ────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.34)} className="flex flex-wrap gap-2 justify-center">
          {HINT_CHIPS.map((chip, i) => (
            <motion.button
              key={chip}
              onClick={() => setHintValue(chip)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.94 }}
              className="text-[11px] font-mono px-3 py-1.5 rounded-full"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                color: 'var(--text-faint)',
              }}
            >
              {chip}
            </motion.button>
          ))}
        </motion.div>

        {/* ── CTA row ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.42)} className="flex flex-wrap items-center justify-center gap-3">
          <motion.button
            type="button"
            onClick={runCinematicLogin}
            disabled={isLoading || cinematicLogin}
            {...motionProps}
            className="relative flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-bold overflow-hidden"
            style={{
              background: (isLoading || cinematicLogin)
                ? 'rgba(34,197,94,0.35)'
                : 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#000',
              boxShadow: '0 0 0 1px rgba(34,197,94,0.25), 0 6px 24px rgba(34,197,94,0.22)',
              cursor: (isLoading || cinematicLogin) ? 'not-allowed' : 'pointer',
            }}
          >
            {/* shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.22) 50%,transparent 60%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
            />
            {isLoading
              ? <><Spinner /><span>Loading…</span></>
              : <><Sparkles size={14} /><span>Enter Demo Sandbox</span><ArrowRight size={14} /></>
            }
          </motion.button>

          {/* Google Sign-In — shown when OAuth credentials are configured */}
          {googleConfigured && (
            <motion.button
              type="button"
              onClick={handleGoogleSignIn}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                color: isDark ? 'var(--text-primary)' : '#1f2937',
                boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {/* Google G */}
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </motion.button>
          )}

          <button
            type="button"
            onClick={onSeeHowItWorks}
            className="text-sm transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            See how it works ↓
          </button>
        </motion.div>

        {/* ── Trust line ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="flex items-center gap-1.5"
        >
          <CheckCircle2 size={11} className="text-green-400" />
          <span className="text-[11px] font-mono" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>
            No account needed · pre-loaded with real AI demo data · zero setup
          </span>
        </motion.div>

      </div>


      {/* ── Cinematic login overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {cinematicLogin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
              className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
              style={{
                background: isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 0 1px rgba(34,197,94,0.15), 0 40px 80px rgba(0,0,0,0.7)',
              }}
            >
              <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#22c55e 30%,#38bdf8 70%,transparent)' }} />
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <Zap size={13} className="text-green-400" />
                  <span className="text-xs font-mono font-bold" style={{ color: '#4ade80' }}>Velocity · Auto-Login</span>
                </div>
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Loading demo credentials...</p>
              </div>
              <div className="px-6 pb-5 space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>Username</label>
                  <div className="flex items-center px-3 py-2 rounded-xl"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: cinematicStep >= 1 ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-sm font-mono flex-1" style={{ color: 'var(--text-primary)', minHeight: '1em' }}>
                      {typedUser}
                      {cinematicStep === 1 && (
                        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                          style={{ display: 'inline-block', width: 2, height: 13, background: '#22c55e', marginLeft: 1, verticalAlign: 'text-bottom' }} />
                      )}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>Password</label>
                  <div className="flex items-center px-3 py-2 rounded-xl"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: cinematicStep >= 2 ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-sm font-mono flex-1" style={{ color: 'var(--text-primary)', minHeight: '1em' }}>
                      {'•'.repeat(typedPass.length)}
                      {cinematicStep === 2 && (
                        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                          style={{ display: 'inline-block', width: 2, height: 13, background: '#22c55e', marginLeft: 1, verticalAlign: 'text-bottom' }} />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  {cinematicStep < 4 && (
                    <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                  )}
                  {cinematicStep === 4 && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                    </motion.div>
                  )}
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    {cinematicStep <= 1 && 'Entering credentials...'}
                    {cinematicStep === 2 && 'Entering password...'}
                    {cinematicStep === 3 && 'Authenticating...'}
                    {cinematicStep === 4 && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#4ade80' }}>
                        ✓ Authenticated — loading dashboard
                      </motion.span>
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading overlay ───────────────────────────────────────────── */}
      <AnimatePresence>
        {isLoading && !cinematicLogin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: isDark ? 'rgba(8,10,14,0.92)' : 'rgba(240,244,248,0.92)', backdropFilter: 'blur(20px)' }}>
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-5">
              <div className="relative w-14 h-14">
                <motion.div className="absolute inset-0 rounded-full border-2 border-green-500/20" />
                <motion.div className="absolute inset-0 rounded-full border-2 border-t-green-400 border-r-green-400/40 border-b-transparent border-l-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={18} className="text-green-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Launching Velocity...</p>
                <p className="text-xs font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Seeding your demo workspace</p>
              </div>
              <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                <motion.div className="h-full rounded-full bg-green-400"
                  initial={{ width: 0 }} animate={{ width: '100%' }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
};

export default HeroSection;
