/**
 * VelocityReport.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bottom drawer showing the REAL weekly velocity report — credits earned,
 * tasks completed, on-time rate, pace consistency, hours logged, and a daily
 * credit-earning bar chart. Pulled live from /api/insights/weekly.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Coins, CheckCircle, Gauge, Clock, Flame, TrendingUp } from 'lucide-react';
import { fetchWeeklyReport } from '../api';
import type { WeeklyReport } from '../types';
import { fmtHours } from '../data';

interface VelocityReportProps {
  isDark?: boolean;
}

const VelocityReport: React.FC<VelocityReportProps> = ({ isDark = true }) => {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const drawerBg  = isDark ? 'rgba(13,17,23,0.98)'     : 'rgba(248,250,252,0.98)';
  const borderTop = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const surfaceBr = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const load = async () => {
    setLoading(true);
    try { setReport(await fetchWeeklyReport()); } catch { /* backend offline */ }
    finally { setLoading(false); }
  };

  // Load once on first open
  useEffect(() => { if (open && !report) load(); /* eslint-disable-next-line */ }, [open]);

  const STATS = report ? [
    { icon: Coins,       label: 'Credits This Week', value: report.creditsThisWeek.toLocaleString(), color: '#22c55e' },
    { icon: CheckCircle, label: 'Tasks Completed',   value: String(report.tasksCompleted),           color: '#22c55e' },
    { icon: Gauge,       label: 'On-Time Rate',      value: `${report.onTimeRate}%`,                 color: report.onTimeRate >= 70 ? '#22c55e' : report.onTimeRate >= 40 ? '#f59e0b' : '#ef4444' },
    { icon: TrendingUp,  label: 'Pace Consistency',  value: `${report.avgConsistency}%`,             color: report.avgConsistency >= 70 ? '#22c55e' : '#f59e0b' },
  ] : [];

  const maxDaily = report ? Math.max(...report.dailyCredits.map(d => d.value), 1) : 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Pull handle */}
        <motion.button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-center gap-2.5 w-full py-2.5 text-xs font-mono transition-colors"
          style={{ background: drawerBg, borderTop: `1px solid ${borderTop}`, backdropFilter: 'blur(12px)', color: open ? 'var(--text-tertiary)' : 'var(--text-faint)' }}
          whileHover={{ color: 'var(--text-tertiary)' }}
        >
          {open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={12} style={{ color: 'var(--text-faint)' }} />}
          <span>Weekly Velocity Report</span>
          {report && report.currentStreak > 0 && (
            <span className="flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              <Flame size={9} /> {report.currentStreak}d
            </span>
          )}
          {open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={12} style={{ color: 'var(--text-faint)' }} />}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
              style={{ background: drawerBg, borderTop: `1px solid ${borderTop}`, backdropFilter: 'blur(20px)' }}
            >
              <div className="max-w-5xl mx-auto px-6 py-5">
                {loading && (
                  <div className="flex items-center justify-center py-8 gap-3">
                    <motion.div className="w-5 h-5 rounded-full border-2 border-green-400 border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Crunching this week's numbers...</span>
                  </div>
                )}

                {!loading && report && (
                  <>
                    {/* Header line */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{report.weekLabel}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.15)' }}>Live</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1"><Clock size={11} style={{ color: '#f59e0b' }} /> {fmtHours(report.hoursLogged)} logged</span>
                        <span>{report.onPaceCount}/{report.activeCount} on pace</span>
                      </div>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {STATS.map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                          <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }} className="rounded-xl p-4"
                            style={{ background: surfaceBg, border: `1px solid ${surfaceBr}` }}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Icon size={11} style={{ color: stat.color }} />
                              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{stat.label}</span>
                            </div>
                            <div className="font-bold font-mono text-2xl" style={{ color: stat.color }}>{stat.value}</div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Daily credits bar chart + top task */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 rounded-xl p-4" style={{ background: surfaceBg, border: `1px solid ${surfaceBr}` }}>
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Credits Earned · Last 7 Days</span>
                        <div className="flex items-end justify-between gap-2 mt-3 h-20">
                          {report.dailyCredits.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <motion.div className="w-full rounded-t"
                                initial={{ height: 0 }} animate={{ height: `${(d.value / maxDaily) * 64}px` }}
                                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                style={{ background: d.value > 0 ? 'linear-gradient(180deg,#22c55e,#16a34a)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'), minHeight: 2 }}
                                title={`${d.value} VC`} />
                              <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>{d.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl p-4 flex flex-col justify-center" style={{ background: surfaceBg, border: `1px solid ${surfaceBr}` }}>
                        <span className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Top Earner</span>
                        {report.topTask ? (
                          <>
                            <span className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{report.topTask.taskName}</span>
                            <span className="flex items-center gap-1 text-sm font-mono font-bold mt-1" style={{ color: '#22c55e' }}>
                              <Coins size={12} /> {report.topTask.creditValue} VC
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No completions yet this week</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VelocityReport;
