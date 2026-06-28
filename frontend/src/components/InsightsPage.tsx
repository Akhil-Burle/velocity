/**
 * InsightsPage.tsx — Velocity Intelligence Command Center
 * ─────────────────────────────────────────────────────────────────────────────
 * God-tier data visualization of the user's entire life inside Velocity.
 * Every data source feeds into one unified view. Real graphs, real numbers.
 *
 * Data sources:
 *   • generateInsights()       — AI summary, stats, calibration
 *   • fetchVelocityDNA()       — 6-axis radar fingerprint + archetype
 *   • fetchLeaderboard()       — global percentile + rank
 *   • fetchPrebrief()          — tomorrow planning pre-brief
 *   • fetchResults()           — agent impact evidence
 *   • fetchWeeklyReport()      — weekly credits/on-time/consistency + daily bar chart
 *   • fetchTasks()             — full task portfolio (completion %, status, type)
 *   • fetchHabits()            — habit streaks + 30-day history heatmap
 *   • fetchGoals()             — goal progress + linked task counts
 *   • computeDriftScoreBatch() — behavioral drift for all active tasks
 *   • useCredits()             — level, achievements, credit ledger
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  AreaChart, Area, PieChart, Pie,
} from 'recharts';
import {
  TrendingUp, Zap, BarChart2, Target, Clock, CheckCircle, AlertTriangle, RefreshCw, Cpu,
  Fingerprint, Trophy, Flame, Coins, Crown, Gem, Rocket, Swords, ShieldCheck, CalendarCheck,
  Sunrise, Lock, Medal, Sparkles, ChevronRight, Bot, Activity, Brain, GitBranch,
  ArrowUp, ArrowDown, Minus, Layers, ListChecks, Heart,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import {
  generateInsights, generateBriefing, fetchVelocityDNA, fetchLeaderboard,
  fetchPrebrief, fetchResults, fetchWeeklyReport, fetchTasks, fetchHabits, fetchGoals,
  computeDriftScoreBatch,
} from '../api';
import type {
  InsightsReport, VelocityDNA, LeaderboardResult, PrebriefReport,
  Achievement, WeeklyReport, Task, Habit, Goal,
} from '../types';
import type { ResultsData, DriftBatchResult } from '../api';
import { fmtHours } from '../data';
import InfoTooltip from './InfoTooltip';

// ── Icon map for achievement badges ──────────────────────────────────────────
const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Swords, Rocket, ShieldCheck, Flame, CalendarCheck, Trophy, Coins, Gem, Crown, Target, Medal,
} as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>;

// ── Design tokens ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444', COMPLETE: '#38bdf8', failed: '#6b7280',
};

// ── Shared section card shell ─────────────────────────────────────────────────
const Section: React.FC<{
  icon: React.ReactNode; label: string; accent?: string;
  right?: React.ReactNode; tooltip?: string; delay?: number;
  surfaceBg: string; surfaceBorder: string; divider: string;
  children: React.ReactNode;
}> = ({ icon, label, accent, right, tooltip, surfaceBg, surfaceBorder, divider, delay = 0, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-xl overflow-hidden"
    style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}
  >
    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${divider}` }}>
      <div className="flex items-center gap-2">
        <span style={{ color: accent || 'var(--text-faint)' }}>{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accent || 'var(--text-faint)' }}>{label}</span>
        {tooltip && <InfoTooltip explanation={tooltip} />}
      </div>
      {right}
    </div>
    {children}
  </motion.div>
);

// ── Mini stat pill ────────────────────────────────────────────────────────────
const StatPill: React.FC<{ label: string; value: string | number; color?: string; icon?: React.ReactNode; accentBg?: string }> =
({ label, value, color = '#22c55e', icon, accentBg }) => (
  <div className="rounded-xl p-4 flex flex-col gap-1"
    style={{ background: accentBg || `${color}08`, border: `1px solid ${color}1a` }}>
    <div className="flex items-center gap-1.5">
      {icon && <span style={{ color }}>{icon}</span>}
      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
    </div>
    <div className="font-bold font-mono text-xl leading-none" style={{ color }}>{value}</div>
  </div>
);

// ── Recharts custom tooltip ───────────────────────────────────────────────────
const ChartTooltip: React.FC<{ active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string; isDark: boolean }> =
({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: isDark ? 'rgba(13,17,23,0.97)' : 'rgba(248,250,252,0.97)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 8, padding: '8px 12px', backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      {label && <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-faint)', marginBottom: 6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ color: p.color || p.fill, fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
const InsightsPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { profile } = useCredits();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [report, setReport]       = useState<InsightsReport | null>(null);
  const [dna, setDna]             = useState<VelocityDNA | null>(null);
  const [leaderboard, setLB]      = useState<LeaderboardResult | null>(null);
  const [prebrief, setPrebrief]   = useState<PrebriefReport | null>(null);
  const [results, setResults]     = useState<ResultsData | null>(null);
  const [weekly, setWeekly]       = useState<WeeklyReport | null>(null);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [habits, setHabits]       = useState<Habit[]>([]);
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [drift, setDrift]         = useState<DriftBatchResult | null>(null);
  const [briefing, setBriefing]   = useState<string | null>(null);

  const [loading, setLoading]           = useState(true);
  const [briefingLoading, setBriefLoading] = useState(false);
  const [prebriefLoading, setPBLoading]    = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Design tokens ──────────────────────────────────────────────────────────
  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const gridColor     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const axisColor     = 'var(--text-faint)';

  // ── Load all data in parallel ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [r, d, lb, pb, res, wk, tk, hb, gl, dr] = await Promise.allSettled([
      generateInsights(), fetchVelocityDNA(), fetchLeaderboard(), fetchPrebrief(),
      fetchResults(), fetchWeeklyReport(), fetchTasks(), fetchHabits(), fetchGoals(),
      computeDriftScoreBatch(),
    ]);
    if (r.status === 'fulfilled')   setReport(r.value);     else setError('Could not generate insights — ensure backend is running');
    if (d.status === 'fulfilled')   setDna(d.value);
    if (lb.status === 'fulfilled')  setLB(lb.value);
    if (pb.status === 'fulfilled')  setPrebrief(pb.value);
    if (res.status === 'fulfilled') setResults(res.value);
    if (wk.status === 'fulfilled')  setWeekly(wk.value);
    if (tk.status === 'fulfilled')  setTasks(tk.value);
    if (hb.status === 'fulfilled')  setHabits(hb.value);
    if (gl.status === 'fulfilled')  setGoals(gl.value);
    if (dr.status === 'fulfilled')  setDrift(dr.value);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBriefing = async () => {
    setBriefLoading(true);
    try { const r = await generateBriefing(); setBriefing(r.briefing); }
    catch { setBriefing('Good morning! Focus on your highest-priority tasks and maintain your daily habits.'); }
    finally { setBriefLoading(false); }
  };

  const refreshPrebrief = async () => {
    setPBLoading(true);
    try { setPrebrief(await fetchPrebrief()); } catch { /* keep */ }
    finally { setPBLoading(false); }
  };

  // ── Derived task metrics ───────────────────────────────────────────────────
  const activeTasks    = tasks.filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
  const completedTasks = tasks.filter(t => t.status === 'COMPLETE');
  const redTasks       = activeTasks.filter(t => t.status === 'RED');
  const portfolioHealth = activeTasks.length > 0
    ? Math.round(activeTasks.reduce((s, t) => s + (t.completionPercent || 0), 0) / activeTasks.length)
    : 0;

  const statusCounts = {
    GREEN:    activeTasks.filter(t => t.status === 'GREEN').length,
    AMBER:    activeTasks.filter(t => t.status === 'AMBER').length,
    RED:      redTasks.length,
    COMPLETE: completedTasks.length,
    failed:   tasks.filter(t => t.status === 'failed').length,
  };

  // Status donut data for recharts PieChart
  const statusPieData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, fill: STATUS_COLOR[k] }));

  // Task completion bar data
  const taskBarData = activeTasks
    .sort((a, b) => (b.completionPercent || 0) - (a.completionPercent || 0))
    .slice(0, 8)
    .map(t => ({
      name: t.taskName.length > 16 ? t.taskName.slice(0, 14) + '…' : t.taskName,
      fullName: t.taskName,
      value: t.completionPercent || 0,
      fill: STATUS_COLOR[t.status] || '#22c55e',
      status: t.status,
    }));

  // Habit heatmap — last 30 days
  const today = new Date(); today.setHours(0,0,0,0);
  const habitDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getTime() - (29 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { date: key, label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) };
  });

  // Weekly credit bar
  const maxDaily = weekly ? Math.max(...weekly.dailyCredits.map(d => d.value), 1) : 1;

  // Drift worst offenders
  const driftOffenders = drift?.velocityVector?.worstOffenders?.slice(0, 4) ?? [];

  if (loading) return (
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
    <div className="px-4 sm:px-6 py-6 pb-20">


      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Zap size={11} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Velocity Intelligence</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Command Center</h1>
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

      {/* ── Morning briefing ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {briefing && (
          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-6 px-5 py-4 rounded-xl overflow-hidden"
            style={{ background: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={11} style={{ color: '#22c55e' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#22c55e' }}>Daily Briefing</span>
            </div>
            <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--text-tertiary)' }}>{briefing}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live Status Banner ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.4 }}
        className="mb-4 rounded-xl px-5 py-4"
        style={{
          background: redTasks.length > 0
            ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)')
            : (isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)'),
          border: `1px solid ${redTasks.length > 0 ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.2)'}`,
        }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: redTasks.length > 0 ? '#ef4444' : '#22c55e' }} />
            <span className="text-xs font-mono font-semibold" style={{ color: redTasks.length > 0 ? '#f87171' : '#4ade80' }}>
              {redTasks.length > 0 ? `${redTasks.length} critical task${redTasks.length > 1 ? 's' : ''} need attention` : 'All systems nominal'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] font-mono ml-auto">
            <span style={{ color: 'var(--text-faint)' }}><span style={{ color: '#22c55e', fontWeight: 700 }}>{statusCounts.GREEN}</span> on track</span>
            <span style={{ color: 'var(--text-faint)' }}><span style={{ color: '#f59e0b', fontWeight: 700 }}>{statusCounts.AMBER}</span> drifting</span>
            <span style={{ color: 'var(--text-faint)' }}><span style={{ color: '#ef4444', fontWeight: 700 }}>{statusCounts.RED}</span> critical</span>
            <span style={{ color: 'var(--text-faint)' }}><span style={{ color: '#38bdf8', fontWeight: 700 }}>{statusCounts.COMPLETE}</span> done</span>
            {profile && <span style={{ color: 'var(--text-faint)' }}>Portfolio <span style={{ color: '#a855f7', fontWeight: 700 }}>{portfolioHealth}%</span></span>}
          </div>
        </div>
      </motion.div>

      {/* ── Row 1: DNA + Gamification ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {dna && <VelocityDNACard dna={dna} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} />}
        <GamificationCard isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} leaderboard={leaderboard} />
      </div>


      {/* ── Row 2: Weekly Performance ─────────────────────────────────────── */}
      {weekly && (
        <div className="mb-4">
          <Section icon={<TrendingUp size={12} />} label="Weekly Performance"
            accent="#22c55e" tooltip="Real metrics from this week: credits earned per day, on-time rate, pace consistency, and focus hours."
            surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.05}
            right={
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <Flame size={9} /> {weekly.currentStreak}d streak
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{weekly.weekLabel}</span>
              </div>
            }>
            <div className="px-5 py-4">
              {/* Stat row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatPill label="Credits This Week" value={weekly.creditsThisWeek.toLocaleString()} color="#22c55e" icon={<Coins size={11} />} />
                <StatPill label="Tasks Completed" value={weekly.tasksCompleted} color="#38bdf8" icon={<CheckCircle size={11} />} />
                <StatPill label="On-Time Rate" value={`${weekly.onTimeRate}%`}
                  color={weekly.onTimeRate >= 70 ? '#22c55e' : weekly.onTimeRate >= 40 ? '#f59e0b' : '#ef4444'}
                  icon={<Target size={11} />} />
                <StatPill label="Hours Logged" value={fmtHours(weekly.hoursLogged)} color="#f59e0b" icon={<Clock size={11} />} />
              </div>
              {/* Daily credits bar chart */}
              <div className="mb-2">
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Daily Credits — Last 7 Days</span>
              </div>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly.dailyCredits} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={gridColor} />
                    <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                      tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: axisColor, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                      tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                    <Bar dataKey="value" name="Credits" radius={[3, 3, 0, 0]}>
                      {weekly.dailyCredits.map((d, i) => (
                        <Cell key={i} fill={d.value > 0
                          ? (d.value >= maxDaily * 0.7 ? '#22c55e' : d.value >= maxDaily * 0.3 ? '#4ade80' : '#86efac')
                          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Secondary stats row */}
              <div className="flex flex-wrap gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${divider}` }}>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span style={{ color: 'var(--text-faint)' }}>Pace Consistency</span>
                  <span className="font-bold" style={{ color: weekly.avgConsistency >= 70 ? '#22c55e' : '#f59e0b' }}>{weekly.avgConsistency}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span style={{ color: 'var(--text-faint)' }}>On Pace</span>
                  <span className="font-bold" style={{ color: '#38bdf8' }}>{weekly.onPaceCount}/{weekly.activeCount}</span>
                </div>
                {weekly.topTask && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono ml-auto">
                    <Coins size={10} style={{ color: '#22c55e' }} />
                    <span style={{ color: 'var(--text-faint)' }}>Top earner:</span>
                    <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{weekly.topTask.taskName}</span>
                    <span style={{ color: '#22c55e' }}>{weekly.topTask.creditValue} VC</span>
                  </div>
                )}
              </div>
            </div>
          </Section>
        </div>
      )}


      {/* ── Row 3: Task Portfolio ─────────────────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Completion bars */}
          <div className="lg:col-span-2">
            <Section icon={<Layers size={12} />} label="Task Portfolio"
              accent="#38bdf8" tooltip="Completion percentage for each active task, colored by pace status."
              surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.07}
              right={<span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{activeTasks.length} active · {completedTasks.length} done</span>}>
              <div className="px-5 py-4">
                {taskBarData.length > 0 ? (
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskBarData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke={gridColor} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: axisColor, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                          tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={90}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                          tickLine={false} axisLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as typeof taskBarData[0];
                            return (
                              <div style={{
                                background: isDark ? 'rgba(13,17,23,0.97)' : 'rgba(248,250,252,0.97)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 8, padding: '8px 12px',
                              }}>
                                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', marginBottom: 4 }}>{d.fullName}</div>
                                <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: d.fill, fontWeight: 700 }}>{d.value}% complete</div>
                                <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-faint)', marginTop: 2 }}>{d.status}</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="value" name="Completion %" radius={[0, 3, 3, 0]} minPointSize={2}>
                          {taskBarData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No active tasks to display</span>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* Status donut */}
          <Section icon={<ListChecks size={12} />} label="Status Breakdown"
            accent="#a855f7" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.08}>
            <div className="px-5 py-4">
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={44} outerRadius={64}
                      dataKey="value" strokeWidth={0} paddingAngle={2}
                      isAnimationActive animationDuration={900} animationBegin={200}>
                      {statusPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { name: string; value: number; fill: string };
                      return (
                        <div style={{ background: isDark ? 'rgba(13,17,23,0.97)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8, padding: '6px 10px' }}>
                          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: d.fill, fontWeight: 700 }}>{d.name} — {d.value}</span>
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-1.5 mt-2">
                {statusPieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold" style={{ color: d.fill }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>
      )}


      {/* ── Row 4: Habits Heatmap + Goals Progress ────────────────────────── */}
      {(habits.length > 0 || goals.length > 0) && (
        <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Habit Heatmap */}
          {habits.length > 0 && (
            <Section icon={<Heart size={12} />} label="Habit Performance"
              accent="#f97316" tooltip="30-day completion heatmap for all tracked habits. Darker = completed."
              surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.1}
              right={<span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{habits.length} habit{habits.length !== 1 ? 's' : ''}</span>}>
              <div className="px-5 py-4">
                {habits.map((habit, hi) => {
                  const histMap: Record<string, boolean> = {};
                  habit.history.forEach(h => { histMap[h.date] = h.completed; });
                  const completedDays = habitDays.filter(d => histMap[d.date] === true).length;
                  const pct = Math.round((completedDays / 30) * 100);
                  return (
                    <div key={habit.id} className={hi < habits.length - 1 ? 'mb-4' : ''}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{habit.title}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>{habit.frequency}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-[10px] font-mono" style={{ color: '#f59e0b' }}>
                            <Flame size={9} />{habit.streak}d
                          </span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 flex-wrap">
                        {habitDays.map((d, di) => {
                          const done = histMap[d.date] === true;
                          const noData = !(d.date in histMap);
                          return (
                            <motion.div key={di} title={`${d.label}: ${done ? 'Done' : noData ? 'No data' : 'Missed'}`}
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ delay: 0.15 + di * 0.008, duration: 0.2 }}
                              className="w-3.5 h-3.5 rounded-sm"
                              style={{
                                background: done ? '#f97316' : noData
                                  ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                                  : (isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)'),
                              }} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: `1px solid ${divider}` }}>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f97316' }} /><span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>Completed</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)' }} /><span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>Missed</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} /><span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>No data</span></div>
                </div>
              </div>
            </Section>
          )}

          {/* Goals Progress */}
          {goals.length > 0 && (
            <Section icon={<Target size={12} />} label="Goal Progress"
              accent="#a855f7" tooltip="Progress toward each active goal, with linked task counts."
              surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.11}
              right={<span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{goals.length} goal{goals.length !== 1 ? 's' : ''}</span>}>
              <div className="px-5 py-4 space-y-4">
                {goals.map((goal, gi) => {
                  const pct = goal.progressPercent || 0;
                  const linkedCount = goal.linkedTaskIds?.length || 0;
                  const linkedDone = linkedCount > 0
                    ? tasks.filter(t => goal.linkedTaskIds.includes(t.id) && t.status === 'COMPLETE').length
                    : 0;
                  const daysLeft = goal.targetDate
                    ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <motion.div key={goal.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 + gi * 0.06 }}>
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <div>
                          <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{goal.title}</span>
                          {goal.description && <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-faint)' }}>{goal.description.slice(0, 60)}{goal.description.length > 60 ? '…' : ''}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold font-mono" style={{ color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#a855f7' : '#f59e0b' }}>{pct}%</span>
                          {daysLeft !== null && <p className="text-[9px] font-mono mt-0.5" style={{ color: daysLeft <= 7 ? '#ef4444' : 'var(--text-faint)' }}>{daysLeft > 0 ? `${daysLeft}d left` : 'overdue'}</p>}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                          style={{ background: pct >= 80 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : pct >= 50 ? 'linear-gradient(90deg,#a855f7,#c084fc)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />
                      </div>
                      {linkedCount > 0 && (
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                          {linkedDone}/{linkedCount} linked tasks complete
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}


      {/* ── Row 5: Behavioral Drift Signals ──────────────────────────────── */}
      {drift && drift.driftScores.length > 0 && (
        <div className="mb-4">
          <Section icon={<Brain size={12} />} label="Behavioral Drift Analysis"
            accent="#f97316"
            tooltip="Compares what you report vs what your behavior signals. Gap = over/under-reporting."
            surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.13}
            right={
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: drift.velocityVector.direction === 'good' ? 'rgba(34,197,94,0.1)' : drift.velocityVector.direction === 'poor' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    color: drift.velocityVector.direction === 'good' ? '#22c55e' : drift.velocityVector.direction === 'poor' ? '#ef4444' : '#f59e0b',
                    border: `1px solid ${drift.velocityVector.direction === 'good' ? 'rgba(34,197,94,0.2)' : drift.velocityVector.direction === 'poor' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                  Vector {drift.velocityVector.direction}
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  Alignment {drift.velocityVector.alignment}%
                </span>
              </div>
            }>
            <div className="px-5 py-4">
              {/* Vector summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg px-3 py-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
                  <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Magnitude</div>
                  <div className="text-lg font-bold font-mono" style={{ color: '#f97316' }}>{drift.velocityVector.magnitude}</div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>output intensity</div>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
                  <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Alignment</div>
                  <div className="text-lg font-bold font-mono" style={{ color: drift.velocityVector.alignment >= 70 ? '#22c55e' : '#f59e0b' }}>{drift.velocityVector.alignment}%</div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>real vs needed</div>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
                  <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Direction</div>
                  <div className="text-lg font-bold font-mono capitalize"
                    style={{ color: drift.velocityVector.direction === 'good' ? '#22c55e' : drift.velocityVector.direction === 'poor' ? '#ef4444' : '#f59e0b' }}>
                    {drift.velocityVector.direction}
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>trajectory</div>
                </div>
              </div>
              {/* Per-task drift rows */}
              <div className="space-y-2.5">
                {drift.driftScores.slice(0, 6).map((d, i) => {
                  const gap = d.gap;
                  const gapColor = gap < -10 ? '#ef4444' : gap > 10 ? '#22c55e' : '#f59e0b';
                  const DirIcon = gap > 5 ? ArrowUp : gap < -5 ? ArrowDown : Minus;
                  return (
                    <motion.div key={d.taskId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.05 }}
                      className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{d.taskName}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <DirIcon size={9} style={{ color: gapColor }} />
                            <span className="text-[10px] font-mono font-bold" style={{ color: gapColor }}>
                              {gap > 0 ? '+' : ''}{gap}%
                            </span>
                            <span className="text-[9px] font-mono px-1 py-0.5 rounded"
                              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-faint)' }}>
                              {d.confidence}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${d.selfReported}%`, background: '#4b5563' }} />
                          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${d.inferredReal}%`, background: gapColor, opacity: 0.7 }} />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>Reported {d.selfReported}%</span>
                          <span className="text-[9px] font-mono" style={{ color: gapColor }}>Inferred {d.inferredReal}%</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {/* Worst offenders */}
              {driftOffenders.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${divider}` }}>
                  <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Highest risk tasks</p>
                  <div className="flex flex-wrap gap-2">
                    {driftOffenders.map(o => (
                      <span key={o.taskId} className="text-[10px] font-mono px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {o.taskName.length > 20 ? o.taskName.slice(0, 18) + '…' : o.taskName} — {o.probability}% finish prob
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ── Row 6: AI Summary + Stat Cards ───────────────────────────────── */}
      {report && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { icon: CheckCircle, label: 'Tasks Completed', value: String(report.stats.tasksCompleted), color: '#22c55e' },
              { icon: TrendingUp, label: 'Velocity Score', value: String(report.stats.avgVelocityScore), color: report.stats.avgVelocityScore >= 70 ? '#22c55e' : report.stats.avgVelocityScore >= 50 ? '#f59e0b' : '#ef4444' },
              { icon: Target, label: 'On-Time Rate', value: report.stats.onTimeRate, color: '#38bdf8' },
              { icon: Clock, label: 'Hours Logged', value: fmtHours(report.stats.totalHoursLogged), color: '#f59e0b' },
            ].map(({ icon: Icon, label, value, color }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -3, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1)' }}
                className="rounded-xl p-4 cursor-default" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon size={11} style={{ color: 'var(--text-faint)' }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
                  {label === 'Velocity Score' && <InfoTooltip explanation="Average across completed tasks: on-pace ratio weighted 60%, pace consistency weighted 40%." />}
                </div>
                <div className="font-bold font-mono text-2xl" style={{ color }}>{value}</div>
              </motion.div>
            ))}
          </div>

          {/* AI Summary */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.45 }}
            className="mb-4 px-5 py-4 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.75)', border: `1px solid ${divider}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={12} style={{ color: '#a855f7' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a855f7' }}>AI Performance Summary</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{report.summary}</p>
            {report.recommendations.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {report.recommendations.map((rec, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: '#a855f7' }} />{rec}
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </>
      )}


      {/* ── Row 7: Tomorrow Pre-Brief ─────────────────────────────────────── */}
      {prebrief && (
        <div className="mb-4">
          <PrebriefCard prebrief={prebrief} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}
            loading={prebriefLoading} onRefresh={refreshPrebrief} />
        </div>
      )}

      {/* ── Row 8: Impact Evidence ────────────────────────────────────────── */}
      {results && (
        <div className="mb-4">
          <ResultsCard results={results} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} />
        </div>
      )}

      {/* ── Row 9: Achievements ───────────────────────────────────────────── */}
      {profile && profile.achievements?.length > 0 && (
        <div className="mb-4">
          <AchievementsCard achievements={profile.achievements}
            unlocked={profile.achievementsUnlocked} total={profile.achievementsTotal}
            isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} />
        </div>
      )}

      {/* ── Row 10: Estimation Calibration ───────────────────────────────── */}
      {report && report.calibration.length > 0 && (
        <div className="mb-4">
          <Section icon={<BarChart2 size={12} />} label="Estimation Calibration"
            accent="#38bdf8" tooltip="How accurate your time estimates are by task type, derived from pace consistency vs planned effort."
            surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.25}>
            <div className="px-5 py-2 overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  {['Task Type', 'Estimated', 'Actual', 'Accuracy', 'Recommendation'].map(h => (
                    <th key={h} className="py-2 pr-3 text-left">
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{h}</span>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {report.calibration.map((row, i) => {
                    const accNum = parseFloat(row.accuracy);
                    const accColor = accNum >= 80 ? '#22c55e' : accNum >= 60 ? '#f59e0b' : '#ef4444';
                    return (
                      <motion.tr key={row.taskType} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.28 + i * 0.08 }}
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
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ── Velocity DNA radar card ───────────────────────────────────────────────────
const VelocityDNACard: React.FC<{
  dna: VelocityDNA; isDark: boolean;
  surfaceBg: string; surfaceBorder: string; divider: string;
}> = ({ dna, isDark, surfaceBg, surfaceBorder, divider }) => {
  const radarData = dna.axes.map(a => ({ subject: a.axis, value: a.value, fullMark: 100 }));
  const axisColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.5)';
  return (
    <Section icon={<Fingerprint size={12} />} label="Velocity DNA" accent="#a855f7"
      tooltip="6-axis radar fingerprint derived from real task completions and check-in patterns — not a questionnaire."
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.02}
      right={<span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>Overall {dna.overall}</span>}>
      <div className="px-3 pt-2 pb-4">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: axisColor, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#a855f7" strokeWidth={2} fill="#a855f7" fillOpacity={0.28}
                isAnimationActive animationDuration={900} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="px-3 mt-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={12} style={{ color: '#c084fc' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{dna.archetype}</span>
            <InfoTooltip explanation="Inferred from the two highest radar axes — describes your dominant work pattern, not a fixed personality type." />
          </div>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{dna.archetypeBlurb}</p>
          <div className="flex flex-wrap gap-2">
            <DnaPill icon={<Sunrise size={9} />} label="Peak" value={dna.peakHours} />
            <DnaPill icon={<Rocket size={9} />} label="Fastest" value={dna.strongestType} />
            <DnaPill icon={<Target size={9} />} label="Growth" value={dna.weakestType} />
            <DnaPill icon={<GitBranch size={9} />} label="Sample" value={`${dna.sampleSize.tasks}t · ${dna.sampleSize.checkins}c`} />
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


// ── Gamification card ─────────────────────────────────────────────────────────
const GamificationCard: React.FC<{
  isDark: boolean; surfaceBg: string; surfaceBorder: string; divider: string;
  leaderboard: LeaderboardResult | null;
}> = ({ isDark, surfaceBg, surfaceBorder, divider, leaderboard }) => {
  const { profile } = useCredits();
  if (!profile) return (
    <Section icon={<Trophy size={12} />} label="Velocity Credits" accent="#22c55e"
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.04}>
      <div className="px-5 py-10 flex items-center justify-center">
        <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Credits unavailable — backend offline</span>
      </div>
    </Section>
  );

  const R = 30, C = 2 * Math.PI * R;
  const dash = C * (profile.progressPercent / 100);

  // Credit history line chart (last 10 ledger entries)
  const ledgerTrend = (() => {
    if (!profile.ledger?.length) return [];
    const chrono = [...profile.ledger].reverse().slice(-10);
    let cum = 0;
    return chrono.map(e => { cum += Math.max(0, e.amount); return { label: e.label?.slice(0, 8) || '', value: cum }; });
  })();

  return (
    <Section icon={<Trophy size={12} />} label="Velocity Credits" accent="#22c55e"
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.04}
      right={<span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
        <Flame size={9} /> {profile.streak}-day streak
      </span>}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-5 mb-4">
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
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{profile.title}</div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <Coins size={13} style={{ color: '#22c55e' }} />
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{profile.credits.toLocaleString()}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>VC</span>
            </div>
            <div className="rounded-full h-1.5 overflow-hidden mb-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${profile.progressPercent}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: 'linear-gradient(90deg,#22c55e,#4ade80)' }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{profile.creditsToNext.toLocaleString()} to Level {profile.level + 1}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{profile.tasksCompleted} tasks · {profile.checkins} check-ins</span>
            </div>
          </div>
        </div>

        {/* Credit history sparkline */}
        {ledgerTrend.length >= 2 && (
          <div className="mb-4 pt-3" style={{ borderTop: `1px solid ${divider}` }}>
            <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Credit Growth (last 10 actions)</p>
            <div style={{ height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ledgerTrend} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" name="Credits" stroke="#22c55e" strokeWidth={1.5}
                    fill="url(#creditGrad)" dot={false} isAnimationActive animationDuration={900} />
                  <XAxis dataKey="label" hide />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard && (
          <div className="pt-3" style={{ borderTop: `1px solid ${divider}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Crown size={11} style={{ color: '#fbbf24' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Global Standing</span>
              </div>
              <span className="text-[11px] font-mono font-bold" style={{ color: '#22c55e' }}>Top {leaderboard.percentile}%</span>
            </div>
            <div className="relative rounded-full h-2 overflow-hidden mb-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${100 - leaderboard.percentile}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: 'linear-gradient(90deg,#f59e0b,#22c55e)' }} />
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Rank #{leaderboard.rank} of {leaderboard.total} users</span>
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
    surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.22}
    right={<span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{unlocked}/{total} unlocked</span>}>
    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {achievements.map((a, i) => {
        const Icon = ACHIEVEMENT_ICONS[a.icon] || Trophy;
        return (
          <motion.div key={a.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2 }}
            className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
            style={{
              background: a.unlocked ? 'rgba(245,158,11,0.07)' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
              border: `1px solid ${a.unlocked ? 'rgba(245,158,11,0.25)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
            }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: a.unlocked ? 'rgba(245,158,11,0.14)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') }}>
              {a.unlocked ? <Icon size={16} style={{ color: '#fbbf24' }} /> : <Lock size={14} style={{ color: 'var(--text-faint)', opacity: 0.6 }} />}
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
  prebrief: PrebriefReport; isDark: boolean;
  surfaceBg: string; surfaceBorder: string; divider: string;
  loading: boolean; onRefresh: () => void;
}> = ({ prebrief, isDark, surfaceBg, surfaceBorder, divider, loading, onRefresh }) => {
  const dateLabel = new Date(prebrief.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const [h, m] = prebrief.recommendedStart.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const start12 = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${ap}`;
  const STATUS_ACCENT: Record<string, string> = { GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444' };
  return (
    <Section icon={<Sunrise size={12} />} label="Tomorrow Pre-Brief" accent="#38bdf8"
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.2}
      right={
        <motion.button onClick={onRefresh} disabled={loading}
          whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.4 }}
          className="w-7 h-7 flex items-center justify-center rounded-lg"
          style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}` }}>
          {loading
            ? <motion.div className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
            : <RefreshCw size={12} />}
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
          {[
            { icon: <Target size={11} />, label: 'Tasks', value: String(prebrief.taskCount) },
            { icon: <Clock size={11} />, label: 'Focus', value: fmtHours(prebrief.requiredHours) },
            { icon: <Sunrise size={11} />, label: 'Start', value: start12 },
          ].map(({ icon, label, value }) => (
            <div key={label} className="rounded-lg px-3 py-2" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.16)' }}>
              <div className="flex items-center gap-1 mb-0.5"><span style={{ color: '#38bdf8' }}>{icon}</span><span className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-faint)' }}>{label}</span></div>
              <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
        {prebrief.blocks.length > 0 && (
          <div className="space-y-1.5">
            {prebrief.blocks.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_ACCENT[b.status] || '#22c55e' }} />
                <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{b.taskName}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: 'var(--text-faint)' }}>{b.cognitiveWeight}</span>
                <ChevronRight size={11} style={{ color: 'var(--text-faint)' }} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
};


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
  results: ResultsData; isDark: boolean;
  surfaceBg: string; surfaceBorder: string; divider: string;
}> = ({ results, isDark, surfaceBg, surfaceBorder, divider }) => {
  const impactStats = [
    { label: 'Tasks Completed',       value: String(results.tasksCompleted),    color: '#22c55e', icon: <CheckCircle size={11} /> },
    { label: 'On-Time Rate',          value: `${results.onTimeRate}%`,           color: results.onTimeRate >= 70 ? '#22c55e' : '#f59e0b', icon: <Clock size={11} /> },
    { label: 'Autonomous AI Saves',   value: String(results.autonomousSaves),   color: '#ef4444', icon: <Bot size={11} /> },
    { label: 'Est. Hours Saved',      value: fmtHours(results.hoursSaved),      color: '#38bdf8', icon: <Activity size={11} /> },
  ];
  const breakdowns = [
    { label: 'Rebalances',  value: results.rebalances,      color: '#22c55e' },
    { label: 'Triages',     value: results.triages,         color: '#f59e0b' },
    { label: 'Panic Saves', value: results.panicRescues,    color: '#ef4444' },
    { label: 'Drafts',      value: results.negotiateDrafts, color: '#38bdf8' },
    { label: 'Drift Alerts',value: results.driftAlerts,     color: '#f97316' },
    { label: 'Check-ins',   value: results.checkIns,        color: '#a855f7' },
  ];
  // Bar chart data for agent action breakdown
  const actionBarData = breakdowns.filter(b => b.value > 0);

  return (
    <Section icon={<Activity size={12} />} label="Impact Evidence" accent="#22c55e"
      tooltip="Real proof that AI assistance is working — every number is derived from actual agent log entries."
      surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider} delay={0.23}
      right={<span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
        {results.totalAgentActions} total AI actions
      </span>}>
      <div className="px-5 py-4">
        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {impactStats.map(({ label, value, color, icon }) => (
            <div key={label} className="rounded-xl p-3"
              style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-faint)' }}>{icon}<span className="text-[9px] font-mono uppercase tracking-wider">{label}</span></div>
              <div className="font-bold font-mono text-xl" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Action breakdown bar chart */}
        {actionBarData.length > 0 && (
          <div className="mb-4">
            <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Action breakdown</p>
            <div style={{ height: 90 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionBarData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Bar dataKey="value" name="Actions" radius={[3, 3, 0, 0]}>
                    {actionBarData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent actions timeline */}
        {results.recentActions.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Recent autonomous actions</p>
            <div className="space-y-1.5">
              {results.recentActions.map((a, i) => {
                const color = FEATURE_COLORS[a.featureKey] || '#94a3b8';
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.06 }}
                    className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{a.title}</span>
                      <span className="text-[10px] font-mono ml-2" style={{ color: 'var(--text-faint)' }}>{relativeTime(a.createdAt)}</span>
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

export default InsightsPage;
