/**
 * GoogleTechSection.tsx
 * Verified, accurate Google technology stack — matches TechStackPage.tsx exactly.
 * No aspirational claims. Each entry names the specific feature it powers.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Calendar, ShieldCheck, Volume2, Mic, ExternalLink } from 'lucide-react';

interface GoogleTechSectionProps {
  reducedMotion: boolean;
}

const GOOGLE_TECHS = [
  {
    name: 'Gemini 3.1 Flash Lite via Vertex AI',
    badge: 'Google Cloud AI',
    icon: <Brain size={15} />,
    color: '#4285f4',
    what: 'Every AI decision: Brain Dump parsing, Panic Mode scaffold, Negotiate email drafting, Ultimatum synthesis, OmniBar intent, Day Rebalance coaching. Routes through Vertex AI when project is configured.',
    docsUrl: 'https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini',
  },
  {
    name: 'Gemini Vision (multimodal)',
    badge: 'Google Cloud AI',
    icon: <Brain size={15} />,
    color: '#4285f4',
    what: 'Powers Chaos Scanner — drop a whiteboard photo, Gemini Vision extracts structured tasks with deadlines. Image sent as base64 inlineData.',
    docsUrl: 'https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/overview',
  },
  {
    name: 'Google Calendar API',
    badge: 'Google Workspace',
    icon: <Calendar size={15} />,
    color: '#34a853',
    what: 'Reads real events from the authenticated Google account. Command Day and AI Rebalance block against actual meetings — not simulated schedule data.',
    docsUrl: 'https://developers.google.com/calendar/api',
  },
  {
    name: 'Google Sign-In (OAuth 2.0)',
    badge: 'Google Identity',
    icon: <ShieldCheck size={15} />,
    color: '#fbbc04',
    what: 'Real OAuth 2.0 consent flow. Returns ID token, creates or finds Velocity user, issues JWT. Unlocks Calendar API for the session.',
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },
  {
    name: 'Cloud Text-to-Speech',
    badge: 'Google Cloud',
    icon: <Volume2 size={15} />,
    color: '#ea4335',
    what: 'OmniBar voice responses. After AI parses a command, response synthesized via en-US-Journey-F (WaveNet) and played back. Falls back to browser speechSynthesis.',
    docsUrl: 'https://cloud.google.com/text-to-speech',
  },
  {
    name: 'Web Speech API',
    badge: 'Browser / Chrome',
    icon: <Mic size={15} />,
    color: '#34a853',
    what: 'Voice input in Brain Dump and OmniBar. SpeechRecognition (backed by Google\'s speech engine in Chrome) transcribes in real time — completing the full voice loop.',
    docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition',
  },
];

const GoogleTechSection: React.FC<GoogleTechSectionProps> = ({ reducedMotion }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return (
    <section ref={ref} id="google-tech" className="py-20 sm:py-28 px-5 sm:px-8"
      style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(66,133,244,0.02) 50%, transparent 100%)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-6">
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Every Google API is live and wired in
          </h2>
          <p className="text-base leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Not logos on a slide. Every technology listed here is confirmed real and connected.
            Each description names the exact Velocity feature it powers.
          </p>
        </motion.div>

        {/* Banner */}
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 16 }}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl px-5 py-4 mb-8"
          style={{ background: 'linear-gradient(135deg, rgba(66,133,244,0.07) 0%, rgba(234,67,53,0.05) 50%, rgba(251,188,4,0.05) 100%)', border: '1px solid rgba(66,133,244,0.2)' }}
        >
          <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Velocity's AI backbone runs on{' '}
            <span style={{ color: '#4285f4' }}>Vertex AI (Gemini 3.1 Flash Lite)</span> for all text and vision reasoning,{' '}
            <span style={{ color: '#34a853' }}>Google Calendar API</span> for real schedule data,{' '}
            <span style={{ color: '#fbbc04' }}>Google OAuth 2.0</span> for identity,{' '}
            <span style={{ color: '#ea4335' }}>Cloud Text-to-Speech</span> for voice output, and{' '}
            <span style={{ color: '#34a853' }}>Web Speech API</span> for voice input —{' '}
            forming a complete voice-in / voice-out command loop on the OmniBar.
          </p>
        </motion.div>

        {/* Tech grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GOOGLE_TECHS.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              whileHover={reducedMotion ? {} : { y: -3, transition: { duration: 0.15 } }}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: `1px solid ${tech.color}18` }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${tech.color}12`, color: tech.color }}>
                  {tech.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    {tech.name}
                    {tech.name === 'Google Sign-In (OAuth 2.0)' && (
                      <span className="ml-1.5 text-[9px] font-mono font-normal" style={{ color: 'var(--text-faint)' }}>*test mode only</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full inline-block"
                    style={{ background: `${tech.color}10`, color: tech.color, border: `1px solid ${tech.color}20` }}>
                    {tech.badge}
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-mono leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{tech.what}</p>
              <a href={tech.docsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono"
                style={{ color: 'var(--text-faint)' }}
                onClick={e => e.stopPropagation()}>
                <ExternalLink size={9} /> docs
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GoogleTechSection;
