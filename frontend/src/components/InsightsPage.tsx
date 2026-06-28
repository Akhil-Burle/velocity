/**
 * InsightsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The intelligence command center. Combines:
 *   • Velocity DNA — a radar fingerprint of your work profile + archetype
 *   • Gamification — level progress, Velocity Credits, streak, achievements
 *   • Leaderboard — anonymized global percentile
 *   • Tomorrow Pre-Brief — the nightly planning ritual
 *   • AI Summary, stat cards, velocity trend, and estimation calibration
 *
 * Built on the existing design system: surface cards, mono labels, status
 * palette, [0.16,1,0.3,1] easing, and Recharts.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp, Zap, BarChart2, Target, Clock, CheckCircle, AlertTriangle, RefreshCw, Cpu,
  Fingerprint, Trophy, Flame, Coins, Crown, Gem, Rocket, Swords, ShieldCheck, CalendarCheck,
  Sunrise, Lock, Medal, Sparkles, ChevronRight, Bot, Activity,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import Sparkline from './Sparkline';
import {
  generateInsights, generateBriefing, fetchVelocityDNA, fetchLeaderboard, fetchPrebrief, fetchResults,
} from '../api';
import type { InsightsReport, VelocityDNA, LeaderboardResult, PrebriefReport, Achievement } from '../types';
import type { ResultsData } from '../api';

// Map backend achievement icon names → lucide components
const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Swords, Rocket, ShieldCheck, Flame, CalendarCheck, Trophy, Coins, Gem, Crown, Target, Medal,
} as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>;

// ── Calibration table row ─────────────────────────────────────────────────────
const CalibRow: React.FC<{ row: InsightsReport['calibration'][0]; isDark: boolean; i: number }> = ({ row, isDark, i }) => {
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const accNum = parseFloat(row.accuracy);
  const accColor = accNum >= 80 ? '#22c55e' : accNum >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
      style={{ borderBottom: `1px solid ${divider}` }}>
      <td className="py-2.5 pr-3"><span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>{row.taskType}</span></td>
      <td className="py-2.5 pr-3 text-right"><span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.estimated}h</span></td>
      <td className="py-2.5 pr-3 text-right"><span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.actual}h</span></td>
      <td className="py-2.5 pr-3 text-right">
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accColor}14`, color: accColor, border: `1px solid ${accColor}28` }}>{row.accuracy}</span>
      </td>
      <td className="py-2.5"><span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{row.recommendation}</span></td>
    </motion.tr>
  );
};

// ── Section card shell ────────────────────────────────────────────────────────
const Section: React.FC<{
  icon: React.ReactNode; label: string; accent?: string; right?: React.ReactNode;
  surfaceBg: string; surfaceBorder: string; divider: string; delay?: number; children: React.ReactNode;
}> = ({ icon, label, accent, right, surfaceBg, surfaceBorder, divider, delay = 0, children }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-xl overflow-hidden" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${divider}` }}>
      <div className="flex items-center gap-2">
        <span style={{ color: accent || 'var(--text-faint)' }}>{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accent || 'var(--text-faint)' }}>{label}</span>
      </div>
      {right}
    </div>
    {children}
  </motion.div>
);

const InsightsPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { profile } = useCredits();

  const [report, setReport] = useState<InsightsReport | null>(null);
  const [dna, setDna] = useState<VelocityDNA | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [prebrief, setPrebrief] = useState<PrebriefReport | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [prebriefLoading, setPrebriefLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const load = async () => {
    setLoading(true);
    setError(null);
    // Fetch all intelligence sources in parallel; the report is the gate.
    const [r, d, lb, pb, res] = await Promise.allSettled([
      generateInsights(), fetchVelocityDNA(), fetchLeaderboard(), fetchPrebrief(), fetchResults(),
    ]);
    if (r.status === 'fulfilled') setReport(r.value); else setError('Could not generate insights — ensure backend is running');
    if (d.status === 'fulfilled') setDna(d.value);
    if (lb.status === 'fulfilled') setLeaderboard(lb.value);
    if (pb.status === 'fulfilled') setPrebrief(pb.value);
    if (res.status === 'fulfilled') setResults(res.value);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleBriefing = async () => {
    setBriefingLoading(true);
    try {
      const result = await generateBriefing();
      setBriefing(result.briefing);
    } catch { setBriefing('Good morning! Focus on your highest-priority tasks and maintain your daily habits.'); }
    finally { setBriefingLoading(false); }
  };

  const refreshPrebrief = async () => {
    setPrebriefLoading(true);
    try { setPrebrief(await fetchPrebrief()); } catch { /* keep prior */ }
    finally { setPrebriefLoading(false); }
  };

  // Velocity trend points — derived from the real credit ledger when available.
  const trendPoints = (() => {
    if (profile && profile.ledger && profile.ledger.length >= 2) {
      const chrono = [...profile.ledger].reverse();
      let cum = Math.max(0, (profile.lifetimeCredits || 0) - chrono.reduce((s, e) => s + e.amount, 0));
      return chrono.map(e => { cum += e.amount; return { value: cum }; });
    }
    return [
      { value: 55 }, { value: 62 }, { value: 58 }, { value: 71 }, { value: 67 }, { value: 75 }, { value: 72 },
      { value: 80 }, { value: 77 }, { value: 83 }, { value: 79 }, { value: 88 }, { value: 85 }, { value: 91 },
    ];
  })();

  const STATS = report ? [
    { icon: CheckCircle, label: 'Tasks Completed', value: String(report.stats.tasksCompleted), color: '#22c55e' },
    { icon: TrendingUp,  label: 'Velocity Score',  value: String(report.stats.avgVelocityScore), color: report.stats.avgVelocityScore >= 70 ? '#22c55e' : report.stats.avgVelocityScore >= 50 ? '#f59e0b' : '#ef4444' },
    { icon: Target,      label: 'On-Time Rate',    value: report.stats.onTimeRate, color: '#38bdf8' },
    { icon: Clock,       label: 'Hours Logged',    value: `${report.stats.totalHoursLogged}h`, color: '#f59e0b' },
  ] : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <motion.div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'rgba(34,197,94,0.2)' }} />
          <motion.div className="absolute inset-0 rounded-full border-2 border-t-green-400 border-r-transparent border-b-transparent border-l-transparent"
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
          <div className="absolute inset-0 flex items-center justify-center"><Fingerprint size={20} style={{ color: '#22c55e' }} /></div>
        </motion.div>
        <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>Analyzing your Velocity DNA...</span>
      </div>
    );
  }

  if (!report && error) return (
    <div className="px-4 sm:px-6 py-8">
      <div className="flex flex-col items-center gap-3 py-12">
        <AlertTriangle size={28} style={{ color: '#ef4444', opacity: 0.5 }} />
        <span className="text-sm font-mono" style={{ color: 'var(--text-faint)' }}>{error}</span>
        <motion.button onClick={load} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          className="px-4 py-2 rounded-xl text-sm font-semibold mt-2"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000' }}>Retry</motion.button>
      </div>
    </div>
  );

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap size={11} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Velocity Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button onClick={handleBriefing} disabled={briefingLoading}
            whileHover={!briefingLoading ? { scale: 1.04 } : {}} whileTap={!briefingLoading ? { scale: 0.96 } : {}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={briefingLoading
              ? { background: surfaceBg, color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, opacity: 0.5 }
              : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
            {briefingLoading
              ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              : <Cpu size={12} />}
            Morning Briefing
          </motion.button>
          <motion.button onClick={load} whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.4 }}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
            <RefreshCw size={13} />
          </motion.button>
        </div>
      </div>

      {/* Morning briefing */}
      <AnimatePresence>
        {briefing && (
          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-6 px-5 py-4 rounded-xl overflow-hidden"
            style={{ background: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={11} style={{ color: '#22c55e' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#22c55e' }}>Daily Briefing</span>
            </div>
            <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--text-tertiary)' }}>{briefing}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO: Velocity DNA + Gamification ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {dna && <VelocityDNACard dna={dna} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} />}
        <GamificationCard isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}
          leaderboard={leaderboard} />
      </div>

      {/* ── Tomorrow Pre-Brief ────────────────────────────────────────────────── */}
      {prebrief && (
        <div className="mb-4">
          <PrebriefCard prebrief={prebrief} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}
            loading={prebriefLoading} onRefresh={refreshPrebrief} />
        </div>
      )}

      {/* ── Results / Impact view ─────────────────────────────────────────── */}
      {results && (
        <div className="mb-4">
          <ResultsCard
            results={results}
            isDark={isDark}
            surfaceBg={surfaceBg}
            surfaceBorder={surfaceBorder}
            divider={divider}
          />
        </div>
      )}

      {/* ── Achievements ──────────────────────────────────────────────────────── */}
      {profile && profile.achievements?.length > 0 && (
        <div className="mb-4">
          <AchievementsCard achievements={profile.achievements}
            unlocked={profile.achievementsUnlocked} total={profile.achievementsTotal}
            isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} />
        </div>
      )}

      {/* ── AI Summary ────────────────────────────────────────────────────────── */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="mb-4 px-5 py-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.75)', border: `1px solid ${divider}` }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={12} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>AI Summary</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{report.summary}</p>
          {report.recommendations.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {report.recommendations.map((rec, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: '#22c55e' }} />{rec}
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────────── */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {STATS.map(({ icon: Icon, label, value, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1)' }}
              className="rounded-xl p-4 cursor-default" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={11} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
              </div>
              <div className="font-bold font-mono text-2xl" style={{ color }}>{value}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Velocity trend ────────────────────────────────────────────────────── */}
      <Section icon={<TrendingUp size={12} />} label="Velocity Trend" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.2}
        right={<div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} /><span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Cumulative VC</span></div>}>
        <div className="px-5 py-6">
          <div className="h-24"><Sparkline data={trendPoints} color="#22c55e" height={96} /></div>
          <div className="flex justify-between mt-2">
            {['earlier', 'recent', 'now'].map(label => (
              <span key={label} className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{label}</span>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Calibration ───────────────────────────────────────────────────────── */}
      {report && report.calibration.length > 0 && (
        <div className="mt-4">
          <Section icon={<BarChart2 size={12} />} label="Estimation Calibration" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.3}>
            <div className="px-5 py-2 overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  {['Task Type', 'Estimated', 'Actual', 'Accuracy', 'Recommendation'].map(h => (
                    <th key={h} className="py-2 pr-3 text-left"><span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{h}</span></th>
                  ))}
                </tr></thead>
                <tbody>{report.calibration.map((row, i) => <CalibRow key={row.taskType} row={row} isDark={isDark} i={i} />)}</tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};

// ── Velocity DNA radar card ───────────────────────────────────────────────────
const VelocityDNACard: React.FC<{ dna: VelocityDNA; isDark: boolean; surfaceBg: string; surfaceBorder: string; divider: string }> =
({ dna, isDark, surfaceBg, surfaceBorder, divider }) => {
  const data = dna.axes.map(a => ({ subject: a.axis, value: a.value, fullMark: 100 }));
  return (
    <Section icon={<Fingerprint size={12} />} label="Velocity DNA" accent="#a855f7"
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.05}
      right={<span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>Overall {dna.overall}</span>}>
      <div className="px-3 pt-2 pb-4">
        <div style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#a855f7" strokeWidth={2} fill="#a855f7" fillOpacity={0.28} isAnimationActive animationDuration={900} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Archetype */}
        <div className="px-3 mt-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={12} style={{ color: '#c084fc' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{dna.archetype}</span>
          </div>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{dna.archetypeBlurb}</p>
          <div className="flex flex-wrap gap-2">
            <DnaPill icon={<Sunrise size={9} />} label="Peak" value={dna.peakHours} />
            <DnaPill icon={<Rocket size={9} />} label="Fastest" value={dna.strongestType} />
            <DnaPill icon={<Target size={9} />} label="Growth" value={dna.weakestType} />
          </div>
        </div>
      </div>
    </Section>
  );
};

const DnaPill: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg"
    style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)', color: 'var(--text-tertiary)' }}>
    <span style={{ color: '#c084fc' }}>{icon}</span>
    <span style={{ color: 'var(--text-faint)' }}>{label}</span>
    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{value}</span>
  </span>
);

// ── Gamification card (level + credits + streak + leaderboard) ─────────────────
const GamificationCard: React.FC<{
  isDark: boolean; surfaceBg: string; surfaceBorder: string; divider: string; leaderboard: LeaderboardResult | null;
}> = ({ isDark, surfaceBg, surfaceBorder, divider, leaderboard }) => {
  const { profile } = useCredits();
  if (!profile) {
    return (
      <Section icon={<Trophy size={12} />} label="Velocity Credits" accent="#22c55e"
        surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.1}>
        <div className="px-5 py-10 flex items-center justify-center">
          <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Credits unavailable — backend offline</span>
        </div>
      </Section>
    );
  }

  const R = 30, C = 2 * Math.PI * R;
  const dash = C * (profile.progressPercent / 100);

  return (
    <Section icon={<Trophy size={12} />} label="Velocity Credits" accent="#22c55e"
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.1}
      right={<span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}><Flame size={9} /> {profile.streak}-day streak</span>}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-5">
          {/* Level ring */}
          <div className="relative w-[76px] h-[76px] shrink-0">
            <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
              <circle cx="38" cy="38" r={R} fill="none" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} strokeWidth="5" />
              <motion.circle cx="38" cy="38" r={R} fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C - dash }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[8px] font-mono uppercase" style={{ color: 'var(--text-faint)' }}>LVL</span>
              <span className="text-xl font-bold font-mono leading-none" style={{ color: '#22c55e' }}>{profile.level}</span>
            </div>
          </div>
          {/* Stats */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{profile.title}</div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <Coins size={13} style={{ color: '#22c55e' }} />
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{profile.credits.toLocaleString()}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>VC</span>
            </div>
            <div className="rounded-full h-1.5 overflow-hidden mb-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${profile.progressPercent}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ background: 'linear-gradient(90deg,#22c55e,#4ade80)' }} />
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{profile.creditsToNext.toLocaleString()} VC to Level {profile.level + 1}</span>
          </div>
        </div>

        {/* Leaderboard percentile */}
        {leaderboard && (
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${divider}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Crown size={11} style={{ color: '#fbbf24' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Global Standing</span>
              </div>
              <span className="text-[11px] font-mono font-bold" style={{ color: '#22c55e' }}>Top {leaderboard.percentile}%</span>
            </div>
            <div className="relative rounded-full h-2 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${100 - leaderboard.percentile}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} style={{ background: 'linear-gradient(90deg,#f59e0b,#22c55e)' }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Rank #{leaderboard.rank} of {leaderboard.total}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{profile.tasksCompleted} done · {profile.checkins} check-ins</span>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};

// ── Achievements grid ─────────────────────────────────────────────────────────
const AchievementsCard: React.FC<{
  achievements: Achievement[]; unlocked: number; total: number;
  isDark: boolean; surfaceBg: string; surfaceBorder: string; divider: string;
}> = ({ achievements, unlocked, total, isDark, surfaceBg, surfaceBorder, divider }) => (
  <Section icon={<Medal size={12} />} label="Achievements" accent="#fbbf24"
    surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.15}
    right={<span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{unlocked}/{total} unlocked</span>}>
    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {achievements.map((a, i) => {
        const Icon = ACHIEVEMENT_ICONS[a.icon] || Trophy;
        return (
          <motion.div key={a.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2 }}
            className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5 relative overflow-hidden"
            style={{
              background: a.unlocked ? 'rgba(245,158,11,0.07)' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
              border: `1px solid ${a.unlocked ? 'rgba(245,158,11,0.25)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
            }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: a.unlocked ? 'rgba(245,158,11,0.14)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') }}>
              {a.unlocked
                ? <Icon size={16} style={{ color: '#fbbf24' }} />
                : <Lock size={14} style={{ color: 'var(--text-faint)', opacity: 0.6 }} />}
            </div>
            <span className="text-[10px] font-semibold leading-tight" style={{ color: a.unlocked ? 'var(--text-secondary)' : 'var(--text-faint)' }}>{a.name}</span>
            <span className="text-[8px] font-mono leading-tight" style={{ color: 'var(--text-faint)' }}>{a.desc}</span>
          </motion.div>
        );
      })}
    </div>
  </Section>
);

// ── Tomorrow Pre-Brief ────────────────────────────────────────────────────────
const PrebriefCard: React.FC<{
  prebrief: PrebriefReport; isDark: boolean; surfaceBg: string; surfaceBorder: string; divider: string;
  loading: boolean; onRefresh: () => void;
}> = ({ prebrief, isDark, surfaceBg, surfaceBorder, divider, loading, onRefresh }) => {
  const dateLabel = new Date(prebrief.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const start12 = (() => { const [h, m] = prebrief.recommendedStart.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${ap}`; })();
  const STATUS_ACCENT: Record<string, string> = { GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444' };
  return (
    <Section icon={<Sunrise size={12} />} label="Tomorrow Pre-Brief" accent="#38bdf8"
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.18}
      right={
        <motion.button onClick={onRefresh} disabled={loading} whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.4 }}
          className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
          {loading ? <motion.div className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} /> : <RefreshCw size={12} />}
        </motion.button>
      }>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>{dateLabel}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Confidence</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: prebrief.confidence >= 70 ? '#22c55e' : prebrief.confidence >= 50 ? '#f59e0b' : '#ef4444' }}>{prebrief.confidence}%</span>
          </div>
        </div>
        <p className="text-xs leading-relaxed font-mono mb-4" style={{ color: 'var(--text-tertiary)' }}>{prebrief.briefing}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <MiniStat icon={<Target size={11} />} label="Tasks" value={String(prebrief.taskCount)} />
          <MiniStat icon={<Clock size={11} />} label="Focus" value={`${prebrief.requiredHours}h`} />
          <MiniStat icon={<Sunrise size={11} />} label="Start" value={start12} />
        </div>

        {prebrief.blocks.length > 0 && (
          <div className="space-y-1.5">
            {prebrief.blocks.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_ACCENT[b.status] || '#22c55e' }} />
                <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{b.taskName}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: 'var(--text-faint)' }}>{b.cognitiveWeight}</span>
                <ChevronRight size={11} style={{ color: 'var(--text-faint)' }} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
};

const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.16)' }}>
    <div className="flex items-center gap-1 mb-0.5"><span style={{ color: '#38bdf8' }}>{icon}</span><span className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-faint)' }}>{label}</span></div>
    <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</div>
  </div>
);

export default InsightsPage;

// ── Results / Impact card ─────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FEATURE_COLORS: Record<string, string> = {
  rebalance: '#22c55e', triage: '#f59e0b', negotiate: '#38bdf8',
  panic: '#ef4444', reschedule: '#a855f7', drift_alert: '#f97316',
};

const ResultsCard: React.FC<{
  results: ResultsData;
  isDark: boolean;
  surfaceBg: string;
  surfaceBorder: string;
  divider: string;
}> = ({ results, isDark, surfaceBg, surfaceBorder, divider }) => {
  const impactStats = [
    { label: 'Tasks Completed', value: String(results.tasksCompleted), color: '#22c55e', icon: <CheckCircle size={11} /> },
    { label: 'On-Time Rate', value: `${results.onTimeRate}%`, color: results.onTimeRate >= 70 ? '#22c55e' : '#f59e0b', icon: <Clock size={11} /> },
    { label: 'AI Saves (Autonomous)', value: String(results.autonomousSaves), color: '#ef4444', icon: <Bot size={11} /> },
    { label: 'Est. Hours Saved', value: `${results.hoursSaved}h`, color: '#38bdf8', icon: <Activity size={11} /> },
  ];

  const breakdowns = [
    { label: 'Rebalances', value: results.rebalances, color: '#22c55e' },
    { label: 'Triages', value: results.triages, color: '#f59e0b' },
    { label: 'Panic Rescues', value: results.panicRescues, color: '#ef4444' },
    { label: 'Drafts', value: results.negotiateDrafts, color: '#38bdf8' },
    { label: 'Drift Alerts', value: results.driftAlerts, color: '#f97316' },
    { label: 'Check-ins', value: results.checkIns, color: '#a855f7' },
  ];

  return (
    <Section
      icon={<Activity size={12} />}
      label="Impact Evidence"
      accent="#22c55e"
      surfaceBg={surfaceBg}
      surfaceBorder={surfaceBorder}
      divider={divider}
      delay={0.12}
      right={
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
          {results.totalAgentActions} total AI actions
        </span>
      }
    >
      <div className="px-5 py-4">
        {/* Impact stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {impactStats.map(({ label, value, color, icon }) => (
            <div key={label} className="rounded-xl p-3"
              style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-faint)' }}>
                {icon}
                <span className="text-[9px] font-mono uppercase tracking-wider">{label}</span>
              </div>
              <div className="font-bold font-mono text-xl" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Breakdown row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {breakdowns.map(({ label, value, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: `${color}10`, color, border: `1px solid ${color}22` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {value} {label}
            </span>
          ))}
        </div>

        {/* Recent actions timeline */}
        {results.recentActions.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
              Recent autonomous actions
            </p>
            <div className="space-y-1.5">
              {results.recentActions.map((a, i) => {
                const color = FEATURE_COLORS[a.featureKey] || '#94a3b8';
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.06 }}
                    className="flex items-start gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {a.title}
                      </span>
                      <span className="text-[10px] font-mono ml-2" style={{ color: 'var(--text-faint)' }}>
                        {relativeTime(a.createdAt)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};
