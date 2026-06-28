/**
 * TestimonialSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a single testimonial quote block with a staggered fade-in animation
 * when the section enters the viewport (unless reducedMotion is active).
 *
 * Layout: center-aligned, large decorative quote marks, Design System card
 * surface styling.
 *
 * Props:
 *   reducedMotion – when true, renders quote fully visible immediately with
 *                   no animation
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface TestimonialSectionProps {
  reducedMotion: boolean;
}

const QUOTE_TEXT =
  'Velocity changed how I handle deadline conflicts. Instead of silently failing, I make the call and move on. That mental shift alone is worth it.';
const ATTRIBUTION = '— Alex R., Computer Science student';

const TestimonialSection: React.FC<TestimonialSectionProps> = ({ reducedMotion }) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // IntersectionObserver — trigger when 30% of the section is in view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

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
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When reducedMotion is active, treat the section as always visible
  const shouldReveal = reducedMotion || isVisible;

  // Shared transition curve used across the Design System
  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

  return (
    <section
      id="testimonial"
      ref={sectionRef}
      className="w-full flex flex-col items-center px-5 sm:px-8 py-20 sm:py-28"
      style={{ minHeight: '300px' }}
    >
      {/* Section label */}
      <motion.p
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={shouldReveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.55, ease }}
        className="text-xs font-mono uppercase tracking-widest mb-10"
        style={{ color: '#22c55e' }}
      >
        What students are saying
      </motion.p>

      {/* Card */}
      <motion.div
        initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        animate={shouldReveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease }}
        className="relative max-w-2xl w-full rounded-2xl px-8 sm:px-12 pt-10 pb-8 text-center"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Decorative opening quote mark */}
        <span
          aria-hidden="true"
          className="absolute -top-5 left-8 sm:left-12 select-none font-serif leading-none"
          style={{
            fontSize: '6rem',
            lineHeight: 1,
            color: 'rgba(34,197,94,0.18)',
          }}
        >
          &#8220;
        </span>

        {/* Quote text — fades in first */}
        <motion.blockquote
          initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          animate={shouldReveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.65, ease, delay: 0.1 }
          }
          className="text-base sm:text-lg leading-relaxed font-medium mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          {QUOTE_TEXT}
        </motion.blockquote>

        {/* Attribution — fades in 200ms after the quote text */}
        <motion.p
          initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={shouldReveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.55, ease, delay: 0.3 }
          }
          className="text-sm font-mono"
          style={{ color: 'var(--text-secondary)' }}
        >
          {ATTRIBUTION}
        </motion.p>

        {/* Decorative closing quote mark */}
        <span
          aria-hidden="true"
          className="absolute -bottom-8 right-8 sm:right-12 select-none font-serif leading-none"
          style={{
            fontSize: '6rem',
            lineHeight: 1,
            color: 'rgba(34,197,94,0.18)',
          }}
        >
          &#8221;
        </span>
      </motion.div>
    </section>
  );
};

export default TestimonialSection;
