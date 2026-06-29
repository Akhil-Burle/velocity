/**
 * TourReOpenButton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent, unobtrusive re-open affordance for the Guided Tour.
 *
 * Appears in the AppShell header after the Start Here card has been dismissed.
 * Small compass/map icon — clearly labeled "Tour" on wider screens.
 * Clicking it re-opens the Start Here card and scrolls the page to the top.
 *
 * Also shows a small progress indicator: "N / 8 seen" as a pill.
 * Visually quiet until hovered; never blocking, never demanding.
 *
 * Design tokens: uses same green accent as the rest of the tour.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map } from 'lucide-react';
import { useTour } from './TourContext';

interface TourReOpenButtonProps {
  surfaceBorder: string;
}

const TourReOpenButton: React.FC<TourReOpenButtonProps> = ({ surfaceBorder }) => {
  const { cardVisible, openCard, seenCount, totalCount } = useTour();

  const handleClick = () => {
    openCard();
    // Scroll to top so the card is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allSeen = seenCount >= totalCount;
  const progressColor = allSeen ? '#22c55e' : seenCount > 0 ? '#f59e0b' : '#64748b';

  // Don't show when card is already visible
  if (cardVisible) return null;

  return (
    <AnimatePresence>
      <motion.button
        key="tour-reopen"
        onClick={handleClick}
        title={`Guided Tour — ${seenCount} of ${totalCount} highlights seen`}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.06, boxShadow: '0 0 10px rgba(34,197,94,0.2)' }}
        whileTap={{ scale: 0.94 }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${surfaceBorder}`,
          color: 'var(--text-faint)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <Map size={12} style={{ color: progressColor }} />
        <span className="hidden sm:inline text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
          Tour
        </span>
        {/* Progress pill */}
        <span
          className="text-[9px] font-mono px-1 py-0.5 rounded-full"
          style={{
            background: `${progressColor}14`,
            color: progressColor,
            border: `1px solid ${progressColor}28`,
            minWidth: 26,
            textAlign: 'center',
          }}
        >
          {seenCount}/{totalCount}
        </span>
      </motion.button>
    </AnimatePresence>
  );
};

export default TourReOpenButton;
