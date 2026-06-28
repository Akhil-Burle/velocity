/**
 * InfoTooltip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE shared (i) info affordance used consistently across every page.
 *
 * Usage:
 *   <InfoTooltip explanation="What this metric actually means." />
 *
 * The tooltip is rendered via ReactDOM.createPortal into document.body so it
 * always escapes overflow:hidden parents AND Framer Motion stacking contexts
 * (motion.div animations with transform/will-change trap position:fixed).
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../ThemeContext';

interface InfoTooltipProps {
  /** One short sentence (≤ ~20 words). Must ADD information, not restate the label. */
  explanation: string;
  /** Optional: override icon size in px. Defaults to 12. */
  size?: number;
}

// Detect touch capability (not just screen width — touch laptops exist)
function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
}

const TOOLTIP_WIDTH = 220;
const TOOLTIP_PADDING = 8; // min px from viewport edge

interface TooltipCoords {
  x: number;       // left edge of tooltip
  y: number;       // top edge of tooltip
  openUp: boolean; // true when tooltip opens upward
}

function calcCoords(iconRect: DOMRect): TooltipCoords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Open upward when less than 90px of space below the icon
  const openUp = vh - iconRect.bottom < 90;

  // Align tooltip's left edge to the icon's left, clamp to stay on screen
  let x = iconRect.left;
  if (x + TOOLTIP_WIDTH > vw - TOOLTIP_PADDING) {
    x = vw - TOOLTIP_WIDTH - TOOLTIP_PADDING;
  }
  if (x < TOOLTIP_PADDING) x = TOOLTIP_PADDING;

  const y = openUp
    ? iconRect.top - 6   // will translate upward via CSS: bottom = vh - y
    : iconRect.bottom + 6;

  return { x, y, openUp };
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ explanation, size = 12 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords>({ x: 0, y: 0, openUp: false });
  const [isTouch, setIsTouch] = useState(false);

  const iconRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setIsTouch(isTouchDevice()); }, []);

  const updateCoords = useCallback(() => {
    if (!iconRef.current) return;
    setCoords(calcCoords(iconRef.current.getBoundingClientRect()));
  }, []);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (isTouch) return;
    hoverTimerRef.current = setTimeout(() => {
      updateCoords();
      setVisible(true);
    }, 200);
  }, [isTouch, updateCoords]);

  const handleMouseLeave = useCallback(() => {
    if (isTouch) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setVisible(false);
  }, [isTouch]);

  // ── Touch handler ──────────────────────────────────────────────────────────
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    updateCoords();
    setVisible(v => !v);
  }, [updateCoords]);

  // Close on outside tap (touch mode)
  useEffect(() => {
    if (!visible || !isTouch) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (
        iconRef.current?.contains(t) === false &&
        tooltipRef.current?.contains(t) === false
      ) setVisible(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [visible, isTouch]);

  // Recalc on scroll/resize so tooltip stays attached to icon
  useEffect(() => {
    if (!visible) return;
    const refresh = () => updateCoords();
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, [visible, updateCoords]);

  // Cleanup hover timer
  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  // ── Style tokens ───────────────────────────────────────────────────────────
  const tooltipBg     = isDark ? 'rgba(13,17,23,0.97)'       : 'rgba(248,250,252,0.97)';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.12)'    : 'rgba(0,0,0,0.1)';
  const tooltipShadow = isDark
    ? '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)'
    : '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)';

  // Portal tooltip style — position:fixed relative to viewport, no ancestor trapping
  const portalStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    width: TOOLTIP_WIDTH,
    ...(coords.openUp
      ? { bottom: window.innerHeight - coords.y, top: 'auto' }
      : { top: coords.y, bottom: 'auto' }),
    left: coords.x,
  };

  // Entrance: slide up 5px if opening below, slide down 5px if opening above
  const yFrom = coords.openUp ? 5 : -5;

  const tooltip = (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={tooltipRef}
          role="tooltip"
          initial={{ opacity: 0, y: yFrom }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: yFrom * 0.5, transition: { duration: 0.1 } }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{
            ...portalStyle,
            background: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            boxShadow: tooltipShadow,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 10,
            padding: '8px 11px',
            pointerEvents: isTouch ? 'auto' : 'none',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
              fontSize: 11,
              lineHeight: 1.55,
              color: isDark ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              fontWeight: 500,
            }}
          >
            {explanation}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <span
        className="inline-flex items-center"
        style={{ verticalAlign: 'middle', lineHeight: 0 }}
      >
        <motion.button
          ref={iconRef}
          type="button"
          aria-label="More information"
          aria-expanded={visible}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={isTouch ? handleTap : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size + 4,
            height: size + 4,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'default',
            flexShrink: 0,
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="info-tooltip-icon"
            style={{
              display: 'block',
              color: isDark ? 'var(--text-faint)' : 'var(--text-faint)',
              opacity: visible ? 0.85 : 0.5,
              transition: 'opacity 0.15s ease',
            }}
          >
            <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1.1" />
            <circle cx="6" cy="3.8" r="0.85" fill="currentColor" />
            <line x1="6" y1="5.6" x2="6" y2="8.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </motion.button>
      </span>

      {/* Rendered into document.body — fully escapes all stacking contexts */}
      {createPortal(tooltip, document.body)}

      <style>{`
        .info-tooltip-icon { transition: opacity 0.15s ease; }
        button:hover .info-tooltip-icon { opacity: 0.85 !important; }
      `}</style>
    </>
  );
};

export default InfoTooltip;
