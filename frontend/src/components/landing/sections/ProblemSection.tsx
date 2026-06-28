/**
 * ProblemSection.tsx
 * The "why passive reminders fail" section — sharp, short, sets up the aha.
 * Scroll-triggered: two claims diverge from a single point (enacting "drift").
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingDown, AlertTriangle } from 'lucide-react';

interface ProblemSectionProps {
  reducedMotion: boolean;
}

const PROBLEMS = [
  {
    icon: <Clock size={16} />,
    color: '#f59e0b',
    title: 'You set a reminder. You ignore it.',
    body: 'Passive notifications don\'t know if you\'re 10% done or 90% done. They fire the same regardless.',
  },
  {
    icon: <TrendingDown size={16} />,
    color: '#ef4444',
    title: 'Your self-reports drift from reality.',
    body: 'When you say "60% done," that number came from your optimism, not from behavioral evidence. The gap compounds silently.',
  },
  {
    icon: <AlertTriangle size={16} />,
    color: '#f97316',
    title: 'Conflicts get silently dropped.',
    body: 'When two deadlines overlap, most tools reschedule both automatically and pretend the problem doesn\'t exist.',
  },
];

const ProblemSection: React.FC<ProblemSectionProps> = ({ reducedMotion }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return (
    <section ref={ref} id="problem" className="py-20 sm:py-28 px-5 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <p className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: '#ef4444' }}>The problem</p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            A speedometer tells you how fast you're going.<br />
            <span style={{ color: 'var(--text-muted)' }}>It doesn't tell you if you're headed off a cliff.</span>
          </h2>
          <p className="text-base leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Productivity tools are built around self-reported numbers and passive reminders.
            Neither one tracks where you're actually going.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-card)', border: `1px solid ${p.color}22` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${p.color}14`, color: p.color }}>
                {p.icon}
              </div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{p.title}</h3>
              <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--text-muted)' }}>{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
