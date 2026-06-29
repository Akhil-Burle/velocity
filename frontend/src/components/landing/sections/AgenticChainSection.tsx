/**
 * AgenticChainSection.tsx
 * Demonstrates the autonomous action system as a single cascading chain that
 * plays out when the section scrolls into view. Theme-aware.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, AlertTriangle, MessageSquare, Send, Bot, type LucideIcon } from 'lucide-react';
import { EASE, Reveal, Eyebrow, glass, useReveal, useIsDark, pal } from './_landingShared';

interface Step {
  icon: LucideIcon;
  color: string;
  origin: string;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  { icon: Calendar, color: '#34a853', origin: 'TRIGGER', title: 'Rebalanced your day', detail: 'Energy-aware plan rebuilt around real Google Calendar events.' },
  { icon: AlertTriangle, color: '#f59e0b', origin: 'CASCADE', title: 'Conflict detected', detail: 'CS Lab and Physics Essay both need the same evening block.' },
  { icon: MessageSquare, color: '#a78bfa', origin: 'CASCADE', title: 'Negotiate drafted automatically', detail: 'Gemini composed an extension request tailored to Prof. Chen.' },
  { icon: Send, color: '#22c55e', origin: 'RESULT', title: 'Sent · logged to Activity Log', detail: 'Full reasoning chain recorded — expandable, never silent.' },
];

const ChainItem: React.FC<{ step: Step; index: number; active: boolean; last: boolean; reducedMotion: boolean; isDark: boolean }> = ({ step, index, active, last, reducedMotion, isDark }) => {
  const Icon = step.icon;
  const p = pal(isDark);
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <motion.div
          initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
          animate={active ? { scale: 1, opacity: 1 } : reducedMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 z-10"
          style={{ background: `${step.color}18`, border: `1px solid ${step.color}45`, color: step.color, boxShadow: active ? `0 0 18px ${step.color}30` : 'none' }}>
          <Icon size={18} />
        </motion.div>
        {!last && (
          <div className="w-px flex-1 my-1" style={{ background: p.hairline, position: 'relative', minHeight: 28 }}>
            <motion.div className="absolute inset-x-0 top-0 w-px mx-auto"
              style={{ background: `linear-gradient(${step.color}, ${STEPS[index + 1]?.color || step.color})`, transformOrigin: 'top' }}
              initial={{ scaleY: 0 }} animate={{ scaleY: active ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.4, delay: 0.2, ease: EASE }} />
            <div className="h-full" />
          </div>
        )}
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, x: -16 }}
        animate={active ? { opacity: 1, x: 0 } : reducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex-1 rounded-2xl p-4 mb-3" style={glass(step.color, isDark, 0.18)}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ background: `${step.color}15`, color: step.color, border: `1px solid ${step.color}30` }}>{step.origin}</span>
          <span className="text-sm font-bold" style={{ color: p.text }}>{step.title}</span>
        </div>
        <p className="text-[11px] font-mono leading-relaxed" style={{ color: p.textFaint }}>{step.detail}</p>
      </motion.div>
    </div>
  );
};

const AgenticChainSection: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const { ref, inView } = useReveal(0.3);
  const isDark = useIsDark();
  const p = pal(isDark);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) { setRevealed(STEPS.length); return; }
    const timers = STEPS.map((_, i) => setTimeout(() => setRevealed(i + 1), 500 + i * 750));
    return () => timers.forEach(clearTimeout);
  }, [inView, reducedMotion]);

  return (
    <section id="agentic" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[0.85fr_1fr] gap-12 lg:gap-16 items-center">
        <Reveal variant="left" reducedMotion={reducedMotion}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8' }}>
              <Bot size={16} />
            </div>
            <Eyebrow color="#38bdf8">Agentic depth</Eyebrow>
          </div>
          <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 18, color: p.text }}>
            One trigger.<br />A whole chain of action.
          </h2>
          <p className="text-lg" style={{ color: p.textMute }}>
            Velocity doesn't stop at one step. A single rebalance can detect a conflict, draft a negotiation, and
            send it — autonomously. Every action in the cascade is logged with full reasoning you can expand.
          </p>
        </Reveal>

        <div ref={ref as React.RefObject<HTMLDivElement>}>
          {STEPS.map((step, i) => (
            <ChainItem key={step.title} step={step} index={i} active={i < revealed} last={i === STEPS.length - 1} reducedMotion={reducedMotion} isDark={isDark} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgenticChainSection;
