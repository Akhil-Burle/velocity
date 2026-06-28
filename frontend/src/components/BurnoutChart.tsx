/**
 * BurnoutChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Burnout Horizon — compact collapsible widget.
 * Collapsed: single status row (urgent alert if burning today).
 * Expanded:  full 14-day area chart.
 */
import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { Zap, AlertTriangle, ChevronDown } from 'lucide-react';
import { Task } from '../types';
import InfoTooltip from './InfoTooltip';

interface BurnoutChartProps {
  tasks: Task[];
  isDark?: boolean;
  onTriggerTriage: () => void;
}

interface BurnoutDataPoint {
  day: string;
  available: number;
  required: number;
  burnout: boolean;
  idx: number;
}

function buildBurnoutData(tasks: Task[]): BurnoutDataPoint[] {
  const activeTasks = tasks.filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
  const now = Date.now();
  const HOURS_PER_DAY = 8;

  return Array.from({ length: 14 }, (_, idx) => {
    const dayMs = now + idx * 86400000;
    const dayLabel = idx === 0 ? 'Today' : idx === 1 ? 'Tmrw' :
      new Date(dayMs).toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');

    const required = activeTasks.reduce((sum, task) => {
      const deadlineMs = new Date(task.deadline).getTime();
      return deadlineMs > dayMs ? sum + (task.currentPaceHoursPerDay || 0) : sum;
    }, 0);

    return {
      day: dayLabel,
      available: HOURS_PER_DAY,
      required: Math.round(required * 10) / 10,
      burnout: required > HOURS_PER_DAY,
      idx,
    };
  });
}

const BurnoutChart: React.FC<BurnoutChartProps> = ({ tasks, isDark = true, onTriggerTriage }) => {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => buildBurnoutData(tasks), [tasks]);
  const isBurningToday = data[0]?.burnout ?? false;
  const burnoutDays = data.filter(d => d.burnout).length;
  const todayRequired = data[0]?.required ?? 0;

  const TooltipContent = useCallback(
    (props: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
      const { active, payload, label } = props;
      if (!active || !payload?.length) return null;
      return (
        <div style={{
          background: isDark ? 'rgba(13,17,23,0.95)' : 'rgba(248,250,252,0.95)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
          borderRadius: 8, padding: '8px 12px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-faint)', marginBottom: 6 }}>{label}</div>
          {payload.map((p) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
              <span style={{ color: p.color, fontWeight: 700 }}>{p.value}h</span>
            </div>
          ))}
        </div>
      );
    }, [isDark]
  );

  // Burnout regions for ReferenceArea
  const burnoutRegions: Array<{ x1: string; x2: string }> = [];
  let inBurnout = false, regionStart = '';
  data.forEach((d, i) => {
    if (d.burnout && !inBurnout) { inBurnout = true; regionStart = d.day; }
    else if (!d.burnout && inBurnout) { inBurnout = false; burnoutRegions.push({ x1: regionStart, x2: data[i - 1].day }); }
  });
  if (inBurnout) burnoutRegions.push({ x1: regionStart, x2: data[data.length - 1].day });

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const gridColor     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';

  return (
    <motion.div
      data-tour="tour-burnout"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="mb-6 rounded-xl overflow-hidden"
      style={{
        background: surfaceBg,
        border: `1px solid ${isBurningToday ? 'rgba(239,68,68,0.28)' : surfaceBorder}`,
      }}
    >
      {/* ── Collapsed header — always visible ─────────────────────────── */}
      <div
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 gap-3 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Zap size={11} style={{ color: isBurningToday ? '#ef4444' : 'var(--text-faint)', flexShrink: 0 }} />
          <span className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: isBurningToday ? '#f87171' : 'var(--text-faint)' }}>
            Burnout Horizon
          </span>
          <InfoTooltip explanation="14-day workload forecast — compares hours your active tasks require each day against your 8h/day capacity limit." />
          {isBurningToday ? (
            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
              <AlertTriangle size={9} />
              {todayRequired}h required today · {burnoutDays}d overloaded
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)' }}>
              capacity OK · 14-day horizon clear
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isBurningToday && !expanded && (
            <motion.button
              onClick={e => { e.stopPropagation(); onTriggerTriage(); }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg font-mono"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              Triage
            </motion.button>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={13} style={{ color: 'var(--text-faint)' }} />
          </motion.div>
        </div>
      </div>

      {/* ── Expanded chart ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', borderTop: `1px solid ${surfaceBorder}` }}
          >
            <div className="px-4 pt-3 pb-4">
              {/* Legend */}
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: '#22c55e' }}>
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Available (8h)
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: '#ef4444' }}>
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Required
                </span>
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data} margin={{ top: 4, right: 0, left: -32, bottom: 0 }}>
                  <defs>
                    <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal vertical={false} stroke={gridColor} />
                  <XAxis dataKey="day"
                    tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                    tickLine={false} axisLine={false} interval={1} />
                  {burnoutRegions.map((r, i) => (
                    <ReferenceArea key={i} x1={r.x1} x2={r.x2} fill="rgba(239,68,68,0.06)" strokeWidth={0} />
                  ))}
                  <ReferenceLine x="Today" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                  <Tooltip content={<TooltipContent />} />
                  <Area type="monotone" dataKey="available" name="Available"
                    stroke="#22c55e" strokeWidth={1.5} fill="url(#availGrad)" dot={false}
                    activeDot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="required" name="Required"
                    stroke="#ef4444" strokeWidth={1.5} fill="url(#reqGrad)" dot={false}
                    activeDot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>

              {isBurningToday && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={11} style={{ color: '#f87171', flexShrink: 0 }} />
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      Workload exceeds capacity today.
                    </span>
                  </div>
                  <motion.button onClick={onTriggerTriage}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg font-mono whitespace-nowrap"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Run Triage
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BurnoutChart;
