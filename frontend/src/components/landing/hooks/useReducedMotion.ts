import { useEffect, useState } from 'react';

/**
 * Returns the slide-in animation direction for a stat card at the given index.
 * Even-indexed cards slide in from the left; odd-indexed from the right.
 *
 * @param index - Zero-based position of the card in the stats array
 * @returns 'left' when index % 2 === 0, 'right' otherwise
 *
 * Requirements: 6.3
 */
export function getSlideDirection(index: number): 'left' | 'right' {
  return index % 2 === 0 ? 'left' : 'right';
}

/**
 * Returns whether the user has requested reduced motion.
 *
 * Wraps `window.matchMedia('(prefers-reduced-motion: reduce)')` with a
 * MediaQueryList change listener so the returned value stays reactive if the
 * OS preference changes at runtime.
 *
 * Gracefully degrades in SSR environments or browsers without matchMedia by
 * returning `false` (animations enabled).
 *
 * Requirements: 11.2
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    // Guard: SSR or environments without matchMedia
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    // Guard: SSR or environments without matchMedia
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    // Use addEventListener if available (modern), fall back to addListener
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
    } else {
      // Legacy Safari fallback
      mql.addListener(handleChange);
    }

    // Sync initial state in case it changed between render and effect
    setReducedMotion(mql.matches);

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handleChange);
      } else {
        mql.removeListener(handleChange);
      }
    };
  }, []);

  return reducedMotion;
}
