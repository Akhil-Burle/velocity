/**
 * TourReOpenButton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Header button that shows "Tour N/12" on non-dashboard pages.
 * Clicking opens an inline dropdown with the full 12-item highlight grid.
 * Disappears completely when all 12 are seen (12/12).
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Map, X, CheckCircle2, ChevronRight,
  Zap, Bot, ShieldAlert, Layers, Activity,
  FlaskConical, TrendingDown, Gauge, FileCode,
  GitBranch, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { useTour, TOUR_HIGHLIGHTS } from './TourContext';
import { useTheme } from '../ThemeContext';

const ICON_MAP: Record<string, React.ReactNode> = {
  'bot':            <Bot size={11} />,
  'trending-down':  <TrendingDown size={11} />,
  'trending-up':    <TrendingUp size={11} />,
  'activity':       <Activity size={11} />,
  'shield-alert':   <ShieldAlert size={11} />,
  'zap':            <Zap size={11} />,
  'flask':          <FlaskConical size={11} />,
  'layers':         <Layers size={11} />,
  'gauge':          <Gauge size={11} />,
  'file-code':      <FileCode size={11} />,
  'git-branch':     <GitBranch size={11} />,
  'alert-triangle': <AlertTriangle size={11} />,
};

interface TourReOpenButtonProps {
  surfaceBorder: string;
  onTriggerPanic?: () => void;
}

const TourReOpenButton: React.FC<TourReOpenButtonProps> = ({ surfaceBorder, onTriggerPanic }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const { seenIds, seenCount, totalCount, markSeen } = useTour();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only show on non-dashboard pages and when not 12/12
  const isOnDashboard = location.pathname === '/dashboard' || location.pathname === '/';
  const allDone = seenCount >= totalCount;

  // Close on outside click — always register, guard inside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Early return AFTER all hooks
  if (isOnDashboard || allDone) return null;

  const progressColor = seenCount > 0 ? '#f59e0b' : '#64748b';

  const handleLinkClick = (highlightId: string, linkTo: string, deepLinkKey?: string, deepLinkValue?: string) => {
    setOpen(false);
    sessionStorage.setItem('tour_navigate_hint', highlightId);
    if (deepLinkKey && deepLinkValue) sessionStorage.setItem(deepLinkKey, deepLinkValue);

    if (highlightId === 'panic-mode') {
      onTriggerPanic?.();
      markSeen('panic-mode');
      navigate('/dashboard');
      return;
    }
    if (highlightId === 'omnibar') {
      window.dispatchEvent(new CustomEvent('velocity:open-omnibar'));
      markSeen('omnibar');
      return;
    }
    if (highlightId === 'ultimatum-engine') {
      window.dispatchEvent(new CustomEvent('velocity:trigger-ultimatum'));
      markSeen('ultimatum-engine');
      navigate('/dashboard');
      return;
    }
    const h = TOUR_HIGHLIGHTS.find(x => x.id === highlightId);
    if (h?.manualOnly) markSeen(highlightId);
    navigate(linkTo);
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setOpen(v => !v)}
        title={`Guided Tour — ${seenCount} of ${totalCount} explored`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(34,197,94,0.2)' }}
        whileTap={{ scale: 0.94 }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
        style={{
          background: open ? 'rgba(34,197,94,0.1)' : 'var(--bg-surface)',
          border: open ? '1px solid rgba(34,197,94,0.3)' : `1px solid ${surfaceBorder}`,
          color: 'var(--text-faint)',
        }}
      >
        <Map size={12} style={{ color: seenCount > 0 ? '#22c55e' : 'var(--text-faint)' }} />
        <span className="hidden sm:inline text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Tour</span>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
          style={{
            background: `${progressColor}18`,
            color: progressColor,
            border: `1px solid ${progressColor}30`,
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {seenCount}/{totalCount}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-10 z-50 rounded-2xl overflow-hidden"
            style={{
              width: 420,
              background: isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.98)',
              border: '1px solid rgba(34,197,94,0.22)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: isDark
                ? '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.08)'
                : '0 20px 40px rgba(0,0,0,0.14)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
              <div className="flex items-center gap-2">
                <motion.div className="w-5 h-5 rounded-md flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                  animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0.2)', '0 0 8px rgba(34,197,94,0.35)', '0 0 0px rgba(34,197,94,0.2)'] }}
                  transition={{ duration: 2.2, repeat: Infinity }}>
                  <Zap size={10} className="text-green-400" />
                </motion.div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Start here for judges</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  {seenCount}/{totalCount} explored
                </span>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full"
                style={{ color: 'var(--text-faint)', background: 'rgba(0,0,0,0.08)' }}>
                <X size={11} />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-1.5 p-3">
              {TOUR_HIGHLIGHTS.map((h, i) => {
                const isSeen = seenIds.has(h.id);
                return (
                  <motion.button
                    key={h.id}
                    onClick={() => handleLinkClick(h.id, h.linkTo, h.deepLinkKey, h.deepLinkValue)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-xl text-left relative overflow-hidden"
                    style={{
                      background: isSeen
                        ? (isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)')
                        : `${h.color}0d`,
                      border: isSeen
                        ? '1px solid rgba(34,197,94,0.18)'
                        : `1px solid ${h.color}20`,
                      opacity: isSeen ? 0.7 : 1,
                    }}
                  >
                    {isSeen && (
                      <CheckCircle2 size={10} className="absolute top-1.5 right-1.5"
                        style={{ color: '#22c55e' }} />
                    )}
                    <span style={{ color: isSeen ? '#22c55e' : h.color }}>
                      {ICON_MAP[h.iconKey] || <Zap size={11} />}
                    </span>
                    <div className="text-[10px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {h.title}
                    </div>
                    {!isSeen && <ChevronRight size={8} className="ml-auto mt-auto" style={{ color: `${h.color}55` }} />}
                  </motion.button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                Click any item to navigate directly · auto-ticks when you visit the page
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TourReOpenButton;
