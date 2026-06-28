/**
 * FinalCTASection.tsx — UPGRADED
 * Final CTA: impossible to miss, no further scrolling needed.
 * Physics-weighted button with spring hover, shimmer shimmer.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../../ThemeContext';

interface FinalCTASectionProps {
  onEnterDemo: () => void | Promise<void>;
  onSeeHowItWorks: () => void;
  reducedMotion: boolean;
}

const Spinner: React.FC = () => (
  <svg aria-hidden="true" className="animate-spin" width="18" height="18" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
    <path d="M10 2 a8 8 0 0 1 8 8" stroke="#000" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const FinalCTASection: React.FC<FinalCTASectionProps> = ({ onEnterDemo, onSeeHowItWorks, reducedMotion }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(reducedMotion);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  const handleEnterDemo = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try { await onEnterDemo(); } finally { setIsLoading(false); }
  };

  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

  return (
    <section ref={ref} id="cta" className="w-full px-5 sm:px-8 py-24 sm:py-32">
      <motion.div
        initial={reducedMotion ? {} : { opacity: 0, y: 32 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
        transition={{ duration: 0.7, ease }}
        className="max-w-3xl mx-auto text-center"
      >
        <p className="text-[11px] font-mono uppercase tracking-widest mb-5" style={{ color: '#22c55e' }}>
          Try it now — no setup required
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Stop measuring speed.
          <br className="hidden sm:block" />
          <span style={{ background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 60%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Start tracking direction.
          </span>
        </h2>

        <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Enter the demo sandbox. In under thirty seconds, you'll see the Velocity Vector,
          the Drift Score diverging from your self-report, and the Deadline Physics curve steepening in real time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          {/* Primary CTA */}
          <motion.button
            type="button"
            disabled={isLoading}
            onClick={handleEnterDemo}
            whileHover={reducedMotion ? {} : { scale: 1.04, y: -3, boxShadow: '0 10px 40px rgba(34,197,94,0.45)' }}
            whileTap={reducedMotion ? {} : { scale: 0.97 }}
            className="relative inline-flex items-center gap-2.5 rounded-2xl px-9 py-4 text-base font-bold overflow-hidden"
            style={{
              background: isLoading ? 'rgba(34,197,94,0.35)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: '#000',
              boxShadow: '0 0 0 1px rgba(34,197,94,0.25), 0 6px 28px rgba(34,197,94,0.28)',
              transition: 'transform 0.18s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Shimmer sweep */}
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.25) 50%,transparent 60%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }} />
            {isLoading
              ? <><Spinner /><span>Loading…</span></>
              : <><Sparkles size={15} /><span>Enter Demo Sandbox</span><ArrowRight size={15} /></>
            }
          </motion.button>

          {/* Secondary */}
          <motion.button type="button" onClick={onSeeHowItWorks}
            whileHover={reducedMotion ? {} : { y: -2, transition: { duration: 0.15 } }}
            className="inline-flex items-center justify-center rounded-2xl px-8 py-4 text-base font-semibold"
            style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1.5px solid var(--border-subtle)', transition: 'color 0.18s ease, border-color 0.18s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-medium)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          >
            See how it works
          </motion.button>
        </div>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          {['No account needed', 'Pre-loaded demo data', 'Google Sign-In available'].map((item, i) => (
            <motion.div key={item}
              initial={reducedMotion ? {} : { opacity: 0, y: 8 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.08, ease }}
              className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-green-400" />
              <span className="text-[11px] font-mono" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>{item}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default FinalCTASection;
