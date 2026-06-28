import { useCallback, useEffect, useRef, useState } from 'react';
import { computeFillRatio } from '../LineSlider';

/**
 * Tracks the page scroll position as a ratio in [0, 1] and detects when the
 * scroll ratio crosses any of the provided milestone thresholds.
 *
 * - Attaches a passive `scroll` listener to `window`
 * - Schedules DOM reads through `requestAnimationFrame` to avoid layout thrash
 * - `ratio` = `scrollY / (scrollHeight - innerHeight)`, clamped to [0, 1]
 * - When `ratio` crosses a milestone, `activeMilestoneIndex` is set to the
 *   milestone's index for 600 ms, then reset to `null`
 *
 * @param milestoneRatios - Sorted array of scroll ratio thresholds (0–1) that
 *                          correspond to major section boundaries
 *
 * Requirements: 5.2, 5.4
 */
export function useScrollProgress(
  milestoneRatios: number[]
): { ratio: number; activeMilestoneIndex: number | null } {
  const [ratio, setRatio] = useState(0);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number | null>(null);

  // Track which milestones have already been crossed to avoid re-firing
  const crossedRef = useRef<Set<number>>(new Set());
  // RAF handle for cancellation on unmount
  const rafRef = useRef<number | null>(null);
  // Timeout handle for resetting activeMilestoneIndex
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a stable reference to the latest milestoneRatios without triggering re-registration
  const milestoneRatiosRef = useRef(milestoneRatios);

  useEffect(() => {
    milestoneRatiosRef.current = milestoneRatios;
  });

  const handleScroll = useCallback(() => {
    // Cancel any pending rAF before scheduling a new one to ensure we only
    // process one update per scroll event burst
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const scrollY = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      const newRatio = computeFillRatio(scrollY, maxScroll);
      setRatio(newRatio);

      // Detect milestone crossings
      const milestones = milestoneRatiosRef.current;
      for (let i = 0; i < milestones.length; i++) {
        if (!crossedRef.current.has(i) && newRatio >= milestones[i]) {
          crossedRef.current.add(i);

          // Clear any pending reset from a previous milestone activation
          if (resetTimerRef.current !== null) {
            clearTimeout(resetTimerRef.current);
          }

          setActiveMilestoneIndex(i);

          resetTimerRef.current = setTimeout(() => {
            resetTimerRef.current = null;
            setActiveMilestoneIndex(null);
          }, 600);
        }
      }
    });
  }, []);

  useEffect(() => {
    // Reset crossed milestones when the milestone list changes
    crossedRef.current = new Set();

    // Run once immediately to capture the current scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [handleScroll]);

  return { ratio, activeMilestoneIndex };
}
