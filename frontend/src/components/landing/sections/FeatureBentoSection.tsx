/**
 * FeatureBentoSection.tsx
 * The full arsenal as a varied bento grid. The large Panic Mode tile carries a
 * live "rescue" preview so it never reads empty. Theme-aware. Accurate copy.
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert, Command, Calendar, Trophy, Brain, Camera,
  MessageSquare, Bot, Target, Mic, Github, FileCode, ListChecks, type LucideIcon,
} from 'lucide-react';
import { EASE, Reveal, Eyebrow, glass, TiltCard, useIsDark, pal } from './_landingShared';

interface Tile {
  icon: LucideIcon;
  color: string;
  label: string;
  desc: string;
  span: string;
  big?: boolean;
  panic?: boolean;
}

const TILES: Tile[] = [
  { icon: ShieldAlert, color: '#ef4444', label: 'Panic Mode', big: true, panic: true, span: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
    desc: 'One click when the clock is gone: a rescue checklist, boilerplate code, and a real GitHub repo scaffolded by Gemini in under 10 seconds.' },
  { icon: Command, color: '#22c55e', label: 'Omni-Bar', span: 'lg:col-span-1',
    desc: 'Ctrl/⌘K from anywhere. Describe the problem in plain words — it classifies intent and acts.' },
  { icon: Calendar, color: '#34a853', label: 'Command Day', span: 'lg:col-span-1',
    desc: 'Energy-aware planning around your real Google Calendar. Rebalance in one click.' },
  { icon: Brain, color: '#4285f4', label: 'Brain Dump', span: 'lg:col-span-1',
    desc: 'Paste your whole mental backlog — Gemini extracts deadlines, estimates, and urgency.' },
  { icon: Camera, color: '#fb923c', label: 'Chaos Scanner', span: 'lg:col-span-1',
    desc: 'Drop a whiteboard or syllabus photo. Gemini Vision returns structured tasks with deadlines.' },
  { icon: Trophy, color: '#fbbf24', label: 'Velocity Credits', span: 'sm:col-span-2 lg:col-span-2',
    desc: 'Gamified momentum: levels, achievements, and an anonymized cohort leaderboard that rewards real progress, not busywork.' },
  { icon: MessageSquare, color: '#a78bfa', label: 'Negotiate', span: 'lg:col-span-1',
    desc: 'AI drafts a professional extension email tailored to the task, recipient, and context.' },
  { icon: Bot, color: '#38bdf8', label: 'Agent Activity Log', span: 'lg:col-span-1',
    desc: 'Every autonomous action logged with the full reasoning chain. Expand any entry.' },
  { icon: Brain, color: '#ec4899', label: 'Adaptive Memory', span: 'lg:col-span-1',
    desc: 'Cancel an action three times and the agent writes a policy — and stops proposing it.' },
  { icon: Target, color: '#06b6d4', label: 'Velocity DNA', span: 'lg:col-span-1',
    desc: 'A radar fingerprint of how you work: deep focus, consistency, urgency response, recovery.' },
  { icon: Mic, color: '#4ade80', label: 'Voice Loop', span: 'sm:col-span-2 lg:col-span-2',
    desc: 'Web Speech in, Google Cloud TTS out. Speak a command on the Omni-Bar and hear the response — a complete voice loop.' },
];

const RESCUE_STEPS = [
  { icon: ListChecks, text: 'Rescue checklist generated' },
  { icon: FileCode, text: 'Boilerplate + starter code written' },
  { icon: Github, text: 'GitHub repo created · pushed' },
];

const PanicExtra: React.FC<{ isDark: boolean; reducedMotion: boolean }> = ({ isDark, reducedMotion }) => {
  const p = pal(isDark);
  return (
    <div className="mt-5 pt-4 space-y-2.5" style={{ borderTop: `1px solid ${p.hairline}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: p.textFaint }}>Auto-rescue</span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.28)' }}>~9.2s</span>
      </div>
      {RESCUE_STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div key={s.text}
            initial={reducedMotion ? false : { opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.18, duration: 0.45, ease: EASE }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{ background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.15)` }}>
            <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.14)', color: '#ef4444' }}>
              <Icon size={12} />
            </span>
            <span className="text-[11px] font-mono" style={{ color: p.textMute }}>{s.text}</span>
            <motion.span className="ml-auto text-green-400"
              initial={reducedMotion ? false : { scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
              transition={{ delay: 0.45 + i * 0.18, type: 'spring', stiffness: 300, damping: 18 }}>✓</motion.span>
          </motion.div>
        );
      })}
    </div>
  );
};

const FeatureBentoSection: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const isDark = useIsDark();
  const p = pal(isDark);
  return (
    <section id="features" className="relative z-10 py-24 sm:py-32 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="up" reducedMotion={reducedMotion} className="text-center mb-14 max-w-2xl mx-auto">
          <Eyebrow>Everything that's built and wired</Eyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 4.6vw, 3.6rem)', fontWeight: 800, letterSpacing: '-0.03em', color: p.text }}>
            The full arsenal
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(150px,auto)]">
          {TILES.map((t, i) => {
            const Icon = t.icon;
            return (
              <Reveal key={t.label} variant="scale" delay={(i % 4) * 0.05} reducedMotion={reducedMotion}
                className={t.span} style={{ display: 'grid' }}>
                <TiltCard reducedMotion={reducedMotion} intensity={5}
                  className="h-full rounded-2xl p-5 sm:p-6 group cursor-default relative overflow-hidden flex flex-col"
                  style={glass(t.color, isDark, 0.18)}>
                  <motion.div aria-hidden className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100"
                    style={{ background: `radial-gradient(circle at 30% 0%, ${t.color}12, transparent 60%)`, transition: 'opacity 0.3s ease' }} />
                  <div className="relative flex flex-col h-full">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: `${t.color}16`, color: t.color }}>
                      <Icon size={19} />
                    </div>
                    <div className={`font-bold mb-1.5 ${t.big ? 'text-lg' : 'text-sm'}`} style={{ color: p.text }}>{t.label}</div>
                    <p className={`leading-relaxed font-mono ${t.big ? 'text-xs' : 'text-[11px]'}`} style={{ color: p.textFaint }}>{t.desc}</p>
                    {t.panic && <PanicExtra isDark={isDark} reducedMotion={reducedMotion} />}
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureBentoSection;
