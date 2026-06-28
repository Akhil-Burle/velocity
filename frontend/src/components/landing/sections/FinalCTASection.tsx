/**
 * FinalCTASection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Closing call-to-action section at the bottom of the landing page.
 *
 * Presents a bold closing hook headline followed by two CTAs:
 *   - Primary:   "Enter Demo Sandbox" — green gradient, manages its own
 *                `isLoading` state, spinner while loading, hover lift/glow,
 *                press scale-down feedback.
 *   - Secondary: "See how it works"  — ghost/outline style, smooth-scrolls to
 *                #feature-showcase.
 *
 * Motion:
 *   - When `!reducedMotion`: hover → lift + scale + box-shadow glow;
 *                            press  → scale-down.
 *   - When `reducedMotion`:  hover/press use color-change only (no transform).
 *
 * Layout: centered, max-w-3xl, generous vertical padding, text-center.
 * Root element carries `id="cta"` for milestone tracking.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FinalCTASectionProps {
  onEnterDemo: () => void | Promise<void>;
  onSeeHowItWorks: () => void;
  reducedMotion: boolean;
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

/** Inline SVG spinner matching the Design System green accent. */
const Spinner: React.FC = () => (
  <svg
    aria-hidden="true"
    className="animate-spin"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="10"
      cy="10"
      r="8"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth="3"
    />
    <path
      d="M10 2 a8 8 0 0 1 8 8"
      stroke="white"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

// ─── FinalCTASection ──────────────────────────────────────────────────────────

const FinalCTASection: React.FC<FinalCTASectionProps> = ({
  onEnterDemo,
  onSeeHowItWorks,
  reducedMotion,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // ── Viewport entry — fade/slide section in ──────────────────────────────────
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  // ── Primary CTA click ───────────────────────────────────────────────────────
  const handleEnterDemo = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onEnterDemo();
    } finally {
      // If navigation occurs the component will unmount; setIsLoading(false)
      // is still safe to call even if unmounted (React 18 no-ops it).
      setIsLoading(false);
    }
  };

  // ── Animation config ────────────────────────────────────────────────────────
  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const shouldReveal = reducedMotion || isVisible;

  return (
    <section
      id="cta"
      ref={sectionRef}
      className="w-full px-5 sm:px-8 py-24 sm:py-32"
      style={{ minHeight: '400px' }}
    >
      <motion.div
        initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
        animate={shouldReveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.7, ease }}
        className="max-w-3xl mx-auto text-center"
      >
        {/* ── Eyebrow label ─────────────────────────────────────────────────── */}
        <p
          className="text-xs font-mono uppercase tracking-widest mb-5"
          style={{ color: '#22c55e' }}
        >
          Try it now — no setup required
        </p>

        {/* ── Closing headline ──────────────────────────────────────────────── */}
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5"
          style={{ color: 'var(--text-primary)' }}
        >
          Ready to stop pretending
          <br className="hidden sm:block" />
          {' '}everything fits?
        </h2>

        {/* ── Supporting copy ───────────────────────────────────────────────── */}
        <p
          className="text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Enter the demo sandbox and see Velocity make a hard call — in under
          thirty seconds.
        </p>

        {/* ── CTA row ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Primary CTA — "Enter Demo Sandbox" */}
          <PrimaryButton
            isLoading={isLoading}
            reducedMotion={reducedMotion}
            onClick={handleEnterDemo}
          />

          {/* Secondary CTA — "See how it works" */}
          <SecondaryButton
            reducedMotion={reducedMotion}
            onClick={onSeeHowItWorks}
          />
        </div>
      </motion.div>
    </section>
  );
};

// ─── PrimaryButton ─────────────────────────────────────────────────────────────

interface PrimaryButtonProps {
  isLoading: boolean;
  reducedMotion: boolean;
  onClick: () => void;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  isLoading,
  reducedMotion,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Reduced motion: color-change feedback only (no transforms)
  const reducedMotionHoverStyle: React.CSSProperties = hovered
    ? { background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }
    : {};

  // Full motion: lift + scale + glow on hover; scale-down on press
  const fullMotionStyle: React.CSSProperties =
    hovered && !pressed
      ? {
          transform: 'translateY(-3px) scale(1.04)',
          boxShadow: '0 8px 32px rgba(34, 197, 94, 0.45)',
        }
      : pressed
        ? { transform: 'scale(0.96)', boxShadow: 'none' }
        : {};

  const dynamicStyle: React.CSSProperties = reducedMotion
    ? reducedMotionHoverStyle
    : fullMotionStyle;

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-label={isLoading ? 'Loading demo sandbox…' : 'Enter Demo Sandbox'}
      className="inline-flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-base font-semibold text-white select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        transition: reducedMotion
          ? 'background 0.2s ease'
          : 'transform 0.18s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s cubic-bezier(0.16,1,0.3,1), background 0.18s ease',
        ...dynamicStyle,
        // Ensure disabled state doesn't carry hover transform
        ...(isLoading ? { transform: 'none', boxShadow: 'none' } : {}),
      }}
    >
      {isLoading ? (
        <>
          <Spinner />
          <span>Loading…</span>
        </>
      ) : (
        'Enter Demo Sandbox'
      )}
    </button>
  );
};

// ─── SecondaryButton ───────────────────────────────────────────────────────────

interface SecondaryButtonProps {
  reducedMotion: boolean;
  onClick: () => void;
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  reducedMotion,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const hoverStyle: React.CSSProperties = hovered
    ? reducedMotion
      ? { color: 'var(--text-primary)', borderColor: 'var(--text-secondary)' }
      : {
          color: 'var(--text-primary)',
          borderColor: 'var(--text-secondary)',
          transform: 'translateY(-2px)',
        }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center rounded-2xl px-8 py-4 text-base font-semibold select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
      style={{
        color: 'var(--text-secondary)',
        background: 'transparent',
        border: '1.5px solid var(--border-subtle)',
        transition: reducedMotion
          ? 'color 0.2s ease, border-color 0.2s ease'
          : 'color 0.18s ease, border-color 0.18s ease, transform 0.18s cubic-bezier(0.16,1,0.3,1)',
        ...hoverStyle,
      }}
    >
      See how it works
    </button>
  );
};

export default FinalCTASection;
