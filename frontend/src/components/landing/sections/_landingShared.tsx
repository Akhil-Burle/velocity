/**
 * _landingShared.tsx
 * Shared motion primitives + glass styling tokens for the upgraded landing page.
 * Keeps the cinematic sections consistent and DRY.
 */
import React, { useRef } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import { useTheme } from '../../../ThemeContext';

/** Signature ease used across the whole product (matches Theme Ripple / app shell). */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Brand accent stops — green → blue → purple. */
export const ACCENT = {
  green: '#22c55e',
  greenBright: '#4ade80',
  blue: '#38bdf8',
  purple: '#818cf8',
  amber: '#f59e0b',
  red: '#ef4444',
} as const;

export const GRADIENT_TEXT: React.CSSProperties = {
  background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 30%, #38bdf8 65%, #818cf8 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

/** True when the active theme is dark. */
export function useIsDark(): boolean {
  const { theme } = useTheme();
  return theme !== 'light';
}

/** Theme-aware colour palette for the landing surfaces. */
export function pal(isDark: boolean) {
  return {
    bg:        isDark ? '#080b10' : '#eef2f8',
    text:      isDark ? '#ffffff' : '#0f172a',
    textSoft:  isDark ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.88)',
    textMute:  isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.62)',
    textFaint: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.5)',
    textDim:   isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(15,23,42,0.4)',
    hairline:  isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)',
    railFaint: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.07)',
    chip:      isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    chipBorder:isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)',
  };
}

/** Reusable glassmorphic card surface, consistent with the floating hero metrics. */
export function glass(accent: string, isDark = true, opacity = 0.22): React.CSSProperties {
  const alpha = Math.round(opacity * 100).toString(16).padStart(2, '0');
  return {
    background: isDark ? 'rgba(13,17,23,0.55)' : 'rgba(255,255,255,0.82)',
    border: `1px solid ${accent}${alpha}`,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: isDark
      ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.8)'
      : '0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 50px -28px rgba(15,23,42,0.25)',
  };
}

export function useReveal(amount = 0.25) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount });
  return { ref, inView };
}

type RevealVariant = 'up' | 'blur' | 'left' | 'right' | 'scale';

const VARIANTS: Record<RevealVariant, Variants> = {
  up: {
    hidden: { opacity: 0, y: 42 },
    show: { opacity: 1, y: 0 },
  },
  blur: {
    hidden: { opacity: 0, y: 24, filter: 'blur(10px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
  },
  left: {
    hidden: { opacity: 0, x: -48 },
    show: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 48 },
    show: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92, y: 24 },
    show: { opacity: 1, scale: 1, y: 0 },
  },
};

interface RevealProps {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  amount?: number;
  className?: string;
  style?: React.CSSProperties;
  reducedMotion?: boolean;
  as?: 'div' | 'section' | 'li';
}

/**
 * Scroll-triggered reveal. Defaults to a soft upward fade but supports a small
 * vocabulary of variants so different sections can enter differently without
 * leaving the shared motion language.
 */
export const Reveal: React.FC<RevealProps> = ({
  children, variant = 'up', delay = 0, duration = 0.7, amount = 0.25,
  className, style, reducedMotion = false,
}) => {
  const { ref, inView } = useReveal(amount);
  const v = VARIANTS[variant];
  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      initial={reducedMotion ? 'show' : 'hidden'}
      animate={inView || reducedMotion ? 'show' : 'hidden'}
      variants={v}
      transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : delay, ease: EASE }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

/** Small eyebrow label used to introduce every section (theme-aware default). */
export const Eyebrow: React.FC<{ color?: string; children: React.ReactNode }> = ({ color, children }) => {
  const isDark = useIsDark();
  const c = color || (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)');
  return <p className="text-[11px] font-mono uppercase tracking-[0.2em] mb-4" style={{ color: c }}>{children}</p>;
};

/** A subtle pointer-tracking tilt wrapper (disabled under reduced motion / touch). */
export const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  reducedMotion?: boolean;
  intensity?: number;
}> = ({ children, className, style, reducedMotion = false, intensity = 6 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - (r.top + r.height / 2)) / r.height) * -intensity;
    const ry = ((e.clientX - (r.left + r.width / 2)) / r.width) * intensity;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={className}
      style={{ transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)', willChange: 'transform', ...style }}>
      {children}
    </div>
  );
};
