/**
 * Unit tests for useScrollProgress hook
 *
 * Requirements: 5.2, 5.4
 */
// Note: vitest globals (describe, it, expect, vi, beforeEach, afterEach) are
// available without import because globals: true is set in vite.config.ts.
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScrollProgress } from '../../hooks/useScrollProgress';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setScrollState(scrollY: number, scrollHeight: number, innerHeight: number) {
  Object.defineProperty(window, 'scrollY', {
    value: scrollY,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: innerHeight,
    writable: true,
    configurable: true,
  });
}

function fireScrollEvent() {
  window.dispatchEvent(new Event('scroll'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useScrollProgress', () => {
  beforeEach(() => {
    // Default: page height 2000px, viewport 500px → maxScroll = 1500
    setScrollState(0, 2000, 500);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('returns ratio 0 and no active milestone on mount', () => {
    const { result } = renderHook(() => useScrollProgress([]));
    expect(result.current.ratio).toBe(0);
    expect(result.current.activeMilestoneIndex).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Ratio calculation — Requirement 5.2
  // -------------------------------------------------------------------------

  it('updates ratio proportionally when the user scrolls', async () => {
    const { result } = renderHook(() => useScrollProgress([]));

    setScrollState(750, 2000, 500); // scrollY=750, maxScroll=1500 → 0.5
    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.ratio).toBeCloseTo(0.5);
    });
  });

  it('clamps ratio to 1 when scrolled past the bottom', async () => {
    const { result } = renderHook(() => useScrollProgress([]));

    setScrollState(2000, 2000, 500); // scrollY > maxScroll
    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.ratio).toBe(1);
    });
  });

  it('returns ratio 0 when maxScroll is 0 (non-scrollable page)', async () => {
    setScrollState(0, 500, 500); // scrollHeight === innerHeight → maxScroll = 0
    const { result } = renderHook(() => useScrollProgress([]));

    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.ratio).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Milestone detection — Requirement 5.4
  // -------------------------------------------------------------------------

  it('sets activeMilestoneIndex when a milestone threshold is crossed', async () => {
    const { result } = renderHook(() => useScrollProgress([0.25, 0.5, 0.75]));

    setScrollState(375, 2000, 500); // ratio = 0.25 → crosses milestone 0
    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.activeMilestoneIndex).toBe(0);
    });
  });

  it('resets activeMilestoneIndex to null after 600ms', async () => {
    // Use real timers for this test so waitFor + actual setTimeout both work
    const { result } = renderHook(() => useScrollProgress([0.25]));

    setScrollState(375, 2000, 500); // crosses milestone 0
    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.activeMilestoneIndex).toBe(0);
    });

    // Wait for the 600ms reset timer to fire
    await waitFor(
      () => {
        expect(result.current.activeMilestoneIndex).toBeNull();
      },
      { timeout: 1500 }
    );
  });

  it('does not re-fire the same milestone once already crossed', async () => {
    const { result } = renderHook(() => useScrollProgress([0.25]));

    // Cross milestone 0 → activates
    setScrollState(375, 2000, 500);
    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.activeMilestoneIndex).toBe(0);
    });

    // Wait for the reset timeout (600ms)
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    expect(result.current.activeMilestoneIndex).toBeNull();

    // Scroll back to top
    setScrollState(0, 2000, 500);
    act(() => { fireScrollEvent(); });

    // Scroll past the same threshold again — should NOT re-activate
    setScrollState(375, 2000, 500);
    act(() => { fireScrollEvent(); });

    // Small wait to confirm it stays null
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(result.current.activeMilestoneIndex).toBeNull();
  });

  it('activates the correct milestone index for a specific threshold', async () => {
    const { result } = renderHook(() => useScrollProgress([0.5]));

    setScrollState(750, 2000, 500); // ratio = 0.5 → crosses milestone 0
    act(() => { fireScrollEvent(); });

    await waitFor(() => {
      expect(result.current.activeMilestoneIndex).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('removes the scroll listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useScrollProgress([]));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('registers the scroll listener as passive', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useScrollProgress([]));

    const scrollCall = addEventListenerSpy.mock.calls.find(([event]) => event === 'scroll');
    expect(scrollCall).toBeDefined();
    expect(scrollCall?.[2]).toMatchObject({ passive: true });
  });
});
