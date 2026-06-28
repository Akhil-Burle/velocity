/**
 * FeatureShowcase.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates all 6 FeatureSection instances. Maps the FEATURES constant to
 * FeatureSection components, injecting the correct mockup component for each
 * feature based on its `mockupType`.
 *
 * Props:
 *   reducedMotion – passed down to each FeatureSection (and transitively to
 *                   each mockup component)
 *
 * Requirements: 4.1, 4.2
 */

import React from 'react';

import { FEATURES } from '../constants/features';
import FeatureSection from './FeatureSection';

import BrainDumpMockup from '../mockups/BrainDumpMockup';
import ChaosScannerMockup from '../mockups/ChaosScannerMockup';
import PaceTrackingMockup from '../mockups/PaceTrackingMockup';
import PanicModeMockup from '../mockups/PanicModeMockup';
import UltimatumMockup from '../mockups/UltimatumMockup';
import NegotiateMockup from '../mockups/NegotiateMockup';

// ─── Mockup type → component map ─────────────────────────────────────────────

const MOCKUP_MAP = {
  braindump: BrainDumpMockup,
  chaos: ChaosScannerMockup,
  pace: PaceTrackingMockup,
  panic: PanicModeMockup,
  ultimatum: UltimatumMockup,
  negotiate: NegotiateMockup,
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface FeatureShowcaseProps {
  reducedMotion: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ reducedMotion }) => {
  return (
    <div id="feature-showcase" className="py-16 sm:py-24 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-16">
        {FEATURES.map((feature) => {
          const MockupComponent = MOCKUP_MAP[feature.mockupType];

          return (
            <FeatureSection
              key={feature.id}
              id={feature.id}
              label={feature.label}
              headline={feature.headline}
              description={feature.description}
              mockupComponent={MockupComponent}
              layout={feature.layout}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </div>
    </div>
  );
};

export default FeatureShowcase;
