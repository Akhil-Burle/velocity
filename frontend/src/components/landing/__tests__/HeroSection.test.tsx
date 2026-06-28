/**
 * HeroSection.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the HeroSection component.
 *
 * HeroSection receives:
 *   onEnterDemo      – called when visitor clicks "Enter Demo Sandbox"
 *   onSeeHowItWorks  – called when visitor clicks "See how it works"
 *   reducedMotion    – skips scale/lift animations
 *
 * Note: HeroSection does NOT call loginWithCredentials directly — it simply
 * calls the onEnterDemo prop. The LandingPage parent is responsible for auth.
 *
 * Requirements: 3.1, 12.1, 12.3, 12.5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroSection from '../sections/HeroSection';

// ── framer-motion mock ────────────────────────────────────────────────────────
// Replaces animated primitives with their plain HTML equivalents so jsdom
// doesn't choke on animation-related internals.

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// ── UltimatumMockup mock ──────────────────────────────────────────────────────
// Avoids rendering the full animated mockup in tests focused on HeroSection.

vi.mock('../mockups/UltimatumMockup', () => ({
  default: () => <div data-testid="ultimatum-mockup" />,
}));

// ── IntersectionObserver mock ─────────────────────────────────────────────────

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

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHero(overrides: Partial<React.ComponentProps<typeof HeroSection>> = {}) {
  const props = {
    onEnterDemo: vi.fn(),
    onSeeHowItWorks: vi.fn(),
    reducedMotion: false,
    ...overrides,
  };
  return { ...render(<HeroSection {...props} />), props };
}

// ── 1. Renders exactly one <h1> ───────────────────────────────────────────────

describe('HeroSection heading hierarchy', () => {
  it('renders exactly one <h1> element', () => {
    const { container } = renderHero();
    const headings = container.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
  });

  it('the single <h1> contains meaningful text', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1.textContent).not.toBe('');
  });
});

// ── 2. "Enter Demo Sandbox" button is in the DOM ──────────────────────────────

describe('HeroSection primary CTA button', () => {
  it('renders the "Enter Demo Sandbox" button', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    expect(btn).toBeInTheDocument();
  });

  it('"Enter Demo Sandbox" button is enabled by default', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    expect(btn).not.toBeDisabled();
  });
});

// ── 3. Clicking "Enter Demo Sandbox" calls onEnterDemo prop ──────────────────

describe('HeroSection primary CTA interaction', () => {
  it('calls onEnterDemo when "Enter Demo Sandbox" is clicked', () => {
    const { props } = renderHero();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    fireEvent.click(btn);
    expect(props.onEnterDemo).toHaveBeenCalledTimes(1);
  });

  it('does not call onSeeHowItWorks when "Enter Demo Sandbox" is clicked', () => {
    const { props } = renderHero();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    fireEvent.click(btn);
    expect(props.onSeeHowItWorks).not.toHaveBeenCalled();
  });
});

// ── 4. Secondary CTA calls onSeeHowItWorks on click ──────────────────────────

describe('HeroSection secondary CTA interaction', () => {
  it('renders the "See how it works" button', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    expect(btn).toBeInTheDocument();
  });

  it('calls onSeeHowItWorks when "See how it works" is clicked', () => {
    const { props } = renderHero();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    fireEvent.click(btn);
    expect(props.onSeeHowItWorks).toHaveBeenCalledTimes(1);
  });

  it('does not call onEnterDemo when "See how it works" is clicked', () => {
    const { props } = renderHero();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    fireEvent.click(btn);
    expect(props.onEnterDemo).not.toHaveBeenCalled();
  });
});

// ── 5. Root element has id="hero" ─────────────────────────────────────────────

describe('HeroSection root element', () => {
  it('has id="hero" on the root section element', () => {
    const { container } = renderHero();
    const root = container.querySelector('#hero');
    expect(root).not.toBeNull();
    expect(root?.tagName.toLowerCase()).toBe('section');
  });

  it('id="hero" is present with reducedMotion=true', () => {
    const { container } = renderHero({ reducedMotion: true });
    expect(container.querySelector('#hero')).not.toBeNull();
  });
});
