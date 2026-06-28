/**
 * LandingPage.meta.test.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for LandingPage head meta tag management (task 12.3, items 4 & 5):
 *   4. <title> and <meta name="description"> are set by LandingPage's useEffect
 *   5. Open Graph tags (og:title, og:description, og:type) are set
 *
 * All of LandingPage's sub-components are stubbed out so this file only
 * exercises the document-head side-effect logic, not section rendering.
 *
 * Requirements: 11.4, 11.5
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Module-level mocks (hoisted by Vitest) ───────────────────────────────────

// Stub out framer-motion (used by sub-components)
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// Stub ThemeContext (used by LandingNav)
vi.mock('../../../ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggle: vi.fn() }),
}));

// Stub api (used by LandingPage's onEnterDemo handler)
vi.mock('../../../api', () => ({
  loginWithCredentials: vi.fn(),
  setApiToken: vi.fn(),
  guestLogin: vi.fn().mockResolvedValue({ token: 'tok', userId: 'u1', mode: 'guest' }),
}));

// Stub all of LandingPage's heavy child components
vi.mock('../LandingNav', () => ({ default: () => <nav data-testid="nav-stub" /> }));
vi.mock('../LineSlider.tsx', () => ({ default: () => null }));
vi.mock('../sections/HeroSection', () => ({ default: () => null }));
vi.mock('../sections/ProblemSection', () => ({ default: () => null }));
vi.mock('../sections/BehavioralVelocitySection', () => ({ default: () => null }));
vi.mock('../sections/AgentDepthSection', () => ({ default: () => null }));
vi.mock('../sections/FullFeatureSection', () => ({ default: () => null }));
vi.mock('../sections/GoogleTechSection', () => ({ default: () => null }));
vi.mock('../sections/FinalCTASection', () => ({ default: () => null }));
vi.mock('../../AuthModal', () => ({ default: () => null }));

// Stub useReducedMotion hook
vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

// ─── Component under test ─────────────────────────────────────────────────────

import { AuthProvider } from '../../../AuthContext';
import LandingPage from '../LandingPage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Wrap with all required providers
const renderLandingPage = () =>
  render(
    <AuthProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </AuthProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LandingPage head meta tags', () => {
  beforeEach(() => {
    // Start each test with a clean head state
    document.title = '';
    document.querySelectorAll('meta[name="description"], meta[property^="og:"]').forEach((el) =>
      el.remove(),
    );
  });

  afterEach(() => {
    // Restore to a sensible baseline
    document.title = 'Velocity';
    document.querySelectorAll('meta[name="description"], meta[property^="og:"]').forEach((el) =>
      el.remove(),
    );
  });

  // ── Requirement 11.4 ────────────────────────────────────────────────────────

  it('sets document.title to a Velocity-branded title', async () => {
    renderLandingPage();
    await waitFor(() => {
      expect(document.title).toContain('Velocity');
      expect(document.title.length).toBeGreaterThan(10);
    });
  });

  it('sets <meta name="description"> with non-empty content', async () => {
    renderLandingPage();
    await waitFor(() => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      expect(meta).not.toBeNull();
      expect(meta!.getAttribute('content')?.trim()).not.toBe('');
    });
  });

  // ── Requirement 11.5 ────────────────────────────────────────────────────────

  it('sets og:title Open Graph tag with non-empty content', async () => {
    renderLandingPage();
    await waitFor(() => {
      const tag = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
      expect(tag).not.toBeNull();
      expect(tag!.getAttribute('content')?.trim()).not.toBe('');
    });
  });

  it('sets og:description Open Graph tag with non-empty content', async () => {
    renderLandingPage();
    await waitFor(() => {
      const tag = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
      expect(tag).not.toBeNull();
      expect(tag!.getAttribute('content')?.trim()).not.toBe('');
    });
  });

  it('sets og:type Open Graph tag to "website"', async () => {
    renderLandingPage();
    await waitFor(() => {
      const tag = document.querySelector<HTMLMetaElement>('meta[property="og:type"]');
      expect(tag).not.toBeNull();
      expect(tag!.getAttribute('content')).toBe('website');
    });
  });

  it('restores document.title to "Velocity" on unmount (cleanup effect)', () => {
    const { unmount } = renderLandingPage();
    unmount();
    expect(document.title).toBe('Velocity');
  });
});
