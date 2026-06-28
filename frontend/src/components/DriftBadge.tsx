/**
 * DriftBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1 — Behavioral Drift Score visual indicator.
 *
 * Renders a small, distinct icon on each task card showing the gap between
 * self-reported progress and the behavioral estimate. On hover/tap, expands
 * to reveal: "Reported: 60% · Real estimate: 35% · Why?" with signal breakdown.
 *
 * Design contract:
 *   - NOT another progress bar
 *   - Uses same color language as existing status system (green/amber/red)
 *   - Degrades gracefully on sparse data → shows neutral "not enough activity"
 *   - Consistent visual family with Trust Decay (Phase 3): same icon style
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, AlertTriangle, TrendingDown, TrendingUp, Minus, Eye, X } from 'lucide-react';
import type { DriftScore } from '../api';

interface DriftBadgeProps {
  drift: DriftScore;
  isDark?: boolean;
}

// Map gap magnitude to color/severity
function driftSeverity(gap: number, confidence: DriftScore['confidence']): {
  color: string; bg: string; border: string; label: string; icon: React.ReactNode;
} {
  if (confidence === 'sparse') {
    return {
      color: '#71717a', bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.2)',
      label: 'Sparse data', icon: <Minus size={9} />,
    };
  }
  const absGap = Math.abs(gap);
  if (gap < -25) return {
    color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)',
    label: 'Significant gap', icon: <TrendingDown size={9} />,
  };
  if (gap < -10) return {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',
    label: 'Moderate gap', icon: <TrendingDown size={9} />,
  };
  if (gap > 10) return {
    color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.22)',
    label: 'Ahead of estimate', icon: <TrendingUp size={9} />,
  };
  return {
    color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.18)',
    label: 'Aligned', icon: <Minus size={9} />,
  };
}

interface PopupCoords {
  x: number;
  y: number;
  openUp: boolean;
}

const POPUP_WIDTH = 256; // w-64
const POPUP_PADDING = 8;

function calcPopupCoords(badgeRect: DOMRect): PopupCoords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const openUp = vh - badgeRect.bottom < 200;

  let x = badgeRect.left;
  if (x + POPUP_WIDTH > vw - POPUP_PADDING) {
    x = vw - POPUP_WIDTH - POPUP_PADDING;
  }
  if (x < POPUP_PADDING) x = POPUP_PADDING;

  const y = openUp ? badgeRect.top - 8 : badgeRect.bottom + 8;
  return { x, y, openUp };
}

const DriftBadge: React.FC<DriftBadgeProps> = ({ drift, isDark = true }) => {
  const [expanded, setExpanded] = useState(false);
  const [coords, setCoords] = useState<PopupCoords>({ x: 0, y: 0, openUp: false });
  const badgeRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    if (!badgeRef.current) return;
    setCoords(calcPopupCoords(badgeRef.current.getBoundingClientRect()));
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (
        badgeRef.current?.contains(e.target as Node) === false &&
        popupRef.current?.contains(e.target as Node) === false
      ) setExpanded(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!expanded) return;
    const refresh = () => updateCoords();
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, [expanded, updateCoords]);

  const { gap, selfReported, inferredReal, confidence, explanation, signals } = drift;
  const sev = driftSeverity(gap, confidence);
  const isSparse = confidence === 'sparse';

  // Don't render at all if sparse and gap is 0 (brand new task)
  if (isSparse && Math.abs(gap) < 1) return null;

  const portalStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    width: POPUP_WIDTH,
    ...(coords.openUp
      ? { bottom: window.innerHeight - coords.y, top: 'auto' }
      : { top: coords.y, bottom: 'auto' }),
    left: coords.x,
  };

  const popup = (
    <AnimatePresence>
      {expanded && (
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, scale: 0.92, y: coords.openUp ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: coords.openUp ? 4 : -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl overflow-hidden"
          style={{
            ...portalStyle,
            background: isDark ? 'rgba(13,17,23,0.97)' : 'rgba(248,250,252,0.97)',
            border: `1px solid ${sev.border}`,
            boxShadow: isDark
              ? `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${sev.border}`
              : `0 8px 24px rgba(0,0,0,0.12)`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}` }}>
              <div className="flex items-center gap-1.5">
                <Activity size={10} style={{ color: sev.color }} />
                <span className="text-[10px] font-bold font-mono" style={{ color: sev.color }}>
                  Behavioral Drift
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                  {confidence}
                </span>
              </div>
              <button onClick={() => setExpanded(false)} style={{ color: 'var(--text-faint)' }}>
                <X size={10} />
              </button>
            </div>

            {isSparse ? (
              <div className="px-3 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Minus size={11} style={{ color: '#71717a' }} />
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                    Not enough activity yet to estimate
                  </span>
                </div>
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  Complete a subtask, log a check-in, or activate Panic Mode to generate behavioral signals.
                </p>
              </div>
            ) : (
              <div className="px-3 py-2.5 space-y-2.5">
                {/* Progress comparison */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Reported</div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${selfReported}%` }}
                          transition={{ duration: 0.5 }}
                          style={{ background: 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color: 'var(--text-primary)' }}>
                        {selfReported}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Real estimate</div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${inferredReal}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          style={{ background: `linear-gradient(90deg, ${sev.color}88, ${sev.color})` }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color: sev.color }}>
                        {inferredReal}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gap callout */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
                  style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
                  <span style={{ color: sev.color }}>{gap < 0 ? <TrendingDown size={9} /> : <TrendingUp size={9} />}</span>
                  <span className="text-[10px] font-mono font-semibold" style={{ color: sev.color }}>
                    {Math.abs(gap)}% {gap < 0 ? 'gap — you may be over-reporting' : 'ahead of behavioral estimate'}
                  </span>
                </div>

                {/* Signal breakdown */}
                <div className="space-y-1.5">
                  <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                    Why?
                  </div>
                  {explanation.map((line, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5" style={{ color: sev.color }}>
                        <Eye size={8} />
                      </span>
                      <span className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {line}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Raw signal values — for transparency */}
                <div className="pt-1.5 mt-0.5 flex flex-wrap gap-1.5"
                  style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}` }}>
                  {signals.subtask !== null && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: 'var(--text-faint)' }}>
                      subtask {signals.subtask}%
                    </span>
                  )}
                  {signals.panic < 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                      panic {signals.panic}
                    </span>
                  )}
                  {signals.staleness < -2 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24' }}>
                      stale {signals.staleness}
                    </span>
                  )}
                  {Math.abs(signals.language) > 1 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(56,189,248,0.08)', color: '#38bdf8' }}>
                      lang {signals.language > 0 ? '+' : ''}{signals.language}
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
  );

  return (
    <span className="inline-block" onClick={e => e.stopPropagation()}>
      {/* Compact badge — always visible */}
      <motion.button
        ref={badgeRef}
        onClick={() => {
          updateCoords();
          setExpanded(v => !v);
        }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.9 }}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
        style={{
          background: sev.bg,
          border: `1px solid ${sev.border}`,
          color: sev.color,
        }}
        title={isSparse ? 'Not enough activity to estimate' : `Behavioral Drift: reported ${selfReported}% vs estimated ${inferredReal}%`}
      >
        <Activity size={8} />
        {!isSparse && (
          <span className="font-mono text-[9px] font-bold">
            {gap > 0 ? '+' : ''}{gap}%
          </span>
        )}
        <span className="text-[8px] font-mono opacity-70">{sev.icon}</span>
      </motion.button>

      {/* Rendered into document.body — escapes overflow:hidden on the task card */}
      {createPortal(popup, document.body)}
    </span>
  );
};

export default DriftBadge;
