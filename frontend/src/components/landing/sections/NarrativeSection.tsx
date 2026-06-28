/**
 * NarrativeSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Side-by-side "What Velocity is NOT" vs "What Velocity IS" narrative section.
 *
 * Layout:
 *   Two-column grid (stacks to single column on mobile).
 *   Left column  – NOT items with line-through styling in muted color.
 *   Right column – IS items in bright primary green.
 *
 * Animation (when `!reducedMotion` and section enters viewport):
 *   IS items slide in from x: 20 → 0, opacity: 0 → 1 with 80ms stagger.
 *   NOT items are always rendered in final state (no animation).
 *   When `reducedMotion`: all items rendered in final state immediately.
 *
 * Props: { reducedMotion: boolean }
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { NOT_ITEMS, IS_ITEMS } from '../constants/narrative';

interface NarrativeSectionProps {
  reducedMotion: boolean;
}

/** 80ms stagger between each IS item */
const STAGGER_DELAY_S = 0.08;

const NarrativeSection: React.FC<NarrativeSectionProps> = ({ reducedMotion }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Guard: if IntersectionObserver is unavailable, show everything immediately
    if (typeof IntersectionObserver === 'undefined') {
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
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const shouldAnimate = isVisible && !reducedMotion;

  return (
    <section
      id="narrative"
      ref={sectionRef}
      className="relative py-20 sm:py-28 px-5 sm:px-8"
      style={{ minHeight: '400px' }}
    >
      {/* Section heading */}
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12"
          style={{ color: 'var(--text-primary)' }}
        >
          What makes Velocity different?
        </h2>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* ── Left column: NOT items ──────────────────────────────────── */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <h3
              className="text-base font-semibold mb-5 tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Velocity is NOT:
            </h3>

            <ul className="flex flex-col gap-3">
              {NOT_ITEMS.map((item) => (
                <li
                  key={item}
                  className="text-sm sm:text-base"
                  style={{
                    textDecoration: 'line-through',
                    color: 'var(--text-muted)',
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Right column: IS items ───────────────────────────────────── */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(34,197,94,0.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <h3
              className="text-base font-semibold mb-5 tracking-wide"
              style={{ color: '#22c55e' }}
            >
              Velocity IS:
            </h3>

            <ul className="flex flex-col gap-3">
              {IS_ITEMS.map((item, index) => (
                <motion.li
                  key={item}
                  initial={reducedMotion ? false : { opacity: 0, x: 20 }}
                  animate={
                    reducedMotion
                      ? { opacity: 1, x: 0 }
                      : shouldAnimate
                        ? { opacity: 1, x: 0 }
                        : { opacity: 0, x: 20 }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.4,
                          delay: index * STAGGER_DELAY_S,
                          ease: [0.16, 1, 0.3, 1],
                        }
                  }
                  className="flex items-start gap-2.5 text-sm sm:text-base"
                  style={{ color: '#22c55e' }}
                >
                  {/* Leading dot accent */}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-[0.4em]"
                    style={{ background: '#22c55e' }}
                    aria-hidden="true"
                  />
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeSection;
