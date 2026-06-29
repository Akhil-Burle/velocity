/**
 * VelocityBento.tsx
 * The visual centerpiece: an asymmetric bento grid demonstrating the Behavioral
 * Velocity System with live, scroll-triggered fidelity. Theme-aware.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Activity, Gauge, Clock } from 'lucide-react';
import { EASE, Reveal, Eyebrow, glass, useReveal, useIsDark, pal, GRADIENT_TEXT } from './_landingShared';

// ── shared curve maths (deadline physics) ──────────────────────────────────────
function buildCurve(daysLeft: number, reqRate: number, pts = 16) {
  if (daysLeft <= 0) return Array.from({ length: pts }, (_, i) => ({ x: i / (pts - 1), y: 1 }));
  const res: { x: number; y: number }[] = [];
  for (let i = 0; i < pts; i++) {
    const t = (i / (pts - 1)) * daysLeft;
    const rem = Math.max(daysLeft - t, 0.01);
    const work = Math.max(100 - reqRate * t, 5);
    res.push({ x: i / (pts - 1), y: work / rem });
  }
  const maxY = Math.max(...res.map((p) => p.y), 0.01);
  return res.map((p) => ({ x: p.x, y: p.y / maxY }));
}
function curvePath(pts: { x: number; y: number }[], w: number, h: number) {
  const mapped = pts.map((p) => ({ x: p.x * w, y: h - p.y * h }));
  return mapped.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = mapped[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${d} C${cx} ${prev.y.toFixed(1)},${cx} ${p.y.toFixed(1)},${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
}
const track = (isDark: boolean) => (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)');

// ── Divergence mini-chart (claimed vs behavioral over check-ins) ────────────────
const DivergenceMini: React.FC<{ play: boolean; reducedMotion: boolean; isDark: boolean }> = ({ play, reducedMotion, isDark }) => {
  const W = 300, H = 76;
  const claimed = [52, 58, 63, 68, 72];
  const real = [50, 47, 44, 41, 39];
  const toPts = (arr: number[]) => arr.map((v, i) => `${(i / (arr.length - 1)) * W},${H - ((v - 30) / 50) * H}`).join(' ');
  const areaPts = `${claimed.map((v, i) => `${(i / (claimed.length - 1)) * W},${H - ((v - 30) / 50) * H}`).join(' ')} ${real.map((v, i) => `${((real.length - 1 - i) / (real.length - 1)) * W},${H - ((real[real.length - 1 - i] - 30) / 50) * H}`).join(' ')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <motion.polygon points={areaPts} fill="#ef4444"
        initial={{ opacity: 0 }} animate={{ opacity: play ? 0.1 : 0 }} transition={{ duration: 0.8, delay: 0.6 }} />
      <motion.polyline points={toPts(claimed)} fill="none" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: play ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 1, ease: EASE }} />
      <motion.polyline points={toPts(real)} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: play ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 1, ease: EASE, delay: 0.15 }} />
    </svg>
  );
};

// ── Tile: Drift Score (large) ───────────────────────────────────────────────────
const DriftTile: React.FC<{ reducedMotion: boolean; isDark: boolean }> = ({ reducedMotion, isDark }) => {
  const { ref, inView } = useReveal(0.35);
  const p = pal(isDark);
  const [claimed, setClaimed] = useState(50);
  const [real, setReal] = useState(50);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) { setClaimed(72); setReal(39); return; }
    const steps: [number, number][] = [[56, 48], [62, 45], [67, 42], [70, 40], [72, 39]];
    const timers = steps.map(([c, r], i) => setTimeout(() => { setClaimed(c); setReal(r); }, 350 + i * 260));
    return () => timers.forEach(clearTimeout);
  }, [inView, reducedMotion]);

  const gap = claimed - real;

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="h-full rounded-3xl p-6 sm:p-7 flex flex-col" style={glass('#ef4444', isDark, 0.2)}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.14)', color: '#ef4444' }}>
            <Gauge size={17} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: p.text }}>Drift Score</div>
            <div className="text-[10px] font-mono" style={{ color: p.textFaint }}>claimed vs. behavioral reality</div>
          </div>
        </div>
        <motion.span key={gap} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}
          className="text-xs font-mono px-3 py-1 rounded-full font-bold"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.28)' }}>
          −{gap}% drift
        </motion.span>
      </div>

      <div className="space-y-4">
        {[{ label: 'Self-reported progress', val: claimed, color: '#38bdf8' }, { label: 'Behavioral estimate', val: real, color: '#22c55e' }].map(({ label, val, color }) => (
          <div key={label}>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-mono" style={{ color: p.textMute }}>{label}</span>
              <span className="text-2xl font-black font-mono leading-none" style={{ color }}>{val}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: track(isDark) }}>
              <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}77, ${color})` }}
                animate={{ width: `${val}%` }} transition={{ duration: reducedMotion ? 0 : 0.55, ease: EASE }} />
            </div>
          </div>
        ))}
      </div>

      {/* divergence over the last 5 check-ins — fills the tall tile */}
      <div className="mt-6 pt-5 flex-1 flex flex-col" style={{ borderTop: `1px solid ${p.hairline}` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: p.textFaint }}>Divergence · last 5 check-ins</span>
          <div className="flex items-center gap-3 text-[9px] font-mono">
            <span className="flex items-center gap-1" style={{ color: '#38bdf8' }}><span className="w-2 h-0.5 rounded" style={{ background: '#38bdf8' }} />claimed</span>
            <span className="flex items-center gap-1" style={{ color: '#22c55e' }}><span className="w-2 h-0.5 rounded" style={{ background: '#22c55e' }} />real</span>
          </div>
        </div>
        <div className="flex-1 flex items-center">
          <DivergenceMini play={inView} reducedMotion={reducedMotion} isDark={isDark} />
        </div>
      </div>

      <div className="mt-4 pt-4 flex items-start gap-2 text-[11px] font-mono"
        style={{ borderTop: `1px solid rgba(239,68,68,0.14)`, color: p.textMute }}>
        <TrendingDown size={13} className="text-red-400 mt-0.5 shrink-0" />
        <span>{gap}% overreporting detected. Forecast adjusted automatically — every intervention is driven by this gap.</span>
      </div>
    </div>
  );
};

// ── Tile: Velocity Vector ────────────────────────────────────────────────────────
const VectorTile: React.FC<{ reducedMotion: boolean; isDark: boolean }> = ({ reducedMotion, isDark }) => {
  const { ref, inView } = useReveal(0.5);
  const p = pal(isDark);
  const show = inView || reducedMotion;
  const cx = 60, cy = 60, len = 40, angle = -38 * (Math.PI / 180);
  const ex = cx + Math.cos(angle) * len;
  const ey = cy + Math.sin(angle) * len;
  const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)';

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="h-full rounded-3xl p-6 flex flex-col" style={glass('#22c55e', isDark, 0.22)}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.14)', color: '#22c55e' }}>
          <Activity size={15} />
        </div>
        <div className="text-sm font-bold" style={{ color: p.text }}>Velocity Vector</div>
      </div>
      <div className="flex-1 flex items-center justify-center py-2">
        <svg viewBox="0 0 120 120" width="100%" style={{ maxWidth: 150 }}>
          <defs>
            <linearGradient id="vecGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <marker id="vecHead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" fill="#38bdf8" />
            </marker>
          </defs>
          <circle cx={cx} cy={cy} r={44} fill="none" stroke={grid} strokeWidth={1} />
          <line x1={cx} y1={cy - 48} x2={cx} y2={cy + 48} stroke={grid} strokeWidth={1} />
          <line x1={cx - 48} y1={cy} x2={cx + 48} y2={cy} stroke={grid} strokeWidth={1} />
          <motion.line x1={cx} y1={cy} x2={ex} y2={ey}
            stroke="url(#vecGrad)" strokeWidth={3.5} strokeLinecap="round" markerEnd="url(#vecHead)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: reducedMotion ? 0 : 1, ease: EASE }} />
          <circle cx={cx} cy={cy} r={3} fill="#22c55e" />
        </svg>
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono pt-2" style={{ borderTop: `1px solid ${p.hairline}` }}>
        <span style={{ color: p.textFaint }}>magnitude</span>
        <span className="font-bold" style={{ color: isDark ? '#4ade80' : '#15803d' }}>78% · on vector</span>
      </div>
    </div>
  );
};

// ── Tile: Trust Decay ────────────────────────────────────────────────────────────
const TrustDecayTile: React.FC<{ reducedMotion: boolean; isDark: boolean }> = ({ reducedMotion, isDark }) => {
  const p = pal(isDark);
  const rows: [string, number, string][] = [
    ['Day 0 — checked in', 80, '#22c55e'],
    ['Day 2 — no update', 65, '#f59e0b'],
    ['Day 4 — stale', 48, '#ef4444'],
  ];
  return (
    <div className="h-full rounded-3xl p-6 flex flex-col" style={glass('#fbbf24', isDark, 0.2)}>
      <div className="text-sm font-bold mb-1" style={{ color: p.text }}>Trust Decay</div>
      <p className="text-[10px] font-mono mb-4" style={{ color: p.textFaint }}>
        Stale check-ins lose credibility — "80% done" four days ago reads as ~48%.
      </p>
      <div className="space-y-3 flex-1 flex flex-col justify-center">
        {rows.map(([label, val, color]) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: p.textFaint }}>
              <span>{label}</span><span style={{ color }}>{val}%</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: track(isDark) }}>
              <motion.div className="h-full rounded-full" style={{ background: color }}
                initial={{ width: '80%' }} whileInView={{ width: `${val}%` }} viewport={{ once: true }}
                transition={{ duration: reducedMotion ? 0 : 0.9, ease: EASE }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Tile: Deadline Physics (graph + phase legend, fills width) ──────────────────
const PHASES = [
  { days: 14, rate: 4, color: '#22c55e', label: '14 days left', status: 'Gradual', sub: '4%/day needed' },
  { days: 4, rate: 14, color: '#f59e0b', label: '4 days left', status: 'Accelerating', sub: '14%/day needed' },
  { days: 0.5, rate: 80, color: '#ef4444', label: '12 hours left', status: 'Steepening', sub: 'Physically critical' },
];

const PhysicsTile: React.FC<{ reducedMotion: boolean; isDark: boolean }> = ({ reducedMotion, isDark }) => {
  const { ref, inView } = useReveal(0.4);
  const p = pal(isDark);
  const [phase, setPhase] = useState(0);
  const W = 360, H = 150;

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) { setPhase(2); return; }
    const t1 = setTimeout(() => setPhase(1), 1300);
    const t2 = setTimeout(() => setPhase(2), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [inView, reducedMotion]);

  const cfg = PHASES[phase];
  const curve = buildCurve(cfg.days, cfg.rate);
  const pathD = curvePath(curve, W, H);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="rounded-3xl overflow-hidden h-full" style={glass(cfg.color, isDark, 0.22)}>
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr]">
        {/* graph */}
        <div className="p-6" style={{ borderRight: `1px solid ${p.hairline}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold" style={{ color: p.text }}>Deadline Physics</div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: cfg.color }}>{cfg.label} · {cfg.sub}</div>
            </div>
            <motion.div key={phase} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="px-3 py-1 rounded-full text-[10px] font-mono font-bold"
              style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              {cfg.status}
            </motion.div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', maxHeight: 150 }}>
            <path d={pathD} fill="none" stroke={track(isDark)} strokeWidth={2} />
            <motion.path key={phase} d={pathD} fill="none" stroke={cfg.color} strokeWidth={3}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.95, ease: EASE }}
              style={{ filter: phase === 2 ? `drop-shadow(0 0 6px ${cfg.color})` : undefined }} />
            {curve.length > 0 && (
              <motion.circle cx={W - 3} cy={H - curve[curve.length - 1].y * H} r={phase === 2 ? 6 : 4} fill={cfg.color}
                animate={phase >= 1 ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
                transition={{ duration: 0.8, repeat: Infinity }} />
            )}
          </svg>
          <div className="flex justify-between mt-2 text-[9px] font-mono uppercase tracking-widest" style={{ color: p.textDim }}>
            <span>now</span><span style={{ color: cfg.color }}>deadline</span>
          </div>
        </div>

        {/* phase legend */}
        <div className="p-6 flex flex-col justify-center gap-2.5">
          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono uppercase tracking-widest" style={{ color: p.textFaint }}>
            <Clock size={11} /> required pace, as time runs out
          </div>
          {PHASES.map((ph, i) => (
            <div key={ph.status}
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{
                background: i === phase ? `${ph.color}14` : 'transparent',
                border: `1px solid ${i === phase ? ph.color + '40' : p.hairline}`,
                opacity: i <= phase ? 1 : 0.45,
                transition: 'all 0.4s ease',
              }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: ph.color }} />
                <span className="text-xs font-semibold" style={{ color: p.text }}>{ph.status}</span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: i === phase ? ph.color : p.textFaint }}>{ph.sub}</span>
            </div>
          ))}
          <p className="text-[10px] font-mono leading-relaxed mt-1" style={{ color: p.textFaint }}>
            The curve isn't linear. Each day you slip, the pace you need to recover gets steeper — fast.
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Section ─────────────────────────────────────────────────────────────────────
const VelocityBento: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const isDark = useIsDark();
  const p = pal(isDark);
  return (
    <section id="behavioral-velocity" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8"
      style={{ background: `radial-gradient(ellipse 60% 40% at 50% 40%, rgba(34,197,94,${isDark ? 0.045 : 0.05}) 0%, transparent 70%)` }}>
      <div className="max-w-6xl mx-auto">
        <Reveal variant="blur" reducedMotion={reducedMotion} className="mb-14 max-w-2xl">
          <Eyebrow color="#22c55e">The core differentiator</Eyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 4.6vw, 3.6rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 18, color: p.text }}>
            The <span style={GRADIENT_TEXT}>Behavioral Velocity</span> System
          </h2>
          <p className="text-lg" style={{ color: p.textMute }}>
            Velocity doesn't trust what you say. It infers a separate behavioral trajectory from subtask completion,
            check-in sentiment, Panic Mode usage, and Omni-Bar urgency. The gap between the two is your{' '}
            <strong style={{ color: '#ef4444' }}>Drift Score</strong> — and it drives every intervention.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 auto-rows-auto">
          <Reveal variant="scale" reducedMotion={reducedMotion} className="lg:col-span-2 lg:row-span-2" style={{ display: 'grid' }}>
            <DriftTile reducedMotion={reducedMotion} isDark={isDark} />
          </Reveal>
          <Reveal variant="up" delay={0.08} reducedMotion={reducedMotion} style={{ display: 'grid' }}>
            <VectorTile reducedMotion={reducedMotion} isDark={isDark} />
          </Reveal>
          <Reveal variant="up" delay={0.16} reducedMotion={reducedMotion} style={{ display: 'grid' }}>
            <TrustDecayTile reducedMotion={reducedMotion} isDark={isDark} />
          </Reveal>
          <Reveal variant="up" delay={0.1} reducedMotion={reducedMotion} className="lg:col-span-3" style={{ display: 'grid' }}>
            <PhysicsTile reducedMotion={reducedMotion} isDark={isDark} />
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default VelocityBento;
