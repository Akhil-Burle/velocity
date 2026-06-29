/**
 * AppShell.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent sidebar navigation + header with notification bell.
 * Wraps all inner pages (Dashboard, Goals, Calendar, Insights, Settings).
 * Styled to exactly match the existing header — same background, border, icon
 * button patterns from Dashboard.tsx.
 */
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, LayoutGrid, Target, Calendar, TrendingUp, Settings,
  Sun, Moon, Bell, X, ChevronRight, AlertTriangle, Clock, CalendarRange, Bot, Layers, Activity, LogOut,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { fetchActiveReminders, computeDriftScoreBatch, VelocityVector as VelocityVectorType, setApiToken } from '../api';
import { Reminder } from '../types';
import CreditsTicker from './CreditsTicker';
import VelocityVectorIndicator from './VelocityVector';
import ContextualHints from './ContextualHints';
import TourReOpenButton from './TourReOpenButton';

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutGrid,   label: 'Dashboard' },
  { path: '/command',   icon: CalendarRange, label: 'Command Day' },
  { path: '/goals',     icon: Target,       label: 'Goals & Habits' },
  { path: '/calendar',  icon: Calendar,     label: 'Calendar' },
  { path: '/insights',  icon: TrendingUp,   label: 'Insights' },
  { path: '/agent-log', icon: Bot,          label: 'Agent Log', highlight: true },
  { path: '/velocity-vector', icon: Activity, label: 'Velocity Vector', highlight: true },
  { path: '/tech-stack',icon: Layers,       label: 'Tech Stack' },
  { path: '/settings',  icon: Settings,     label: 'Settings' },
];

// Urgency color matching existing status colors
const URGENCY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
};

const REMINDER_ICON: Record<string, React.ReactNode> = {
  deadline: <AlertTriangle size={11} />,
  checkin:  <Clock size={11} />,
  habit:    <Target size={11} />,
  briefing: <Zap size={11} />,
};

// ─── Notification Bell ────────────────────────────────────────────────────────
const NotificationBell: React.FC<{ isDark: boolean; surfaceBorder: string }> = ({ isDark, surfaceBorder }) => {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchActiveReminders();
      setReminders(data);
    } catch {
      // silently fail — backend may not be running
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const highCount = reminders.filter(r => r.urgency === 'high').length;

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        className="w-8 h-8 flex items-center justify-center rounded-lg relative"
        style={{
          background: 'var(--bg-surface)',
          color: reminders.length > 0 ? '#f59e0b' : 'var(--text-muted)',
          border: `1px solid ${surfaceBorder}`,
        }}
        title="Notifications"
      >
        <Bell size={14} />
        {/* Badge */}
        {reminders.length > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{
              background: highCount > 0 ? '#ef4444' : '#f59e0b',
              color: '#000',
            }}
          >
            {reminders.length > 9 ? '9+' : reminders.length}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-10 w-80 rounded-2xl overflow-hidden z-50"
            style={{
              background: isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.97)',
              border: `1px solid ${surfaceBorder}`,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${surfaceBorder}` }}>
              <div className="flex items-center gap-2">
                <Bell size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Reminders</span>
                {reminders.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.22)' }}>
                    {reminders.length}
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-faint)' }}>
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {loading && reminders.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <motion.div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent"
                    animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                </div>
              )}

              {!loading && reminders.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Zap size={20} className="text-green-500 opacity-40" />
                  <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>All clear — no active reminders</span>
                </div>
              )}

              {reminders.map((r, i) => {
                const color = URGENCY_COLOR[r.urgency] || '#94a3b8';
                return (
                  <motion.div key={r.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="px-4 py-3 cursor-default"
                    style={{ borderBottom: i < reminders.length - 1 ? `1px solid ${surfaceBorder}` : 'none' }}>
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                        style={{ background: `rgba(${color === '#ef4444' ? '239,68,68' : color === '#f59e0b' ? '245,158,11' : '34,197,94'},0.12)`, color }}>
                        {REMINDER_ICON[r.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                          {r.title}
                        </div>
                        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          {r.body}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main AppShell ────────────────────────────────────────────────────────────
const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  const [velocityVector, setVelocityVector] = useState<VelocityVectorType | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    setAvatarMenuOpen(false);
    logout();
    setApiToken(null);
    navigate('/');
  };

  // Close avatar menu on outside click
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [avatarMenuOpen]);

  useEffect(() => {
    const loadVector = async () => {
      try {
        const data = await computeDriftScoreBatch();
        setVelocityVector(data.velocityVector);
      } catch { /* silently fail */ }
    };
    // Load on mount with delay to not compete with initial task fetch
    const t = setTimeout(loadVector, 3000);
    // Refresh every 5 minutes
    const interval = setInterval(loadVector, 5 * 60000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const headerBg    = isDark ? 'rgba(13,17,23,0.95)' : 'rgba(248,250,252,0.94)';
  const sidebarBg   = isDark ? 'rgba(13,17,23,0.99)' : 'rgba(248,250,252,0.98)';
  const surfaceBg   = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  const SIDEBAR_W = 220;
  const sidebarVisible = isDesktop || sidebarOpen;

  return (
    <div className="min-h-screen flex"
      style={{ background: isDark ? 'linear-gradient(145deg,#0d1117 0%,#111820 55%,#0d1117 100%)' : 'linear-gradient(145deg,#f0f4f8 0%,#e8edf3 55%,#eef2f7 100%)' }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: isDark
          ? 'radial-gradient(ellipse 90% 45% at 50% 0%, rgba(34,197,94,0.04) 0%, transparent 70%)'
          : 'radial-gradient(ellipse 90% 45% at 50% 0%, rgba(20,184,166,0.05) 0%, transparent 70%)' }} />

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 h-full z-40 flex flex-col"
        style={{
          width: SIDEBAR_W,
          background: sidebarBg,
          borderRight: `1px solid ${surfaceBorder}`,
          backdropFilter: 'blur(24px)',
          transform: `translateX(${sidebarVisible ? 0 : -SIDEBAR_W}px)`,
          transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${surfaceBorder}` }}>
          <motion.div whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)' }}>
            <Zap size={13} className="text-green-400" />
          </motion.div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>Velocity</span>
            <span className="text-xs font-mono hidden sm:inline" style={{ color: 'var(--text-faint)' }}>v2</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, icon: Icon, label, highlight }) => {
            const isActive = location.pathname === path || (path === '/dashboard' && location.pathname === '/');
            return (
              <NavLink key={path} to={path} onClick={() => setSidebarOpen(false)}>
                <motion.div
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                  data-tour={path === '/agent-log' ? 'tour-agent-log-link' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative"
                  style={{
                    background: isActive
                      ? 'rgba(34,197,94,0.1)'
                      : 'transparent',
                    border: isActive
                      ? '1px solid rgba(34,197,94,0.2)'
                      : '1px solid transparent',
                    color: isActive ? '#22c55e' : 'var(--text-muted)',
                  }}
                >
                  <Icon size={15} />
                  <span className="text-xs font-medium">{label}</span>
                  {highlight && !isActive && (
                    <motion.span
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ background: '#22c55e' }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  )}
                  {isActive && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto">
                      <ChevronRight size={11} style={{ color: '#22c55e' }} />
                    </motion.div>
                  )}
                </motion.div>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom — theme toggle */}
        <div className="px-4 py-4 shrink-0" style={{ borderTop: `1px solid ${surfaceBorder}` }}>
          <motion.button
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); toggle(r.left + r.width / 2, r.top + r.height / 2); }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{
              background: isDark ? 'rgba(253,224,71,0.06)' : 'rgba(15,23,42,0.05)',
              border: isDark ? '1px solid rgba(253,224,71,0.14)' : '1px solid rgba(15,23,42,0.1)',
              color: isDark ? '#fde047' : '#334155',
            }}
          >
            <AnimatePresence mode="wait">
              {isDark
                ? <motion.span key="sun" initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 40, opacity: 0 }} transition={{ duration: 0.18 }}><Sun size={14} /></motion.span>
                : <motion.span key="moon" initial={{ rotate: 40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -40, opacity: 0 }} transition={{ duration: 0.18 }}><Moon size={14} /></motion.span>}
            </AnimatePresence>
            <span className="text-xs font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </motion.button>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ marginLeft: isDesktop ? SIDEBAR_W : 0, transition: 'margin-left 0.28s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Top header strip */}
        <motion.header
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}
          className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3"
          style={{ background: headerBg, backdropFilter: 'blur(24px)', borderBottom: `1px solid ${surfaceBorder}` }}
        >
          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: `1px solid ${surfaceBorder}`, color: 'var(--text-muted)' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <div className="space-y-1">
              <div className="w-4 h-px" style={{ background: 'currentColor' }} />
              <div className="w-3 h-px" style={{ background: 'currentColor' }} />
              <div className="w-4 h-px" style={{ background: 'currentColor' }} />
            </div>
          </button>

          {/* Page title breadcrumb */}
          <div className="flex items-center gap-2 ml-2 lg:ml-0">
            <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
              {NAV_ITEMS.find(n => n.path === location.pathname)?.label || 'Dashboard'}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Velocity Vector indicator (Phase 4) */}
            {velocityVector && (
              <VelocityVectorIndicator
                vector={velocityVector}
                isDark={isDark}
                surfaceBorder={surfaceBorder}
              />
            )}

            {/* Tour re-open button — shows when Start Here card is dismissed */}
            <TourReOpenButton surfaceBorder={surfaceBorder} />

            {/* Velocity Credits ticker — persistent across all pages */}
            <CreditsTicker isDark={isDark} surfaceBorder={surfaceBorder} />

            {/* Notification bell */}
            <NotificationBell isDark={isDark} surfaceBorder={surfaceBorder} />

            {/* Avatar + logout dropdown */}
            <div ref={avatarRef} className="relative">
              <motion.button
                onClick={() => setAvatarMenuOpen(v => !v)}
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold select-none"
                style={{
                  background: isDark ? 'linear-gradient(135deg,#3f3f46,#27272a)' : 'linear-gradient(135deg,#cbd5e1,#94a3b8)',
                  color: isDark ? '#e4e4e7' : '#1e293b',
                  border: `1px solid ${surfaceBorder}`,
                }}
              >
                A
              </motion.button>

              <AnimatePresence>
                {avatarMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-10 z-50 rounded-xl overflow-hidden"
                    style={{
                      width: 160,
                      background: isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.98)',
                      border: `1px solid ${surfaceBorder}`,
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div className="px-3 py-2" style={{ borderBottom: `1px solid ${surfaceBorder}` }}>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Signed in as</p>
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>demo</p>
                    </div>
                    <div className="p-1.5">
                      <motion.button
                        onClick={handleLogout}
                        whileHover={{ x: 2 }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold"
                        style={{ color: '#f87171', background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <LogOut size={12} />
                        Log out
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.header>

        {/* Page content */}
        <main className="flex-1 relative z-10">
          {children}
        </main>
      </div>

      {/* Contextual hints — page-aware, non-blocking, shares state with StartHereCard */}
      <ContextualHints />
    </div>
  );
};

export default AppShell;
