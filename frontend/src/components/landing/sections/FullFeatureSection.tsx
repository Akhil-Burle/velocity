/**
 * FullFeatureSection.tsx
 * Organized feature grid — all verified built features, grouped by theme.
 * No invented capabilities. Accurate to the actual codebase.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Calendar, Zap, ShieldAlert, GitFork, MessageSquare,
  BarChart2, Target, Repeat2, Mic, Camera, Clock, Trophy, Activity,
  GitBranch, Sun
} from 'lucide-react';

interface FullFeatureSectionProps {
  reducedMotion: boolean;
}

const FEATURE_GROUPS = [
  {
    label: 'AI Task Intelligence',
    color: '#22c55e',
    features: [
      { icon: <Brain size={14} />, name: 'Brain Dump', desc: 'Paste your entire mental backlog. Gemini extracts tasks, deadlines, and effort estimates automatically.' },
      { icon: <Camera size={14} />, name: 'Chaos Scanner', desc: 'Drop a photo of a whiteboard or syllabus. Gemini Vision extracts tasks from real images.' },
      { icon: <Activity size={14} />, name: 'Live Pace Tracking', desc: 'Required %/day to hit each deadline, recalculated every 60 seconds from real behavior.' },
      { icon: <Zap size={14} />, name: 'Check-In Analysis', desc: 'Self-reports analyzed for language signals. Overconfident language triggers drift penalty.' },
    ],
  },
  {
    label: 'Intervention System',
    color: '#ef4444',
    features: [
      { icon: <ShieldAlert size={14} />, name: 'Panic Mode', desc: 'One click: AI generates rescue checklist + boilerplate code + creates real GitHub repo autonomously.' },
      { icon: <GitFork size={14} />, name: 'The Ultimatum', desc: 'When two deadlines genuinely conflict, forces a conscious choice. The losing task is logged, not dropped silently.' },
      { icon: <MessageSquare size={14} />, name: 'Negotiate', desc: 'AI drafts a professional deadline extension email tailored to task, recipient, and context.' },
      { icon: <Clock size={14} />, name: 'Hot Start', desc: 'AI generates a structured first-step scaffold for any task to eliminate blank-page paralysis.' },
    ],
  },
  {
    label: 'Planning & Scheduling',
    color: '#38bdf8',
    features: [
      { icon: <Sun size={14} />, name: 'Command Day', desc: 'Full day timeline with energy-aware task blocks built around real Google Calendar events.' },
      { icon: <Repeat2 size={14} />, name: 'AI Rebalance', desc: 'One click reorders your day by cognitive weight and current energy — avoids burnout blocks.' },
      { icon: <Calendar size={14} />, name: 'Calendar Integration', desc: 'Reads real Google Calendar events. Focus blocks schedule around actual meetings, not simulated ones.' },
      { icon: <BarChart2 size={14} />, name: 'Velocity Forecast', desc: 'Deadline finish probability for every task. Proactively triggers interventions on critical tasks.' },
    ],
  },
  {
    label: 'Insights & Growth',
    color: '#a78bfa',
    features: [
      { icon: <Activity size={14} />, name: 'Velocity DNA', desc: 'Radar chart of your productivity fingerprint — deep work, consistency, recovery, urgency response.' },
      { icon: <Target size={14} />, name: 'Goals & Habits', desc: 'Long-range goals with habit tracking. Consistency streaks and frequency enforcement built in.' },
      { icon: <Trophy size={14} />, name: 'Velocity Credits', desc: 'Gamification system: credits, levels, achievements, and anonymized leaderboard ranking.' },
      { icon: <Mic size={14} />, name: 'Voice Command Loop', desc: 'Web Speech API in → Cloud TTS out. Full voice loop: speak a command, hear the response.' },
    ],
  },
];

const FullFeatureSection: React.FC<FullFeatureSectionProps> = ({ reducedMotion }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return (
    <section ref={ref} id="features" className="py-20 sm:py-28 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <p className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>Everything that's built</p>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            The full feature set
          </h2>
        </motion.div>

        <div className="space-y-10">
          {FEATURE_GROUPS.map((group, gi) => (
            <div key={group.label}>
              <motion.div
                initial={reducedMotion ? {} : { opacity: 0, x: -16 }}
                animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                transition={{ duration: 0.5, delay: gi * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 mb-5"
              >
                <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: group.color }}>{group.label}</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.features.map((feat, fi) => (
                  <motion.div
                    key={feat.name}
                    initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
                    animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.5, delay: gi * 0.08 + fi * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={reducedMotion ? {} : { y: -3, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
                    className="rounded-xl p-4 cursor-default"
                    style={{ background: 'var(--bg-card)', border: `1px solid ${group.color}15` }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                      style={{ background: `${group.color}12`, color: group.color }}>
                      {feat.icon}
                    </div>
                    <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{feat.name}</div>
                    <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>{feat.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FullFeatureSection;
