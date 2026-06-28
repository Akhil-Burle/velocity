/**
 * FeatureShowcase.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the FeatureShowcase component.
 *
 * Requirements: 4.1
 */

import React from 'react';
import { render } from '@testing-library/react';
import FeatureShowcase from '../sections/FeatureShowcase';
import { FEATURES } from '../constants/features';

// ── IntersectionObserver mock ─────────────────────────────────────────────────
// FeatureSection uses IntersectionObserver internally to trigger entrance
// animations. Mock it as a class so `new IntersectionObserver(...)` succeeds
// without error in the jsdom environment.

class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {
    // Never fires — elements stay "not intersecting" by default
  }
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

// ── 1. Renders exactly 6 FeatureSection elements ─────────────────────────────

describe('FeatureShowcase structure', () => {
  it('renders exactly 6 feature sections — one per FEATURES entry', () => {
    const { container } = render(<FeatureShowcase reducedMotion={false} />);

    // Each FeatureSection has its feature id set as the HTML id attribute.
    // Query all 6 by their known ids from the FEATURES constant.
    const sectionEls = FEATURES.map((f) => container.querySelector(`#${f.id}`));

    expect(sectionEls).toHaveLength(6);
    sectionEls.forEach((el) => expect(el).not.toBeNull());
  });

  it('renders a section for each feature id in the FEATURES constant', () => {
    const { container } = render(<FeatureShowcase reducedMotion={false} />);

    for (const feature of FEATURES) {
      const el = container.querySelector(`#${feature.id}`);
      expect(el).not.toBeNull();
    }
  });

  it('total number of feature sections matches FEATURES.length (6)', () => {
    const { container } = render(<FeatureShowcase reducedMotion={false} />);

    // Count the direct feature section divs by querying all known ids
    const found = FEATURES.filter((f) => container.querySelector(`#${f.id}`) !== null);
    expect(found.length).toBe(6);
    expect(found.length).toBe(FEATURES.length);
  });
});

// ── 2. Root element has id="feature-showcase" ────────────────────────────────

describe('FeatureShowcase root element', () => {
  it('has id="feature-showcase" on the root element', () => {
    const { container } = render(<FeatureShowcase reducedMotion={false} />);

    const root = container.querySelector('#feature-showcase');
    expect(root).not.toBeNull();
  });

  it('id="feature-showcase" is on the outermost rendered element', () => {
    const { container } = render(<FeatureShowcase reducedMotion={false} />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute('id', 'feature-showcase');
  });

  it('has id="feature-showcase" with reducedMotion=true', () => {
    const { container } = render(<FeatureShowcase reducedMotion={true} />);
    expect(container.querySelector('#feature-showcase')).not.toBeNull();
  });
});
