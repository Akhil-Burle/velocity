/**
 * BurnoutChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature Block 3: Burnout Horizon Chart — 14-day workload projection.
 * Uses Recharts AreaChart. Auto-triggers triage when capacity exceeded today.
 */
import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { Zap, AlertTriangle } from 'lucide-react';
import { Task } from '../types';

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

    const available = HOURS_PER_DAY;

    // Sum required hours for tasks that haven't hit their deadline yet at this day
    const required = activeTasks.reduce((sum, task) => {
      const deadlineMs = new Date(task.deadline).getTime();
      if (deadlineMs > dayMs) {
        return sum + (task.currentPaceHoursPerDay || 0);
      }
      return sum;
    }, 0);

    return {
      day: dayLabel,
      available: Math.round(available * 10) / 10,
      required: Math.round(required * 10) / 10,
      burnout: required > available,
      idx,
    };
  });
}

const BurnoutChart: React.FC<BurnoutChartProps> = ({ tasks, isDark = true, onTriggerTriage }) => {
  const data = useMemo(() => buildBurnoutData(tasks), [tasks]);
  const isBurningToday = data[0]?.burnout ?? false;

  // Closure-based tooltip so isDark is captured correctly
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
    },
    [isDark]
  );

  // Find burnout zone regions for ReferenceArea
  const burnoutRegions: Array<{ x1: string; x2: string }> = [];
  let inBurnout = false;
  let regionStart = '';

  data.forEach((d, i) => {
    if (d.burnout && !inBurnout) {
      inBurnout = true;
      regionStart = d.day;
    } else if (!d.burnout && inBurnout) {
      inBurnout = false;
      burnoutRegions.push({ x1: regionStart, x2: data[i - 1].day });
    }
  });
  if (inBurnout) burnoutRegions.push({ x1: regionStart, x2: data[data.length - 1].day });

  const surfaceBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const tickColor = 'var(--text-faint)';

  return (
    <motion.div
      className="rounded-xl px-5 py-4"
      style={{
        background: surfaceBg,
        border: `1px solid ${surfaceBorder}`,
        boxShadow: isBurningToday
          ? '0 0 0 1px rgba(239,68,68,0.15)'
          : 'none',
      }}
      animate={isBurningToday ? {
        boxShadow: [
          '0 0 0px rgba(239,68,68,0)',
          '0 0 20px rgba(239,68,68,0.4)',
          '0 0 0px rgba(239,68,68,0)',
        ],
      } : {}}
      transition={isBurningToday ? { duration: 2.5, repeat: Infinity } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={11} style={{ color: isBurningToday ? '#ef4444' : 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: isBurningToday ? '#f87171' : 'var(--text-faint)' }}>
            Burnout Horizon · 14 days
          </span>
        </div>
        {/* Legend pills */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-mono"
            style={{ color: '#22c55e' }}>
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Available
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono"
            style={{ color: '#ef4444' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Required
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
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

          <XAxis
            dataKey="day"
            tick={{ fill: tickColor, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            interval={1}
          />

          {/* Burnout reference areas */}
          {burnoutRegions.map((r, i) => (
            <ReferenceArea key={i} x1={r.x1} x2={r.x2}
              fill="rgba(239,68,68,0.06)" strokeWidth={0}
              label={{ value: '⚠ Burnout Zone', position: 'insideTopRight', fill: '#f87171', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            />
          ))}

          {/* Today marker */}
          <ReferenceLine x="Today" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />

          <Tooltip content={<TooltipContent />} />

          <Area
            type="monotone"
            dataKey="available"
            name="Available"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="url(#availGrad)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="required"
            name="Required"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill="url(#reqGrad)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Auto-triage trigger banner */}
      <AnimatePresence>
        {isBurningToday && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.18)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={12} style={{ color: '#f87171', flexShrink: 0 }} />
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                ⚡ Your workload exceeds capacity today.
              </span>
            </div>
            <motion.button
              onClick={onTriggerTriage}
              whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}
              whileTap={{ scale: 0.95 }}
              className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg font-mono whitespace-nowrap"
              style={{
                background: 'rgba(245,158,11,0.12)',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.3)',
                boxShadow: '0 0 8px rgba(245,158,11,0.15)',
              }}
            >
              Run Triage Now
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BurnoutChart;
