/**
 * UltimatumMockup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated mockup for the Ultimatum feature section. Shows two conflicting
 * task cards that separate in opposite Y directions when triggered.
 *
 * Props:
 *   triggered     – set to true by FeatureSection when it enters the viewport
 *   reducedMotion – when true, renders cards in final separated state immediately
 *
 * Animation behaviour (when `triggered && !reducedMotion`):
 *   - Top card animates to translateY(-48px) over 1.0s cubic-bezier(0.16,1,0.3,1)
 *   - Bottom card animates to translateY(+48px) over 1.0s cubic-bezier(0.16,1,0.3,1)
 *   - Uses Framer Motion `motion.div` with animate prop
 *
 * When `reducedMotion`:
 *   - Cards render in their final separated state immediately (no animation)
 *
 * Requirements: 3.4, 3.5, 3.6
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface UltimatumMockupProps {
  triggered: boolean;
  reducedMotion: boolean;
}

const SPRING = { duration: 1.0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

const UltimatumMockup: React.FC<UltimatumMockupProps> = ({ triggered, reducedMotion }) => {
  const shouldAnimate = triggered && !reducedMotion;

  // Final positions are ±48px; use them immediately for reducedMotion
  const topY    = reducedMotion ? -48 : shouldAnimate ? -48 : 0;
  const bottomY = reducedMotion ?  48 : shouldAnimate ?  48 : 0;
  const transition = reducedMotion ? { duration: 0 } : SPRING;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label="Ultimatum conflict mockup"
    >
      {/* ── Separating task cards ─────────────────────────────────── */}
      <div
        className="relative px-4 py-8 flex flex-col items-stretch gap-3"
        style={{ minHeight: '180px' }}
      >
        {/* Top card — moves up */}
        <motion.div
          animate={{ y: topY }}
          transition={transition}
          className="task-card rounded-lg px-4 py-3 flex items-center justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(239,68,68,0.4)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              React Lab
            </span>
          </div>
          <span
            className="shrink-0 flex items-center gap-1 text-xs font-mono ml-3"
            style={{ color: '#ef4444' }}
          >
            <Clock size={11} aria-hidden="true" />
            due 6pm
          </span>
        </motion.div>

        {/* Bottom card — moves down */}
        <motion.div
          animate={{ y: bottomY }}
          transition={transition}
          className="task-card rounded-lg px-4 py-3 flex items-center justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(239,68,68,0.4)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              Physics Essay
            </span>
          </div>
          <span
            className="shrink-0 flex items-center gap-1 text-xs font-mono ml-3"
            style={{ color: '#ef4444' }}
          >
            <Clock size={11} aria-hidden="true" />
            due 6pm
          </span>
        </motion.div>

        {/* Decision prompt */}
        <p
          className="text-center text-xs font-semibold mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          One will fail. You decide.
        </p>
      </div>
    </div>
  );
};

export default UltimatumMockup;
