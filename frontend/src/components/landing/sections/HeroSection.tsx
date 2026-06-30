/**
 * HeroSection.tsx
 * Full-screen cinematic hero: particle field, mouse-tracking glow orb, massive
 * gradient headline, a capability rail, a live agent terminal, and floating
 * metric cards. Theme-aware (light + dark). The primary CTA + nav both fire the
 * shared cinematic login (passed in via onEnterDemo).
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Zap, CheckCircle2, ChevronDown, Activity, Gauge, Bot, ShieldAlert, Brain, Sparkles } from 'lucide-react';
import { useIsDark, pal } from './_landingShared';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001/api';

export interface HeroSectionProps {
  onEnterDemo: () => void;
  onSeeHowItWorks: () => void;
  reducedMotion: boolean;
}

// ── Particle field canvas ──────────────────────────────────────────────────────
const ParticleCanvas: React.FC<{ reducedMotion: boolean; isDark: boolean }> = ({ reducedMotion, isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rgb = isDark ? '34,197,94' : '22,163,74';

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
    let cssW = window.innerWidth, cssH = window.innerHeight;

    const setSize = () => {
      cssW = window.innerWidth; cssH = window.innerHeight;
      canvas.width = Math.floor(cssW * DPR);
      canvas.height = Math.floor(cssH * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    setSize();

    const area = cssW * cssH;
    const N = Math.max(26, Math.min(70, Math.round(area / 26000)));
    const LINK = cssW < 720 ? 88 : 116;

    const onResize = () => setSize();
    window.addEventListener('resize', onResize);
    const onMouse = (ev: MouseEvent) => { mouseRef.current = { x: ev.clientX, y: ev.clientY }; };
    if (!isTouch) window.addEventListener('mousemove', onMouse, { passive: true });

    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * cssW, y: Math.random() * cssH,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.4 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    let running = true;
    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      for (const p of pts) {
        if (!isTouch) {
          const dx = p.x - mx, dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0.01) { p.vx += (dx / dist) * 0.04; p.vy += (dy / dist) * 0.04; }
        }
        p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = cssW; if (p.x > cssW) p.x = 0;
        if (p.y < 0) p.y = cssH; if (p.y > cssH) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${p.opacity})`;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const d = Math.sqrt(d2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${rgb},${0.12 * (1 - d / LINK)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && document.visibilityState === 'visible') {
        if (!running) { running = true; draw(); }
      } else { running = false; cancelAnimationFrame(animRef.current); }
    }, { threshold: 0 });
    io.observe(canvas);

    const onVis = () => {
      if (document.visibilityState === 'hidden') { running = false; cancelAnimationFrame(animRef.current); }
      else if (!running) { running = true; draw(); }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      if (!isTouch) window.removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reducedMotion, rgb]);

  return (
    <canvas ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: isDark ? 0.55 : 0.45 }}
      aria-hidden="true"
    />
  );
};

// ── Live agent terminal ticker (stays dark in both themes — it's a console) ─────
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
    if (reducedMotion) { setVisibleLines(AGENT_LINES.map((_, i) => i).slice(0, 5)); return; }
    const line = AGENT_LINES[currentLine % AGENT_LINES.length];
    if (charCount < line.text.length) {
      const t = setTimeout(() => setCharCount(c => c + 1), 28);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setVisibleLines(prev => [...prev, currentLine % AGENT_LINES.length].slice(-5));
        setCharCount(0);
        setCurrentLine(l => l + 1);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [charCount, currentLine, reducedMotion]);

  const typingLine = AGENT_LINES[currentLine % AGENT_LINES.length];

  return (
    <div className="rounded-2xl overflow-hidden font-mono text-xs"
      style={{ background: 'rgba(6,9,13,0.82)', border: '1px solid rgba(34,197,94,0.25)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px -30px rgba(0,0,0,0.8)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="ml-2 text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>velocity agent · live</span>
        <motion.div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400"
          animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      </div>
      <div className="px-4 py-3 space-y-1.5" style={{ minHeight: 180 }}>
        {visibleLines.map((lineIdx, i) => {
          const l = AGENT_LINES[lineIdx];
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2" style={{ opacity: 0.55 + i * 0.1 }}>
              <span style={{ color: l.color }}>{l.prefix}</span>
              <span style={{ color: 'rgba(255,255,255,0.72)' }}>{l.text}</span>
            </motion.div>
          );
        })}
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

// ── Floating metric cards ───────────────────────────────────────────────────────
const FloatingMetric: React.FC<{
  label: string; value: string; sub: string; color: string;
  delay: number; x: string; y: string; reducedMotion: boolean; isDark: boolean;
}> = ({ label, value, sub, color, delay, x, y, reducedMotion, isDark }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.82, y: 18 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    className="absolute hidden lg:flex flex-col gap-0.5 rounded-xl px-3 py-2.5"
    style={{ left: x, top: y, transform: 'translateY(-50%)', zIndex: 20, background: isDark ? 'rgba(13,17,23,0.85)' : 'rgba(255,255,255,0.92)', border: `1px solid ${color}30`, backdropFilter: 'blur(16px)', boxShadow: isDark ? `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${color}15` : `0 8px 28px -12px rgba(15,23,42,0.25), 0 0 0 1px ${color}15` }}
  >
    {!reducedMotion && (
      <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
        animate={{ boxShadow: [`0 0 0px ${color}00`, `0 0 16px ${color}1a`, `0 0 0px ${color}00`] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.8 }} />
    )}
    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)' }}>{label}</span>
    <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
    <span className="text-[9px] font-mono" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.5)' }}>{sub}</span>
  </motion.div>
);

// ── Capability rail (replaces the old task bar; fills the space, calm + premium) ─
const CAPS = [
  { icon: Activity,    color: '#22c55e', label: 'Behavioral Velocity' },
  { icon: Gauge,       color: '#f59e0b', label: 'Deadline Physics' },
  { icon: Brain,       color: '#a78bfa', label: 'Brain Dump Engine' },
  { icon: Bot,         color: '#38bdf8', label: 'Autonomous Agent' },
  { icon: ShieldAlert, color: '#ef4444', label: 'Panic Rescue' },
  { icon: Sparkles,    color: '#f59e0b', label: 'Adaptive Learning' },
];

const CapabilityRail: React.FC<{ reducedMotion: boolean; isDark: boolean }> = ({ reducedMotion, isDark }) => {
  const p = pal(isDark);
  return (
    <div className="flex flex-col gap-3 max-w-xl">
      <p className="text-sm leading-relaxed" style={{ color: p.textMute }}>
        Velocity reads your real trajectory from behavior — and intervenes before you fall behind.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {CAPS.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.09, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2 pl-2 pr-3.5 py-2 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', border: `1px solid ${c.color}28`, backdropFilter: 'blur(8px)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${c.color}1f`, color: c.color }}>
                <Icon size={13} />
              </span>
              <span className="text-xs font-semibold" style={{ color: p.textSoft }}>{c.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const HeroSection: React.FC<HeroSectionProps> = ({ onEnterDemo, onSeeHowItWorks, reducedMotion }) => {
  const isDark = useIsDark();
  const p = pal(isDark);
  const [googleConfigured, setGoogleConfigured] = useState(false);

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
    } catch { /* ignore */ }
  };

  const e = [0.16, 1, 0.3, 1] as [number, number, number, number];

  return (
    <section id="hero" className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: '100svh', background: p.bg }}>

      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Top green glow */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,197,94,${isDark ? 0.3 : 0.1}) 0%, transparent 70%)` }} />
        {/* Bottom-right blue glow */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 40% at 85% 70%, rgba(56,189,248,${isDark ? 0.12 : 0.07}) 0%, transparent 60%)` }} />

        {/* Mouse-tracking orb */}
        {!reducedMotion && (
          <motion.div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ x: orbX, y: orbY, background: `radial-gradient(circle, rgba(34,197,94,${isDark ? 0.2 : 0.1}) 0%, transparent 70%)`, filter: 'blur(40px)' }} />
        )}

        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(${isDark ? 'rgba(34,197,94,0.07)' : 'rgba(15,23,42,0.04)'} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? 'rgba(34,197,94,0.07)' : 'rgba(15,23,42,0.04)'} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)',
        }} />

        {/* Bottom warm glow accent — both modes */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(34,197,94,0.05) 0%, transparent 70%)' }} />
      </div>

      <ParticleCanvas reducedMotion={reducedMotion} isDark={isDark} />

      {/* All four floating metric cards — absolute, anchored near section center */}
      <FloatingMetric label="Drift Score"     value="−23%" sub="Overreporting detected"  color="#ef4444" delay={1.15} x="2%"  y="42%" reducedMotion={reducedMotion} isDark={isDark} />
      <FloatingMetric label="Velocity Vector" value="78%"  sub="On vector · aligned"      color="#22c55e" delay={1.35} x="2%"  y="60%" reducedMotion={reducedMotion} isDark={isDark} />
      <FloatingMetric label="Physics Curve"   value="RED"  sub="Steepening — intervene"   color="#f59e0b" delay={1.55} x="75%" y="30%" reducedMotion={reducedMotion} isDark={isDark} />
      <FloatingMetric label="Agent Actions"   value="47"   sub="Today · autonomous"       color="#a78bfa" delay={1.75} x="75%" y="65%" reducedMotion={reducedMotion} isDark={isDark} />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-24 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-center">
        <div className="flex flex-col gap-5">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: e }}>
            <span className="inline-flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.15em] px-4 py-2 rounded-full"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: isDark ? '#4ade80' : '#15803d' }}>
              <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.2, 1], scale: [1, 0.8, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
              AI-Powered Productivity · Beat Every Deadline
            </span>
          </motion.div>

          {/* Giant headline */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: e }}>
            <h1 style={{ fontSize: 'clamp(2.4rem, 5.4vw, 4.6rem)', fontWeight: 800, lineHeight: 1.03, letterSpacing: '-0.04em', color: p.text }}>
              <span style={{ whiteSpace: 'nowrap' }}>Your AI agent for</span><br />
              <span style={{ background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 30%, #38bdf8 65%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', whiteSpace: 'nowrap' }}>
                deadline survival
              </span>
            </h1>
          </motion.div>

          {/* Secondary brand-thesis line */}
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: e }}
            style={{ fontSize: 'clamp(1.05rem, 2.2vw, 1.55rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: p.textSoft }}>
            Speed is what you claim.{' '}
            <span style={{ background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 45%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Velocity is the truth.
            </span>
          </motion.p>

          {/* Capability rail */}
          <CapabilityRail reducedMotion={reducedMotion} isDark={isDark} />

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.32, ease: e }}
            className="flex flex-wrap items-center gap-4">
            <motion.button onClick={onEnterDemo}
              whileHover={reducedMotion ? {} : { scale: 1.04, y: -2 }}
              whileTap={reducedMotion ? {} : { scale: 0.97 }}
              className="relative flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: '#000', boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 8px 32px rgba(34,197,94,0.35)' }}>
              <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.28) 50%,transparent 65%)' }}
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.8 }} />
              <Zap size={18} />
              <span>Enter Demo Sandbox</span>
              <ArrowRight size={16} />
            </motion.button>

            {googleConfigured && (
              <motion.button onClick={handleGoogleSignIn}
                whileHover={reducedMotion ? {} : { scale: 1.03, y: -1 }}
                whileTap={reducedMotion ? {} : { scale: 0.97 }}
                className="flex items-center gap-2.5 px-6 py-4 rounded-2xl text-base font-semibold"
                style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.9)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)'}`, color: p.text, backdropFilter: 'blur(10px)' }}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </motion.button>
            )}
          </motion.div>

          {/* Trust badges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-wrap items-center gap-4">
            {['No account needed', 'Pre-loaded AI demo data', 'Google Cloud powered'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-mono" style={{ color: p.textFaint }}>
                <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right: Agent terminal — centered in its column */}
        <motion.div
          initial={{ opacity: 0, x: 32, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: e }}>
          <AgentTerminal reducedMotion={reducedMotion} />
        </motion.div>
      </div>

      {/* Scroll indicator — centered via flex */}
      <div className="absolute bottom-7 inset-x-0 flex justify-center z-20 pointer-events-none">
        <motion.button onClick={onSeeHowItWorks}
          className="flex flex-col items-center gap-2 text-[11px] font-mono pointer-events-auto"
          style={{ color: p.textDim }}
          animate={reducedMotion ? {} : { y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <span>Scroll to explore</span>
          <ChevronDown size={14} />
        </motion.button>
      </div>
    </section>
  );
};

export default HeroSection;
