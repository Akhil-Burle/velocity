/**
 * HeroSection.tsx — BEAST MODE
 * Full-screen cinematic hero. Animated particle field background, massive
 * gradient headline, live "terminal" preview of the agent working, 
 * physics-simulation vector that reacts to mouse position.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Zap, CheckCircle2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { loginWithCredentials, setApiToken } from '../../../api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001/api';

export interface HeroSectionProps {
  onEnterDemo: () => void | Promise<void>;
  onSeeHowItWorks: () => void;
  reducedMotion: boolean;
  onNavigateDashboard?: () => void;
}

// ── Particle field canvas ──────────────────────────────────────────────────────
const ParticleCanvas: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouse);

    // Create particles
    const N = 80;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      pts.forEach(p => {
        // Mouse repulsion
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) { p.vx += dx / dist * 0.04; p.vy += dy / dist * 0.04; }

        p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,197,94,${p.opacity})`;
        ctx.fill();
      });

      // Draw connections
      pts.forEach((a, i) => {
        pts.slice(i + 1).forEach(b => {
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(34,197,94,${0.12 * (1 - d / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, [reducedMotion]);

  return (
    <canvas ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
      aria-hidden="true"
    />
  );
};

// ── Live agent terminal ticker ─────────────────────────────────────────────────
const AGENT_LINES = [
  { color: '#22c55e', prefix: '✓', text: 'Drift score computed — gap: −23%' },
  { color: '#38bdf8', prefix: '→', text: 'Rebalancing day plan around Calendar...' },
  { color: '#f59e0b', prefix: '⚠', text: 'Physics curve steepening: CS Lab RED' },
  { color: '#a78bfa', prefix: '◈', text: 'Policy learned: skip rebalance Fri >3pm' },
  { color: '#22c55e', prefix: '✓', text: 'Negotiate draft composed for Prof. Chen' },
  { color: '#ef4444', prefix: '⚡', text: 'Panic Mode: scaffold generated in 4.2s' },
  { color: '#38bdf8', prefix: '→', text: 'Velocity vector: 78% magnitude, aligned' },
  { color: '#22c55e', prefix: '✓', text: 'Trust decay applied: Physics Essay −12%' },
];

const AgentTerminal: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setVisibleLines(AGENT_LINES.map((_, i) => i).slice(0, 5));
      return;
    }
    // Stream lines one by one, character by character
    const line = AGENT_LINES[currentLine % AGENT_LINES.length];
    if (charCount < line.text.length) {
      const t = setTimeout(() => setCharCount(c => c + 1), 28);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setVisibleLines(prev => {
          const next = [...prev, currentLine % AGENT_LINES.length];
          return next.slice(-5); // keep last 5
        });
        setCharCount(0);
        setCurrentLine(l => l + 1);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [charCount, currentLine, reducedMotion]);

  const typingLine = AGENT_LINES[currentLine % AGENT_LINES.length];

  return (
    <div className="rounded-2xl overflow-hidden font-mono text-xs"
      style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(34,197,94,0.2)', backdropFilter: 'blur(20px)' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="ml-2 text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>velocity agent · live</span>
        <motion.div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400"
          animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      </div>
      {/* Lines */}
      <div className="px-4 py-3 space-y-1.5" style={{ minHeight: 140 }}>
        {visibleLines.map((lineIdx, i) => {
          const l = AGENT_LINES[lineIdx];
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2" style={{ opacity: 0.6 + i * 0.1 }}>
              <span style={{ color: l.color }}>{l.prefix}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{l.text}</span>
            </motion.div>
          );
        })}
        {/* Currently typing line */}
        {!reducedMotion && (
          <div className="flex items-center gap-2">
            <span style={{ color: typingLine.color }}>{typingLine.prefix}</span>
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>
              {typingLine.text.slice(0, charCount)}
              <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-0.5 h-3 bg-green-400 ml-px align-middle" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Metric pill floating cards ─────────────────────────────────────────────────
const FloatingMetric: React.FC<{
  label: string; value: string; sub: string; color: string;
  delay: number; x: string; y: string; reducedMotion: boolean;
}> = ({ label, value, sub, color, delay, x, y, reducedMotion }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    className="absolute hidden lg:flex flex-col gap-0.5 rounded-xl px-3 py-2.5"
    style={{ left: x, top: y, background: 'rgba(13,17,23,0.85)', border: `1px solid ${color}30`, backdropFilter: 'blur(16px)', boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${color}15` }}
  >
    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
    <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
    <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</span>
    {!reducedMotion && (
      <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
        animate={{ boxShadow: [`0 0 0px ${color}00`, `0 0 20px ${color}22`, `0 0 0px ${color}00`] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: delay + 1 }} />
    )}
  </motion.div>
);

const HeroSection: React.FC<HeroSectionProps> = ({ onEnterDemo, onSeeHowItWorks, reducedMotion, onNavigateDashboard }) => {
  const { isAuthenticated, setAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [cinematicLogin, setCinematicLogin] = useState(false);
  const [cinematicStep, setCinematicStep] = useState(0);
  const [typedUser, setTypedUser] = useState('');
  const [typedPass, setTypedPass] = useState('');
  const [googleConfigured, setGoogleConfigured] = useState(false);

  // Mouse-tracking for the glow orb
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const smoothX = useSpring(mouseX, { stiffness: 40, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 40, damping: 20 });
  const orbX = useTransform(smoothX, [0, 1], ['-30%', '130%']);
  const orbY = useTransform(smoothY, [0, 1], ['-30%', '130%']);

  useEffect(() => {
    fetch(`${BASE_URL}/auth/google/status`).then(r => r.json()).then(d => setGoogleConfigured(d.configured)).catch(() => {});
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const handler = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [reducedMotion, mouseX, mouseY]);

  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/google`);
      const data = await res.json();
      if (data.authUrl) window.location.href = data.authUrl;
    } catch {}
  };

  const runCinematicLogin = useCallback(() => {
    if (isLoading || cinematicLogin) return;
    if (isAuthenticated) { setIsLoading(true); setTimeout(() => { setIsLoading(false); onNavigateDashboard?.(); }, 400); return; }
    const U = 'demo', P = 'velocity2026';
    setCinematicLogin(true); setCinematicStep(0); setTypedUser(''); setTypedPass('');
    setTimeout(() => { setCinematicStep(1); }, 300);
    setTimeout(() => {
      let i = 0;
      const tU = setInterval(() => { i++; setTypedUser(U.slice(0, i)); if (i >= U.length) { clearInterval(tU); setCinematicStep(2); setTimeout(() => { let j = 0; const tP = setInterval(() => { j++; setTypedPass(P.slice(0, j)); if (j >= P.length) { clearInterval(tP); setCinematicStep(3); setTimeout(async () => { try { const r = await loginWithCredentials(U, P); setApiToken(r.token); setAuth(r.token, r.userId, r.mode as 'demo'|'guest'); setCinematicStep(4); setTimeout(() => { setCinematicLogin(false); setIsLoading(true); setTimeout(() => { setIsLoading(false); onNavigateDashboard?.(); }, 300); }, 600); } catch { setCinematicLogin(false); onEnterDemo(); } }, 500); } }, 18); }, 250); } }, 18);
    }, 600);
  }, [isLoading, cinematicLogin, isAuthenticated, onNavigateDashboard, setAuth, onEnterDemo]);

  const e = [0.16, 1, 0.3, 1] as [number,number,number,number];

  return (
    <section id="hero" className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: '100svh', background: '#080b10' }}>

      {/* ── Deep space gradient layers ─────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Base dark */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,197,94,0.12) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 85% 70%, rgba(56,189,248,0.06) 0%, transparent 60%)' }} />
        {/* Mouse-tracking glow orb */}
        {!reducedMotion && (
          <motion.div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ x: orbX, y: orbY, background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        )}
        {/* Grid overlay */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)' }} />
      </div>

      {/* Particle field */}
      <ParticleCanvas reducedMotion={reducedMotion} />

      {/* ── Floating metric cards ──────────────────────────────────────── */}
      <FloatingMetric label="Drift Score" value="−23%" sub="Overreporting detected" color="#ef4444" delay={1.4} x="2%" y="30%" reducedMotion={reducedMotion} />
      <FloatingMetric label="Velocity Vector" value="78%" sub="On vector · aligned" color="#22c55e" delay={1.6} x="1%" y="58%" reducedMotion={reducedMotion} />
      <FloatingMetric label="Physics Curve" value="RED" sub="Steepening — intervene" color="#f59e0b" delay={1.8} x="80%" y="28%" reducedMotion={reducedMotion} />
      <FloatingMetric label="Agent Actions" value="47" sub="Today · autonomous" color="#a78bfa" delay={2.0} x="78%" y="58%" reducedMotion={reducedMotion} />

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-24 pb-20 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 items-center">

        {/* Left: Hero copy */}
        <div className="flex flex-col gap-6">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: e }}>
            <span className="inline-flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.15em] px-4 py-2 rounded-full"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
              <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.2, 1], scale: [1, 0.8, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
              Google AI Hackathon 2026 · Behavioral Velocity Engine
            </span>
          </motion.div>

          {/* Giant headline */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: e }}>
            <h1 style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)', fontWeight: 800, lineHeight: 1.0, letterSpacing: '-0.04em', color: '#fff' }}>
              Speed is what<br />
              <span style={{ background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 30%, #38bdf8 65%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                you claim.
              </span>
              <br />
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>Velocity is</span>{' '}
              <span style={{ background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                the truth.
              </span>
            </h1>
          </motion.div>

          {/* Subtext */}
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.22, ease: e }}
            className="text-lg leading-relaxed max-w-xl" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>
            Most tools show you a number you typed in. Velocity infers your real trajectory from behavior —
            exposes the gap between what you claim and what the evidence shows — and treats urgency as a physical force.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.32, ease: e }}
            className="flex flex-wrap items-center gap-4">
            {/* Primary */}
            <motion.button onClick={runCinematicLogin} disabled={isLoading || cinematicLogin}
              whileHover={reducedMotion ? {} : { scale: 1.04, y: -2 }}
              whileTap={reducedMotion ? {} : { scale: 0.97 }}
              className="relative flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: '#000', boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 8px 32px rgba(34,197,94,0.35)', cursor: (isLoading || cinematicLogin) ? 'not-allowed' : 'pointer' }}>
              <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.28) 50%,transparent 65%)' }}
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.8 }} />
              {isLoading ? (
                <motion.span className="w-5 h-5 rounded-full border-2 border-black border-t-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
              ) : (
                <>
                  <Zap size={18} />
                  <span>Enter Demo Sandbox</span>
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>

            {/* Google Sign-In */}
            {googleConfigured && (
              <motion.button onClick={handleGoogleSignIn}
                whileHover={reducedMotion ? {} : { scale: 1.03, y: -1 }}
                whileTap={reducedMotion ? {} : { scale: 0.97 }}
                className="flex items-center gap-2.5 px-6 py-4 rounded-2xl text-base font-semibold"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', backdropFilter: 'blur(10px)' }}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </motion.button>
            )}
          </motion.div>

          {/* Trust badges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-wrap items-center gap-4">
            {['No account needed', 'Pre-loaded AI demo data', 'Google Cloud powered'].map((t, i) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right: Agent terminal */}
        <motion.div initial={{ opacity: 0, x: 32, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: e }}>
          <AgentTerminal reducedMotion={reducedMotion} />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.button onClick={onSeeHowItWorks}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[11px] font-mono z-10"
        style={{ color: 'rgba(255,255,255,0.3)' }}
        animate={reducedMotion ? {} : { y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        <span>Scroll to explore</span>
        <ChevronDown size={14} />
      </motion.button>

      {/* ── Cinematic login overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {cinematicLogin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}>
            <motion.div initial={{ scale: 0.88, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.05 }}
              className="w-full max-w-sm mx-4 rounded-3xl overflow-hidden"
              style={{ background: 'rgba(10,14,20,0.98)', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 0 60px rgba(34,197,94,0.15), 0 40px 80px rgba(0,0,0,0.8)' }}>
              <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #22c55e 30%, #38bdf8 70%, transparent)' }} />
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1"><Zap size={13} className="text-green-400" /><span className="text-xs font-mono font-bold text-green-400">Auto-Login · Demo Mode</span></div>
                <p className="text-[10px] font-mono text-white/30">Injecting credentials...</p>
              </div>
              <div className="px-6 pb-6 space-y-3">
                {[{ label: 'Username', val: typedUser, step: 1 }, { label: 'Password', val: '•'.repeat(typedPass.length), step: 2 }].map(({ label, val, step }) => (
                  <div key={label}>
                    <div className="text-[10px] font-mono uppercase tracking-wider mb-1 text-white/30">{label}</div>
                    <div className="px-3 py-2 rounded-xl font-mono text-sm text-white/90"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${cinematicStep >= step ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)'}` }}>
                      {val}
                      {cinematicStep === step && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="inline-block w-0.5 h-3.5 bg-green-400 ml-0.5 align-text-bottom" />}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  {cinematicStep < 4
                    ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                    : <CheckCircle2 size={13} className="text-green-400" />}
                  <span className="text-[11px] font-mono text-white/40">
                    {cinematicStep <= 1 && 'Entering credentials...'}{cinematicStep === 2 && 'Entering password...'}{cinematicStep === 3 && 'Authenticating...'}{cinematicStep === 4 && <span className="text-green-400">✓ Authenticated — loading dashboard</span>}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default HeroSection;
