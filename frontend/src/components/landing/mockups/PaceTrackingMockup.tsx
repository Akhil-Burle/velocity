/**
 * PaceTrackingMockup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated mockup for the Live Pace Tracking feature section. Shows a task
 * card with a sparkline/progress bar that draws itself left-to-right, and a
 * left border that transitions through green → amber → red to indicate pace
 * falling behind over time.
 *
 * Animation behaviour (when `triggered && !reducedMotion`):
 *   - Sparkline "draws" from 0 to 100% width over 1s using a CSS @keyframes
 *     animation toggled via a class added by useEffect.
 *   - Left border color progresses through three stages using setTimeout +
 *     state: green (on track) at 0 ms, amber (behind) at 800 ms, red
 *     (critical) at 1600 ms. Each stage uses a CSS transition on border-color
 *     so the change is smooth.
 *
 * When `reducedMotion`:
 *   - Renders in the final red-border state immediately; sparkline fully
 *     visible. No animation or transitions.
 *
 * Design System card surface styling (--bg-card, --bg-surface, --border-subtle)
 * mirrors the pattern used by BrainDumpMockup and ChaosScannerMockup.
 *
 * Requirements: 4.6, 4.10
 */

import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';

interface PaceTrackingMockupProps {
  triggered: boolean;
  reducedMotion: boolean;
}

type PaceStatus = 'on-track' | 'behind' | 'critical';

const BORDER_COLORS: Record<PaceStatus, string> = {
  'on-track': '#22c55e',
  'behind':   '#f59e0b',
  'critical': '#ef4444',
};

const STATUS_LABELS: Record<PaceStatus, string> = {
  'on-track': 'On Track',
  'behind':   'Behind',
  'critical': 'Critical',
};

const STATUS_BG: Record<PaceStatus, string> = {
  'on-track': 'rgba(34,197,94,0.12)',
  'behind':   'rgba(245,158,11,0.12)',
  'critical': 'rgba(239,68,68,0.12)',
};

/** Sparkline data points — a sequence of heights (%) for the mini-chart bars */
const SPARKLINE_BARS = [30, 45, 40, 60, 55, 70, 65, 50, 45, 38, 30, 25];

export default function PaceTrackingMockup({
  triggered,
  reducedMotion,
}: PaceTrackingMockupProps) {
  // Border status drives the left-border color transition
  const [status, setStatus] = useState<PaceStatus>(
    reducedMotion ? 'critical' : 'on-track',
  );

  // Ref to the sparkline fill element so we can toggle the animation class
  const sparklineRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup of timeouts
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Keep initial state in sync if reducedMotion changes before trigger
    if (reducedMotion) {
      setStatus('critical');
      return;
    }

    if (!triggered) {
      // Reset to initial state when trigger is lifted (section scrolls away)
      setStatus('on-track');
      const bar = sparklineRef.current;
      if (bar) {
        bar.classList.remove('pace-sparkline--active');
      }
      return;
    }

    // triggered && !reducedMotion — run the full animation sequence

    // 1. Start sparkline draw animation
    const bar = sparklineRef.current;
    if (bar) {
      bar.classList.remove('pace-sparkline--active');
      void bar.offsetWidth; // force reflow so the animation restarts cleanly
      bar.classList.add('pace-sparkline--active');
    }

    // 2. Clear any previous timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // 3. Stage the border color transitions
    setStatus('on-track');

    const t1 = setTimeout(() => setStatus('behind'), 800);
    const t2 = setTimeout(() => setStatus('critical'), 1600);

    timersRef.current = [t1, t2];

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [triggered, reducedMotion]);

  const borderColor = BORDER_COLORS[status];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label="Pace tracking mockup"
    >
      {/* ── Header bar ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <Activity size={13} color="#22c55e" aria-hidden="true" />
        <span
          className="text-xs font-semibold font-mono tracking-wide"
          style={{ color: '#22c55e' }}
        >
          live pace tracking
        </span>
      </div>

      {/* ── Task card with animated left border ──────────────────── */}
      <div className="p-4">
        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderLeft: `3px solid ${borderColor}`,
            // CSS transition on border-color so the color changes are smooth
            transition: reducedMotion
              ? 'none'
              : 'border-left-color 0.4s ease',
          }}
        >
          {/* Card header — task name + status badge */}
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
            <div className="min-w-0">
              <p
                className="text-sm font-semibold leading-tight truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                Finish React Lab Report
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Due today · 6:00 PM
              </p>
            </div>

            {/* Status badge */}
            <span
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                color: borderColor,
                background: STATUS_BG[status],
                border: `1px solid ${borderColor}40`,
                transition: reducedMotion ? 'none' : 'all 0.4s ease',
              }}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>

          {/* ── Sparkline / progress bar area ──────────────────── */}
          <div className="px-4 pb-4">
            {/* Mini bar-chart (sparkline) */}
            <div className="relative h-10 overflow-hidden rounded" aria-hidden="true">
              {/* Track background */}
              <div
                className="absolute inset-0 rounded"
                style={{ background: 'var(--bg-surface-md, rgba(255,255,255,0.04))' }}
              />

              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-px px-1 pb-1">
                {SPARKLINE_BARS.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${height}%`,
                      background: borderColor,
                      opacity: 0.7,
                      transition: reducedMotion ? 'none' : 'background 0.4s ease',
                    }}
                  />
                ))}
              </div>

              {/* Animated reveal mask — expands from 0% to 100% width */}
              {!reducedMotion && (
                <div
                  ref={sparklineRef}
                  className="pace-sparkline-mask absolute inset-0"
                  style={{
                    background: 'var(--bg-card)',
                    transformOrigin: 'right center',
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Progress label */}
            <div className="flex items-center justify-between mt-2">
              <span
                className="text-[10px] font-mono"
                style={{ color: 'var(--text-faint)' }}
              >
                pace: {status === 'on-track' ? '1.2×' : status === 'behind' ? '0.8×' : '0.4×'} required
              </span>
              <span
                className="text-[10px] font-mono"
                style={{
                  color: borderColor,
                  transition: reducedMotion ? 'none' : 'color 0.4s ease',
                }}
              >
                {status === 'on-track' ? '▲ ahead' : status === 'behind' ? '▼ slowing' : '⚠ intervene'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inline keyframes ─────────────────────────────────────────
           The mask div starts at scaleX(1) (covering the sparkline bars),
           then collapses to scaleX(0) via a class-toggled animation — this
           reveals the bars by sliding the cover away left-to-right.
      ──────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pace-reveal {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }

        .pace-sparkline-mask {
          transform: scaleX(1);
          transform-origin: right center;
        }

        .pace-sparkline-mask.pace-sparkline--active {
          animation: pace-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
