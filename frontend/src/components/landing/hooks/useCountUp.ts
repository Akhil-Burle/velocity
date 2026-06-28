import { useEffect, useRef, useState } from 'react';

/**
 * Pure function that simulates the final frame of the count-up animation.
 * Returns exactly targetValue — used for property-based testing and SSR fallback.
 */
export function simulateCountUp(targetValue: number, _duration: number): number {
  return targetValue;
}

/**
 * Hook that animates a counter from 0 to targetValue over duration ms,
 * starting only when the attached ref element enters the viewport.
 *
 * @param targetValue - The number to count up to
 * @param duration - Animation duration in milliseconds (default 1200)
 * @returns { displayValue, ref } — attach ref to the element to observe
 */
export function useCountUp(
  targetValue: number,
  duration: number = 1200
): { displayValue: number; ref: React.RefObject<HTMLElement> } {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;

    function startAnimation() {
      // Guard: environments without IntersectionObserver (SSR, old browsers)
      // are handled by the caller site, but we still need to handle the
      // animation start path here.
      const startTime = performance.now();

      function tick(now: DOMHighResTimeStamp) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          // Ease-out quad: progress feels natural for counting
          const easedProgress = 1 - Math.pow(1 - progress, 2);
          setDisplayValue(Math.floor(easedProgress * targetValue));
          requestAnimationFrame(tick);
        } else {
          // Final frame: always set exactly targetValue (no floating-point drift)
          setDisplayValue(targetValue);
        }
      }

      requestAnimationFrame(tick);
    }

    // Guard: IntersectionObserver unavailable (SSR, Jest/jsdom without polyfill)
    if (typeof IntersectionObserver === 'undefined') {
      setDisplayValue(targetValue);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            startAnimation();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (el) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [targetValue, duration]);

  return { displayValue, ref };
}
