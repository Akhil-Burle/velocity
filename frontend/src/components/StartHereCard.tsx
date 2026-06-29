/**
 * StartHereCard.tsx — Unified Tour Entry Point
 * ─────────────────────────────────────────────────────────────────────────────
 * The "table of contents" for the Guided Tour.
 *
 * Unified with ContextualHints via TourContext — they share the same
 * "highlights seen" state. Dismissing a hint on any page marks it here too,
 * and clicking a card link triggers the contextual hint to appear on arrival.
 *
 * Behavior:
 *  - Appears 800ms after first login (first session only, via TourContext).
 *  - Lists all 8 prioritized highlights with checkmarks as each is seen.
 *  - Shows a progress indicator: "N of 8 seen" — understated, not gamified.
 *  - Dismissing the card shows the TourReOpenButton in the header instead.
 *  - Clicking a link navigates AND sets tour_navigate_hint = highlight.id
 *    so ContextualHints shows that specific hint immediately on arrival.
 *  - Never blocks interaction — a soft banner, not a modal.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Bot, ShieldAlert, Layers, X, ChevronRight, Activity,
  FlaskConical, TrendingDown, Calendar, CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useTour, TOUR_HIGHLIGHTS } from './TourContext';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  'bot':          <Bot size={12} />,
  'trending-down':<TrendingDown size={12} />,
  'activity':     <Activity size={12} />,
  'shield-alert': <ShieldAlert size={12} />,
  'zap':          <Zap size={12} />,
  'calendar':     <Calendar size={12} />,
  'flask':        <FlaskConical size={12} />,
  'layers':       <Layers size={12} />,
};

interface StartHereCardProps {
  /** Called when Panic Mode link is clicked, so Dashboard can open the panel */
  onTriggerPanic?: () => void;
}

const StartHereCard: React.FC<StartHereCardProps> = ({ onTriggerPanic }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { cardVisible, dismissCard, seenIds, seenCount, totalCount, markSeen } = useTour();
  const [mounted, setMounted] = useState(false);

  // Small delay before revealing so dashboard renders first
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 800);
    return () => clearTimeout(t);
  }, []);

  const handleLinkClick = (highlightId: string, linkTo: string, deepLinkKey?: string, deepLinkValue?: string) => {
    // Set a flag so ContextualHints shows this hint immediately on arrival
    sessionStorage.setItem('tour_navigate_hint', highlightId);

    // Set optional deep-link key (e.g., agent_log_tab = memory)
    if (deepLinkKey && deepLinkValue) {
      sessionStorage.setItem(deepLinkKey, deepLinkValue);
    }

    // Handle Panic Mode specially — it needs the parent to open the panel
    if (highlightId === 'panic-mode') {
      onTriggerPanic?.();
      markSeen('panic-mode');
      return;
    }

    navigate(linkTo);
  };

  const visible = mounted && cardVisible;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="start-here-card"
          initial={{ opacity: 0, y: -16, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -12, height: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            className="mx-4 sm:mx-6 my-3 rounded-2xl overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(56,189,248,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(56,189,248,0.03) 100%)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-2.5">
                <motion.div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                  animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0.2)', '0 0 10px rgba(34,197,94,0.35)', '0 0 0px rgba(34,197,94,0.2)'] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                >
                  <Zap size={11} className="text-green-400" />
                </motion.div>
                <div>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    Start here for judges
                  </span>
                  <span className="text-[10px] font-mono ml-2" style={{ color: 'var(--text-faint)' }}>
                    8 things that make this an agent, not a scheduler
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Progress indicator — understated breadcrumb */}
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.18)',
                  }}
                >
                  <motion.div
                    className="h-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.25)', width: 40, position: 'relative', overflow: 'hidden' }}
                  >
                    <motion.div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{ background: '#22c55e' }}
                      animate={{ width: `${Math.round((seenCount / totalCount) * 100)}%` }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </motion.div>
                  <span className="text-[9px] font-mono" style={{ color: '#22c55e' }}>
                    {seenCount}/{totalCount}
                  </span>
                </div>

                <motion.button
                  onClick={dismissCard}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-6 h-6 flex items-center justify-center rounded-full"
                  style={{ color: 'var(--text-faint)', background: 'rgba(0,0,0,0.1)' }}
                  title="Dismiss (re-open from the Tour button in the header)"
                >
                  <X size={11} />
                </motion.button>
              </div>
            </div>

            {/* ── Links grid — 2 cols on mobile, 4 cols on desktop ─────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pb-3">
              {TOUR_HIGHLIGHTS.map((h, i) => {
                const isSeen = seenIds.has(h.id);
                return (
                  <motion.button
                    key={h.id}
                    onClick={() => handleLinkClick(h.id, h.linkTo, h.deepLinkKey, h.deepLinkValue)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left relative overflow-hidden"
                    style={{
                      background: isSeen
                        ? (isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)')
                        : `${h.color}0d`,
                      border: isSeen
                        ? '1px solid rgba(34,197,94,0.2)'
                        : `1px solid ${h.color}22`,
                      opacity: isSeen ? 0.75 : 1,
                    }}
                  >
                    {/* Seen check overlay */}
                    {isSeen && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
                      </motion.div>
                    )}

                    <div className="flex items-center justify-between w-full">
                      <span style={{ color: isSeen ? '#22c55e' : h.color }}>
                        {ICON_MAP[h.iconKey] || <Zap size={12} />}
                      </span>
                      {!isSeen && <ChevronRight size={10} style={{ color: `${h.color}55` }} />}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {h.title}
                      </div>
                      <div className="text-[9.5px] font-mono mt-0.5 leading-snug" style={{ color: 'var(--text-faint)' }}>
                        {h.cardDesc}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* ── Footer tip ─────────────────────────────────────────────── */}
            <div className="px-4 pb-3">
              <p className="text-[9.5px] font-mono" style={{ color: 'var(--text-faint)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                Hints appear automatically as you navigate. Dismiss this card and use the Tour button in the header to re-open it.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartHereCard;
