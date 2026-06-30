/**
 * LandingPage.tsx — cinematic, scroll-driven product page.
 *
 * Composition (calm in any single viewport, richer as you scroll):
 *   Nav → Hero → a single trajectory line with a ball that draws itself down
 *   the whole page → Problem → Behavioral Velocity bento → Agentic chain →
 *   Feature bento → Google Cloud → Final CTA → Footer.
 *
 * Works in both light and dark themes.
 */
import React, { useCallback, useEffect } from 'react';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useCinematicLogin } from './useCinematicLogin';
import { pal, useIsDark } from './sections/_landingShared';
import LandingNav from './LandingNav';
import ScrollPath from './ScrollPath';
import HeroSection from './sections/HeroSection';
import ProblemBlock from './sections/ProblemBlock';
import VelocityBento from './sections/VelocityBento';
import AgenticChainSection from './sections/AgenticChainSection';
import FeatureBentoSection from './sections/FeatureBentoSection';
import GoogleCloudSection from './sections/GoogleCloudSection';
import FinalCta from './sections/FinalCta';

const SectionDivider: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8">
    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)'} 30%, ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)'} 70%, transparent)` }} />
  </div>
);

const LandingPage: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const isDark = useIsDark();
  const p = pal(isDark);
  const { trigger, overlay } = useCinematicLogin();

  useEffect(() => {
    document.title = 'Velocity — Your AI agent for deadline survival';
    return () => { document.title = 'Velocity'; };
  }, []);

  const onSeeHowItWorks = useCallback(() => {
    document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="relative" style={{ background: p.bg, color: p.text }}>
      <LandingNav onTryDemo={trigger} />

      <HeroSection onEnterDemo={trigger} onSeeHowItWorks={onSeeHowItWorks} reducedMotion={reducedMotion} />

      {/* Everything below the hero shares one continuous trajectory line */}
      <div className="relative" style={{ overflow: 'hidden' }}>
        <ScrollPath reducedMotion={reducedMotion} />

        <ProblemBlock reducedMotion={reducedMotion} />
        <SectionDivider isDark={isDark} />
        <VelocityBento reducedMotion={reducedMotion} />
        <SectionDivider isDark={isDark} />
        <AgenticChainSection reducedMotion={reducedMotion} />
        <SectionDivider isDark={isDark} />
        <FeatureBentoSection reducedMotion={reducedMotion} />
        <SectionDivider isDark={isDark} />
        <GoogleCloudSection reducedMotion={reducedMotion} />
        <SectionDivider isDark={isDark} />
        <FinalCta onEnterDemo={trigger} reducedMotion={reducedMotion} />

        {/* Footer */}
        <div className="relative z-10 text-center py-8 px-5" style={{ borderTop: `1px solid ${p.hairline}` }}>
          <p className="text-[11px] font-mono" style={{ color: p.textDim }}>
            Velocity · Built for Vibe2Ship 2026 · All API calls are live in the demo
          </p>
        </div>
      </div>

      {overlay}
    </div>
  );
};

export default LandingPage;
