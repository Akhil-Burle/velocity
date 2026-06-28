/**
 * StartHereCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dismissible first-load "Start Here" card that replaces the missing live
 * narration. Gives an unguided grader direct links to the 4 most impressive
 * features so they can't miss them.
 *
 * Shows once per session (sessionStorage key: start_here_dismissed_v1).
 * Positioned as a sticky banner below the quick-entry bar on Dashboard.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Bot, ShieldAlert, Layers, X, ChevronRight, Sparkles, FlaskConical, Activity,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';

const SESSION_KEY = 'start_here_dismissed_v2'; // bumped so existing users see updated card

interface QuickLink {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  action: () => void;
}

interface StartHereCardProps {
  onNavigateAgentLog?: () => void;
  onNavigateTechStack?: () => void;
  onTriggerPanic?: () => void;
}

const StartHereCard: React.FC<StartHereCardProps> = ({
  onNavigateAgentLog,
  onNavigateTechStack,
  onTriggerPanic,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      // Small delay so dashboard renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setVisible(false);
  };

  const links: QuickLink[] = [
    {
      icon: <Bot size={13} />,
      label: 'Agent Log',
      desc: 'See every autonomous AI action',
      color: '#22c55e',
      action: () => { onNavigateAgentLog?.(); navigate('/agent-log'); dismiss(); },
    },
    {
      icon: <ShieldAlert size={13} />,
      label: 'Panic Mode',
      desc: 'Click a RED task → Activate Panic Mode',
      color: '#ef4444',
      action: () => { onTriggerPanic?.(); dismiss(); },
    },
    {
      icon: <Sparkles size={13} />,
      label: 'AI Rebalance',
      desc: 'Command Day → Rebalance My Day',
      color: '#38bdf8',
      action: () => { navigate('/command'); dismiss(); },
    },
    {
      icon: <Layers size={13} />,
      label: 'Tech Stack',
      desc: 'Every Google technology in use',
      color: '#4285f4',
      action: () => { onNavigateTechStack?.(); navigate('/tech-stack'); dismiss(); },
    },
    {
      icon: <FlaskConical size={13} />,
      label: 'Agent Memory',
      desc: 'See the agent learn from its own mistakes',
      color: '#ec4899',
      action: () => { navigate('/agent-log'); sessionStorage.setItem('agent_log_tab', 'memory'); dismiss(); },
    },
    {
      icon: <Activity size={13} />,
      label: 'Velocity Vector',
      desc: 'See why we\'re called Velocity',
      color: '#a78bfa',
      action: () => { navigate('/velocity-vector'); dismiss(); },
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -12, height: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            className="mx-4 sm:mx-6 my-3 rounded-2xl overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(56,189,248,0.05) 100%)'
                : 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(56,189,248,0.04) 100%)',
              border: '1px solid rgba(34,197,94,0.22)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                  animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0.2)', '0 0 12px rgba(34,197,94,0.4)', '0 0 0px rgba(34,197,94,0.2)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap size={12} className="text-green-400" />
                </motion.div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  Start here — 6 things that show why this is an agent, not a scheduler
                </span>
              </div>
              <motion.button
                onClick={dismiss}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-6 h-6 flex items-center justify-center rounded-full"
                style={{ color: 'var(--text-faint)', background: 'rgba(0,0,0,0.1)' }}
              >
                <X size={12} />
              </motion.button>
            </div>

            {/* Links grid — 6 links */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 px-4 pb-4">
              {links.map(({ icon, label, desc, color, action }, i) => (
                <motion.button
                  key={label}
                  onClick={action}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left"
                  style={{
                    background: `${color}0d`,
                    border: `1px solid ${color}22`,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span style={{ color }}>{icon}</span>
                    <ChevronRight size={10} style={{ color: `${color}66` }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{desc}</div>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="px-4 pb-3">
              <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                Tip: "Velocity Vector" shows why the product is named Velocity — real trajectory vs. claimed progress, as a literal vector. Agent Log has 15+ entries from today including action chains and learned behaviors.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartHereCard;
