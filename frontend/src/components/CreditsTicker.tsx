/**
 * CreditsTicker.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent header widget showing live Velocity Credits, level ring, and streak.
 * Animates a +VC burst on every award and a celebratory pulse on level-up.
 * Clicking it routes to the Insights tab (the full gamification view).
 *
 * Styled to match the AppShell header icon-button rhythm exactly.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, Flame } from 'lucide-react';
import { useCredits } from '../CreditsContext';

// Smooth count-up between two values
const useCountUp = (target: number, duration = 700) => {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
};

const CreditsTicker: React.FC<{ isDark: boolean; surfaceBorder: string }> = ({ isDark, surfaceBorder }) => {
  const { profile, burst, leveledUp } = useCredits();
  const navigate = useNavigate();
  const credits = useCountUp(profile?.credits ?? 0, 900);

  if (!profile) return null;

  const R = 13;
  const C = 2 * Math.PI * R;
  const dash = C * (profile.progressPercent / 100);

  return (
    <motion.button
      onClick={() => navigate('/insights')}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="relative flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full select-none"
      style={{
        background: isDark ? 'rgba(34,197,94,0.07)' : 'rgba(34,197,94,0.08)',
        border: `1px solid ${leveledUp ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.22)'}`,
      }}
      animate={leveledUp ? {
        boxShadow: [
          '0 0 0px rgba(34,197,94,0)',
          '0 0 22px rgba(34,197,94,0.55)',
          '0 0 0px rgba(34,197,94,0)',
        ],
      } : {}}
      transition={leveledUp ? { duration: 1.1, repeat: 3 } : {}}
      title={`${profile.title} · Level ${profile.level} · ${profile.creditsToNext} VC to next`}
    >
      {/* Level ring */}
      <div className="relative w-7 h-7 shrink-0">
        <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
          <circle cx="14" cy="14" r={R} fill="none" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} strokeWidth="2.5" />
          <motion.circle
            cx="14" cy="14" r={R} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={C}
            initial={false}
            animate={{ strokeDashoffset: C - dash }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-mono font-bold" style={{ color: '#22c55e' }}>{profile.level}</span>
        </div>
      </div>

      {/* Credits */}
      <div className="flex flex-col items-start leading-none">
        <div className="flex items-center gap-1">
          <Zap size={10} style={{ color: '#22c55e' }} />
          <span
            className="text-xs font-mono font-bold tabular-nums"
            style={{ color: burst ? '#4ade80' : 'var(--text-primary)', transition: 'color 0.3s ease' }}
          >
            {credits.toLocaleString()}
          </span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>VC</span>
        </div>
        <span className="text-[8px] font-mono uppercase tracking-wider hidden sm:block" style={{ color: 'var(--text-faint)' }}>
          {profile.title}
        </span>
      </div>

      {/* Streak */}
      {profile.streak > 0 && (
        <div className="hidden sm:flex items-center gap-0.5 pl-2 ml-0.5" style={{ borderLeft: `1px solid ${surfaceBorder}` }}>
          <motion.span
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Flame size={12} style={{ color: '#f59e0b' }} />
          </motion.span>
          <span className="text-[11px] font-mono font-bold" style={{ color: '#fbbf24' }}>{profile.streak}</span>
        </div>
      )}

      {/* +VC burst — rises up INTO the credit number then vanishes */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, y: 8, scale: 0.75 }}
            animate={{ opacity: [0, 1, 1, 0], y: [8, 0, -8, -20], scale: [0.75, 1.1, 1, 0.9] }}
            transition={{ duration: 1.2, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
            className="absolute pointer-events-none whitespace-nowrap"
            style={{
              // Position it over the credits number
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 800,
              color: '#4ade80',
              textShadow: '0 0 14px rgba(34,197,94,0.9), 0 0 30px rgba(34,197,94,0.4)',
              zIndex: 20,
              letterSpacing: '-0.01em',
            }}
          >
            +{burst.amount} VC
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow pulse on the counter when burst fires */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key={`glow-${burst.id}`}
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.25) 0%, transparent 70%)' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default CreditsTicker;
