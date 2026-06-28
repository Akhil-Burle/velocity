/**
 * StatsSection.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the StatsSection component.
 *
 * Requirements: 6.1, 6.4
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import StatsSection from '../sections/StatsSection';
import { STATS } from '../constants/stats';

// ── IntersectionObserver mock ─────────────────────────────────────────────────
// StatCard and useCountUp both use IntersectionObserver internally.
// Mock it as a class so `new IntersectionObserver(...)` succeeds without error.

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {
    // Never fires — element stays "not intersecting" by default
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
}

beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

// ── 1. Renders exactly 3 StatCard elements ────────────────────────────────────

describe('StatsSection structure', () => {
  it('renders exactly 3 stat cards (one per STATS entry)', () => {
    render(<StatsSection reducedMotion={false} />);

    // Each StatCard renders the stat label — query all three from the STATS constant
    const labels = STATS.map((stat) => screen.getByText(stat.label));
    expect(labels).toHaveLength(3);
    labels.forEach((label) => expect(label).toBeInTheDocument());
  });

  it('renders a stat card for each STATS entry by label', () => {
    render(<StatsSection reducedMotion={false} />);

    for (const stat of STATS) {
      expect(screen.getByText(stat.label)).toBeInTheDocument();
    }
  });
});

// ── 2. reducedMotion=true shows final values without count-up ─────────────────

describe('StatsSection reducedMotion', () => {
  it('with reducedMotion=true each card displays its final stat value immediately', () => {
    render(<StatsSection reducedMotion={true} />);

    for (const stat of STATS) {
      // StatCard renders `value` directly when reducedMotion is true:
      // <span ...>{reducedMotion ? value : displayValue}</span>
      // The displayed number is stat.value (a number), so query by its string form.
      const valueEl = screen.getByText(stat.value.toString());
      expect(valueEl).toBeInTheDocument();
    }
  });

  it('with reducedMotion=true displayed values equal stat.value (not 0)', () => {
    render(<StatsSection reducedMotion={true} />);

    for (const stat of STATS) {
      // Ensure the value shown is the actual target, not 0 (which count-up starts at)
      const valueEl = screen.getByText(stat.value.toString());
      expect(valueEl.textContent).toBe(stat.value.toString());

      // Also confirm 0 is NOT shown as the display value for this stat
      // (Note: '0' could appear elsewhere so we verify via the value element itself)
      expect(valueEl.textContent).not.toBe('0');
    }
  });
});

// ── 3. Root element has id="stats" ───────────────────────────────────────────

describe('StatsSection root element', () => {
  it('root <section> element has id="stats"', () => {
    const { container } = render(<StatsSection reducedMotion={false} />);
    const section = container.querySelector('#stats');
    expect(section).not.toBeNull();
    expect(section!.tagName.toLowerCase()).toBe('section');
  });

  it('id="stats" is on the outermost element', () => {
    const { container } = render(<StatsSection reducedMotion={false} />);
    // The very first element child of the container is the root section
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('id', 'stats');
  });
});
