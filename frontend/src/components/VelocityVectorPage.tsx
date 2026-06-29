/**
 * VelocityVectorPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 4 — Full "Velocity Vector" deep-link view.
 *
 * Accessible at /velocity-vector. Shows why the product is called "Velocity":
 *   - The vector visualization (magnitude + direction)
 *   - Which tasks are dragging the vector
 *   - Drift Score breakdown per task
 *   - The gap between claimed and real progress — visualized
 *
 * All data is derived from Phase 1 (drift batch) — no new data collection.
 * This is the "See why we're called Velocity" experience.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, TrendingDown, TrendingUp, Minus, AlertTriangle, Zap,
  RefreshCw, ArrowRight, Brain, Clock, Target, ShieldAlert, Gauge,
} from 'lucide-react';
import { computeDriftScoreBatch, DriftBatchResult, DriftScore, VelocityVector } from '../api';
import { useTheme } from '../ThemeContext';
import InfoTooltip from './InfoTooltip';

// ── SVG vector arrow (full size version) ─────────────────────────────────────
const BigVectorArrow: React.FC<{
  magnitude: number;
  direction: string;
  alignment: number;
}> = ({ magnitude, direction, alignment }) => {
  const color  = direction === 'good' ? '#22c55e' : direction === 'mixed' ? '#f59e0b' : '#ef4444';
  const angle  = direction === 'good' ? 10 : direction === 'mixed' ? 40 : 70;
  const S = 120;
  const len    = (magnitude / 100) * S * 0.62 + S * 0.18;
  const rad    = ((angle - 90) * Math.PI) / 180;
  const cx = S / 2, cy = S / 2;
  const ex = cx + Math.cos(rad) * len;
  const ey = cy + Math.sin(rad) * len;
  const headLen = 10;
  const headAngle = 0.45;
  const ax1 = ex - headLen * Math.cos(rad - headAngle);
  const ay1 = ey - headLen * Math.sin(rad - headAngle);
  const ax2 = ex - headLen * Math.cos(rad + headAngle);
  const ay2 = ey - headLen * Math.sin(rad + headAngle);

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
      {/* Background circles */}
      <circle cx={cx} cy={cy} r={S * 0.45} fill={`${color}06`} stroke={`${color}14`} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={S * 0.28} fill={`${color}0a`} stroke={`${color}1a`} strokeWidth={0.5} />
      {/* Velocity shaft */}
      <motion.line
        x1={cx} y1={cy} x2={cx} y2={cy}
        animate={{ x2: ex, y2: ey }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
      />
      {/* Arrowhead */}
      <motion.polyline
        points={`${cx},${cy} ${cx},${cy} ${cx},${cy}`}
        animate={{ points: `${ax1.toFixed(1)},${ay1.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}` }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Origin dot */}
      <circle cx={cx} cy={cy} r={4} fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      {/* "Ideal" dashed line pointing straight up */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - S * 0.42}
        stroke={`${color}28`} strokeWidth={1} strokeDasharray="4 3" />
    </svg>
  );
};

// ── Drift task row ─────────────────────────────────────────────────────────────
const DriftRow: React.FC<{ score: DriftScore; isDark: boolean; index: number }> = ({ score, isDark, index }) => {
  const { taskName, selfReported, inferredReal, gap, confidence, explanation } = score;
  const absGap = Math.abs(gap);
  const isOverreporting = gap < -5;
  const color = absGap > 25 ? '#ef4444' : absGap > 10 ? '#f59e0b' : '#22c55e';
  const [expanded, setExpanded] = useState(false);

  if (confidence === 'sparse') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.8)',
        border: `1px solid ${color}22`,
      }}
    >
      <button
        className="w-full text-left px-4 py-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Gap indicator */}
          <div className="flex flex-col items-center shrink-0 w-12">
            <span className="font-mono font-black text-lg leading-none" style={{ color }}>
              {isOverreporting ? '-' : '+'}{absGap}
            </span>
            <span className="text-[8px] font-mono" style={{ color: `${color}88` }}>drift</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {taskName}
              </span>
              {confidence === 'high' && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${color}14`, color, border: `1px solid ${color}28` }}>
                  high confidence
                </span>
              )}
            </div>

            {/* Dual progress bar */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono w-16 shrink-0" style={{ color: 'var(--text-faint)' }}>Reported</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }}>
                  <motion.div className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${selfReported}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.06 }}
                    style={{ background: 'rgba(255,255,255,0.25)' }} />
                </div>
                <span className="text-[10px] font-mono w-8 text-right" style={{ color: 'var(--text-secondary)' }}>
                  {selfReported}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono w-16 shrink-0" style={{ color: 'var(--text-faint)' }}>Real est.</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }}>
                  <motion.div className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${inferredReal}%` }}
                    transition={{ duration: 0.6, delay: 0.3 + index * 0.06 }}
                    style={{ background: `linear-gradient(90deg,${color}66,${color})` }} />
                </div>
                <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>
                  {inferredReal}%
                </span>
              </div>
              {/* Signal chips — always visible */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {[
                  { key: 'subtask', label: 'subtask', val: score.signals?.subtask },
                  { key: 'staleness', label: 'stale', val: score.signals?.staleness },
                  { key: 'panic', label: 'panic', val: score.signals?.panic },
                  { key: 'language', label: 'lang', val: score.signals?.language },
                ].filter(s => s.val !== null && s.val !== undefined && s.val !== 0).map(sig => {
                  const v = sig.val as number;
                  const c = v > 0 ? '#22c55e' : '#ef4444';
                  return (
                    <span key={sig.key} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: `${c}0f`, color: c, border: `1px solid ${c}22` }}>
                      {sig.label} {v > 0 ? '+' : ''}{v}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Expand chevron */}
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.18 }}>
            <ArrowRight size={12} style={{ color: 'var(--text-faint)' }} />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0 space-y-1.5"
              style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}` }}>
              <div className="text-[9px] font-mono uppercase tracking-wider pt-2" style={{ color: 'var(--text-faint)' }}>
                Signal breakdown
              </div>
              {explanation.map((line, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span style={{ color, marginTop: 1 }}><Activity size={8} /></span>
                  <span className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const VelocityVectorPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState<DriftBatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await computeDriftScoreBatch();
      setData(result);
      setLastFetch(new Date());
    } catch (e) {
      console.warn('[VelocityVector] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const vector: VelocityVector | null = data?.velocityVector ?? null;
  const scores: DriftScore[] = (data?.driftScores ?? [])
    .filter(s => s.confidence !== 'sparse' && Math.abs(s.gap) > 3)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const dirColor = vector
    ? (vector.direction === 'good' ? '#22c55e' : vector.direction === 'mixed' ? '#f59e0b' : '#ef4444')
    : '#22c55e';

  const surfaceBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.9)';
  const border    = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.08)';

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 pb-24">

      {/* ── How This Works ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 rounded-2xl overflow-hidden"
        style={{ background: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
          <Zap size={11} style={{ color: '#22c55e' }} />
          <span className="text-[10px] font-mono uppercase tracking-widest font-semibold" style={{ color: '#22c55e' }}>
            How This Works
          </span>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Behavioral signals collected',
              body: 'Every check-in, pace reading, and task update is logged. The AI infers your real progress from patterns — not just what you type.',
              color: '#22c55e',
            },
            {
              step: '02',
              title: 'Drift gap computed',
              body: 'Reported progress is compared to behavioral evidence. A large gap means you\'re over- or under-reporting — the "drift" score quantifies this.',
              color: '#f59e0b',
            },
            {
              step: '03',
              title: 'Vector calculated',
              body: 'Magnitude = how much real work is happening. Alignment = whether that work is pointed at your deadlines. Together they form your Velocity Vector.',
              color: '#38bdf8',
            },
          ].map(({ step, title, body, color }) => (
            <div key={step} className="flex gap-3">
              <span className="text-2xl font-black font-mono leading-none shrink-0 mt-0.5"
                style={{ color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)' }}>{step}</span>
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color }}>{title}</div>
                <div className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Velocity Vector
          </h1>
          <p className="text-sm mt-1 max-w-lg" style={{ color: 'var(--text-muted)' }}>
            Speed + direction in one view. Your true trajectory toward deadlines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[9px] font-mono hidden sm:block" style={{ color: 'var(--text-faint)' }}>
              analyzed {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <motion.button
            onClick={load} disabled={loading}
            animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            whileHover={!loading ? { scale: 1.08 } : {}}
            whileTap={!loading ? { scale: 0.92 } : {}}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', opacity: loading ? 0.7 : 1 }}>
            <RefreshCw size={13} />
          </motion.button>
        </div>
      </div>

      {/* Portfolio summary stat bar */}
      {!loading && data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: 'Tasks Analyzed',
              value: data.driftScores.filter(s => s.confidence !== 'sparse').length,
              color: 'var(--text-primary)',
              icon: <Target size={11} />,
              tip: 'Active tasks with enough behavioral signals to compute a real progress estimate.',
            },
            {
              label: 'Avg Drift Gap',
              value: data.driftScores.length
                ? `${Math.round(data.driftScores.reduce((s, d) => s + Math.abs(d.gap), 0) / data.driftScores.length)}%`
                : '—',
              color: '#f59e0b',
              icon: <Gauge size={11} />,
              tip: 'Average absolute gap between reported and AI-inferred progress across all tasks.',
            },
            {
              label: 'Overreporting',
              value: data.driftScores.filter(s => s.gap < -5).length,
              color: '#ef4444',
              icon: <TrendingDown size={11} />,
              tip: 'Tasks where you claimed more progress than behavioral signals support.',
            },
            {
              label: 'On Signal',
              value: data.driftScores.filter(s => Math.abs(s.gap) <= 5).length,
              color: '#22c55e',
              icon: <TrendingUp size={11} />,
              tip: 'Tasks where reported progress aligns with behavioral signals (gap ≤ 5%).',
            },
          ].map(({ label, value, color, icon, tip }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05 }}
              className="rounded-xl p-3.5"
              style={{ background: surfaceBg, border: `1px solid ${border}` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span style={{ color }}>{icon}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
                <InfoTooltip size={9} explanation={tip} />
              </div>
              <div className="font-black font-mono text-xl leading-none" style={{ color }}>{value}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-12">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-green-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }} />
          ))}
          <span className="text-sm font-mono" style={{ color: 'var(--text-faint)' }}>
            Analyzing behavioral signals…
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-wrap">
          {/* Left — Vector visualization */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl p-6 flex flex-col items-center"
              style={{ background: surfaceBg, border: `1px solid ${dirColor}28` }}
            >
              {vector ? (
                <>
                  <div data-tour="tour-vector-arrow">
                  <BigVectorArrow
                    magnitude={vector.magnitude}
                    direction={vector.direction}
                    alignment={vector.alignment}
                  />
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-xl font-black" style={{ color: dirColor }}>
                      {vector.direction === 'good' ? 'On Vector' : vector.direction === 'mixed' ? 'Drift Detected' : 'Off Course'}
                    </div>
                    <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-faint)' }}>
                      {vector.alignment}% aligned with deadlines
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-5 w-full">
                    <div className="text-center p-2 rounded-lg"
                      style={{ background: `${dirColor}0a`, border: `1px solid ${dirColor}18` }}>
                      <div className="text-lg font-black font-mono" style={{ color: dirColor }}>{vector.magnitude}%</div>
                      <div className="flex items-center justify-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                        magnitude
                        <InfoTooltip size={10} explanation="How much active work is actually getting done across all tasks — combines velocity rate and completion progress." />
                      </div>
                    </div>
                    <div className="text-center p-2 rounded-lg"
                      style={{ background: `${dirColor}0a`, border: `1px solid ${dirColor}18` }}>
                      <div className="text-lg font-black font-mono" style={{ color: dirColor }}>{vector.alignment}%</div>
                      <div className="flex items-center justify-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                        alignment
                        <InfoTooltip size={10} explanation="How closely your behavioral signals point toward your deadlines — penalized when self-reported progress exceeds what activity patterns support." />
                      </div>
                    </div>
                  </div>

                  {/* Physics lesson */}
                  <div className="mt-4 p-3 rounded-xl text-center"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                              border: `1px solid ${border}` }}>
                    <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                      <span style={{ color: dirColor }}>v = speed + direction</span><br />
                      Speed: how much you report done.<br />
                      Direction: where behavioral signals say you're actually going.
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <span className="text-sm font-mono" style={{ color: 'var(--text-faint)' }}>No active tasks</span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right — Per-task breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <div data-tour="tour-drift-section" className="inline-flex items-center gap-2 mb-2">
              <Activity size={11} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                Tasks dragging the vector
              </span>
              {scores.length > 0 && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
                  {scores.filter(s => s.gap < -10).length} with significant gaps
                </span>
              )}
            </div>

            {scores.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 py-12 rounded-2xl"
                style={{ background: surfaceBg, border: `1px solid ${border}` }}>
                <Zap size={24} style={{ color: '#22c55e', opacity: 0.5 }} />
                <span className="text-sm font-mono" style={{ color: 'var(--text-faint)' }}>
                  No significant drift detected — behavioral signals align with reported progress
                </span>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {scores.map((score, i) => (
                  <DriftRow key={score.taskId} score={score} isDark={isDark} index={i} />
                ))}
              </div>
            )}

            {/* What this means — removed, covered by top How This Works banner */}
          </div>

          {/* Worst Offenders — velocity rate vs required rate */}
          {vector && vector.worstOffenders.length > 0 && (
            <div className="lg:col-span-3 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={11} style={{ color: '#ef4444' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  Velocity Rate vs Required — tasks falling behind
                </span>
                <InfoTooltip size={9} explanation="Compares how fast each task is actually progressing (velocity rate) against the pace needed to finish on time (required rate). A red gap means the task will miss its deadline at current pace." />
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ background: surfaceBg, border: `1px solid ${border}` }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${border}` }}>
                      {['Task', 'Status', 'Velocity', 'Required', 'Gap', 'On-Time Prob.'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[9px] font-mono uppercase tracking-wider"
                          style={{ color: 'var(--text-faint)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vector.worstOffenders.map((o, i) => {
                      const rateGap = o.velocityRate - o.requiredRate;
                      const gapColor = rateGap >= 0 ? '#22c55e' : rateGap >= -10 ? '#f59e0b' : '#ef4444';
                      const statusColor = o.status === 'RED' ? '#ef4444' : o.status === 'AMBER' ? '#f59e0b' : '#22c55e';
                      const probColor = o.probability >= 70 ? '#22c55e' : o.probability >= 45 ? '#f59e0b' : '#ef4444';
                      return (
                        <motion.tr key={o.taskId}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          style={{ borderBottom: i < vector.worstOffenders.length - 1 ? `1px solid ${border}` : 'none' }}>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {o.taskName.length > 28 ? o.taskName.slice(0, 26) + '…' : o.taskName}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: `${statusColor}14`, color: statusColor, border: `1px solid ${statusColor}28` }}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                              {o.velocityRate}%/d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
                              {o.requiredRate}%/d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {rateGap >= 0
                                ? <TrendingUp size={10} style={{ color: '#22c55e' }} />
                                : <TrendingDown size={10} style={{ color: '#ef4444' }} />}
                              <span className="text-xs font-mono font-bold" style={{ color: gapColor }}>
                                {rateGap > 0 ? '+' : ''}{rateGap}%/d
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full overflow-hidden"
                                style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                                <motion.div className="h-full rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${o.probability}%` }}
                                  transition={{ duration: 0.6, delay: i * 0.05 }}
                                  style={{ background: probColor }} />
                              </div>
                              <span className="text-[10px] font-mono font-bold" style={{ color: probColor }}>
                                {o.probability}%
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VelocityVectorPage;
