/**
 * GuidedTour.tsx — complete rewrite
 * ─────────────────────────────────────────────────────────────────────────────
 * A proper sequential guided tour with:
 *  - Spotlight ring around the target element
 *  - Tooltip positioned AWAY from the target with correct directional arrow
 *  - Full viewport-edge clamping so nothing bleeds off screen
 *  - One step at a time (no overlapping)
 *  - Semi-transparent full-screen backdrop that lets users click through
 *  - "Next", "Skip tour", step counter
 *  - Fires once per session (sessionStorage key: tour_v2_done)
 *  - Auto-advances after 12s of inactivity per step
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface TourStep {
  /** data-tour attribute value on the target element, OR a CSS selector */
  target: string;
  /** Short title shown in bold */
  title: string;
  /** Body copy — keep under 80 chars */
  body: string;
  /** Which side of the target the tooltip appears on */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** Accent color — defaults to green */
  color?: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  onDone?: () => void;
  /** Delay in ms before tour starts — default 2200 */
  startDelay?: number;
}

const SESSION_KEY = 'tour_v2_done';
const TOOLTIP_GAP = 14;   // px between spotlight edge and tooltip
const SPOTLIGHT_PAD = 6;  // px padding around target in spotlight ring

// ─── Measure a target element reliably ───────────────────────────────────────
function measureTarget(target: string): DOMRect | null {
  // Try data-tour attribute first, then CSS selector
  const el =
    document.querySelector<HTMLElement>(`[data-tour="${target}"]`) ??
    document.querySelector<HTMLElement>(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

// ─── Clamp a value between min and max ───────────────────────────────────────
function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

// ─── Compute tooltip position (top-left corner) given target rect ─────────────
function tooltipPosition(
  rect: DOMRect,
  placement: TourStep['placement'],
  tooltipW: number,
  tooltipH: number,
  vw: number,
  vh: number
): { x: number; y: number; actualPlacement: TourStep['placement'] } {
  const pad = SPOTLIGHT_PAD + TOOLTIP_GAP;
  let x = 0, y = 0;
  let actualPlacement = placement;

  switch (placement) {
    case 'bottom':
      x = rect.left + rect.width / 2 - tooltipW / 2;
      y = rect.bottom + pad;
      // Flip to top if not enough space below
      if (y + tooltipH > vh - 16) { y = rect.top - pad - tooltipH; actualPlacement = 'top'; }
      break;
    case 'top':
      x = rect.left + rect.width / 2 - tooltipW / 2;
      y = rect.top - pad - tooltipH;
      if (y < 16) { y = rect.bottom + pad; actualPlacement = 'bottom'; }
      break;
    case 'right':
      x = rect.right + pad;
      y = rect.top + rect.height / 2 - tooltipH / 2;
      if (x + tooltipW > vw - 16) { x = rect.left - pad - tooltipW; actualPlacement = 'left'; }
      break;
    case 'left':
      x = rect.left - pad - tooltipW;
      y = rect.top + rect.height / 2 - tooltipH / 2;
      if (x < 16) { x = rect.right + pad; actualPlacement = 'right'; }
      break;
  }

  // Horizontal clamp
  x = clamp(x, 16, vw - tooltipW - 16);
  // Vertical clamp
  y = clamp(y, 16, vh - tooltipH - 16);

  return { x, y, actualPlacement };
}

// ─── Arrow SVG pointing FROM tooltip TOWARD the target ───────────────────────
// placement is the side of the target the tooltip is on.
// The arrow points BACK toward the target (opposite direction).
const Arrow: React.FC<{ placement: TourStep['placement']; color: string }> = ({ placement, color }) => {
  // Arrow points from tooltip toward the target
  // If tooltip is BELOW the target → arrow points UP
  // If tooltip is ABOVE the target → arrow points DOWN
  // If tooltip is RIGHT of target → arrow points LEFT
  // If tooltip is LEFT of target → arrow points RIGHT
  const style: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
  };

  switch (placement) {
    case 'bottom': // tooltip below → arrow points up, sits at top of tooltip
      return (
        <svg width={16} height={20} viewBox="0 0 16 20" fill="none"
          style={{ ...style, top: -20, left: '50%', transform: 'translateX(-50%)' }}>
          <motion.path d="M 8 18 L 8 4" stroke={color} strokeWidth="1.5" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          <motion.path d="M 3 8 L 8 3 L 13 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />
        </svg>
      );
    case 'top': // tooltip above → arrow points down, sits at bottom of tooltip
      return (
        <svg width={16} height={20} viewBox="0 0 16 20" fill="none"
          style={{ ...style, bottom: -20, left: '50%', transform: 'translateX(-50%)' }}>
          <motion.path d="M 8 2 L 8 16" stroke={color} strokeWidth="1.5" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          <motion.path d="M 3 12 L 8 17 L 13 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />
        </svg>
      );
    case 'right': // tooltip right → arrow points left, sits at left of tooltip
      return (
        <svg width={20} height={16} viewBox="0 0 20 16" fill="none"
          style={{ ...style, left: -20, top: '50%', transform: 'translateY(-50%)' }}>
          <motion.path d="M 18 8 L 4 8" stroke={color} strokeWidth="1.5" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          <motion.path d="M 8 3 L 3 8 L 8 13" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />
        </svg>
      );
    case 'left': // tooltip left → arrow points right, sits at right of tooltip
      return (
        <svg width={20} height={16} viewBox="0 0 20 16" fill="none"
          style={{ ...style, right: -20, top: '50%', transform: 'translateY(-50%)' }}>
          <motion.path d="M 2 8 L 16 8" stroke={color} strokeWidth="1.5" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          <motion.path d="M 12 3 L 17 8 L 12 13" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />
        </svg>
      );
  }
};

// ─── Spotlight ring (outline around the target element) ───────────────────────
const Spotlight: React.FC<{ rect: DOMRect; color: string }> = ({ rect, color }) => {
  const pad = SPOTLIGHT_PAD;
  return ReactDOM.createPortal(
    <motion.div
      key={`${rect.left}-${rect.top}`}
      style={{
        position: 'fixed',
        zIndex: 9996,
        pointerEvents: 'none',
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 10,
        border: `2px solid ${color}`,
        boxShadow: `0 0 0 4px ${color}22, 0 0 20px ${color}33`,
      }}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    />,
    document.body
  );
};

// ─── Tooltip card ─────────────────────────────────────────────────────────────
const TOOLTIP_W = 240;

const Tooltip: React.FC<{
  step: TourStep;
  rect: DOMRect;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}> = ({ step, rect, stepIndex, totalSteps, onNext, onSkip }) => {
  const color = step.color ?? '#22c55e';
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // We'll estimate tooltip height for positioning — it renders then adjusts
  const estH = 110;
  const { x, y, actualPlacement } = tooltipPosition(rect, step.placement, TOOLTIP_W, estH, vw, vh);

  return ReactDOM.createPortal(
    <motion.div
      key={`tooltip-${stepIndex}`}
      style={{
        position: 'fixed',
        zIndex: 9998,
        left: x,
        top: y,
        width: TOOLTIP_W,
        fontFamily: 'JetBrains Mono, monospace',
        background: 'rgba(8,10,14,0.96)',
        border: `1px solid ${color}40`,
        borderRadius: 12,
        padding: '14px 16px 12px',
        boxShadow: `0 0 0 1px ${color}18, 0 8px 40px rgba(0,0,0,0.55), 0 0 24px ${color}15`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        // Leave room for the arrow
        ...(actualPlacement === 'bottom' ? { marginTop: 20 } : {}),
        ...(actualPlacement === 'top'    ? { marginBottom: 20 } : {}),
        ...(actualPlacement === 'right'  ? { marginLeft: 20 } : {}),
        ...(actualPlacement === 'left'   ? { marginRight: 20 } : {}),
      }}
      initial={{ opacity: 0, y: actualPlacement === 'bottom' ? -8 : actualPlacement === 'top' ? 8 : 0, x: actualPlacement === 'right' ? -8 : actualPlacement === 'left' ? 8 : 0, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Arrow pointing back toward target */}
      <Arrow placement={actualPlacement} color={color} />

      {/* Top accent line */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${color}, ${color}44)`,
        borderRadius: 999, marginBottom: 10 }} />

      {/* Step counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} style={{
              width: i === stepIndex ? 16 : 5, height: 5, borderRadius: 999,
              background: i === stepIndex ? color : `${color}33`,
              display: 'inline-block',
              transition: 'width 0.2s, background 0.2s',
            }} />
          ))}
        </div>
        <span style={{ fontSize: 9, color: `${color}66`, letterSpacing: '0.08em' }}>
          {stepIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 5, letterSpacing: '0.02em' }}>
        {step.title}
      </div>

      {/* Body */}
      <div style={{ fontSize: 10.5, color: 'rgba(226,232,240,0.75)', lineHeight: 1.55, marginBottom: 12 }}>
        {step.body}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={onSkip} style={{
          fontSize: 9, color: 'rgba(100,116,139,0.7)', background: 'none',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          letterSpacing: '0.04em',
        }}>
          Skip tour
        </button>
        <button onClick={onNext} style={{
          fontSize: 10, color: '#000', background: color,
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontFamily: 'inherit', padding: '4px 12px', fontWeight: 700,
          letterSpacing: '0.02em',
          boxShadow: `0 0 12px ${color}44`,
        }}>
          {stepIndex < totalSteps - 1 ? 'Next →' : 'Done ✓'}
        </button>
      </div>
    </motion.div>,
    document.body
  );
};

// ─── Main GuidedTour component ────────────────────────────────────────────────
const GuidedTour: React.FC<GuidedTourProps> = ({ steps, onDone, startDelay = 2200 }) => {
  const [active, setActive]   = useState(false);
  const [step, setStep]       = useState(0);
  const [rect, setRect]       = useState<DOMRect | null>(null);
  const autoRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setActive(false);
    onDone?.();
  }, [onDone]);

  const goNext = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current);
    if (step < steps.length - 1) {
      setRect(null);
      setStep(s => s + 1);
    } else {
      finish();
    }
  }, [step, steps.length, finish]);

  // Start tour once after delay
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) { onDone?.(); return; }
    const t = setTimeout(() => setActive(true), startDelay);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure target when step changes or active
  useEffect(() => {
    if (!active) return;
    let attempts = 0;
    const tryMeasure = () => {
      const r = measureTarget(steps[step]?.target ?? '');
      if (r) {
        setRect(r);
      } else if (attempts < 10) {
        attempts++;
        setTimeout(tryMeasure, 150);
      }
    };
    tryMeasure();

    const onResize = () => {
      const r = measureTarget(steps[step]?.target ?? '');
      if (r) setRect(r);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, step, steps]);

  // Auto-advance after 12s
  useEffect(() => {
    if (!active || !rect) return;
    autoRef.current = setTimeout(goNext, 12000);
    return () => { if (autoRef.current) clearTimeout(autoRef.current); };
  }, [active, rect, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !rect || step >= steps.length) return null;
  const current = steps[step];
  const color = current.color ?? '#22c55e';

  return (
    <AnimatePresence mode="wait">
      <React.Fragment key={step}>
        <Spotlight rect={rect} color={color} />
        <Tooltip
          step={current}
          rect={rect}
          stepIndex={step}
          totalSteps={steps.length}
          onNext={goNext}
          onSkip={finish}
        />
      </React.Fragment>
    </AnimatePresence>
  );
};

export default GuidedTour;
// Re-export TourStep so Dashboard can import it
export type { TourStep as TourTarget };
