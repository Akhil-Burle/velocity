/**
 * PaceChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The real pace tracker. Plots the EXPECTED completion line (a straight diagonal
 * from 0% at task creation to 100% at the deadline) against the user's ACTUAL
 * logged progress over time. The gap between them is the drift. A dashed
 * projection extends the user's current velocity to show whether they'll land
 * before or after the deadline.
 *
 *   compact = true  → tiny inline version for task cards (no axes)
 *   compact = false → full version for the detail modal (axes, tooltip, readouts)
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Flag, Gauge } from 'lucide-react';
import type { Task, PaceMetrics } from '../types';
import { computePaceMetrics } from '../data';

const DAY = 86400000;
const STATUS_COLOR: Record<string, string> = {
  GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444', COMPLETE: '#22c55e', failed: '#71717a',
};

interface PaceChartProps {
  task: Task;
  isDark?: boolean;
  compact?: boolean;
  metrics?: PaceMetrics;
}

const PaceChart: React.FC<PaceChartProps> = ({ task, isDark = true, compact = false, metrics }) => {
  // Always recompute from the task's current completionPercent so the chart
  // stays live when the modal slider moves. Only use the cached paceMetrics
  // from the server when the parent explicitly passes `metrics` (card compact mode).
  const m = metrics ?? computePaceMetrics(task);
  const accent = STATUS_COLOR[m.status] || '#22c55e';

  const { data, deadlineMs, nowMs, projectedMs } = useMemo(() => {
    const createdAt = new Date(task.createdAt || Date.now()).getTime();
    const deadline = new Date(task.deadline).getTime();
    const now = Date.now();
    const span = Math.max(deadline - createdAt, DAY * 0.1);
    const lin = (t: number) => Math.max(0, Math.min(100, ((t - createdAt) / span) * 100));

    const rows: Array<{ t: number; expected: number | null; actual: number | null; projected: number | null }> = [];
    rows.push({ t: createdAt, expected: 0, actual: 0, projected: null });

    (task.sparkline || [])
      .filter(p => p.timestamp)
      .map(p => ({ t: new Date(p.timestamp as string).getTime(), v: p.value }))
      .sort((a, b) => a.t - b.t)
      .forEach(p => rows.push({ t: p.t, expected: lin(p.t), actual: p.v, projected: null }));

    // "Now" anchor with current completion
    rows.push({ t: now, expected: lin(now), actual: m.actual, projected: m.actual });

    // Projection from now → projected finish (capped to a sensible horizon)
    const projFinish = m.projectedFinish ? new Date(m.projectedFinish).getTime() : null;
    let projMs: number | null = null;
    if (projFinish && m.actual < 100) {
      projMs = Math.min(projFinish, deadline + span * 0.5);
      rows.push({ t: projMs, expected: null, actual: null, projected: 100 });
    }

    // Expected endpoint at the deadline
    rows.push({ t: deadline, expected: 100, actual: null, projected: null });

    // Sort + dedupe by timestamp
    rows.sort((a, b) => a.t - b.t);
    return { data: rows, deadlineMs: deadline, nowMs: now, projectedMs: projMs };
  }, [task, m]);

  const grid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const expectedColor = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.6)';

  const fmtDate = (t: number) => new Date(t).toLocaleDateString('en', { month: 'numeric', day: 'numeric' });

  // ── Compact (card) ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div style={{ width: '100%', height: 44 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <Line type="monotone" dataKey="expected" stroke={expectedColor} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="actual" stroke={accent} strokeWidth={2} dot={false} isAnimationActive connectNulls />
            <Line type="monotone" dataKey="projected" stroke={accent} strokeWidth={1.5} strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls opacity={0.6} />
            <ReferenceLine x={nowMs} stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'} strokeWidth={1} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
            <YAxis domain={[0, 100]} hide />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Full (modal) ──────────────────────────────────────────────────────────
  const DriftIcon = m.drift > 3 ? TrendingUp : m.drift < -3 ? TrendingDown : Minus;
  const driftColor = m.drift >= -3 ? '#22c55e' : m.drift >= -15 ? '#f59e0b' : '#ef4444';
  const projLabel = m.actual >= 100
    ? 'Completed'
    : m.willFinishOnTime
      ? 'On track to finish on time'
      : m.projectedFinish
        ? `Projected ${Math.abs(Math.round((new Date(m.projectedFinish).getTime() - deadlineMs) / DAY))}d ${new Date(m.projectedFinish).getTime() > deadlineMs ? 'late' : 'early'}`
        : 'Not enough data yet';

  return (
    <div>
      {/* Readouts */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Readout label="Drift" value={`${m.drift > 0 ? '+' : ''}${m.drift}%`} color={driftColor} icon={<DriftIcon size={11} />} sub={m.drift >= 0 ? 'ahead' : 'behind'} />
        <Readout label="Velocity" value={`${m.velocityRate}%/d`} color="#38bdf8" icon={<Gauge size={11} />} sub={`need ${m.requiredRate}%/d`} />
        <Readout label="Consistency" value={`${m.consistency}%`} color={m.consistency >= 70 ? '#22c55e' : m.consistency >= 45 ? '#f59e0b' : '#ef4444'} icon={<TrendingUp size={11} />} sub="pace steadiness" />
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={`pace-${task.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal vertical={false} stroke={grid} />
            {/* deadline → projected miss zone */}
            {projectedMs && projectedMs > deadlineMs && (
              <ReferenceArea x1={deadlineMs} x2={projectedMs} fill="rgba(239,68,68,0.06)" strokeWidth={0} />
            )}
            <ReferenceLine x={nowMs} stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'} strokeDasharray="2 2"
              label={{ value: 'now', position: 'insideTopRight', fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} />
            <ReferenceLine x={deadlineMs} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3"
              label={{ value: 'deadline', position: 'insideTopLeft', fill: '#f87171', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtDate}
              tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{
                background: isDark ? 'rgba(13,17,23,0.96)' : 'rgba(248,250,252,0.96)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8, fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              }}
              labelFormatter={(t) => new Date(t as number).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric' })}
              formatter={(val: number | null, name: string) => val === null ? ['—', name] : [`${Math.round(val)}%`, name === 'expected' ? 'Expected' : name === 'actual' ? 'Actual' : 'Projected']}
            />
            <Line type="monotone" dataKey="expected" name="expected" stroke={expectedColor} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="projected" name="projected" stroke={accent} strokeWidth={1.5} strokeDasharray="3 4" dot={false} connectNulls opacity={0.5} isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" name="actual" stroke={accent} strokeWidth={2.5} dot={{ r: 2.5, fill: accent, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls isAnimationActive animationDuration={800} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Projection footer */}
      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg"
        style={{ background: `${accent}10`, border: `1px solid ${accent}28` }}>
        <Flag size={11} style={{ color: accent }} />
        <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{projLabel}</span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
          {m.actual}% of 100% · {m.daysToDeadline > 0 ? `${m.daysToDeadline}d left` : 'due now'}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 justify-center">
        <LegendDot color={accent} label="Actual" solid />
        <LegendDot color={expectedColor} label="Expected" />
        {projectedMs && <LegendDot color={accent} label="Projected" dashed />}
      </div>
    </div>
  );
};

const Readout: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode; sub: string }> = ({ label, value, color, icon, sub }) => (
  <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
    <div className="flex items-center gap-1 mb-0.5">
      <span style={{ color }}>{icon}</span>
      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
    </div>
    <div className="font-bold font-mono text-sm leading-none" style={{ color }}>{value}</div>
    <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>{sub}</div>
  </div>
);

const LegendDot: React.FC<{ color: string; label: string; solid?: boolean; dashed?: boolean }> = ({ color, label }) => (
  <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
    <span className="inline-block w-3 h-px" style={{ background: color }} /> {label}
  </span>
);

export default PaceChart;
