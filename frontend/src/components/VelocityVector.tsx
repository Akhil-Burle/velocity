/**
 * VelocityVector.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 4 — The Velocity Vector.
 *
 * A persistent header indicator showing the user's overall velocity as a
 * literal vector: magnitude (how much is getting done) AND direction (whether
 * trajectory aligns with deadlines, or whether real signals show drag).
 *
 * This is the brand payoff — velocity in physics is speed + direction.
 * High reported activity with behavioral drift pulling the vector off-course
 * is immediately visible here as a single glanceable indicator.
 *
 * Clicking deep-links to /velocity-vector for the full breakdown.
 *
 * Uses data already produced by Phase 1 (drift batch) — no new fetches.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Zap, X } from 'lucide-react';
import type { VelocityVector as VelocityVectorType } from '../api';
import InfoTooltip from './InfoTooltip';

interface VelocityVectorProps {
  vector: VelocityVectorType | null;
  isDark?: boolean;
  surfaceBorder?: string;
}

function directionAngle(direction: string, magnitude: number, alignment: number): number {
  // Angle from vertical (pointing up = perfect), measured in degrees
  // 'good' → 15° (nearly straight up)
  // 'mixed' → 45°
  // 'poor' → 80° (nearly horizontal — going sideways, not forward)
  if (direction === 'good')  return 15;
  if (direction === 'poor')  return 75;
  return 45;
}

function directionColor(direction: string): string {
  if (direction === 'good')  return '#22c55e';
  if (direction === 'mixed') return '#f59e0b';
  return '#ef4444';
}

function directionLabel(direction: string): string {
  if (direction === 'good')  return 'On vector';
  if (direction === 'mixed') return 'Drift detected';
  return 'Off course';
}

// SVG arrow component
const VectorArrow: React.FC<{
  angle: number;      // degrees from pointing straight up
  magnitude: number;  // 0–100 → arrow length
  color: string;
  size?: number;
}> = ({ angle, magnitude, color, size = 28 }) => {
  const len = (magnitude / 100) * (size * 0.65) + size * 0.2;
  const rad = ((angle - 90) * Math.PI) / 180; // convert to standard angle (0 = right)
  const cx = size / 2;
  const cy = size / 2;
  const ex = cx + Math.cos(rad) * len;
  const ey = cy + Math.sin(rad) * len;

  // Arrow head
  const headLen = 5;
  const headAngle = 0.4;
  const ax1 = ex - headLen * Math.cos(rad - headAngle);
  const ay1 = ey - headLen * Math.sin(rad - headAngle);
  const ax2 = ex - headLen * Math.cos(rad + headAngle);
  const ay2 = ey - headLen * Math.sin(rad + headAngle);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Glow circle */}
      <circle cx={cx} cy={cy} r={size * 0.42} fill={`${color}0d`} stroke={`${color}1a`} strokeWidth={0.5} />
      {/* Shaft */}
      <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      {/* Head */}
      <polyline points={`${ax1.toFixed(1)},${ay1.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}`}
        fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {/* Origin dot */}
      <circle cx={cx} cy={cy} r={1.5} fill={color} />
    </svg>
  );
};

const VelocityVectorIndicator: React.FC<VelocityVectorProps> = ({
  vector, isDark = true, surfaceBorder,
}) => {
  const navigate = useNavigate();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  if (!vector) return null;

  const { magnitude, direction, alignment, worstOffenders } = vector;
  const color  = directionColor(direction);
  const angle  = directionAngle(direction, magnitude, alignment);
  const label  = directionLabel(direction);
  const border = surfaceBorder || (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)');

  return (
    <div className="relative">
      <motion.button
        onClick={() => { navigate('/velocity-vector'); }}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
        style={{
          background: `${color}0d`,
          border: `1px solid ${color}28`,
        }}
        title="Velocity Vector — click to see full analysis"
      >
        <motion.div
          animate={direction === 'poor' ? { rotate: [0, 2, -2, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <VectorArrow angle={angle} magnitude={magnitude} color={color} size={22} />
        </motion.div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-[10px] font-mono font-bold leading-tight" style={{ color }}>
            {label}
          </span>
          <div className="flex items-center gap-0.5">
            <span className="text-[9px] font-mono" style={{ color: `${color}cc` }}>
              {alignment}% aligned
            </span>
            <InfoTooltip
              size={10}
              explanation="Deadline reachability penalized by how much self-reported progress exceeds behavioral signals — tasks can be 'On Pace' on the clock while this score is low if the reported numbers are optimistic."
            />
          </div>
        </div>
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl overflow-hidden pointer-events-none"
            style={{
              background: isDark ? 'rgba(13,17,23,0.97)' : 'rgba(248,250,252,0.97)',
              border: `1px solid ${color}28`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2">
                <VectorArrow angle={angle} magnitude={magnitude} color={color} size={28} />
                <div>
                  <div className="text-[10px] font-bold" style={{ color }}>Velocity Vector</div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    {magnitude}% magnitude · {alignment}% aligned
                  </div>
                </div>
              </div>
              {worstOffenders.length > 0 && (
                <div className="space-y-1 pt-2"
                  style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}` }}>
                  <div className="text-[8px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
                    Dragging the vector:
                  </div>
                  {worstOffenders.slice(0, 2).map(o => (
                    <div key={o.taskId} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full shrink-0"
                        style={{ background: o.status === 'RED' ? '#ef4444' : '#f59e0b' }} />
                      <span className="text-[9px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                        {o.taskName.slice(0, 28)}
                      </span>
                      {o.driftGap > 0 && (
                        <span className="shrink-0 text-[8px] font-mono" style={{ color: '#ef4444' }}>
                          -{o.driftGap}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 text-[8px] font-mono text-center" style={{ color: 'var(--text-faint)' }}>
                Click for full analysis
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VelocityVectorIndicator;
