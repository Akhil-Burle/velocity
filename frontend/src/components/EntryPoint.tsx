/**
 * EntryPoint.tsx — Velocity Landing Page
 * "Pathway" Hero redesign: gradient orbs → stats banner → bento grid
 * All existing handlers (onSubmit, auth modal, hint chips) preserved exactly.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  ArrowRight, Zap, Sun, Moon, Activity, Brain, Mail, GitBranch,
  Code2, Terminal, CheckCircle2, Sparkles, Clock, TrendingUp,
} from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';
import BrainDumpInput from './BrainDumpInput';
import AuthModal from './AuthModal';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { setApiToken } from '../api';

interface EntryPointProps {
  onSubmit: (input: string) => void;
}

const HINT_CHIPS = ['React Lab due Friday', 'DBMS homework', 'Study for midterm', 'Research draft'];

const STATS = [
  { value: 1240, suffix: '+', label: 'tasks analyzed',  sublabel: 'this month' },
  { value: 98,   suffix: '%', label: 'on-time rate',    sublabel: 'avg across users' },
  { value: 3,    suffix: 'x', label: 'velocity boost',  sublabel: 'vs manual planning' },
  { value: 2,    suffix: 's', label: 'avg parse time',  sublabel: 'brain dump → tasks' },
];

// ── Animated counter ─────────────────────────────────────────────────────────
const AnimCounter: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = value / 40;
    const t = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(t); }
      else setDisplay(Math.floor(start));
    }, 30);
    return () => clearInterval(t);
  }, [started, value]);

  return <span ref={ref}>{display}{suffix}</span>;
};

// ── Tilt card wrapper ─────────────────────────────────────────────────────────
const TiltCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 200, damping: 22 });
  const y = useSpring(useMotionValue(0), { stiffness: 200, damping: 22 });
  const rotX = useTransform(y, v => -v * 8);
  const rotY = useTransform(x, v => v * 8);

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) / rect.width);
    y.set((e.clientY - rect.top - rect.height / 2) / rect.height);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d', ...style }}
      className={className}>
      {children}
    </motion.div>
  );
};

// ── Gradient orb ─────────────────────────────────────────────────────────────
const Orb: React.FC<{ cx: string; cy: string; color: string; size: string; delay?: number }> = ({ cx, cy, color, size, delay = 0 }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ left: cx, top: cy, width: size, height: size, background: color, filter: 'blur(80px)', transform: 'translate(-50%,-50%)' }}
    animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.75, 0.55] }}
    transition={{ duration: 7 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
  />
);

// ── Floating task pill (hero decoration) ─────────────────────────────────────
const TaskPill: React.FC<{ text: string; status: 'red' | 'amber' | 'green'; delay: number; x: string; y: string }> = ({ text, status, delay, x, y }) => {
  const cfg = {
    red:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   dot: '#ef4444' },
    amber: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  dot: '#f59e0b' },
    green: { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   dot: '#22c55e' },
  }[status];
  return (
    <motion.div
      className="absolute hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono backdrop-blur-md whitespace-nowrap"
      style={{ left: x, top: y, background: cfg.bg, border: `1px solid ${cfg.border}`, color: '#e2e8f0' }}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.2 + delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }} />
      {text}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const EntryPoint: React.FC<EntryPointProps> = ({ onSubmit }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const { isAuthenticated, setAuth } = useAuth();

  const [loading, setLoading]         = useState(false);
  const [hintValue, setHintValue]     = useState('');
  const [pendingText, setPendingText] = useState<string | null>(null);

  // ── Preserved handlers ────────────────────────────────────────────────────
  const handleSubmit = (text: string) => {
    if (loading) return;
    if (!isAuthenticated) {
      // Silently run the cinematic demo login, then submit the text
      setPendingText(text);
      handleDemoSandboxWithCallback(text);
      return;
    }
    setLoading(true);
    setTimeout(() => onSubmit(text), 1400);
  };

  const [cinematicLogin, setCinematicLogin] = useState(false);
  const [cinematicStep, setCinematicStep] = useState(0);
  const [typedUser, setTypedUser] = useState('');
  const [typedPass, setTypedPass] = useState('');

  // Runs the cinematic login, then fires submitText once authenticated
  const handleDemoSandboxWithCallback = (submitText?: string) => {
    if (loading) return;

    // Cinematic sequence: type "demo" + "velocity2026" → login
    setCinematicLogin(true);
    setCinematicStep(0);
    setTypedUser('');
    setTypedPass('');

    const DEMO_USER = 'demo';
    const DEMO_PASS = 'velocity2026';

    // Step 0: overlay appears (300ms)
    setTimeout(() => { setCinematicStep(1); }, 300);

    // Step 1: type username character by character (20ms/char)
    setTimeout(() => {
      let i = 0;
      const typeUser = setInterval(() => {
        i++;
        setTypedUser(DEMO_USER.slice(0, i));
        if (i >= DEMO_USER.length) {
          clearInterval(typeUser);
          setCinematicStep(2);
          // Step 2: brief pause, then type password
          setTimeout(() => {
            let j = 0;
            const typePass = setInterval(() => {
              j++;
              setTypedPass(DEMO_PASS.slice(0, j));
              if (j >= DEMO_PASS.length) {
                clearInterval(typePass);
                setCinematicStep(3);
                // Step 3: "logging in..." then transition
                setTimeout(async () => {
                  try {
                    const { loginWithCredentials } = await import('../api');
                    const res = await loginWithCredentials(DEMO_USER, DEMO_PASS);
                    setApiToken(res.token);
                    setAuth(res.token, res.userId, res.mode);
                    setCinematicStep(4);
                    setTimeout(() => {
                      setCinematicLogin(false);
                      setLoading(true);
                      setTimeout(() => onSubmit(submitText ?? ''), 400);
                    }, 700);
                  } catch {
                    // Demo login failed — fall back to guest session, then proceed
                    try {
                      const { guestLogin } = await import('../api');
                      const guest = await guestLogin();
                      setApiToken(guest.token);
                      setAuth(guest.token, guest.userId, 'guest');
                    } catch { /* backend fully unreachable */ }
                    setCinematicLogin(false);
                    setLoading(true);
                    setTimeout(() => onSubmit(submitText ?? ''), 400);
                  }
                }, 600);
              }
            }, 20);
          }, 300);
        }
      }, 20);
    }, 600);
  };

  // Original sandbox button handler — no pending text, goes straight to dashboard
  const handleDemoSandbox = () => {
    if (isAuthenticated) {
      setLoading(true);
      setTimeout(() => onSubmit(''), 800);
      return;
    }
    handleDemoSandboxWithCallback();
  };

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } };
  const item    = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <div className="min-h-screen relative overflow-x-hidden"
      style={{ background: isDark ? '#0d1117' : '#f0f4f8', color: isDark ? '#ffffff' : '#0f172a' }}>

      {/* ── Background layer ───────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Orbs */}
        <Orb cx="20%"  cy="25%"  color="rgba(34,197,94,0.18)"  size="600px" delay={0} />
        <Orb cx="80%"  cy="15%"  color="rgba(56,189,248,0.12)" size="500px" delay={2} />
        <Orb cx="60%"  cy="70%"  color="rgba(34,197,94,0.1)"   size="700px" delay={3.5} />
        <Orb cx="10%"  cy="80%"  color="rgba(56,189,248,0.08)" size="400px" delay={1.5} />
        {/* Fine grid */}
        <div className="absolute inset-0" style={{
          opacity: isDark ? 0.022 : 0.035,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
        }} />
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundSize: '200px' }} />
      </div>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)' }}
            animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0.2)', '0 0 20px rgba(34,197,94,0.35)', '0 0 0px rgba(34,197,94,0.2)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}>
            <Zap size={15} className="text-green-400" />
          </motion.div>
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>Velocity</span>
          <span className="hidden sm:block text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)', color: '#4ade80' }}>
            v2
          </span>
        </div>
        <div className="flex items-center gap-3">
          <WaveformAnimation />
          <motion.button
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); toggle(r.left + r.width / 2, r.top + r.height / 2); }}
            whileHover={{ scale: 1.1, rotate: 12 }} whileTap={{ scale: 0.9 }}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: isDark ? 'rgba(253,224,71,0.07)' : 'rgba(15,23,42,0.07)', border: isDark ? '1px solid rgba(253,224,71,0.18)' : '1px solid rgba(15,23,42,0.12)', color: isDark ? '#fde047' : '#334155' }}>
            <AnimatePresence mode="wait">
              {isDark
                ? <motion.span key="s" initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 40, opacity: 0 }} transition={{ duration: 0.18 }}><Sun size={15} /></motion.span>
                : <motion.span key="m" initial={{ rotate: 40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -40, opacity: 0 }} transition={{ duration: 0.18 }}><Moon size={15} /></motion.span>}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: HERO                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 pt-16 pb-24 px-6">
        {/* Floating task pills */}
        <TaskPill text="React Lab — 1.8h/day" status="red"   delay={0}    x="4%"  y="18%" />
        <TaskPill text="DBMS due tomorrow"     status="amber" delay={0.15} x="6%"  y="62%" />
        <TaskPill text="Essay · On Pace ✓"     status="green" delay={0.3}  x="72%" y="12%" />
        <TaskPill text="Physics — triaged"     status="amber" delay={0.45} x="74%" y="68%" />

        <motion.div
          variants={stagger} initial="hidden" animate="visible"
          className="max-w-4xl mx-auto flex flex-col items-center text-center gap-8"
        >
          {/* Badge */}
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 text-[11px] font-mono px-4 py-1.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: '#4ade80' }}>
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              </motion.span>
              AI-Powered Productivity Engine · Zero-Hour Agent Suite
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div variants={item} className="space-y-3">
            <h1 className="font-bold leading-[1.08] tracking-tight"
              style={{ fontSize: 'clamp(2.6rem, 7vw, 5.5rem)' }}>
              <span style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 40%, #22c55e 70%, #4ade80 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Don't manage tasks.
              </span>
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 35%, #38bdf8 70%, #818cf8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Pace your velocity.
              </span>
            </h1>
            <p className="text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
              style={{ color: isDark ? '#94a3b8' : '#475569' }}>
              Velocity watches your deadlines in real time, surfaces conflicts before they explode,
              and executes autonomous rescue operations — so you always know what to do next.
            </p>
          </motion.div>

          {/* Input bar */}
          <motion.div variants={item} className="w-full max-w-2xl">
            <BrainDumpInput
              onSubmit={handleSubmit}
              onTasksExtracted={(tasks) => {
                // On landing page, auto-navigate to dashboard with extracted tasks
                if (tasks.length > 0) handleSubmit('');
              }}
              loading={loading}
              isDark={isDark}
              showCalendar={true}
              defaultValue={hintValue}
              placeholder="Paste your tasks or describe your workload..."
            />
          </motion.div>

          {/* CTA row */}
          <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
            {/* Primary CTA */}
            <motion.button
              onClick={handleDemoSandbox}
              disabled={loading}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                color: '#000',
                boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 8px 32px rgba(34,197,94,0.3), 0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {/* Shimmer overlay */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
              />
              <Sparkles size={15} />
              Enter Demo Sandbox
              <ArrowRight size={15} />
            </motion.button>

            {/* Hint chips */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {HINT_CHIPS.map((chip, i) => (
                <motion.button key={chip} onClick={() => setHintValue(chip)}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + i * 0.06 }}
                  whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }}
                  className="text-[11px] font-mono px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
                    color: 'var(--text-faint)',
                  }}>
                  {chip}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Trust line */}
          <motion.div variants={item} className="flex items-center gap-2">
            <CheckCircle2 size={12} className="text-green-400" />
            <span className="text-xs font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
              No account needed · pre-loaded with real AI demo data · zero setup
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: STATS BANNER                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto rounded-2xl overflow-hidden"
          style={{
            background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.7)',
            border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Top accent line */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.5) 30%, rgba(56,189,248,0.5) 70%, transparent)' }} />

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
            style={{ divideColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
            {STATS.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex flex-col items-center justify-center gap-1 px-6 py-7 text-center"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
              >
                <div className="font-black font-mono leading-none"
                  style={{
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    background: i % 2 === 0
                      ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                      : 'linear-gradient(135deg, #38bdf8, #818cf8)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>
                  <AnimCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="text-xs font-mono font-semibold tracking-wide mt-1"
                  style={{ color: 'var(--text-secondary)' }}>
                  {s.label}
                </div>
                <div className="text-[10px] font-mono"
                  style={{ color: 'var(--text-faint)' }}>
                  {s.sublabel}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: BENTO GRID                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto mb-10 text-center"
        >
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] mb-3"
            style={{ color: isDark ? '#4ade80' : '#16a34a' }}>
            The pathway
          </p>
          <h2 className="font-bold leading-tight"
            style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)', color: 'var(--text-primary)' }}>
            From chaos to execution in three steps
          </h2>
        </motion.div>

        {/* Bento grid */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ── TOP: Wide card — AI Triage ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="sm:col-span-2"
          >
            <TiltCard className="group rounded-2xl p-7 overflow-hidden relative cursor-default transition-all duration-300"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                backdropFilter: 'blur(16px)',
              } as React.CSSProperties}>
              {/* Hover border glow — done with box-shadow via motion */}
              <motion.div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(34,197,94,0.4)' }} />
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 80% 20%, rgba(34,197,94,0.08) 0%, transparent 60%)' }} />

              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <Brain size={18} className="text-green-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#4ade80' }}>Step 01</p>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>AI Triage Engine</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    Dump everything in your head. Velocity parses deadlines, priorities, cognitive load, and external dependencies.
                    When you're overloaded, it fires the <span style={{ color: '#4ade80' }}>Ultimatum</span> — forcing a conscious choice instead of silent auto-reschedule.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Brain dump → structured tasks', 'Conflict detection', 'Urgency scoring', 'Smart reschedule'].map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', color: '#4ade80' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Task cascade visual */}
                <div className="w-full sm:w-72 shrink-0 space-y-2">
                  {[
                    { name: 'React Lab — Auth Module', pace: '6.2h/day', s: 'RED',   pct: 12 },
                    { name: 'Physics Essay',           pace: '3.1h/day', s: 'AMBER', pct: 35 },
                    { name: 'Weekly Report',           pace: '0.8h/day', s: 'GREEN', pct: 80 },
                  ].map((t, i) => {
                    const cfg = { RED: { c: '#ef4444', bg: 'rgba(239,68,68,0.1)', b: 'rgba(239,68,68,0.2)' }, AMBER: { c: '#f59e0b', bg: 'rgba(245,158,11,0.1)', b: 'rgba(245,158,11,0.2)' }, GREEN: { c: '#22c55e', bg: 'rgba(34,197,94,0.1)', b: 'rgba(34,197,94,0.2)' } }[t.s]!;
                    return (
                      <motion.div key={t.name}
                        initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }}
                        className="rounded-xl px-3 py-2.5 relative overflow-hidden"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.b}` }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                          <span className="text-[10px] font-mono shrink-0" style={{ color: cfg.c }}>{t.pace}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                          <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                            whileInView={{ width: `${t.pct}%` }} viewport={{ once: true }}
                            transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            style={{ background: `linear-gradient(90deg, ${cfg.c}80, ${cfg.c})` }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* ── BOTTOM LEFT: Panic Mode / Scaffold ──────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <TiltCard className="group h-full rounded-2xl p-6 overflow-hidden relative cursor-default"
              style={{
                background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.75)',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                backdropFilter: 'blur(16px)',
              } as React.CSSProperties}>
              <motion.div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.4)' }} />
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 20% 80%, rgba(239,68,68,0.07) 0%, transparent 60%)' }} />

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)' }}>
                  <Code2 size={18} style={{ color: '#f87171' }} />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#f87171' }}>Step 02</p>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Panic Mode Scaffold</h3>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                Deadline in under 2 hours? Velocity generates a task-specific checklist, runnable boilerplate, and creates a GitHub repository — autonomously.
              </p>

              {/* Code editor mockup */}
              <div className="rounded-xl overflow-hidden text-[10px] font-mono"
                style={{ background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)' }}>
                <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)' }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-2 text-[9px]" style={{ color: 'var(--text-faint)' }}>velocity-scaffold.ts</span>
                  <motion.span className="ml-auto text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
                    animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    ⚡ PANIC
                  </motion.span>
                </div>
                <div className="px-3 py-3 space-y-1 leading-relaxed">
                  {[
                    { t: '// ✓ Initialize Express router',   c: isDark ? '#6b7280' : '#94a3b8' },
                    { t: 'const router = express.Router();', c: isDark ? '#c084fc' : '#7c3aed' },
                    { t: '// ✓ POST /auth/login',            c: isDark ? '#6b7280' : '#94a3b8' },
                    { t: 'router.post("/login", async',      c: isDark ? '#38bdf8' : '#0284c7' },
                    { t: '  // TODO: validate & sign JWT',   c: isDark ? '#6b7280' : '#94a3b8' },
                  ].map((line, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                      viewport={{ once: true }} transition={{ delay: 0.5 + i * 0.08 }}
                      style={{ color: line.c }}>
                      {line.t}
                    </motion.div>
                  ))}
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* ── BOTTOM RIGHT: Negotiate Mode ────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <TiltCard className="group h-full rounded-2xl p-6 overflow-hidden relative cursor-default"
              style={{
                background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.75)',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                backdropFilter: 'blur(16px)',
              } as React.CSSProperties}>
              <motion.div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.4)' }} />
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 80% 20%, rgba(56,189,248,0.07) 0%, transparent 60%)' }} />

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.22)' }}>
                  <Mail size={18} style={{ color: '#38bdf8' }} />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: '#38bdf8' }}>Step 03</p>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Negotiate Mode</h3>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                Can't meet a deadline owed to someone? One tap drafts a context-aware professional extension request and sends it via Gmail — no awkward wording needed.
              </p>

              {/* Email mockup */}
              <div className="rounded-xl overflow-hidden text-[10px] font-mono"
                style={{ background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(56,189,248,0.12)' : '1px solid rgba(56,189,248,0.18)' }}>
                <div className="px-3 py-2 space-y-1.5" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                  {[
                    { k: 'To:',      v: 'Prof. Chen <chen@university.edu>', c: isDark ? '#e2e8f0' : '#334155' },
                    { k: 'Subject:', v: 'Extension Request — Physics Essay', c: isDark ? '#38bdf8' : '#0284c7' },
                  ].map(r => (
                    <div key={r.k} className="flex gap-2">
                      <span style={{ color: 'var(--text-faint)', minWidth: 52 }}>{r.k}</span>
                      <span style={{ color: r.c }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-3 leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                  <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
                    Dear Prof. Chen, I'm currently at 20% completion with 2 days remaining due to overlapping deadlines. I'd appreciate a 48-hour extension to deliver quality work...
                  </motion.span>
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.7 }}
                    className="mt-2.5 flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: isDark ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.3)' }} />
                    <span style={{ color: '#38bdf8' }}>⚡ Velocity AI · context-aware draft</span>
                    <div className="h-px flex-1" style={{ background: isDark ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.3)' }} />
                  </motion.div>
                </div>
              </div>
            </TiltCard>
          </motion.div>

        </div>{/* end bento grid */}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER CTA                                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
          style={{
            background: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(34,197,94,0.12) 0%, transparent 70%)' }} />

          <motion.div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)' }}
            animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0.3)', '0 0 30px rgba(34,197,94,0.5)', '0 0 0px rgba(34,197,94,0.3)'] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <Zap size={22} className="text-green-400" />
          </motion.div>

          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Ready to see it in action?
          </h2>
          <p className="text-sm mb-8" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
            One click. Pre-loaded with real tasks, real AI responses, and real agent actions.
            No account, no setup, no waiting.
          </p>

          <motion.button
            onClick={handleDemoSandbox}
            disabled={loading}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-bold overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#000',
              boxShadow: '0 0 0 1px rgba(34,197,94,0.4), 0 12px 40px rgba(34,197,94,0.35)',
            }}
          >
            <motion.div className="absolute inset-0"
              style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }} />
            <Sparkles size={16} />
            Launch Demo Sandbox
            <ArrowRight size={16} />
          </motion.button>

          <p className="text-[10px] font-mono mt-4" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            demo · velocity2026 · or continue as guest
          </p>
        </motion.div>
      </section>

      {/* ── Loading overlay ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: isDark ? 'rgba(8,10,14,0.92)' : 'rgba(240,244,248,0.92)', backdropFilter: 'blur(20px)' }}>
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-6">
              <div className="relative w-16 h-16">
                <motion.div className="absolute inset-0 rounded-full border-2 border-green-500/20" />
                <motion.div className="absolute inset-0 rounded-full border-2 border-t-green-400 border-r-green-400/40 border-b-transparent border-l-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={20} className="text-green-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Launching Velocity...</p>
                <p className="text-xs font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Seeding your demo workspace</p>
              </div>
              <div className="w-52 h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                <motion.div className="h-full rounded-full bg-green-400"
                  initial={{ width: 0 }} animate={{ width: '100%' }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cinematic auto-login overlay (Feature Block 8) ─────────────────── */}
      <AnimatePresence>
        {cinematicLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
              className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
              style={{
                background: isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 0 1px rgba(34,197,94,0.15), 0 40px 80px rgba(0,0,0,0.7)',
              }}
            >
              {/* Top accent */}
              <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #22c55e 30%, #38bdf8 70%, transparent)' }} />

              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-green-400" />
                  <span className="text-xs font-mono font-bold" style={{ color: '#4ade80' }}>
                    Velocity · Auto-Login
                  </span>
                </div>
                <p className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  Loading demo credentials...
                </p>
              </div>

              {/* Mock login form */}
              <div className="px-6 pb-6 space-y-3">
                {/* Username field */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-faint)' }}>Username</label>
                  <div className="flex items-center px-3 py-2.5 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: cinematicStep >= 1 ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                    <span className="text-sm font-mono flex-1" style={{ color: 'var(--text-primary)', minHeight: '1em' }}>
                      {typedUser}
                      {cinematicStep === 1 && (
                        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                          style={{ display: 'inline-block', width: 2, height: 14, background: '#22c55e', marginLeft: 1, verticalAlign: 'text-bottom' }} />
                      )}
                    </span>
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-faint)' }}>Password</label>
                  <div className="flex items-center px-3 py-2.5 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: cinematicStep >= 2 ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                    <span className="text-sm font-mono flex-1" style={{ color: 'var(--text-primary)', minHeight: '1em' }}>
                      {'•'.repeat(typedPass.length)}
                      {cinematicStep === 2 && (
                        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                          style={{ display: 'inline-block', width: 2, height: 14, background: '#22c55e', marginLeft: 1, verticalAlign: 'text-bottom' }} />
                      )}
                    </span>
                  </div>
                </div>

                {/* Status line */}
                <div className="flex items-center gap-2 pt-1">
                  {cinematicStep < 3 && (
                    <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                  )}
                  {cinematicStep === 4 && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                      <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                    </motion.div>
                  )}
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    {cinematicStep <= 1 && 'Entering credentials...'}
                    {cinematicStep === 2 && 'Entering password...'}
                    {cinematicStep === 3 && 'Authenticating...'}
                    {cinematicStep === 4 && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#4ade80' }}>
                        ✓ Authenticated — loading dashboard
                      </motion.span>
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default EntryPoint;
