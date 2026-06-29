/**
 * ContextualHints.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Arrow implementation: a simple inline SVG polygon inside the bubble div
 * (position:relative). No nested divs, no border tricks, no absolute-on-wrapper.
 * The SVG sits flush against the bubble edge that faces the target.
 */
import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTour, TourHighlight } from './TourContext';

const TIP_W   = 240;
const GAP     = 8;   // px between target edge and bubble edge (excluding arrow)
const PAD     = 10;  // min distance from viewport edge
const ARR     = 10;  // arrow height in px

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function measureTarget(sel: string): DOMRect | null {
  const el =
    document.querySelector<HTMLElement>(`[data-tour="${sel}"]`) ??
    document.querySelector<HTMLElement>(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : r;
}

/**
 * Returns where the bubble top-left should go, and which side the arrow is on.
 * tipH must be the ACTUAL rendered height of the bubble (measured via ref).
 *
 * For top/bottom placements: we anchor to the LEFT portion of the target
 * (capped at 120px wide) so full-width block elements don't push the
 * tooltip to the center of the screen.
 */
function place(
  rect: DOMRect,
  preferred: TourHighlight['placement'],
  tipH: number,
): { x: number; y: number; side: TourHighlight['placement'] } {
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = 0, y = 0, side = preferred;
  const gap = GAP + ARR;

  // For horizontal centering on top/bottom placements, cap the effective
  // width at 120px so full-width containers don't center the tooltip at
  // the middle of the page.
  const effectiveW = Math.min(rect.width, 120);

  switch (preferred) {
    case 'bottom':
      x = rect.left + effectiveW / 2 - TIP_W / 2;
      y = rect.bottom + gap;
      if (y + tipH > vh - PAD) { y = rect.top - gap - tipH; side = 'top'; }
      break;
    case 'top':
      x = rect.left + effectiveW / 2 - TIP_W / 2;
      y = rect.top - gap - tipH;
      if (y < PAD) { y = rect.bottom + gap; side = 'bottom'; }
      break;
    case 'right':
      x = rect.right + gap;
      y = rect.top + rect.height / 2 - tipH / 2;
      if (x + TIP_W > vw - PAD) { x = rect.left - gap - TIP_W; side = 'left'; }
      break;
    case 'left':
      x = rect.left - gap - TIP_W;
      y = rect.top + rect.height / 2 - tipH / 2;
      if (x < PAD) { x = rect.right + gap; side = 'right'; }
      break;
  }

  x = clamp(x, PAD, vw - TIP_W - PAD);
  y = clamp(y, PAD, vh - tipH - PAD);
  return { x, y, side };
}

// ─── Pulse beacon ─────────────────────────────────────────────────────────────
// Position near the LEFT side of the target (not right) so it doesn't
// fly to the far edge when the target is a full-width container.
// Also clamp so it stays within the viewport.
const PulseDot: React.FC<{ rect: DOMRect; color: string }> = ({ rect, color }) => {
  // Anchor to a point just above-right of the target's left side
  const left = clamp(rect.left + Math.min(rect.width * 0.15, 60), 8, window.innerWidth - 16);
  const top  = rect.top - 5;

  return ReactDOM.createPortal(
    <motion.div
      style={{
        position: 'fixed', zIndex: 9989, pointerEvents: 'none',
        left, top,
        width: 9, height: 9, borderRadius: '50%', background: color,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [1, 1.5, 1], opacity: [0.9, 0.3, 0.9],
        boxShadow: [`0 0 0 0 ${color}55`, `0 0 0 8px transparent`, `0 0 0 0 transparent`],
      }}
      transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
    />,
    document.body,
  );
};

// ─── Arrow — inline SVG, lives inside the bubble div (position:relative) ──────
//
// For each placement, we know exactly which edge of the bubble faces the target.
// The SVG is absolutely positioned against that edge with a negative inset so
// its tip pokes out beyond the bubble border toward the target.
//
//   'bottom' → bubble below target → arrow on BUBBLE TOP, points up
//   'top'    → bubble above target → arrow on BUBBLE BOTTOM, points down
//   'right'  → bubble right of target → arrow on BUBBLE LEFT, points left
//   'left'   → bubble left of target → arrow on BUBBLE RIGHT, points right
//
const Arrow: React.FC<{ side: TourHighlight['placement']; color: string }> = ({ side, color }) => {
  const fill  = 'rgba(8,10,14,0.97)';
  const stroke = `${color}50`;

  if (side === 'bottom') {
    // Arrow on top of bubble, pointing up
    // SVG: triangle with tip at top center
    return (
      <svg
        width={20} height={ARR + 1}
        viewBox={`0 0 20 ${ARR + 1}`}
        style={{ position: 'absolute', top: -(ARR), left: '50%', transform: 'translateX(-50%)', overflow: 'visible', display: 'block' }}
      >
        <polygon
          points={`0,${ARR} 10,0 20,${ARR}`}
          fill={fill}
          stroke={stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Cover the bottom edge of the polygon so it blends into the bubble */}
        <line x1="0" y1={ARR} x2="20" y2={ARR} stroke={fill} strokeWidth="2" />
      </svg>
    );
  }
  if (side === 'top') {
    // Arrow on bottom of bubble, pointing down
    return (
      <svg
        width={20} height={ARR + 1}
        viewBox={`0 0 20 ${ARR + 1}`}
        style={{ position: 'absolute', bottom: -(ARR), left: '50%', transform: 'translateX(-50%)', overflow: 'visible', display: 'block' }}
      >
        <polygon
          points={`0,0 10,${ARR} 20,0`}
          fill={fill}
          stroke={stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <line x1="0" y1="0" x2="20" y2="0" stroke={fill} strokeWidth="2" />
      </svg>
    );
  }
  if (side === 'right') {
    // Arrow on left of bubble, pointing left
    return (
      <svg
        width={ARR + 1} height={20}
        viewBox={`0 0 ${ARR + 1} 20`}
        style={{ position: 'absolute', left: -(ARR), top: '50%', transform: 'translateY(-50%)', overflow: 'visible', display: 'block' }}
      >
        <polygon
          points={`${ARR},0 0,10 ${ARR},20`}
          fill={fill}
          stroke={stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <line x1={ARR} y1="0" x2={ARR} y2="20" stroke={fill} strokeWidth="2" />
      </svg>
    );
  }
  // side === 'left' — arrow on right of bubble, pointing right
  return (
    <svg
      width={ARR + 1} height={20}
      viewBox={`0 0 ${ARR + 1} 20`}
      style={{ position: 'absolute', right: -(ARR), top: '50%', transform: 'translateY(-50%)', overflow: 'visible', display: 'block' }}
    >
      <polygon
        points={`0,0 ${ARR},10 0,20`}
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <line x1="0" y1="0" x2="0" y2="20" stroke={fill} strokeWidth="2" />
    </svg>
  );
};

// ─── HintBubble ───────────────────────────────────────────────────────────────
const HintBubble: React.FC<{
  highlight: TourHighlight;
  targetRect: DOMRect;
  onDismiss: () => void;
}> = ({ highlight, targetRect, onDismiss }) => {
  const color     = highlight.color;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; side: TourHighlight['placement'] } | null>(null);

  // Pass 1: render invisible to measure real height, then set position
  useLayoutEffect(() => {
    if (!bubbleRef.current) return;
    const h = bubbleRef.current.offsetHeight;
    setPos(place(targetRect, highlight.placement, h));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const recalc = () => {
      if (!bubbleRef.current) return;
      const fr = measureTarget(highlight.target);
      if (!fr) return;
      setPos(place(fr, highlight.placement, bubbleRef.current.offsetHeight));
    };
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [highlight]);

  const side = pos?.side ?? highlight.placement;

  return ReactDOM.createPortal(
    <motion.div
      style={{
        position: 'fixed',
        zIndex: 9994,
        width: TIP_W,
        left: pos?.x ?? -9999,
        top:  pos?.y ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: pos ? 1 : 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 1.4, ease: 'easeInOut' } }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Bubble — position:relative so Arrow SVGs anchor correctly */}
      <div
        ref={bubbleRef}
        style={{
          position: 'relative',
          background: 'rgba(8,10,14,0.97)',
          border: `1px solid ${color}45`,
          borderRadius: 12,
          padding: '12px 14px 12px',
          boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${color}18`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Arrow sits inside this div so position:absolute uses this as context */}
        <Arrow side={side} color={color} />

        {/* Accent bar */}
        <div style={{ height: 2, background: `linear-gradient(90deg,${color},${color}28)`, borderRadius: 999, marginBottom: 10 }} />

        {/* Title + X */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color, lineHeight: 1.3, fontFamily: 'JetBrains Mono, monospace' }}>
            {highlight.title}
          </span>
          <button onClick={onDismiss} title="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: `${color}65`, flexShrink: 0, lineHeight: 1, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
            <X size={11} />
          </button>
        </div>

        {/* Body */}
        <p style={{ fontSize: 10.5, color: 'rgba(226,232,240,0.75)', lineHeight: 1.6, margin: '0 0 11px', fontFamily: 'JetBrains Mono, monospace' }}>
          {highlight.hint}
        </p>

        {/* Got it */}
        <button onClick={onDismiss}
          style={{
            width: '100%', padding: '6px 0',
            background: `${color}1a`, border: `1px solid ${color}38`,
            borderRadius: 8, color, fontSize: 10.5, fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', letterSpacing: '0.05em',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}2e`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}1a`; }}
        >
          Got it
        </button>
      </div>
    </motion.div>,
    document.body,
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const ContextualHints: React.FC = () => {
  const location = useLocation();
  const { highlights, seenIds, markSeen } = useTour();
  const [active,     setActive]     = useState<TourHighlight | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: string) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    markSeen(id);
    setShowBubble(false);
    setTimeout(() => { setActive(null); setTargetRect(null); }, 1600); // wait for slow fade
  }, [markSeen]);

  useEffect(() => {
    setShowBubble(false); setTargetRect(null); setActive(null);
    if (showTimer.current)    clearTimeout(showTimer.current);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    const candidates = highlights.filter(h => h.route === location.pathname && !seenIds.has(h.id) && !h.cardOnly);
    if (!candidates.length) return;

    const chosen   = candidates[0];
    const fromCard = sessionStorage.getItem('tour_navigate_hint') === chosen.id;
    if (fromCard) sessionStorage.removeItem('tour_navigate_hint');

    showTimer.current = setTimeout(() => {
      let tries = 0;
      const probe = () => {
        const r = measureTarget(chosen.target);
        if (r) {
          setActive(chosen); setTargetRect(r); setShowBubble(true);
          dismissTimer.current = setTimeout(() => dismiss(chosen.id), 6000);
        } else if (tries++ < 15) { setTimeout(probe, 200); }
      };
      probe();
    }, fromCard ? 500 : 2000);

    return () => {
      if (showTimer.current)    clearTimeout(showTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !targetRect || !showBubble) return null;

  return (
    <>
      <PulseDot rect={targetRect} color={active.color} />
      <AnimatePresence>
        {showBubble && (
          <HintBubble
            key={active.id}
            highlight={active}
            targetRect={targetRect}
            onDismiss={() => dismiss(active.id)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ContextualHints;
