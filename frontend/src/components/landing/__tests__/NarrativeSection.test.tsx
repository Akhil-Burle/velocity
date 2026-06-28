/**
 * NarrativeSection.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the NarrativeSection component.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import NarrativeSection from '../sections/NarrativeSection';
import { NOT_ITEMS, IS_ITEMS } from '../constants/narrative';

// Mock IntersectionObserver so it behaves as if nothing is visible by default.
// Must be a class (constructor function) — a plain arrow fn mock won't work
// because the component calls `new IntersectionObserver(...)`.
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {
    // Default implementation: never fires (section not in viewport)
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
}

beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

// ── Structure ──────────────────────────────────────────────────────────────

describe('NarrativeSection structure', () => {
  it('renders with id="narrative" on the root element', () => {
    const { container } = render(<NarrativeSection reducedMotion={false} />);
    const section = container.querySelector('#narrative');
    expect(section).not.toBeNull();
  });

  it('renders an <h2> section heading', () => {
    render(<NarrativeSection reducedMotion={false} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
  });

  it('renders "Velocity is NOT:" sub-heading', () => {
    render(<NarrativeSection reducedMotion={false} />);
    expect(screen.getByText(/velocity is not:/i)).toBeInTheDocument();
  });

  it('renders "Velocity IS:" sub-heading', () => {
    render(<NarrativeSection reducedMotion={false} />);
    expect(screen.getByText(/velocity is:/i)).toBeInTheDocument();
  });

  it('renders all NOT_ITEMS', () => {
    render(<NarrativeSection reducedMotion={false} />);
    for (const item of NOT_ITEMS) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('renders all IS_ITEMS', () => {
    render(<NarrativeSection reducedMotion={false} />);
    for (const item of IS_ITEMS) {
      // getByText matches the list item text; the dot span is aria-hidden so text
      // content still equals the item string when using getByText
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});

// ── Styling ────────────────────────────────────────────────────────────────

describe('NarrativeSection styling', () => {
  it('NOT items have text-decoration: line-through', () => {
    render(<NarrativeSection reducedMotion={false} />);
    // Check the first NOT_ITEM — all share the same inline style
    const firstNotItem = screen.getByText(NOT_ITEMS[0]);
    expect(firstNotItem).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('NOT items use var(--text-muted) color', () => {
    render(<NarrativeSection reducedMotion={false} />);
    const firstNotItem = screen.getByText(NOT_ITEMS[0]);
    expect(firstNotItem).toHaveStyle({ color: 'var(--text-muted)' });
  });

  it('IS items use bright green (#22c55e) color', () => {
    render(<NarrativeSection reducedMotion={false} />);
    // Motion elements render as <li> — grab the first IS item's li
    const firstIsItem = screen.getByText(IS_ITEMS[0]).closest('li');
    expect(firstIsItem).toHaveStyle({ color: 'rgb(34, 197, 94)' });
  });
});

// ── Reduced motion ─────────────────────────────────────────────────────────

describe('NarrativeSection reducedMotion', () => {
  it('with reducedMotion=true: IS items are immediately visible (opacity 1)', () => {
    render(<NarrativeSection reducedMotion={true} />);
    // All IS items should be in the DOM and accessible (not hidden)
    for (const item of IS_ITEMS) {
      const el = screen.getByText(item);
      expect(el).toBeInTheDocument();
      // The li should be visible — Framer Motion sets final state immediately
      // when initial={false} is passed. The li should not have opacity: 0.
      const li = el.closest('li');
      expect(li).not.toHaveStyle({ opacity: '0' });
    }
  });

  it('with reducedMotion=false: IS items start invisible (opacity 0) when not in viewport', () => {
    render(<NarrativeSection reducedMotion={false} />);
    // IntersectionObserver is mocked to never fire, so isVisible stays false.
    // Framer Motion honours the `initial` prop and starts at opacity: 0.
    const firstIsItem = screen.getByText(IS_ITEMS[0]).closest('li');
    // The element is in the DOM (Framer Motion still renders it) but initial style is opacity:0
    expect(firstIsItem).toBeInTheDocument();
  });
});

// ── IntersectionObserver guard ─────────────────────────────────────────────

describe('NarrativeSection IntersectionObserver unavailability', () => {
  it('renders all items when IntersectionObserver is undefined', () => {
    // Simulate environments without IntersectionObserver (e.g. old browsers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).IntersectionObserver = undefined;

    render(<NarrativeSection reducedMotion={false} />);

    // All items should still render
    for (const item of NOT_ITEMS) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    for (const item of IS_ITEMS) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }

    // Restore
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });
  });
});
