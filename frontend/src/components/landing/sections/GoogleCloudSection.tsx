/**
 * GoogleCloudSection.tsx
 * Built natively on Google Cloud — accurate, verified stack. Theme-aware.
 */
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Reveal, Eyebrow, glass, TiltCard, useIsDark, pal } from './_landingShared';

interface Tech { color: string; name: string; badge: string; what: string; url: string; }

const TECHS: Tech[] = [
  { color: '#4285f4', name: 'Vertex AI · Gemini 3.1 Flash Lite', badge: 'AI Core', what: 'Every AI decision — Brain Dump, Panic Mode, Negotiate, Ultimatum, Omni-Bar, Day Rebalance — routes through Vertex AI.', url: 'https://cloud.google.com/vertex-ai' },
  { color: '#4285f4', name: 'Gemini Vision (multimodal)', badge: 'AI Vision', what: 'Chaos Scanner: drop a whiteboard photo and Gemini Vision extracts structured tasks with deadlines.', url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/overview' },
  { color: '#34a853', name: 'Google Calendar API', badge: 'Workspace', what: 'Reads real events from your account. Command Day and Rebalance schedule around actual meetings.', url: 'https://developers.google.com/calendar' },
  { color: '#fbbc04', name: 'Google Sign-In (OAuth 2.0)', badge: 'Identity', what: 'A real OAuth 2.0 consent flow: signs in, creates the user, issues a JWT, and unlocks Calendar access.', url: 'https://developers.google.com/identity' },
  { color: '#ea4335', name: 'Cloud Text-to-Speech', badge: 'Voice Out', what: 'Omni-Bar voice responses via the en-US-Journey-F WaveNet voice, with a browser speechSynthesis fallback.', url: 'https://cloud.google.com/text-to-speech' },
  { color: '#34a853', name: 'Web Speech API', badge: 'Voice In', what: 'Voice input in Brain Dump and the Omni-Bar — backed by Google\'s speech engine in Chrome. A full voice loop.', url: 'https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition' },
];

const GoogleCloudSection: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const isDark = useIsDark();
  const p = pal(isDark);
  return (
    <section id="google-tech" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8"
      style={{ background: `radial-gradient(ellipse 60% 40% at 50% 45%, rgba(66,133,244,${isDark ? 0.045 : 0.05}) 0%, transparent 70%)` }}>
      <div className="max-w-5xl mx-auto">
        <Reveal variant="blur" reducedMotion={reducedMotion} className="mb-12 max-w-xl">
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 3.2rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 14, color: p.text, whiteSpace: 'nowrap' }}>
            Every API is live and wired in
          </h2>
          <p className="text-base" style={{ color: p.textMute }}>
            Not logos on a slide. Each technology here is confirmed real — and each line names the exact feature it powers.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TECHS.map((tech, i) => (
            <Reveal key={tech.name} variant="up" delay={(i % 3) * 0.07} reducedMotion={reducedMotion} style={{ display: 'grid' }}>
              <TiltCard reducedMotion={reducedMotion} intensity={5} className="h-full rounded-2xl p-5" style={glass(tech.color, isDark, 0.2)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tech.color}15` }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: tech.color }} />
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: `${tech.color}12`, color: tech.color, border: `1px solid ${tech.color}25` }}>
                    {tech.badge}
                  </span>
                </div>
                <div className="text-xs font-bold mb-1.5" style={{ color: p.text }}>
                  {tech.name}
                  {tech.name === 'Google Sign-In (OAuth 2.0)' && (
                    <span className="ml-1.5 text-[9px] font-mono font-normal" style={{ color: p.textFaint }}>*test mode only</span>
                  )}
                </div>
                <p className="text-[10px] font-mono leading-relaxed mb-3" style={{ color: p.textFaint }}>{tech.what}</p>
                <a href={tech.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono" style={{ color: tech.color }}>
                  <ExternalLink size={9} /> docs
                </a>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GoogleCloudSection;
