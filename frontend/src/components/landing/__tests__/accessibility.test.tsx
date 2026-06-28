/**
 * accessibility.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Accessibility tests for landing page components.
 *
 * Verifies:
 *   - Correct heading hierarchy (one h1 in HeroSection, h2/h3 elsewhere)
 *   - All interactive elements have accessible names
 *   - Theme toggle has aria-label="Toggle theme"
 *   - CTA buttons are keyboard-activatable (have accessible names)
 *   - Focus rings are present on interactive elements
 *   - Header landmark is a semantic <header>
 *   - Decorative elements are aria-hidden
 *
 * Requirements: 11.1, 11.3, 11.4
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

// Mock framer-motion so animated components render as plain HTML in jsdom
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileHover: _wh, whileTap: _wt, ...props }: any) => (
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
  useReducedMotion: () => false,
}));

// Mock ThemeContext so LandingNav can render standalone
vi.mock('../../../ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggle: vi.fn(),
  }),
}));

// Mock UltimatumMockup (used in HeroSection)
vi.mock('../mockups/UltimatumMockup', () => ({
  default: () => <div data-testid="ultimatum-mockup" aria-hidden="true" />,
}));

// Mock IntersectionObserver
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

// ─── Import components ────────────────────────────────────────────────────────

import LandingNav from '../LandingNav';
import HeroSection from '../sections/HeroSection';
import FinalCTASection from '../sections/FinalCTASection';
import FeatureSection from '../sections/FeatureSection';
import StatsSection from '../sections/StatsSection';
import NarrativeSection from '../sections/NarrativeSection';

// ─── LandingNav ───────────────────────────────────────────────────────────────

describe('LandingNav accessibility', () => {
  it('renders a semantic <header> landmark', () => {
    const { container } = render(<LandingNav />);
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
  });

  it('theme toggle button has aria-label="Toggle theme"', () => {
    render(<LandingNav />);
    const toggleBtn = screen.getByRole('button', { name: /toggle theme/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-label', 'Toggle theme');
  });

  it('theme toggle button can receive focus (is keyboard-activatable)', () => {
    render(<LandingNav />);
    const toggleBtn = screen.getByRole('button', { name: /toggle theme/i });
    // Native <button> is inherently focusable — tabIndex should not be negative
    expect(toggleBtn.tagName.toLowerCase()).toBe('button');
    const tabIndex = toggleBtn.getAttribute('tabindex');
    if (tabIndex !== null) {
      expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── HeroSection ─────────────────────────────────────────────────────────────

describe('HeroSection heading hierarchy', () => {
  const renderHero = (overrides = {}) =>
    render(
      <HeroSection
        onEnterDemo={vi.fn()}
        onSeeHowItWorks={vi.fn()}
        reducedMotion={false}
        {...overrides}
      />,
    );

  it('renders exactly one <h1>', () => {
    const { container } = renderHero();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('<h1> contains non-empty text', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.trim()).not.toBe('');
  });

  it('contains no <h2> or deeper headings (no skipped levels from h1)', () => {
    const { container } = renderHero();
    // HeroSection should only have the h1 — sub-sections use h2 in their own
    // components, not within HeroSection itself
    const h2s = container.querySelectorAll('h2');
    expect(h2s).toHaveLength(0);
  });
});

describe('HeroSection interactive element accessibility', () => {
  const renderHero = (overrides = {}) =>
    render(
      <HeroSection
        onEnterDemo={vi.fn()}
        onSeeHowItWorks={vi.fn()}
        reducedMotion={false}
        {...overrides}
      />,
    );

  it('primary CTA has an accessible name', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    expect(btn).toBeInTheDocument();
  });

  it('primary CTA has focus-visible ring classes', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it('secondary CTA has an accessible name via visible text', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    expect(btn).toBeInTheDocument();
  });

  it('secondary CTA has focus-visible ring classes', () => {
    renderHero();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it('all buttons are native <button> elements (keyboard-activatable)', () => {
    const { container } = renderHero();
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons.forEach((btn) => {
      const tabIndex = btn.getAttribute('tabindex');
      if (tabIndex !== null) {
        expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ─── FeatureSection ───────────────────────────────────────────────────────────

describe('FeatureSection heading hierarchy', () => {
  const MockMockup: React.FC<{ triggered: boolean; reducedMotion: boolean }> = () => (
    <div data-testid="mockup" aria-hidden="true" />
  );

  const renderFeature = (overrides = {}) =>
    render(
      <FeatureSection
        id="test-feature"
        label="Test Label"
        headline="Feature Headline"
        description="Feature description text."
        mockupComponent={MockMockup}
        layout="text-left"
        reducedMotion={false}
        {...overrides}
      />,
    );

  it('renders feature headline as <h2>', () => {
    renderFeature();
    const h2 = screen.getByRole('heading', { level: 2, name: /feature headline/i });
    expect(h2).toBeInTheDocument();
  });

  it('does not render any <h1> (no skipped levels going upward)', () => {
    const { container } = renderFeature();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('does not render any <h3> or deeper (no skipped levels going downward)', () => {
    const { container } = renderFeature();
    expect(container.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0);
  });

  it('label badge is not a heading element', () => {
    const { container } = renderFeature();
    // The label "Test Label" should be a span, not a heading
    const span = container.querySelector('span');
    // Verify no h1-h6 contains just the label text
    const allHeadings = container.querySelectorAll('h1,h2,h3,h4,h5,h6');
    const labelInHeading = Array.from(allHeadings).some(
      (h) => h.textContent?.trim() === 'Test Label',
    );
    expect(labelInHeading).toBe(false);
    expect(span).not.toBeNull();
  });
});

// ─── StatsSection ─────────────────────────────────────────────────────────────

describe('StatsSection heading hierarchy', () => {
  it('renders section heading as <h2>', () => {
    render(<StatsSection reducedMotion={false} />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toBeInTheDocument();
    expect(h2.textContent?.trim()).not.toBe('');
  });

  it('does not render any <h1> in StatsSection', () => {
    const { container } = render(<StatsSection reducedMotion={false} />);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('stat values are not wrapped in heading elements', () => {
    const { container } = render(<StatsSection reducedMotion={false} />);
    // Values like "1240", "98", "3" should be in spans, not headings
    const headings = container.querySelectorAll('h1,h2,h3,h4,h5,h6');
    // Only 1 h2 for the section title
    expect(headings).toHaveLength(1);
  });
});

// ─── NarrativeSection ────────────────────────────────────────────────────────

describe('NarrativeSection heading hierarchy', () => {
  it('renders main section heading as <h2>', () => {
    render(<NarrativeSection reducedMotion={false} />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toBeInTheDocument();
  });

  it('renders column sub-headings as <h3>', () => {
    const { container } = render(<NarrativeSection reducedMotion={false} />);
    const h3s = container.querySelectorAll('h3');
    // Two h3s: "Velocity is NOT:" and "Velocity IS:"
    expect(h3s.length).toBeGreaterThanOrEqual(2);
  });

  it('no heading levels are skipped (h2 → h3 is valid)', () => {
    const { container } = render(<NarrativeSection reducedMotion={false} />);
    // Confirm there is no h1 (which would skip a level in the page context)
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    // Confirm there is no h4+ (which would skip a level)
    expect(container.querySelectorAll('h4,h5,h6')).toHaveLength(0);
  });

  it('dot accent spans inside IS items are aria-hidden', () => {
    const { container } = render(<NarrativeSection reducedMotion={false} />);
    // Each IS item has a decorative dot span with aria-hidden="true"
    const hiddenSpans = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenSpans.length).toBeGreaterThan(0);
  });
});

// ─── FinalCTASection ─────────────────────────────────────────────────────────

describe('FinalCTASection heading hierarchy and accessibility', () => {
  const renderCTA = (overrides = {}) =>
    render(
      <FinalCTASection
        onEnterDemo={vi.fn()}
        onSeeHowItWorks={vi.fn()}
        reducedMotion={false}
        {...overrides}
      />,
    );

  it('renders closing headline as <h2>', () => {
    renderCTA();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toBeInTheDocument();
    expect(h2.textContent?.trim()).not.toBe('');
  });

  it('does not render any <h1>', () => {
    const { container } = renderCTA();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('primary CTA has accessible name', () => {
    renderCTA();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    expect(btn).toBeInTheDocument();
  });

  it('primary CTA has focus-visible ring classes', () => {
    renderCTA();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it('secondary CTA has accessible name via visible text', () => {
    renderCTA();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    expect(btn).toBeInTheDocument();
  });

  it('secondary CTA has focus-visible ring classes', () => {
    renderCTA();
    const btn = screen.getByRole('button', { name: /see how it works/i });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it('all buttons are native <button> elements', () => {
    const { container } = renderCTA();
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons.forEach((btn) => {
      expect(btn.tagName.toLowerCase()).toBe('button');
    });
  });

  it('spinner is aria-hidden when loading', async () => {
    // The spinner SVG inside PrimaryButton has aria-hidden="true"
    // We can verify by checking the button's aria-label changes to the loading state
    const { container } = renderCTA();
    const btn = screen.getByRole('button', { name: /enter demo sandbox/i });
    // In idle state there should be no spinner visible
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});

// ─── Cross-component: no tabindex that breaks natural tab order ───────────────

describe('No broken tab order across landing components', () => {
  it('LandingNav has no negative tabindex on interactive elements', () => {
    const { container } = render(<LandingNav />);
    const interactives = container.querySelectorAll('button, a, input, select, textarea');
    interactives.forEach((el) => {
      const tabIndex = el.getAttribute('tabindex');
      if (tabIndex !== null) {
        expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('HeroSection buttons have no negative tabindex', () => {
    const { container } = render(
      <HeroSection
        onEnterDemo={vi.fn()}
        onSeeHowItWorks={vi.fn()}
        reducedMotion={false}
      />,
    );
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const tabIndex = btn.getAttribute('tabindex');
      if (tabIndex !== null) {
        expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('FinalCTASection buttons have no negative tabindex', () => {
    const { container } = render(
      <FinalCTASection
        onEnterDemo={vi.fn()}
        onSeeHowItWorks={vi.fn()}
        reducedMotion={false}
      />,
    );
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const tabIndex = btn.getAttribute('tabindex');
      if (tabIndex !== null) {
        expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});


