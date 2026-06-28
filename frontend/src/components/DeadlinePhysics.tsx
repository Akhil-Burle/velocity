/**
 * DeadlinePhysics.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2 — Deadline Physics visual layer.
 *
 * Renders a small embedded sparkline/curve showing required pace acceleration
 * over the remaining time window. Flat and gentle when there's slack,
 * visibly steep near the deadline.
 *
 * REUSES the exact pace numbers already calculated by paceEngine.js —
 * this is a rendering change only, not a new calculation engine.
 *
 * Also applies physical-feeling CSS animations to the card border glow as
 * urgency rises — faster pulse, accelerating color transition.
 *
 * Design contract:
 *   - Same color tokens as existing status system (green/amber/red)
 *   - CSS/SVG driven — no new heavy calculations per frame
 *   - Reads from already-computed pace values passed as props
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface DeadlinePhysicsProps {
  daysToDeadline: number;  // from computePaceMetrics()
  requiredRate: number;    // %/day needed — from computePaceMetrics()
  velocityRate: number;    // %/day actual — from computePaceMetrics()
  status: string;          // GREEN | AMBER | RED
  completionPercent: number;
  isDark?: boolean;
}

// Compute how steep the required pace curve is over the remaining window
// Returns an array of N SVG points for the sparkline
function buildPaceCurve(daysLeft: number, requiredRate: number, points = 12): { x: number; y: number }[] {
  if (daysLeft <= 0) return Array.from({ length: points }, (_, i) => ({ x: i / (points - 1), y: 1 }));

  // y = how steep the required pace WOULD BE at each future moment
  // The closer to the deadline, the higher required rate if you haven't done the work
  // We model this as: requiredPace(t) ∝ 1 / (daysLeft - t), clamped
  const result = [];
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * daysLeft; // days elapsed from now
    const remaining = Math.max(daysLeft - t, 0.01);
    const remainingWork = Math.max(100 - (requiredRate * t), 5);
    const futurePace = remainingWork / remaining;
    result.push({ x: i / (points - 1), y: futurePace });
  }

  // Normalize y values to 0–1 for SVG
  const maxY = Math.max(...result.map(p => p.y), 0.01);
  return result.map(p => ({ x: p.x, y: p.y / maxY }));
}

// Map the curve to an SVG path
function curveToPath(points: { x: number; y: number }[], w: number, h: number): string {
  if (points.length < 2) return '';
  const pts = points.map(p => ({ x: p.x * w, y: h - p.y * h }));
  const d = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
  return d;
}

// How "urgent" is the physics? 0 = chill, 1 = terminal
function urgencyLevel(daysLeft: number, status: string): number {
  if (status === 'RED' && daysLeft < 1) return 1.0;
  if (status === 'RED') return 0.85;
  if (status === 'AMBER') return 0.5;
  if (daysLeft < 2) return 0.6;
  if (daysLeft < 5) return 0.3;
  return 0.1;
}

const STATUS_COLOR: Record<string, string> = {
  GREEN: '#22c55e',
  AMBER: '#f59e0b',
  RED:   '#ef4444',
};

const DeadlinePhysics: React.FC<DeadlinePhysicsProps> = ({
  daysToDeadline, requiredRate, velocityRate, status, completionPercent, isDark = true,
}) => {
  const W = 64, H = 24;
  const urgency = urgencyLevel(daysToDeadline, status);
  const color   = STATUS_COLOR[status] || '#22c55e';
  const isComplete = status === 'COMPLETE' || completionPercent >= 100;

  const curve = useMemo(
    () => buildPaceCurve(daysToDeadline, requiredRate),
    [daysToDeadline, requiredRate]
  );
  const pathD = useMemo(() => curveToPath(curve, W, H), [curve]);

  if (isComplete || daysToDeadline <= 0) return null;

  // Pulse animation speed — faster as urgency rises
  const pulseDuration = urgency > 0.8 ? 0.7 : urgency > 0.5 ? 1.2 : 2.5;
  // Whether the actual velocity is keeping up
  const onPace = velocityRate >= requiredRate * 0.8;

  return (
    <div className="flex items-center gap-2 mt-1.5">
      {/* Sparkline curve */}
      <div className="relative" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="overflow-visible">
          {/* Track line */}
          <path
            d={pathD}
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Actual pace curve */}
          <motion.path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={urgency > 0.6 ? 2 : 1.5}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: urgency > 0.1 ? 1 : 0.4 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              filter: urgency > 0.6 ? `drop-shadow(0 0 3px ${color}88)` : 'none',
            }}
          />
          {/* Endpoint dot — pulses if urgent */}
          <motion.circle
            cx={W - 1}
            cy={H - curve[curve.length - 1].y * H}
            r={urgency > 0.6 ? 2.5 : 1.5}
            fill={color}
            animate={urgency > 0.4 ? { opacity: [0.6, 1, 0.6], r: [1.5, 3, 1.5] } : { opacity: 1 }}
            transition={{ duration: pulseDuration, repeat: Infinity }}
          />
        </svg>
      </div>

      {/* Label */}
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-mono" style={{ color: `${color}bb` }}>
          {urgency > 0.7 ? 'steepening' : urgency > 0.4 ? 'accelerating' : 'gradual'}
        </span>
        {!onPace && (
          <motion.span
            className="text-[9px] font-mono"
            style={{ color: urgency > 0.6 ? '#ef4444' : '#f59e0b' }}
            animate={{ opacity: urgency > 0.7 ? [1, 0.4, 1] : 1 }}
            transition={{ duration: pulseDuration, repeat: Infinity }}
          >
            need {requiredRate}%/d
          </motion.span>
        )}
      </div>
    </div>
  );
};

export default DeadlinePhysics;
