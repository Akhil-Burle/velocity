/**
 * StatsSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Statistics section displaying three Stat_Cards with count-up animation and
 * alternating slide-in directions as the section enters the viewport.
 *
 * - Uses `useCountUp` hook for per-card count-up animation
 * - Uses `getSlideDirection(index)` for alternating slide-in direction
 * - Respects `reducedMotion`: displays final values immediately, no animation
 * - Renders exactly 3 StatCards from the STATS constant
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '../hooks/useCountUp';
import { getSlideDirection } from '../hooks/useReducedMotion';
import { STATS } from '../constants/stats';

// ─── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: number;
  suffix: string;
  label: string;
  sublabel?: string;
  index: number;
  reducedMotion: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  value,
  suffix,
  label,
  sublabel,
  index,
  reducedMotion,
}) => {
  const { displayValue, ref } = useCountUp(value);
  const direction = getSlideDirection(index);

  // Track viewport entry for slide-in animation
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [reducedMotion]);

  // Slide-in animation config
  const slideX = direction === 'left' ? -40 : 40;

  return (
    <motion.div
      ref={cardRef}
      initial={reducedMotion ? false : { x: slideX, opacity: 0 }}
      animate={
        reducedMotion
          ? { x: 0, opacity: 1 }
          : isVisible
            ? { x: 0, opacity: 1 }
            : { x: slideX, opacity: 0 }
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1],
            }
      }
      className="flex flex-col items-center justify-center rounded-xl px-6 py-8 text-center"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Count-up number + suffix */}
      <div className="flex items-end justify-center gap-0.5 mb-3">
        <span
          ref={ref as React.RefObject<HTMLSpanElement>}
          className="text-5xl font-bold tabular-nums leading-none"
          style={{ color: 'var(--text-primary)' }}
          aria-live="polite"
          aria-label={`${reducedMotion ? value : displayValue}${suffix}`}
        >
          {reducedMotion ? value : displayValue}
        </span>
        <span
          className="text-3xl font-bold leading-none mb-0.5"
          style={{ color: '#22c55e' }}
          aria-hidden="true"
        >
          {suffix}
        </span>
      </div>

      {/* Label */}
      <span
        className="text-sm font-semibold tracking-wide uppercase"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>

      {/* Sublabel */}
      {sublabel && (
        <span
          className="text-xs mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {sublabel}
        </span>
      )}
    </motion.div>
  );
};

// ─── StatsSection ──────────────────────────────────────────────────────────────

interface StatsSectionProps {
  reducedMotion: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({ reducedMotion }) => {
  return (
    <section id="stats" className="py-20 px-5 sm:px-8" style={{ minHeight: '300px' }}>
      <div className="max-w-4xl mx-auto">
        {/* Section heading */}
        <h2
          className="text-center text-2xl sm:text-3xl font-bold mb-10"
          style={{ color: 'var(--text-primary)' }}
        >
          Real outcomes, real users
        </h2>

        {/* 3-column stat grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STATS.map((stat, index) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              sublabel={stat.sublabel}
              index={index}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
