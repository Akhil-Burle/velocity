/**
 * MotionContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads the OS/browser `prefers-reduced-motion` media query and exposes a
 * `reducedMotion` boolean via context.
 *
 * - Normal power mode  → false  → full animations play as designed
 * - Power saving / OS reduced-motion → true → lighter transitions only
 *
 * Components consume this via `useMotionPreference()` and swap their
 * Framer Motion variants accordingly. No prop drilling needed.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

interface MotionContextValue {
  reducedMotion: boolean;
}

const MotionContext = createContext<MotionContextValue>({ reducedMotion: false });

export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reducedMotion, setReducedMotion] = useState(() => {
    // Read synchronously on first render to avoid a flash
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    // Use addEventListener with fallback for older Safari
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  return (
    <MotionContext.Provider value={{ reducedMotion }}>
      {children}
    </MotionContext.Provider>
  );
};

/** Returns true when the OS/browser requests reduced motion (e.g. power saving mode). */
export function useMotionPreference(): boolean {
  return useContext(MotionContext).reducedMotion;
}
