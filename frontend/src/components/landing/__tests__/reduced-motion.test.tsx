/**
 * reduced-motion.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Behavioral tests that verify landing page components respect the
 * `prefers-reduced-motion: reduce` media query.
 *
 * Strategy:
 *   - Mock `window.matchMedia` to return `matches: true` for the
 *     `(prefers-reduced-motion: reduce)` query before rendering each component.
 *   - Assert that each component renders in its final/resting state with no
 *     in-progress animation artefacts.
 *
 * Requirements: 3.6, 4.10, 5.8, 6.4, 7.5, 8.3, 9.5, 11.2
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ─── framer-motion mock ───────────────────────────────────────────────────────
// Strip animation props so jsdom does not complain about unknown DOM attributes.
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, transition: _t, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, initial: _i, animate: _a, transition: _t, ...props }: any) => (
      <span {...props}>{children}</span>
    ),
    li: ({ children, initial: _i, animate: _a, transition: _t, ...props }: any) => (
      <li {...props}>{children}</li>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

// ─── matchMedia helper ────────────────────────────────────────────────────────

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

// ─── IntersectionObserver mock ────────────────────────────────────────────────
// Used by StatCard / useCountUp to detect viewport entry.
// We intentionally never fire the callback so it never triggers count-up,
// allowing the reducedMotion=true path to be the only active rendering path.

class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
}

// ─── rAF capture helpers (shared across describes that need them) ─────────────

let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;
let originalRaf: typeof requestAnimationFrame;
let originalCaf: typeof cancelAnimationFrame;

function setupRafCapture() {
  rafCallbacks = [];
  rafIdCounter = 0;
  originalRaf = window.requestAnimationFrame;
  originalCaf = window.cancelAnimationFrame;

  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    rafIdCounter++;
    rafCallbacks.push(cb);
    return rafIdCounter;
  };
  window.cancelAnimationFrame = (_id: number) => {
    // no-op
  };
}

function teardownRafCapture() {
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCaf;
  rafCallbacks = [];
}

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockMatchMedia(true); // reduced motion ON for all tests in this file

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UltimatumMockup — final separated state with reducedMotion=true
// ═══════════════════════════════════════════════════════════════════════════════

import UltimatumMockup from '../mockups/UltimatumMockup';

describe('UltimatumMockup with reducedMotion=true', () => {
  it('renders exactly two .task-card elements', () => {
    const { container } = render(
      <UltimatumMockup triggered={false} reducedMotion={true} />,
    );
    const cards = container.querySelectorAll('.task-card');
    expect(cards).toHaveLength(2);
  });

  it('renders both task cards (React Lab and Physics Essay)', () => {
    render(<UltimatumMockup triggered={false} reducedMotion={true} />);
    expect(screen.getByText('React Lab')).toBeInTheDocument();
    expect(screen.getByText('Physics Essay')).toBeInTheDocument();
  });

  it('renders task cards in final separated state (no animation in progress)', () => {
    const { container } = render(
      <UltimatumMockup triggered={true} reducedMotion={true} />,
    );
    // Both cards must be present — final state, not hidden/removed
    const cards = container.querySelectorAll('.task-card');
    expect(cards).toHaveLength(2);
  });

  it('conflict header is visible', () => {
    const { container } = render(
      <UltimatumMockup triggered={false} reducedMotion={true} />,
    );
    // The header bar contains the "CONFLICT DETECTED" label
    const header = container.querySelector('[aria-label="Ultimatum conflict mockup"]');
    expect(header).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LineSlider — no particle <span> elements when reduced-motion is active
// ═══════════════════════════════════════════════════════════════════════════════

import LineSlider from '../LineSlider.tsx';

describe('LineSlider with prefers-reduced-motion: reduce', () => {
  beforeEach(() => {
    setupRafCapture();
    // matchMedia already returns matches: true from global beforeEach
  });

  afterEach(() => {
    teardownRafCapture();
  });

  it('renders without error', () => {
    expect(() => render(React.createElement(LineSlider))).not.toThrow();
  });

  it('does not append .ls-particle <span> elements after a milestone-crossing rAF tick', () => {
    const { container } = render(React.createElement(LineSlider));

    // Simulate near-end-of-page scroll (forces milestone crossings)
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 900,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      writable: true,
      configurable: true,
      value: 1100,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 200,
    });
    // maxScroll = 1100 - 200 = 900; scrollY = 900 → fillRatio = 1.0 (all milestones crossed)

    // Fire the first rAF tick registered by LineSlider's useEffect
    const tick = rafCallbacks[0];
    expect(tick).toBeDefined();
    tick(performance.now());

    // Reduced-motion is active — no particle spans should exist
    const particles = container.querySelectorAll('.ls-particle');
    expect(particles.length).toBe(0);
  });

  it('still updates --fill-pct even with reduced-motion active', () => {
    const { container } = render(React.createElement(LineSlider));

    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 500,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 200,
    });
    // maxScroll = 1000; scrollY = 500 → fillPct = 50

    const tick = rafCallbacks[0];
    expect(tick).toBeDefined();
    tick(performance.now());

    const fillEl = container.querySelector('.ls-fill') as HTMLElement | null;
    expect(fillEl).not.toBeNull();
    expect(fillEl!.style.getPropertyValue('--fill-pct')).toBe('50');
  });

  it('does not add milestone-glow class to knob when reduced-motion is active', () => {
    const { container } = render(React.createElement(LineSlider));

    // Scroll to max to trigger all milestones
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 200,
    });

    const tick = rafCallbacks[0];
    expect(tick).toBeDefined();
    tick(performance.now());

    const knob = container.querySelector('.ls-knob');
    expect(knob).not.toBeNull();
    expect(knob!.classList.contains('milestone-glow')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BrainDumpMockup — all task lines visible immediately with reducedMotion=true
// ═══════════════════════════════════════════════════════════════════════════════

import BrainDumpMockup from '../mockups/BrainDumpMockup';

describe('BrainDumpMockup with reducedMotion=true', () => {
  it('renders without throwing', () => {
    expect(() =>
      render(<BrainDumpMockup triggered={false} reducedMotion={true} />),
    ).not.toThrow();
  });

  it('renders all 5 task lines immediately (final state)', () => {
    const { container } = render(
      <BrainDumpMockup triggered={false} reducedMotion={true} />,
    );
    // Each task line renders as a rounded row; the mockup has 5 task lines.
    // We verify by checking that all known task names are in the document.
    expect(screen.getByText('React Lab')).toBeInTheDocument();
    expect(screen.getByText('Physics Essay')).toBeInTheDocument();
    expect(screen.getByText('Email Prof Chen')).toBeInTheDocument();
    expect(screen.getByText('Study for Calc Midterm')).toBeInTheDocument();
    expect(screen.getByText('Submit Lab Report')).toBeInTheDocument();
  });

  it('all task lines are present even when triggered=false (no animation gating)', () => {
    render(<BrainDumpMockup triggered={false} reducedMotion={true} />);
    // With reducedMotion=true, lines appear regardless of triggered
    expect(screen.getByText('React Lab')).toBeInTheDocument();
    expect(screen.getByText('Submit Lab Report')).toBeInTheDocument();
  });

  it('all task lines are present when triggered=true', () => {
    render(<BrainDumpMockup triggered={true} reducedMotion={true} />);
    expect(screen.getByText('React Lab')).toBeInTheDocument();
    expect(screen.getByText('Submit Lab Report')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. StatCard (via StatsSection) — final values displayed without count-up
// ═══════════════════════════════════════════════════════════════════════════════

import StatsSection from '../sections/StatsSection';
import { STATS } from '../constants/stats';

describe('StatsSection / StatCard with reducedMotion=true', () => {
  it('renders without throwing', () => {
    expect(() => render(<StatsSection reducedMotion={true} />)).not.toThrow();
  });

  it('displays the final value 1240 immediately for "tasks analyzed"', () => {
    render(<StatsSection reducedMotion={true} />);
    // STATS[0].value = 1240
    const el = screen.getByText('1240');
    expect(el).toBeInTheDocument();
  });

  it('displays the final value 98 immediately for "on-time delivery"', () => {
    render(<StatsSection reducedMotion={true} />);
    // STATS[1].value = 98
    const el = screen.getByText('98');
    expect(el).toBeInTheDocument();
  });

  it('displays the final value 3 immediately for "velocity boost"', () => {
    render(<StatsSection reducedMotion={true} />);
    // STATS[2].value = 3
    const el = screen.getByText('3');
    expect(el).toBeInTheDocument();
  });

  it('each stat card shows its target value (not 0) immediately', () => {
    render(<StatsSection reducedMotion={true} />);

    for (const stat of STATS) {
      const valueEl = screen.getByText(stat.value.toString());
      expect(valueEl).toBeInTheDocument();
      expect(valueEl.textContent).toBe(stat.value.toString());
      // Must not be showing 0 (the count-up starting value)
      expect(valueEl.textContent).not.toBe('0');
    }
  });

  it('renders exactly 3 stat cards', () => {
    render(<StatsSection reducedMotion={true} />);
    for (const stat of STATS) {
      expect(screen.getByText(stat.label)).toBeInTheDocument();
    }
    expect(STATS).toHaveLength(3);
  });

  it('stat suffixes (+, %, x) are present', () => {
    render(<StatsSection reducedMotion={true} />);
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
