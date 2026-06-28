/**
 * LandingNav.tsx — BEAST MODE
 * Glassmorphic nav with Velocity logo, section links, and CTA button.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

const NAV_LINKS = [
  { label: 'How it works', href: '#behavioral-velocity' },
  { label: 'Features', href: '#features' },
  { label: 'Tech Stack', href: '#google-tech' },
];

const LandingNav: React.FC = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    toggle(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const scrollTo = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-[100]"
      style={{
        background: scrolled
          ? (isDark ? 'rgba(8,11,16,0.92)' : 'rgba(248,250,252,0.92)')
          : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease',
      }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 py-4">
        {/* Logo */}
        <motion.div className="flex items-center gap-2.5 cursor-pointer"
          whileHover={{ scale: 1.02 }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
            whileHover={{ rotate: [0, -15, 15, 0], transition: { duration: 0.4 } }}
          >
            <Zap size={15} className="text-green-400" />
          </motion.div>
          <div>
            <span className="font-black text-base tracking-tight" style={{ color: '#fff', letterSpacing: '-0.02em' }}>Velocity</span>
          </div>
        </motion.div>

        {/* Nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <a key={link.label} href={link.href} onClick={scrollTo(link.href)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <motion.button onClick={handleToggle} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            aria-label="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: isDark ? '#fde047' : '#475569' }}>
            <AnimatePresence mode="wait">
              {isDark
                ? <motion.span key="sun" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.15 }} style={{ display: 'flex' }}><Sun size={14} /></motion.span>
                : <motion.span key="moon" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.15 }} style={{ display: 'flex' }}><Moon size={14} /></motion.span>
              }
            </AnimatePresence>
          </motion.button>

          {/* CTA pill */}
          <motion.button
            onClick={() => document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' })}
            whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#000', boxShadow: '0 4px 16px rgba(34,197,94,0.25)' }}>
            <Zap size={13} />
            Try Demo
          </motion.button>
        </div>
      </div>
    </header>
  );
};

export default LandingNav;
