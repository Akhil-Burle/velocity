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
import { Activity, TrendingDown, TrendingUp, Minus, AlertTriangle, Zap, RefreshCw, ArrowRight } from 'lucide-react';
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
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} style={{ color: '#22c55e' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              Why we're called Velocity
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Velocity Vector
          </h1>
          <p className="text-sm mt-1 max-w-lg" style={{ color: 'var(--text-muted)' }}>
            Velocity isn't speed — it's speed <em>plus direction</em>. This view shows your true trajectory:
            how much you're getting done AND whether your real behavioral signals are pointing toward your deadlines.
          </p>
        </div>
        <motion.button
          onClick={load}
          disabled={loading}
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
          style={{
            background: 'rgba(34,197,94,0.08)',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.2)',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={11} />
          Refresh
        </motion.button>
      </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* What this means */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl p-4"
              style={{ background: surfaceBg, border: `1px solid ${border}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={10} style={{ color: '#22c55e' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  How this works
                </span>
              </div>
              <p className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Velocity doesn't trust the speedometer. Every task's "real" progress is inferred from behavioral
                signals you're already producing — subtask completions, check-in staleness, Panic Mode usage,
                and language patterns in the OmniBar — not just what you type in. The gap between claimed and
                real is the drift. The vector is which direction all that drift, combined, is pointing.
              </p>
              {lastFetch && (
                <p className="text-[9px] font-mono mt-2" style={{ color: 'var(--text-faint)' }}>
                  Last analyzed: {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VelocityVectorPage;
