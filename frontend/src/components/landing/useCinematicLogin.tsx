/**
 * useCinematicLogin.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared cinematic demo-login flow: an auto-typing credential overlay that
 * authenticates and routes into the dashboard. Exposed as a hook so multiple
 * entry points (hero CTA, nav "Try Demo", final CTA) all trigger the identical
 * experience from a single source of truth.
 */
import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { loginWithCredentials, setApiToken, guestLogin } from '../../api';

export function useCinematicLogin() {
  const navigate = useNavigate();
  const { isAuthenticated, setAuth } = useAuth();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [typedUser, setTypedUser] = useState('');
  const [typedPass, setTypedPass] = useState('');
  const busyRef = React.useRef(false);

  const trigger = useCallback(() => {
    if (busyRef.current) return;
    if (isAuthenticated) { navigate('/dashboard'); return; }
    busyRef.current = true;
    const U = 'demo', P = 'velocity2026';
    setActive(true); setStep(0); setTypedUser(''); setTypedPass('');
    setTimeout(() => setStep(1), 300);
    setTimeout(() => {
      let i = 0;
      const tU = setInterval(() => {
        i++; setTypedUser(U.slice(0, i));
        if (i >= U.length) {
          clearInterval(tU); setStep(2);
          setTimeout(() => {
            let j = 0;
            const tP = setInterval(() => {
              j++; setTypedPass(P.slice(0, j));
              if (j >= P.length) {
                clearInterval(tP); setStep(3);
                setTimeout(async () => {
                  try {
                    const r = await loginWithCredentials(U, P);
                    setApiToken(r.token); setAuth(r.token, r.userId, r.mode as 'demo' | 'guest');
                    setStep(4);
                    setTimeout(() => { setActive(false); busyRef.current = false; navigate('/dashboard'); }, 650);
                  } catch {
                    try { const g = await guestLogin(); setApiToken(g.token); setAuth(g.token, g.userId, 'guest'); } catch { /* ignore */ }
                    setActive(false); busyRef.current = false; navigate('/dashboard');
                  }
                }, 500);
              }
            }, 18);
          }, 250);
        }
      }, 18);
    }, 600);
  }, [isAuthenticated, navigate, setAuth]);

  const overlay = (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}>
          <motion.div initial={{ scale: 0.88, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.05 }}
            className="w-full max-w-sm mx-4 rounded-3xl overflow-hidden"
            style={{ background: 'rgba(10,14,20,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 0 60px rgba(34,197,94,0.15), 0 40px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #22c55e 30%, #38bdf8 70%, transparent)' }} />
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1"><Zap size={13} className="text-green-400" /><span className="text-xs font-mono font-bold text-green-400">Auto-Login · Demo Mode</span></div>
              <p className="text-[10px] font-mono text-white/30">Injecting credentials...</p>
            </div>
            <div className="px-6 pb-6 space-y-3">
              {[{ label: 'Username', val: typedUser, step: 1 }, { label: 'Password', val: '•'.repeat(typedPass.length), step: 2 }].map(({ label, val, step: s }) => (
                <div key={label}>
                  <div className="text-[10px] font-mono uppercase tracking-wider mb-1 text-white/30">{label}</div>
                  <div className="px-3 py-2 rounded-xl font-mono text-sm text-white/90"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${step >= s ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)'}` }}>
                    {val}
                    {step === s && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="inline-block w-0.5 h-3.5 bg-green-400 ml-0.5 align-text-bottom" />}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                {step < 4
                  ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                  : <CheckCircle2 size={13} className="text-green-400" />}
                <span className="text-[11px] font-mono text-white/40">
                  {step <= 1 && 'Entering credentials...'}{step === 2 && 'Entering password...'}{step === 3 && 'Authenticating...'}{step === 4 && <span className="text-green-400">✓ Authenticated — loading dashboard</span>}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { trigger, overlay };
}
