/**
 * FeatureSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A single feature section used in FeatureShowcase. Renders a two-column grid
 * (text column + mockup column) with a scroll-triggered entrance animation.
 *
 * Layout alternation:
 *   - `layout === 'text-left'`  → text on left, mockup on right
 *   - `layout === 'text-right'` → mockup on left, text on right
 *
 * Animation:
 *   - IntersectionObserver (threshold: 0.15) sets `isVisible` state.
 *   - When `isVisible && !reducedMotion`: Framer Motion animates the section
 *     from y: 40, opacity: 0 → y: 0, opacity: 1 using
 *     cubic-bezier(0.16, 1, 0.3, 1) over 0.6s.
 *   - When `reducedMotion`: section renders in its final visible state immediately.
 *   - Guard: if IntersectionObserver is unavailable, isVisible is set to true
 *     immediately so the section renders without waiting.
 *
 * Mockup:
 *   The `mockupComponent` prop is a React component constructor. It is
 *   rendered directly with `triggered={isVisible}` and `reducedMotion` injected
 *   as props — no cloneElement gymnastics needed.
 *
 * Design System surface:
 *   - background: var(--bg-card)
 *   - border: 1px solid var(--border-subtle)
 *   - backdrop-filter: blur(12px)
 *
 * Requirements: 4.2, 4.3, 4.10, 10.7
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MockupComponentProps {
  triggered: boolean;
  reducedMotion: boolean;
}

export interface FeatureSectionProps {
  /** HTML id attribute — used by nav and IntersectionObserver */
  id: string;
  /** Short label displayed in the badge above the headline, e.g. "Brain Dump" */
  label: string;
  /** Main feature headline rendered as an <h2> */
  headline: string;
  /** Body copy paragraph describing the feature */
  description: string;
  /**
   * The mockup component constructor. Receives `triggered` and `reducedMotion`
   * as props automatically.
   */
  mockupComponent: React.ComponentType<MockupComponentProps>;
  /** Which column holds the text content */
  layout: 'text-left' | 'text-right';
  /** When true, skip all motion and render in final visible state immediately */
  reducedMotion: boolean;
}

// ─── Framer Motion variants ───────────────────────────────────────────────────

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
  // Reduced motion: render immediately in final state, no transition cost
  instant: { opacity: 1, y: 0 },
};

// ─── Component ────────────────────────────────────────────────────────────────

const FeatureSection: React.FC<FeatureSectionProps> = ({
  id,
  label,
  headline,
  description,
  mockupComponent: MockupComponent,
  layout,
  reducedMotion,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // ── IntersectionObserver setup ──────────────────────────────────────────────
  useEffect(() => {
    // Guard: environments without IntersectionObserver (SSR, old browsers)
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, no need to keep observing — unobserve for perf
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  // ── Column content ──────────────────────────────────────────────────────────

  const textColumn = (
    <div className="flex flex-col justify-center gap-4">
      {/* Label badge */}
      <span
        className="inline-flex items-center self-start px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
        style={{
          color: '#22c55e',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
      >
        {label}
      </span>

      {/* Feature headline */}
      <h2
        className="text-2xl sm:text-3xl font-bold leading-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {headline}
      </h2>

      {/* Description paragraph */}
      <p
        className="text-base leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {description}
      </p>
    </div>
  );

  const mockupColumn = (
    <div className="flex items-center justify-center">
      <div className="w-full">
        <MockupComponent triggered={isVisible} reducedMotion={reducedMotion} />
      </div>
    </div>
  );

  // ── Layout: which column is first? ──────────────────────────────────────────
  // 'text-left'  → [text, mockup]
  // 'text-right' → [mockup, text]
  const firstCol  = layout === 'text-left' ? textColumn  : mockupColumn;
  const secondCol = layout === 'text-left' ? mockupColumn : textColumn;

  // ── Animation state ─────────────────────────────────────────────────────────
  const animateState = reducedMotion
    ? 'instant'
    : isVisible
      ? 'visible'
      : 'hidden';

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      id={id}
      ref={sectionRef}
      variants={SECTION_VARIANTS}
      initial={reducedMotion ? 'instant' : 'hidden'}
      animate={animateState}
      className="rounded-2xl px-6 py-10 sm:px-10 sm:py-14"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        minHeight: '300px',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {firstCol}
        {secondCol}
      </div>
    </motion.div>
  );
};

export default FeatureSection;
