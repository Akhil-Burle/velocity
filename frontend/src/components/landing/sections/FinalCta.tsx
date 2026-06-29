/**
 * FinalCta.tsx
 * The closing call to action. No ambiguity about what to do next.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Reveal, Eyebrow, GRADIENT_TEXT, useIsDark, pal } from './_landingShared';

const FinalCta: React.FC<{ onEnterDemo: () => void | Promise<void>; reducedMotion: boolean }> = ({ onEnterDemo, reducedMotion }) => {
  const isDark = useIsDark();
  const p = pal(isDark);
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try { await onEnterDemo(); } finally { setLoading(false); }
  };

  return (
    <section id="cta" className="relative z-10 py-28 sm:py-44 px-5 sm:px-8 text-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,197,94,${isDark ? 0.09 : 0.1}) 0%, transparent 70%)` }} />
      <Reveal variant="scale" reducedMotion={reducedMotion} className="max-w-3xl mx-auto relative">
        <Eyebrow color="#22c55e">Try it now — no setup required</Eyebrow>
        <h2 style={{ fontSize: 'clamp(2.4rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, marginBottom: 24, color: p.text }}>
          Stop measuring speed.<br />
          <span style={GRADIENT_TEXT}>Start tracking direction.</span>
        </h2>
        <p className="text-xl" style={{ color: p.textMute, maxWidth: 540, margin: '0 auto 44px' }}>
          Enter the sandbox. In under 30 seconds, watch the Velocity Vector, the Drift Score diverging, and the
          Deadline Physics curve steepening — live.
        </p>

        <div className="flex justify-center">
          <motion.button onClick={handleClick} disabled={loading}
            whileHover={reducedMotion ? {} : { scale: 1.05, y: -3, boxShadow: '0 16px 48px rgba(34,197,94,0.5)' }}
            whileTap={reducedMotion ? {} : { scale: 0.97 }}
            className="relative flex items-center gap-3 px-10 py-5 rounded-2xl text-lg font-bold overflow-hidden"
            style={{ background: loading ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: '#000', boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 8px 40px rgba(34,197,94,0.4)', transition: 'transform 0.18s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s cubic-bezier(0.16,1,0.3,1)' }}>
            {!reducedMotion && (
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.3) 50%,transparent 65%)' }}
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }} />
            )}
            {loading
              ? <motion.span className="w-5 h-5 rounded-full border-2 border-black border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
              : <><Zap size={20} /><span>Enter Demo Sandbox</span><ArrowRight size={18} /></>}
          </motion.button>
        </div>

        <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          {['No account needed', 'Real AI data pre-loaded', 'Google Cloud powered'].map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-xs font-mono" style={{ color: p.textDim }}>
              <CheckCircle2 size={11} className="text-green-400" />{t}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
};

export default FinalCta;
