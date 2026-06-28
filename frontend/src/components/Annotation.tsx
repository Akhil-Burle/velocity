/**
 * Annotation.tsx — rewritten
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone floating hint that targets a SPECIFIC ref or data-annotation attr.
 * No longer uses parentElement — every annotation gets an explicit targetRef.
 *
 * Key fixes vs previous version:
 *  - Tooltip is positioned by a fixed portal using the real target's DOMRect
 *  - Viewport-edge clamping so nothing bleeds off screen
 *  - Arrow direction is geometrically correct: arrow tip points AT the target
 *  - No simultaneous firing — each instance manages its own sessionStorage key
 *  - pointerEvents: none on the arrow; 'auto' only on the dismiss area
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface AnnotationProps {
  text: string;
  /** Which side of the TARGET the tooltip appears on */
  placement: 'top' | 'bottom' | 'left' | 'right';
  sessionKey: string;
  color?: string;
  delay?: number;
  /** Ref to the element to annotate */
  targetRef: React.RefObject<HTMLElement>;
}

const TOOLTIP_W = 180;
const GAP = 12;
const PAD = 6;

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

function computePos(rect: DOMRect, placement: AnnotationProps['placement'], h: number) {
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = 0, y = 0;
  switch (placement) {
    case 'bottom': x = rect.left + rect.width / 2 - TOOLTIP_W / 2; y = rect.bottom + GAP; break;
    case 'top':    x = rect.left + rect.width / 2 - TOOLTIP_W / 2; y = rect.top - GAP - h; break;
    case 'right':  x = rect.right + GAP; y = rect.top + rect.height / 2 - h / 2; break;
    case 'left':   x = rect.left - GAP - TOOLTIP_W; y = rect.top + rect.height / 2 - h / 2; break;
  }
  x = clamp(x, PAD, vw - TOOLTIP_W - PAD);
  y = clamp(y, PAD, vh - h - PAD);
  return { x, y };
}

// Tiny directional arrow SVG — tip points TOWARD target
const TipArrow: React.FC<{ placement: AnnotationProps['placement']; color: string }> = ({ placement, color }) => {
  const base: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
  switch (placement) {
    case 'bottom': return (
      <svg width={12} height={16} viewBox="0 0 12 16" fill="none"
        style={{ ...base, top: -16, left: '50%', transform: 'translateX(-50%)' }}>
        <motion.path d="M6 14 L6 3" stroke={color} strokeWidth={1.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
        <motion.path d="M2 7 L6 2 L10 7" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      </svg>
    );
    case 'top': return (
      <svg width={12} height={16} viewBox="0 0 12 16" fill="none"
        style={{ ...base, bottom: -16, left: '50%', transform: 'translateX(-50%)' }}>
        <motion.path d="M6 2 L6 13" stroke={color} strokeWidth={1.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
        <motion.path d="M2 9 L6 14 L10 9" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      </svg>
    );
    case 'right': return (
      <svg width={16} height={12} viewBox="0 0 16 12" fill="none"
        style={{ ...base, left: -16, top: '50%', transform: 'translateY(-50%)' }}>
        <motion.path d="M14 6 L3 6" stroke={color} strokeWidth={1.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
        <motion.path d="M7 2 L2 6 L7 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      </svg>
    );
    case 'left': return (
      <svg width={16} height={12} viewBox="0 0 16 12" fill="none"
        style={{ ...base, right: -16, top: '50%', transform: 'translateY(-50%)' }}>
        <motion.path d="M2 6 L13 6" stroke={color} strokeWidth={1.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
        <motion.path d="M9 2 L14 6 L9 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      </svg>
    );
  }
};

const Annotation: React.FC<AnnotationProps> = ({
  text, placement, sessionKey, color = '#22c55e', delay = 0, targetRef,
}) => {
  const [visible, setVisible]   = useState(false);
  const [dismissed, setDismiss] = useState(false);
  const [pos, setPos]           = useState<{ x: number; y: number } | null>(null);
  const estH = 52; // rough height estimate for initial position calc

  // Check session
  useEffect(() => {
    if (sessionStorage.getItem(sessionKey)) { setDismiss(true); return; }
    const t = setTimeout(() => setVisible(true), delay * 1000 + 600);
    return () => clearTimeout(t);
  }, [sessionKey, delay]);

  // Measure
  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    setPos(computePos(r, placement, estH));
  }, [targetRef, placement]);

  useEffect(() => {
    if (!visible || dismissed) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [visible, dismissed, measure]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(sessionKey, 'true');
    setDismiss(true);
  }, [sessionKey]);

  // Auto-dismiss after 8s
  useEffect(() => {
    if (!visible || dismissed) return;
    const t = setTimeout(dismiss, 8000);
    return () => clearTimeout(t);
  }, [visible, dismissed, dismiss]);

  if (!visible || dismissed || !pos) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        key={sessionKey}
        onClick={dismiss}
        style={{
          position: 'fixed', zIndex: 9995,
          left: pos.x, top: pos.y,
          width: TOOLTIP_W,
          cursor: 'pointer',
        }}
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Arrow tip toward target */}
        <TipArrow placement={placement} color={color} />
        {/* Bubble */}
        <div style={{
          fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace',
          color, lineHeight: 1.5,
          padding: '7px 10px',
          borderRadius: 8,
          background: 'rgba(8,10,14,0.92)',
          border: `1px solid ${color}35`,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}10`,
        }}>
          {text}
          <div style={{ fontSize: 8, color: `${color}55`, marginTop: 3 }}>click to dismiss</div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default Annotation;
