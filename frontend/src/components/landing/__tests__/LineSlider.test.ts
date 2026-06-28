import * as fc from 'fast-check';
import { computeFillRatio } from '../LineSlider';

// Feature: velocity-landing-page, Property 1: Line Slider fill proportion
// Validates: Requirements 5.2

describe('computeFillRatio', () => {
  it('Property 1: fill ratio is always in [0,1] and equals scrollY/maxScroll when not clamped', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),  // scrollY
        fc.integer({ min: 1, max: 10000 }),  // maxScroll
        (scrollY, maxScroll) => {
          const ratio = computeFillRatio(scrollY, maxScroll);
          return (
            ratio >= 0 &&
            ratio <= 1 &&
            (scrollY >= maxScroll
              ? ratio === 1
              : Math.abs(ratio - scrollY / maxScroll) < 1e-9)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('edge case: computeFillRatio(0, 0) returns 0 (maxScroll <= 0 guard)', () => {
    expect(computeFillRatio(0, 0)).toBe(0);
  });
});

// ─── Unit tests for LineSlider component ─────────────────────────────────────
// Requirements: 5.1, 5.8

import { render } from '@testing-library/react';
import React from 'react';
import LineSlider from '../LineSlider.tsx';

describe('LineSlider component', () => {
  // Helper: build a matchMedia mock
  function mockMatchMedia(reducedMotion: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // Store the real rAF so we can restore it
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafIdCounter = 0;
  let originalRaf: typeof requestAnimationFrame;
  let originalCaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    rafIdCounter = 0;
    originalRaf = window.requestAnimationFrame;
    originalCaf = window.cancelAnimationFrame;

    // Capture rAF callbacks without firing them automatically
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafIdCounter++;
      rafCallbacks.push(cb);
      return rafIdCounter;
    };
    window.cancelAnimationFrame = (_id: number) => {
      // no-op in tests
    };

    // Default: no reduced motion
    mockMatchMedia(false);
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
    rafCallbacks = [];
  });

  // ── Test 1: renders without throwing ──────────────────────────────────────
  it('renders without throwing an error', () => {
    expect(() => render(React.createElement(LineSlider))).not.toThrow();
  });

  // ── Test 2: no particle spans when prefers-reduced-motion is active ───────
  it('does not append particle <span> elements when prefers-reduced-motion is active', () => {
    // Enable reduced motion
    mockMatchMedia(true);

    const { container } = render(React.createElement(LineSlider));

    // Simulate being near the end of a page so milestone(s) are crossed
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 1000 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 200 });

    // Fire the captured rAF tick (the first one registered by useEffect)
    const tick = rafCallbacks[0];
    expect(tick).toBeDefined();
    tick(performance.now());

    // No particle <span> elements should have been appended
    const particles = container.querySelectorAll('.ls-particle');
    expect(particles.length).toBe(0);
  });

  // ── Test 3: --fill-pct CSS custom property is updated on scroll ───────────
  it('updates --fill-pct CSS custom property when the rAF tick fires after a scroll', () => {
    const { container } = render(React.createElement(LineSlider));

    // Simulate the page being scrolled 50% of the way down
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 500 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 200 });
    // maxScroll = 1200 - 200 = 1000; scrollY = 500 → fillPct = 50

    // Fire the first rAF tick
    const tick = rafCallbacks[0];
    expect(tick).toBeDefined();
    tick(performance.now());

    // The .ls-fill element carries --fill-pct
    const fillEl = container.querySelector('.ls-fill') as HTMLElement | null;
    expect(fillEl).not.toBeNull();
    expect(fillEl!.style.getPropertyValue('--fill-pct')).toBe('50');
  });
});
