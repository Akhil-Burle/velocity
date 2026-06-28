/**
 * LandingNav.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sticky top navigation bar for the landing page.
 * - Left: Velocity logo/wordmark (Zap icon + "Velocity" text)
 * - Right: Theme toggle button (Sun in dark mode, Moon in light mode)
 *
 * Requirements: 2.3, 11.3
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

const LandingNav: React.FC = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const surfaceBorder = isDark
    ? 'rgba(255,255,255,0.07)'
    : 'rgba(0,0,0,0.08)';

  const navBg = isDark
    ? 'rgba(13,17,23,0.88)'
    : 'rgba(248,250,252,0.90)';

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    toggle(originX, originY);
  };

  return (
    <header
      className="sticky top-0 z-[100] flex items-center justify-between px-5 sm:px-8 py-3"
      style={{
        background: navBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${surfaceBorder}`,
      }}
    >
      {/* ── Logo / Wordmark ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <motion.div
          whileHover={{ rotate: [0, -12, 12, 0] }}
          transition={{ duration: 0.5 }}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.28)',
          }}
        >
          <Zap size={13} className="text-green-400" />
        </motion.div>

        <span
          className="hidden sm:block font-bold text-sm tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Velocity
        </span>
      </div>

      {/* ── Theme Toggle ─────────────────────────────────────────────────── */}
      <motion.button
        onClick={handleToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Toggle theme"
        className="w-8 h-8 flex items-center justify-center rounded-lg"
        style={{
          background: isDark
            ? 'rgba(253,224,71,0.07)'
            : 'rgba(15,23,42,0.05)',
          border: isDark
            ? '1px solid rgba(253,224,71,0.16)'
            : '1px solid rgba(15,23,42,0.1)',
          color: isDark ? '#fde047' : '#475569',
        }}
      >
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.span
              key="sun"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: 'flex' }}
            >
              <Sun size={14} />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -45, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: 'flex' }}
            >
              <Moon size={14} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </header>
  );
};

export default LandingNav;
