/**
 * AgentDepthSection.tsx
 * Shows the autonomous agent system: Activity Log, compositional chains,
 * Adaptive Policy Memory. Animated chain sequence: Rebalance → conflict
 * detected → Negotiate drafted → policy learned.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronRight, GitBranch, Brain, CheckCircle2, AlertTriangle, Mail, Sparkles, RefreshCw } from 'lucide-react';

interface AgentDepthSectionProps {
  reducedMotion: boolean;
}

const CHAIN_STEPS = [
  {
    icon: <RefreshCw size={11} />,
    label: 'Day Rebalance triggered',
    detail: 'Energy-aware block assigned: CS Lab → 9–11am',
    color: '#38bdf8',
    autonomy: 'autonomous',
    delay: 0,
  },
  {
    icon: <AlertTriangle size={11} />,
    label: 'Conflict detected',
    detail: 'DBMS deadline overlaps — 2 tasks, 1 slot',
    color: '#f59e0b',
    autonomy: 'detected',
    delay: 700,
  },
  {
    icon: <Mail size={11} />,
    label: 'Negotiate draft composed',
    detail: 'Extension request to Prof. Chen — context-aware',
    color: '#22c55e',
    autonomy: 'composed',
    delay: 1500,
  },
  {
    icon: <Brain size={11} />,
    label: 'Policy learned',
    detail: 'Adaptive Memory: prefer morning for deep work',
    color: '#a78bfa',
    autonomy: 'learned',
    delay: 2400,
  },
];

const POLICY_ENTRIES = [
  { label: 'Skip rebalance on Fridays after 3pm', count: 4, color: '#a78bfa' },
  { label: 'Prefer negotiate over force-complete for DBMS', count: 2, color: '#22c55e' },
  { label: 'Block 9–11am for deep work', count: 7, color: '#38bdf8' },
];

const AgentDepthSection: React.FC<AgentDepthSectionProps> = ({ reducedMotion }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(reducedMotion);
  const [stepsShown, setStepsShown] = useState(reducedMotion ? CHAIN_STEPS.length : 0);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); setStepsShown(CHAIN_STEPS.length); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (!visible || reducedMotion) return;
    CHAIN_STEPS.forEach((step, i) => {
      setTimeout(() => setStepsShown(prev => Math.max(prev, i + 1)), step.delay + 400);
    });
  }, [visible, reducedMotion]);

  const fadeUp = (delay: number) => ({
    initial: reducedMotion ? {} : { opacity: 0, y: 24 },
    animate: visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] },
  });

  return (
    <section ref={ref} id="agent-depth" className="py-20 sm:py-28 px-5 sm:px-8"
      style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.02) 50%, transparent 100%)' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div {...fadeUp(0)} className="mb-12 max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: '#38bdf8' }}>Agentic depth</p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            An agent that acts, chains, and learns
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Velocity doesn't just suggest. It executes — and logs every autonomous action so you
            can review, undo, or override it. When actions produce conflicts, it chains follow-up
            responses automatically. When you cancel an action repeatedly, it stops suggesting it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chain demo */}
          <motion.div {...fadeUp(0.1)}>
            <h3 className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>
              Live action chain — watch it build
            </h3>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid rgba(56,189,248,0.15)' }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <Bot size={13} style={{ color: '#38bdf8' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#38bdf8' }}>Agent Activity Log</span>
                <span className="ml-auto text-[9px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                  live
                </span>
              </div>
              <div className="p-4">
                <div className="relative">
                  {/* Vertical spine */}
                  <div className="absolute left-[18px] top-4 bottom-4 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                  <div className="space-y-0">
                    {CHAIN_STEPS.map((step, i) => (
                      <AnimatePresence key={step.label}>
                        {i < stepsShown && (
                          <motion.div
                            initial={{ opacity: 0, x: -12, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            className="flex items-start gap-3 pb-3"
                          >
                            {/* Step icon */}
                            <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center z-10 mt-0.5"
                              style={{ background: `${step.color}15`, border: `1px solid ${step.color}30`, color: step.color }}>
                              {step.icon}
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</span>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                                  style={{ background: `${step.color}10`, color: step.color }}>
                                  {step.autonomy}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{step.detail}</p>
                            </div>
                            {/* Connect arrow */}
                            {i < CHAIN_STEPS.length - 1 && i < stepsShown - 1 && (
                              <ChevronRight size={10} className="shrink-0 mt-2" style={{ color: 'var(--text-faint)' }} />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}

                    {stepsShown < CHAIN_STEPS.length && !reducedMotion && (
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
                        className="flex items-center gap-2 pl-12">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>agent working...</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Adaptive Policy Memory */}
          <motion.div {...fadeUp(0.18)} className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>
              Adaptive Policy Memory
            </h3>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid rgba(167,139,250,0.15)' }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <Brain size={13} style={{ color: '#a78bfa' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78bfa' }}>Learned behaviors</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  When you cancel the same type of action 3+ times, the agent writes a policy and stops proposing it.
                  When a pattern succeeds, it reinforces.
                </p>
                {POLICY_ENTRIES.map((p, i) => (
                  <motion.div key={p.label}
                    initial={reducedMotion ? {} : { opacity: 0, x: 10 }}
                    animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl"
                    style={{ background: `${p.color}0a`, border: `1px solid ${p.color}18` }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.label}</p>
                    </div>
                    <span className="text-[9px] font-mono shrink-0" style={{ color: p.color }}>×{p.count}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* OmniBar note */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} style={{ color: '#22c55e' }} />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>OmniBar</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded ml-auto" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}>Ctrl+K</span>
              </div>
              <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Natural language command bar with voice input. Type or say "panic the React lab" and the agent
                executes the full chain autonomously — scaffolds, logs, and learns.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AgentDepthSection;
