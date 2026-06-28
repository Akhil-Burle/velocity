/**
 * LandingPage.tsx — BEAST MODE
 * Full cinematic landing with:
 *   - Particle-field hero with mouse-tracking glow
 *   - Live agent terminal showing real capabilities
 *   - Floating metric cards with glows
 *   - 3D tilt feature cards
 *   - Animated deadline physics showcase
 *   - Full Google tech credibility section
 *   - Screaming final CTA
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../AuthContext';
import { loginWithCredentials, setApiToken } from '../../api';
import { useReducedMotion } from './hooks/useReducedMotion';
import LandingNav from './LandingNav';
import HeroSection from './sections/HeroSection';
import {
  Zap, Brain, ShieldAlert, Calendar, GitFork, MessageSquare,
  ArrowRight, RefreshCw, Target, Mic, Camera, Trophy, Activity,
  BarChart2, Sparkles, Clock, Volume2, ExternalLink, Bot,
  ChevronRight, TrendingDown, CheckCircle2
} from 'lucide-react';

// ─── Shared scroll-reveal hook ────────────────────────────────────────────────
function useReveal(threshold = 0.18) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: threshold });
  return { ref, inView };
}

const EASE: [number,number,number,number] = [0.16, 1, 0.3, 1];

// ─── Section wrapper with reveal ──────────────────────────────────────────────
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }> = ({ children, delay = 0, className, style }) => {
  const { ref, inView } = useReveal();
  return (
    <motion.div ref={ref as React.RefObject<HTMLDivElement>}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className} style={style}>
      {children}
    </motion.div>
  );
};

// ─── 3D tilt card ─────────────────────────────────────────────────────────────
const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  reducedMotion: boolean;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}> = ({ children, className, style, reducedMotion, onMouseEnter, onMouseLeave }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rotX = ((e.clientY - cy) / rect.height) * -8;
    const rotY = ((e.clientX - cx) / rect.width) * 8;
    card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
  };
  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    onMouseLeave?.(e);
  };
  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseEnter?.(e);
  };
  return (
    <div ref={cardRef} onMouseMove={handleMove} onMouseLeave={handleLeave} onMouseEnter={handleEnter}
      className={className}
      style={{ transition: 'transform 0.15s ease', willChange: 'transform', ...style }}>
      {children}
    </div>
  );
};

// ─── Deadline Physics live demo ────────────────────────────────────────────────
function buildCurve(daysLeft: number, reqRate: number, pts = 14) {
  if (daysLeft <= 0) return Array.from({ length: pts }, (_, i) => ({ x: i / (pts - 1), y: 1 }));
  const res = [];
  for (let i = 0; i < pts; i++) {
    const t = (i / (pts - 1)) * daysLeft;
    const rem = Math.max(daysLeft - t, 0.01);
    const work = Math.max(100 - reqRate * t, 5);
    res.push({ x: i / (pts - 1), y: work / rem });
  }
  const maxY = Math.max(...res.map(p => p.y), 0.01);
  return res.map(p => ({ x: p.x, y: p.y / maxY }));
}
function curvePath(pts: {x:number;y:number}[], w: number, h: number) {
  const mapped = pts.map(p => ({ x: p.x * w, y: h - p.y * h }));
  return mapped.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = mapped[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${d} C${cx} ${prev.y.toFixed(1)},${cx} ${p.y.toFixed(1)},${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
}

const LivePhysicsCurve: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const { ref, inView } = useReveal(0.4);
  const [phase, setPhase] = useState(0);
  const W = 300, H = 100;
  const phases = [
    { days: 14, rate: 4, color: '#22c55e', label: '14 days remaining', status: 'Gradual', sub: '4%/day needed' },
    { days: 4, rate: 14, color: '#f59e0b', label: '4 days remaining', status: 'Accelerating', sub: '14%/day needed' },
    { days: 0.5, rate: 80, color: '#ef4444', label: '12 hours remaining', status: 'Steepening ↑', sub: 'Physically critical' },
  ];

  useEffect(() => {
    if (!inView || reducedMotion) { if (reducedMotion) setPhase(2); return; }
    const t1 = setTimeout(() => setPhase(1), 1200);
    const t2 = setTimeout(() => setPhase(2), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [inView, reducedMotion]);

  const cfg = phases[phase];
  const curve = buildCurve(cfg.days, cfg.rate);
  const pathD = curvePath(curve, W, H);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${cfg.color}25`, backdropFilter: 'blur(20px)' }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div className="text-xs font-mono font-bold" style={{ color: cfg.color }}>Deadline Physics</div>
          <div className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{cfg.label}</div>
        </div>
        <motion.div key={phase}
          initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="px-3 py-1 rounded-full text-[10px] font-mono font-bold"
          style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
          {cfg.status}
        </motion.div>
      </div>
      <div className="px-5 py-4">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
          <motion.path key={phase} d={pathD} fill="none" stroke={cfg.color} strokeWidth={2.5}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.9, ease: EASE }}
            style={{ filter: phase === 2 ? `drop-shadow(0 0 6px ${cfg.color})` : undefined }} />
          {curve.length > 0 && (
            <motion.circle cx={W - 2} cy={H - curve[curve.length - 1].y * H} r={phase === 2 ? 5 : 3.5} fill={cfg.color}
              animate={phase >= 1 ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
              transition={{ duration: 0.8, repeat: Infinity }} />
          )}
          <text x={4} y={H - 6} fontSize="9" fill="rgba(255,255,255,0.25)" fontFamily="JetBrains Mono, monospace">now</text>
          <text x={W - 40} y={H - 6} fontSize="9" fill={cfg.color} fontFamily="JetBrains Mono, monospace" opacity={0.8}>deadline</text>
        </svg>
        <div className="mt-2 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Required pace: <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.sub}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Drift Score divergence demo ──────────────────────────────────────────────
const DriftDemo: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const { ref, inView } = useReveal(0.4);
  const [claimed, setClaimed] = useState(50);
  const [real, setReal] = useState(50);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) { setClaimed(72); setReal(39); return; }
    const steps = [[55,48],[60,45],[65,42],[70,40],[72,39]];
    const timers = steps.map(([c, r], i) =>
      setTimeout(() => { setClaimed(c); setReal(r); }, 300 + i * 250)
    );
    return () => timers.forEach(clearTimeout);
  }, [inView, reducedMotion]);

  const gap = claimed - real;

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="rounded-2xl p-5"
      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(239,68,68,0.2)', backdropFilter: 'blur(20px)' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono font-bold text-white/80">Behavioral Drift Score</span>
        <motion.span key={gap} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}
          className="text-[10px] font-mono px-2.5 py-1 rounded-full font-bold"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
          −{gap}% drift
        </motion.span>
      </div>
      <div className="space-y-3">
        {[{ label: 'Self-reported', val: claimed, color: '#38bdf8' }, { label: 'Behavioral estimate', val: real, color: '#22c55e' }].map(({ label, val, color }) => (
          <div key={label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
              <motion.span className="text-sm font-bold font-mono" style={{ color }} animate={{ opacity: 1 }}>{val}%</motion.span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
                animate={{ width: `${val}%` }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: EASE }} />
            </div>
          </div>
        ))}
      </div>
      {gap > 8 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-4 pt-3 flex items-start gap-2 text-[10px] font-mono"
          style={{ borderTop: '1px solid rgba(239,68,68,0.12)', color: 'rgba(255,255,255,0.45)' }}>
          <TrendingDown size={11} className="text-red-400 mt-0.5 shrink-0" />
          {gap}% overreporting detected. Forecast adjusted. Trust Decay applied to progress bar.
        </motion.div>
      )}
    </div>
  );
};

// ─── Feature card data ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Brain, color: '#4285f4', label: 'Brain Dump', desc: 'Paste your entire mental backlog — Gemini extracts deadlines, estimates, and urgency scores in seconds.' },
  { icon: Activity, color: '#22c55e', label: 'Behavioral Velocity', desc: 'Infers real trajectory from subtask patterns, check-in language, and behavioral signals. Not your self-report.' },
  { icon: ShieldAlert, color: '#ef4444', label: 'Panic Mode', desc: 'One click: rescue checklist + boilerplate code + real GitHub repo created autonomously in under 10 seconds.' },
  { icon: GitFork, color: '#f59e0b', label: 'The Ultimatum', desc: 'When two deadlines genuinely conflict, forces a conscious choice. The loser is logged — never silently dropped.' },
  { icon: Calendar, color: '#34a853', label: 'Command Day', desc: 'Energy-aware day planning built around real Google Calendar events. Rebalance with one click.' },
  { icon: MessageSquare, color: '#a78bfa', label: 'Negotiate', desc: 'AI drafts a professional extension request tailored to the task, recipient, and real context.' },
  { icon: Bot, color: '#38bdf8', label: 'Agent Activity Log', desc: 'Every autonomous action logged with full chain detail. Expand any entry to see the full reasoning.' },
  { icon: Brain, color: '#ec4899', label: 'Adaptive Memory', desc: 'Cancel an action 3 times → the agent writes a policy and stops proposing it. Learns from your behavior.' },
  { icon: Camera, color: '#fb923c', label: 'Chaos Scanner', desc: 'Drop a whiteboard photo. Gemini Vision extracts structured tasks with deadlines — from real images.' },
  { icon: Target, color: '#06b6d4', label: 'Velocity DNA', desc: 'Radar chart of your productivity fingerprint. Deep work, consistency, urgency response, recovery.' },
  { icon: Trophy, color: '#fbbf24', label: 'Velocity Credits', desc: 'Gamified progress tracking with levels, achievements, and anonymized cohort leaderboard.' },
  { icon: Mic, color: '#4ade80', label: 'Voice Loop', desc: 'Web Speech API in → Cloud TTS out. Speak a command, hear the response. Complete voice loop on OmniBar.' },
];

const GOOGLE_TECHS = [
  { color: '#4285f4', name: 'Vertex AI · Gemini 2.0 Flash', badge: 'AI Core', what: 'Every AI decision: Brain Dump, Panic Mode, Negotiate, Ultimatum, OmniBar, Day Rebalance. Routes through Vertex AI.', url: 'https://cloud.google.com/vertex-ai' },
  { color: '#4285f4', name: 'Gemini Vision (multimodal)', badge: 'AI Vision', what: 'Chaos Scanner: drop any whiteboard photo, Gemini Vision extracts structured tasks with deadlines.', url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/overview' },
  { color: '#34a853', name: 'Google Calendar API', badge: 'Workspace', what: 'Reads real events from your Google account. Command Day and Rebalance schedule around actual meetings.', url: 'https://developers.google.com/calendar' },
  { color: '#fbbc04', name: 'Google Sign-In (OAuth 2.0)', badge: 'Identity', what: 'Real OAuth 2.0 consent flow. Signs in, creates user, issues JWT, and unlocks Calendar access.', url: 'https://developers.google.com/identity' },
  { color: '#ea4335', name: 'Cloud Text-to-Speech', badge: 'Voice Out', what: 'OmniBar voice responses via en-US-Journey-F WaveNet voice. Falls back to browser speechSynthesis.', url: 'https://cloud.google.com/text-to-speech' },
  { color: '#34a853', name: 'Web Speech API', badge: 'Voice In', what: 'Voice input in Brain Dump and OmniBar. Backed by Google\'s speech engine in Chrome. Full voice loop.', url: 'https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition' },
];

// ─── Section: Problem ──────────────────────────────────────────────────────────
const SectionDivider = () => (
  <div className="w-full max-w-5xl mx-auto px-5 sm:px-8">
    <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent)' }} />
  </div>
);

// ─── Main landing page ─────────────────────────────────────────────────────────
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    document.title = 'Velocity — The AI agent that tracks where you\'re actually headed';
    return () => { document.title = 'Velocity'; };
  }, []);

  const onEnterDemo = useCallback(async () => {
    try {
      const res = await loginWithCredentials('demo', 'velocity2026');
      setApiToken(res.token); setAuth(res.token, res.userId, res.mode); navigate('/dashboard');
    } catch {
      try { const { guestLogin } = await import('../../api'); const g = await guestLogin(); setApiToken(g.token); setAuth(g.token, g.userId, 'guest'); } catch {}
      navigate('/dashboard');
    }
  }, [navigate, setAuth]);

  const onSeeHowItWorks = useCallback(() => {
    document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="relative overflow-x-hidden" style={{ background: '#080b10', color: '#fff' }}>
      <LandingNav />

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <HeroSection onEnterDemo={onEnterDemo} onSeeHowItWorks={onSeeHowItWorks} reducedMotion={reducedMotion} onNavigateDashboard={() => navigate('/dashboard')} />

      {/* ── 2. PROBLEM ───────────────────────────────────────────────────── */}
      <section id="problem" className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4" style={{ color: '#ef4444' }}>The problem with every other tool</p>
            <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              A speedometer shows you how fast.<br />
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>It doesn't tell you if you're headed off a cliff.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { color: '#f59e0b', title: 'You set a reminder. You ignore it.', body: 'Passive alerts fire the same whether you\'re 10% done or 90% done. They carry zero behavioral information.' },
              { color: '#ef4444', title: 'Self-reports compound silently.', body: 'When you say "60% done" your number came from optimism, not evidence. The gap grows invisibly every day.' },
              { color: '#f97316', title: 'Conflicts get quietly dropped.', body: 'When two deadlines overlap, most tools auto-reschedule both and pretend the problem resolved itself.' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1}>
                <TiltCard reducedMotion={reducedMotion} className="h-full rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.color}20` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${p.color}15`, color: p.color }}>
                    <span className="text-lg font-bold">{i + 1}</span>
                  </div>
                  <h3 className="text-base font-bold mb-2" style={{ color: '#fff' }}>{p.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{p.body}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ── 3. BEHAVIORAL VELOCITY ───────────────────────────────────────── */}
      <section id="behavioral-velocity" className="py-24 sm:py-32 px-5 sm:px-8"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(34,197,94,0.04) 0%, transparent 70%)' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="mb-16 max-w-2xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4" style={{ color: '#22c55e' }}>The core differentiator</p>
            <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
              Behavioral Velocity System
            </h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Velocity doesn't trust what you say. It infers a separate behavioral trajectory from subtask completion rates,
              check-in language sentiment, Panic Mode usage, and OmniBar urgency signals.
              The gap between those two numbers is your <strong style={{ color: '#ef4444' }}>Drift Score</strong> — and it's what drives every intervention.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Watch the curve steepen as time runs out →</p>
              <LivePhysicsCurve reducedMotion={reducedMotion} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Claimed vs. behavioral reality →</p>
              <DriftDemo reducedMotion={reducedMotion} />
            </div>
          </div>

          {/* Trust Decay */}
          <Reveal>
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(251,188,4,0.15)' }}>
              <div className="flex items-start gap-6 flex-wrap">
                <div className="flex-1 min-w-48">
                  <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#fbbc04' }}>Trust Decay</div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Every day without a check-in, your reported progress loses credibility.
                    Velocity subtracts a staleness penalty — so "80% done" from 4 days ago shows as ~48%.
                  </p>
                </div>
                <div className="flex-1 min-w-48 space-y-2.5">
                  {[['Day 0 — checked in', 80, '#22c55e'], ['Day 2 — no update', 65, '#f59e0b'], ['Day 4 — stale', 48, '#ef4444']].map(([label, val, color]) => (
                    <div key={String(label)}>
                      <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <span>{label}</span><span style={{ color: color as string }}>{val}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <motion.div className="h-full rounded-full" style={{ background: color as string, width: `${val}%` }}
                          initial={{ width: 0 }} whileInView={{ width: `${val}%` }} viewport={{ once: true }}
                          transition={{ duration: reducedMotion ? 0 : 0.8, ease: EASE }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SectionDivider />

      {/* ── 4. FEATURES GRID ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>Everything that's built and wired</p>
            <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.03em' }}>
              The full arsenal
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <Reveal key={feat.label} delay={(i % 4) * 0.06}>
                  <TiltCard reducedMotion={reducedMotion} className="h-full rounded-2xl p-5 cursor-default"
                    style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${feat.color}18`, transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.15s ease' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.background = `${feat.color}08`; (e.currentTarget as HTMLDivElement).style.borderColor = `${feat.color}30`; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${feat.color}18`; }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: `${feat.color}15`, color: feat.color }}>
                      <Icon size={18} />
                    </div>
                    <div className="text-sm font-bold mb-1.5" style={{ color: '#fff' }}>{feat.label}</div>
                    <p className="text-[11px] leading-relaxed font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{feat.desc}</p>
                  </TiltCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ── 5. GOOGLE TECH ───────────────────────────────────────────────── */}
      <section id="google-tech" className="py-24 sm:py-32 px-5 sm:px-8"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(66,133,244,0.04) 0%, transparent 70%)' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              {['#4285f4','#ea4335','#fbbc04','#34a853'].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              <span className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.35)' }}>Built natively on Google Cloud</span>
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
              Every API is live and wired in
            </h2>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 560 }}>
              Not logos on a slide. Each technology listed here is confirmed real — each description names the exact feature it powers.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GOOGLE_TECHS.map((tech, i) => (
              <Reveal key={tech.name} delay={i * 0.07}>
                <TiltCard reducedMotion={reducedMotion} className="h-full rounded-2xl p-5"
                  style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${tech.color}20` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${tech.color}15` }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: tech.color }} />
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                      style={{ background: `${tech.color}12`, color: tech.color, border: `1px solid ${tech.color}25` }}>
                      {tech.badge}
                    </span>
                  </div>
                  <div className="text-xs font-bold mb-1.5" style={{ color: '#fff' }}>{tech.name}</div>
                  <p className="text-[10px] font-mono leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{tech.what}</p>
                  <a href={tech.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono"
                    style={{ color: `${tech.color}88` }}>
                    <ExternalLink size={9} /> docs
                  </a>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ── 6. FINAL CTA ─────────────────────────────────────────────────── */}
      <section id="cta" className="py-28 sm:py-40 px-5 sm:px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,197,94,0.08) 0%, transparent 70%)' }} />
        <Reveal className="max-w-3xl mx-auto relative z-10">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] mb-6" style={{ color: '#22c55e' }}>Try it now — no setup required</p>
          <h2 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, marginBottom: 24 }}>
            Stop measuring speed.<br />
            <span style={{ background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 40%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Start tracking direction.
            </span>
          </h2>
          <p className="text-xl mb-12" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 520, margin: '0 auto 48px' }}>
            Enter the sandbox. In under 30 seconds, see the Velocity Vector, the Drift Score diverging, and the Deadline Physics curve steepening — live.
          </p>

          <CTAButtons onEnterDemo={onEnterDemo} reducedMotion={reducedMotion} />

          <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
            {['No account needed', 'Real AI data pre-loaded', 'Google Cloud powered'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <CheckCircle2 size={11} className="text-green-400" />{t}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <div className="text-center py-8 px-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Velocity · Built for Google AI Hackathon 2026 · All Google API calls are live in the demo
        </p>
      </div>
    </div>
  );
};

// ─── CTA Buttons (extracted to avoid re-render) ───────────────────────────────
const CTAButtons: React.FC<{ onEnterDemo: () => void | Promise<void>; reducedMotion: boolean }> = ({ onEnterDemo, reducedMotion }) => {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try { await onEnterDemo(); } finally { setLoading(false); }
  };
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <motion.button onClick={handleClick} disabled={loading}
        whileHover={reducedMotion ? {} : { scale: 1.05, y: -3, boxShadow: '0 16px 48px rgba(34,197,94,0.5)' }}
        whileTap={reducedMotion ? {} : { scale: 0.97 }}
        className="relative flex items-center gap-3 px-10 py-5 rounded-2xl text-lg font-bold overflow-hidden"
        style={{ background: loading ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: '#000', boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 8px 40px rgba(34,197,94,0.4)', transition: 'transform 0.18s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s cubic-bezier(0.16,1,0.3,1)' }}>
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.3) 50%,transparent 65%)' }}
          animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }} />
        {loading
          ? <motion.span className="w-5 h-5 rounded-full border-2 border-black border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
          : <><Zap size={20} /><span>Enter Demo Sandbox</span><ArrowRight size={18} /></>
        }
      </motion.button>
    </div>
  );
};

export default LandingPage;
