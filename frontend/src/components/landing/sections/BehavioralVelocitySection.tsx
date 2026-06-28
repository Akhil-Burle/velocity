/**
 * BehavioralVelocitySection.tsx
 * THE core differentiator section. Shows the Drift Score, Deadline Physics,
 * Velocity Vector live-animated, and Trust Decay — all with real design tokens.
 *
 * The Deadline Physics curve STEEPENS as you watch — this is the "show don't tell"
 * moment. The Drift Score numbers diverge from a shared starting point (claimed
 * vs real) as the section enters view, literally enacting the concept of drift.
 *
 * Physics-based easing throughout: spring/overshoot for the divergence moment,
 * cubic-bezier [0.16,1,0.3,1] for curve reveals.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown } from 'lucide-react';

interface BehavioralVelocitySectionProps {
  reducedMotion: boolean;
}

// Build a pace curve SVG path — same algorithm as DeadlinePhysics.tsx
function buildPaceCurve(daysLeft: number, requiredRate: number, pts = 14) {
  if (daysLeft <= 0) return Array.from({ length: pts }, (_, i) => ({ x: i / (pts - 1), y: 1 }));
  const result = [];
  for (let i = 0; i < pts; i++) {
    const t = (i / (pts - 1)) * daysLeft;
    const remaining = Math.max(daysLeft - t, 0.01);
    const remainingWork = Math.max(100 - (requiredRate * t), 5);
    const futurePace = remainingWork / remaining;
    result.push({ x: i / (pts - 1), y: futurePace });
  }
  const maxY = Math.max(...result.map(p => p.y), 0.01);
  return result.map(p => ({ x: p.x, y: p.y / maxY }));
}

function curveToPath(points: { x: number; y: number }[], w: number, h: number) {
  if (points.length < 2) return '';
  const pts = points.map(p => ({ x: p.x * w, y: h - p.y * h }));
  return pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
}

/** Live-steepening deadline physics demo */
const DeadlinePhysicsDemo: React.FC<{ triggered: boolean; reducedMotion: boolean }> = ({ triggered, reducedMotion }) => {
  const W = 260, H = 80;
  const [phase, setPhase] = useState(0); // 0=slack, 1=accelerating, 2=critical

  useEffect(() => {
    if (!triggered) { setPhase(0); return; }
    if (reducedMotion) { setPhase(2); return; }
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [triggered, reducedMotion]);

  const configs = [
    { daysLeft: 14, requiredRate: 4, color: '#22c55e', label: 'Gradual', status: 'GREEN' },
    { daysLeft: 4, requiredRate: 14, color: '#f59e0b', label: 'Accelerating', status: 'AMBER' },
    { daysLeft: 0.8, requiredRate: 60, color: '#ef4444', label: 'Steepening ↑', status: 'RED' },
  ];
  const cfg = configs[phase];
  const curve = buildPaceCurve(cfg.daysLeft, cfg.requiredRate);
  const pathD = curveToPath(curve, W, H);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: `1px solid ${cfg.color}28` }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: cfg.color }}>Deadline Physics</span>
        <motion.span
          key={phase}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: `${cfg.color}14`, color: cfg.color, border: `1px solid ${cfg.color}28` }}
        >{cfg.label}</motion.span>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--text-faint)' }}>Required pace to finish on time — now vs. if you wait</p>
        <svg width={W} height={H} style={{ overflow: 'visible' }}>
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1.5} strokeLinecap="round" />
          <motion.path
            key={phase}
            d={pathD} fill="none" stroke={cfg.color} strokeWidth={2} strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: phase === 2 ? `drop-shadow(0 0 4px ${cfg.color}88)` : 'none' }}
          />
          {curve.length > 0 && (
            <motion.circle
              cx={W - 1} cy={H - curve[curve.length - 1].y * H} r={phase === 2 ? 4 : 3} fill={cfg.color}
              animate={phase >= 1 ? { opacity: [0.5, 1, 0.5], r: [2.5, 4.5, 2.5] } : { opacity: 1 }}
              transition={{ duration: phase === 2 ? 0.6 : 1.2, repeat: Infinity }}
            />
          )}
          <text x={4} y={H - 4} fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="JetBrains Mono, monospace">now</text>
          <text x={W - 24} y={H - 4} fontSize="9" fill={cfg.color} fontFamily="JetBrains Mono, monospace">deadline</text>
        </svg>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
            {phase === 0 ? '4%/day needed — easy pace' : phase === 1 ? '14%/day — behind, needs push' : '60%/day — physically impossible'}
          </span>
        </div>
      </div>
    </div>
  );
};

/** Drift Score — claimed vs real diverging from a single point */
const DriftScoreDemo: React.FC<{ triggered: boolean; reducedMotion: boolean }> = ({ triggered, reducedMotion }) => {
  const [claimed, setClaimed] = useState(50);
  const [real, setReal] = useState(50);

  useEffect(() => {
    if (!triggered) { setClaimed(50); setReal(50); return; }
    if (reducedMotion) { setClaimed(72); setReal(38); return; }
    // Both start at 50, then diverge with a spring-like overshoot
    const steps = [
      [52, 49], [56, 46], [61, 43], [66, 41], [70, 39], [72, 38],
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach(([c, r], i) => {
      timers.push(setTimeout(() => { setClaimed(c); setReal(r); }, 180 + i * 220));
    });
    return () => timers.forEach(clearTimeout);
  }, [triggered, reducedMotion]);

  const gap = claimed - real;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.22)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Behavioral Drift Score</span>
        <motion.span
          key={gap}
          initial={{ scale: 1.2, color: '#ef4444' }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >−{gap}% drift</motion.span>
      </div>

      <div className="space-y-2.5">
        {/* Claimed bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Self-reported</span>
            <motion.span className="text-[10px] font-mono font-bold" style={{ color: '#38bdf8' }}>
              {claimed}%
            </motion.span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div className="h-full rounded-full" style={{ background: '#38bdf8' }}
              animate={{ width: `${claimed}%` }}
              transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
        {/* Real inferred bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Behavioral estimate</span>
            <motion.span className="text-[10px] font-mono font-bold" style={{ color: '#22c55e' }}>
              {real}%
            </motion.span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div className="h-full rounded-full" style={{ background: '#22c55e' }}
              animate={{ width: `${real}%` }}
              transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      </div>

      {gap > 10 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 pt-2.5 flex items-start gap-2"
          style={{ borderTop: '1px solid rgba(239,68,68,0.15)' }}>
          <TrendingDown size={11} style={{ color: '#ef4444', marginTop: 1, flexShrink: 0 }} />
          <span className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {gap}% overreporting detected. Pace forecasts adjusted. Deadline risk elevated.
          </span>
        </motion.div>
      )}
    </div>
  );
};

/** Velocity Vector mini visual */
const VelocityVectorMini: React.FC<{ triggered: boolean; reducedMotion: boolean }> = ({ triggered, reducedMotion }) => {
  const svgSize = 80;
  const cx = svgSize / 2, cy = svgSize / 2;
  const angle = 28;
  const rad = ((angle - 90) * Math.PI) / 180;
  const len = 28;
  const ex = cx + Math.cos(rad) * len;
  const ey = cy + Math.sin(rad) * len;
  const headLen = 7;
  const ha = 0.38;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(34,197,94,0.18)' }}>
      <span className="text-[10px] font-mono uppercase tracking-widest block mb-2" style={{ color: 'var(--text-faint)' }}>Velocity Vector</span>
      <div className="flex items-center gap-3">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} aria-hidden="true">
          <circle cx={cx} cy={cy} r={svgSize * 0.42} fill="rgba(34,197,94,0.05)" stroke="rgba(34,197,94,0.15)" strokeWidth={0.5} />
          <motion.line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#22c55e" strokeWidth={2} strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={triggered ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }} />
          <motion.polyline
            points={`${(ex - headLen * Math.cos(rad - ha)).toFixed(1)},${(ey - headLen * Math.sin(rad - ha)).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${(ex - headLen * Math.cos(rad + ha)).toFixed(1)},${(ey - headLen * Math.sin(rad + ha)).toFixed(1)}`}
            fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            initial={{ opacity: 0 }} animate={triggered ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, delay: 0.5 }} />
          <circle cx={cx} cy={cy} r={3} fill="#22c55e" />
        </svg>
        <div>
          <div className="text-xs font-bold mb-0.5" style={{ color: '#22c55e' }}>On vector</div>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>78% magnitude</div>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>82% aligned</div>
        </div>
      </div>
      <p className="text-[10px] font-mono mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Direction penalized by drift. You're producing — but toward deadline?
      </p>
    </div>
  );
};

const BehavioralVelocitySection: React.FC<BehavioralVelocitySectionProps> = ({ reducedMotion }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.18 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  const fadeUp = (delay: number) => ({
    initial: reducedMotion ? {} : { opacity: 0, y: 30 },
    animate: visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
    transition: { duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] },
  });

  return (
    <section ref={ref} id="behavioral-velocity" className="py-20 sm:py-28 px-5 sm:px-8"
      style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(34,197,94,0.02) 50%, transparent 100%)' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div {...fadeUp(0)} className="mb-12 max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: '#22c55e' }}>
            The core differentiator
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Behavioral Velocity System
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Velocity doesn't trust what you say. It watches what you do — subtask completion rates,
            check-in language, how often you hit Panic Mode — and infers a behavioral trajectory
            separate from your self-reported number. The gap between the two is your Drift Score.
          </p>
          <p className="text-sm leading-relaxed mt-3 font-mono" style={{ color: 'var(--text-muted)' }}>
            This is why it's called Velocity. Not speed — direction plus magnitude. High activity with
            behavioral drift pulling you off-course shows up as a misaligned vector, not just a slow clock.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div {...fadeUp(0.1)}>
            <h3 className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>
              Watch the curve steepen ↓
            </h3>
            <DeadlinePhysicsDemo triggered={visible} reducedMotion={reducedMotion} />
          </motion.div>
          <motion.div {...fadeUp(0.18)}>
            <h3 className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>
              Claimed vs. behavioral reality ↓
            </h3>
            <DriftScoreDemo triggered={visible} reducedMotion={reducedMotion} />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <motion.div {...fadeUp(0.25)}>
            <VelocityVectorMini triggered={visible} reducedMotion={reducedMotion} />
          </motion.div>

          {/* Trust Decay explanation card */}
          <motion.div {...fadeUp(0.3)}
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(251,188,4,0.18)' }}>
            <span className="text-[10px] font-mono uppercase tracking-widest block mb-2" style={{ color: '#fbbc04' }}>Trust Decay</span>
            <p className="text-xs font-mono leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
              Every day without a check-in, your reported progress loses credibility.
              Velocity subtracts a staleness penalty from the displayed number — so a task
              you marked "80% done" three days ago shows as lower until you confirm it.
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Day 0 — check-in', val: 80, color: '#22c55e' },
                { label: 'Day 2 — no update', val: 65, color: '#f59e0b' },
                { label: 'Day 4 — stale', val: 48, color: '#ef4444' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono w-28 shrink-0" style={{ color: 'var(--text-faint)' }}>{label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={visible ? { width: `${val}%` } : { width: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                  <span className="text-[10px] font-mono w-7 text-right" style={{ color }}>{val}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BehavioralVelocitySection;
