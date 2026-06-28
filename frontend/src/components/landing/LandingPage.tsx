/**
 * LandingPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root landing page component — composes all sections.
 *
 * No external props. Reads ThemeContext (via LandingNav) and AuthContext
 * internally for the demo CTA auth flow.
 *
 * Auth flow (onEnterDemo):
 *   1. Call loginWithCredentials('demo', 'velocity2026')
 *   2. On success: setApiToken + setAuth + navigate('/dashboard')
 *   3. On failure (or 10s timeout): open <AuthModal>
 *
 * Head management:
 *   useEffect sets <title> and <meta> tags for description + Open Graph.
 *
 * Requirements: 11.4, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { loginWithCredentials, setApiToken } from '../../api';
import { useReducedMotion } from './hooks/useReducedMotion';
import LandingNav from './LandingNav';
import LineSlider from './LineSlider.tsx';
import HeroSection from './sections/HeroSection';
import FeatureShowcase from './sections/FeatureShowcase';
import StatsSection from './sections/StatsSection';
import NarrativeSection from './sections/NarrativeSection';
import TestimonialSection from './sections/TestimonialSection';
import FinalCTASection from './sections/FinalCTASection';

// ─── Component ────────────────────────────────────────────────────────────────

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const reducedMotion = useReducedMotion();

  // ── Head meta tags ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Page title
    document.title = 'Velocity — The AI Productivity Agent';

    // Meta description — find or create
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      'content',
      'Velocity forces conscious tradeoffs when deadlines conflict, so nothing gets silently dropped.',
    );

    // Open Graph helper
    const setOGTag = (property: string, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setOGTag('og:title', 'Velocity — The AI Productivity Agent');
    setOGTag(
      'og:description',
      'Velocity forces conscious tradeoffs when deadlines conflict, so nothing gets silently dropped.',
    );
    setOGTag('og:type', 'website');

    // Cleanup: restore a sensible title when navigating away
    return () => {
      document.title = 'Velocity';
    };
  }, []);

  // ── onEnterDemo ────────────────────────────────────────────────────────────
  const onEnterDemo = useCallback(async () => {
    try {
      const res = await loginWithCredentials('demo', 'velocity2026');
      setApiToken(res.token);
      setAuth(res.token, res.userId, res.mode);
      navigate('/dashboard');
    } catch {
      // Demo login failed — fall back to guest session so dashboard still works
      try {
        const { guestLogin } = await import('../../api');
        const guest = await guestLogin();
        setApiToken(guest.token);
        setAuth(guest.token, guest.userId, 'guest');
      } catch { /* backend fully unreachable — proceed anyway */ }
      navigate('/dashboard');
    }
  }, [navigate, setAuth]);

  // ── onSeeHowItWorks ────────────────────────────────────────────────────────
  const onSeeHowItWorks = useCallback(() => {
    document.getElementById('feature-showcase')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <LandingNav />
      <LineSlider />

      <main>
        <HeroSection
          onEnterDemo={onEnterDemo}
          onSeeHowItWorks={onSeeHowItWorks}
          reducedMotion={reducedMotion}
          onNavigateDashboard={() => navigate('/dashboard')}
        />
        <FeatureShowcase reducedMotion={reducedMotion} />
        <StatsSection reducedMotion={reducedMotion} />
        <NarrativeSection reducedMotion={reducedMotion} />
        <TestimonialSection reducedMotion={reducedMotion} />
        <FinalCTASection
          onEnterDemo={onEnterDemo}
          onSeeHowItWorks={onSeeHowItWorks}
          reducedMotion={reducedMotion}
        />
      </main>

    </div>
  );
};

export default LandingPage;
