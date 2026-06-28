/**
 * PaceChart.tsx — Velocity-grade pace visualization
 * ─────────────────────────────────────────────────────────────────────────────
 * Redesigned for Velocity's pace-centric identity. The chart reads like a
 * speedometer transcript — not just "are you ahead or behind" but HOW you got
 * here and WHERE you're heading at this velocity.
 *
 *   compact = true  → streamlined card version with glow fill + projection ghost
 *   compact = false → full modal version with axes, tooltip, metric pills,
 *                     finish probability arc, and projected-finish callout
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Flag, Gauge, Activity } from 'lucide-react';
import type { Task, PaceMetrics } from '../types';
import { computePaceMetrics } from '../data';

const DAY = 86400000;

const STATUS_COLOR: Record<string, string> = {
  GREEN:    '#22c55e',
  AMBER:    '#f59e0b',
  RED:      '#ef4444',
  COMPLETE: '#22c55e',
  failed:   '#71717a',
};

interface PaceChartProps {
  task: Task;
  isDark?: boolean;
  compact?: boolean;
  metrics?: PaceMetrics;
}

// ── Data builder ──────────────────────────────────────────────────────────────
function buildChartData(task: Task, m: PaceMetrics) {
  const createdAt = new Date((task as Task & { createdAt?: string }).createdAt || Date.now()).getTime();
  const deadline  = new Date(task.deadline).getTime();
  const now       = Date.now();
  const span      = Math.max(deadline - createdAt, DAY * 0.1);
  const lin       = (t: number) => Math.max(0, Math.min(100, ((t - createdAt) / span) * 100));

  type Row = { t: number; expected: number | null; actual: number | null; projected: number | null; fill: number | null };
  const rows: Row[] = [];

  rows.push({ t: createdAt, expected: 0, actual: 0, projected: null, fill: 0 });

  (task.sparkline || [])
    .filter(p => p.timestamp)
    .map(p => ({ t: new Date(p.timestamp as string).getTime(), v: p.value }))
    .sort((a, b) => a.t - b.t)
    .forEach(p => rows.push({ t: p.t, expected: lin(p.t), actual: p.v, projected: null, fill: null }));

  rows.push({ t: now, expected: lin(now), actual: m.actual, projected: m.actual, fill: m.actual });

  const projFinish = m.projectedFinish ? new Date(m.projectedFinish).getTime() : null;
  let projMs: number | null = null;
  if (projFinish && m.actual < 100) {
    projMs = Math.min(projFinish, deadline + span * 0.5);
    rows.push({ t: projMs, expected: null, actual: null, projected: 100, fill: null });
  }

  rows.push({ t: deadline, expected: 100, actual: null, projected: null, fill: null });
  rows.sort((a, b) => a.t - b.t);

  return { data: rows, deadlineMs: deadline, nowMs: now, projectedMs: projMs };
}

// ── Finish probability arc (SVG) ──────────────────────────────────────────────
const FinishArc: React.FC<{ probability: number; color: string; isDark: boolean }> = ({ probability, color, isDark }) => {
  const R = 20, cx = 26, cy = 26;
  const startAngle = -210; // degrees, measured from 3-o'clock
  const sweepAngle = 240;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const arcPath = (start: number, sweep: number) => {
    const a1 = toRad(start);
    const a2 = toRad(start + sweep);
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2);
    const y2 = cy + R * Math.sin(a2);
    const large = sweep > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const fillSweep = (probability / 100) * sweepAngle;

  return (
    <svg width={52} height={52} viewBox="0 0 52 52">
      {/* Track */}
      <path d={arcPath(startAngle, sweepAngle)} fill="none"
        stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}
        strokeWidth={3.5} strokeLinecap="round" />
      {/* Fill */}
      <motion.path
        d={arcPath(startAngle, fillSweep)}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
      />
      {/* Center value */}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontFamily="JetBrains Mono, monospace" fontWeight="700" fill={color}>
        {probability}%
      </text>
    </svg>
  );
};

// ── Metric pill ───────────────────────────────────────────────────────────────
const MetricPill: React.FC<{
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}> = ({ label, value, sub, color, icon }) => (
  <div className="flex-1 rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
    style={{
      background: `${color}0d`,
      border: `1px solid ${color}22`,
    }}>
    <div className="flex items-center gap-1.5 mb-0.5">
      <span style={{ color, opacity: 0.8 }}>{icon}</span>
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: `${color}88` }}>{label}</span>
    </div>
    <div className="font-black font-mono text-sm leading-none" style={{ color }}>{value}</div>
    <div className="text-[9px] font-mono mt-0.5" style={{ color: `${color}66` }}>{sub}</div>
  </div>
);

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: number;
  isDark: boolean;
}> = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length || label === undefined) return null;
  const date = new Date(label as number).toLocaleString('en', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return (
    <div style={{
      background: isDark ? 'rgba(10,14,20,0.97)' : 'rgba(248,250,252,0.97)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 10, padding: '8px 12px',
      backdropFilter: 'blur(16px)',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.12)',
      fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
    }}>
      <div style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.4)', marginBottom: 6, fontSize: 10 }}>
        {date}
      </div>
      {payload.map(p => p.value !== null && (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.5)' }}>
            {p.name === 'expected' ? 'Expected' : p.name === 'actual' ? 'Actual' : 'Projected'}:
          </span>
          <span style={{ color: p.color, fontWeight: 700, marginLeft: 2 }}>{Math.round(p.value as number)}%</span>
        </div>
      ))}
    </div>
  );
};

// ── Legend item ───────────────────────────────────────────────────────────────
const LegendItem: React.FC<{ color: string; label: string; dashed?: boolean }> = ({ color, label, dashed }) => (
  <span className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
    <span style={{
      display: 'inline-block', width: 16, height: 2,
      background: dashed ? 'none' : color,
      borderTop: dashed ? `2px dashed ${color}` : 'none',
    }} />
    {label}
  </span>
);

// ── Main component ─────────────────────────────────────────────────────────────
const PaceChart: React.FC<PaceChartProps> = ({ task, isDark = true, compact = false, metrics }) => {
  const m = metrics ?? computePaceMetrics(task);
  const accent = STATUS_COLOR[m.status] || '#22c55e';

  const { data, deadlineMs, nowMs, projectedMs } = useMemo(
    () => buildChartData(task, m),
    [task, m]
  );

  const gradId   = `pace-fill-${task.id}`;
  const projGrad = `pace-proj-${task.id}`;
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  const expectedColor = isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.5)';
  const fmtDate = (t: number) => new Date(t).toLocaleDateString('en', { month: 'numeric', day: 'numeric' });

  // ── Compact ──────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div style={{ width: '100%', height: 52 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 3, right: 3, bottom: 0, left: 3 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Danger zone — past deadline */}
            {projectedMs && projectedMs > deadlineMs && (
              <ReferenceArea x1={deadlineMs} x2={projectedMs}
                fill="rgba(239,68,68,0.05)" strokeWidth={0} />
            )}

            {/* Expected baseline */}
            <Line type="monotone" dataKey="expected"
              stroke={expectedColor} strokeWidth={1} strokeDasharray="3 4"
              dot={false} isAnimationActive={false} connectNulls />

            {/* Actual fill area */}
            <Area type="monotone" dataKey="actual"
              stroke={accent} strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={false} connectNulls
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out" />

            {/* Projected ghost */}
            <Line type="monotone" dataKey="projected"
              stroke={accent} strokeWidth={1.5} strokeDasharray="2 4"
              dot={false} connectNulls opacity={0.45}
              isAnimationActive={false} />

            {/* Now marker */}
            <ReferenceLine x={nowMs}
              stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}
              strokeWidth={1} />

            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
            <YAxis domain={[0, 100]} hide />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Full (modal) ──────────────────────────────────────────────────────────
  const driftColor = m.drift >= -3 ? '#22c55e' : m.drift >= -15 ? '#f59e0b' : '#ef4444';
  const consColor  = m.consistency >= 70 ? '#22c55e' : m.consistency >= 45 ? '#f59e0b' : '#ef4444';
  const DriftIcon  = m.drift > 3 ? TrendingUp : m.drift < -3 ? TrendingDown : Minus;

  const prob = m.finishProbability ?? 50;
  const probColor = prob >= 70 ? '#22c55e' : prob >= 45 ? '#f59e0b' : '#ef4444';

  const projLabel = m.actual >= 100
    ? 'Completed'
    : m.willFinishOnTime
      ? 'On track to finish on time'
      : m.projectedFinish
        ? (() => {
            const diff = Math.abs(Math.round((new Date(m.projectedFinish).getTime() - deadlineMs) / DAY));
            return `Projected ${diff}d ${new Date(m.projectedFinish).getTime() > deadlineMs ? 'late' : 'early'}`;
          })()
        : 'Not enough data yet';

  return (
    <div className="space-y-3">
      {/* ── Metric pills ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <MetricPill
          label="Drift"
          value={`${m.drift > 0 ? '+' : ''}${m.drift}%`}
          sub={m.drift >= 0 ? 'ahead of pace' : 'behind pace'}
          color={driftColor}
          icon={<DriftIcon size={10} />}
        />
        <MetricPill
          label="Velocity"
          value={`${m.velocityRate}%`}
          sub={`need ${m.requiredRate}%/d`}
          color="#38bdf8"
          icon={<Gauge size={10} />}
        />
        <MetricPill
          label="Consistency"
          value={`${m.consistency}%`}
          sub="pace steadiness"
          color={consColor}
          icon={<Activity size={10} />}
        />

        {/* Finish probability arc */}
        <div className="flex flex-col items-center justify-center rounded-xl px-2 py-1.5"
          style={{ background: `${probColor}0d`, border: `1px solid ${probColor}22`, minWidth: 60 }}>
          <FinishArc probability={prob} color={probColor} isDark={isDark} />
          <span className="text-[8px] font-mono uppercase tracking-wider mt-0.5"
            style={{ color: `${probColor}77` }}>
            on-time
          </span>
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                <stop offset="60%" stopColor={accent} stopOpacity={0.08} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={projGrad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.12} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
              <filter id={`glow-${task.id}`}>
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <CartesianGrid horizontal vertical={false} stroke={gridColor} strokeDasharray="2 4" />

            {/* Miss zone — past deadline red shading */}
            {projectedMs && projectedMs > deadlineMs && (
              <ReferenceArea x1={deadlineMs} x2={projectedMs}
                fill="rgba(239,68,68,0.06)" strokeWidth={0} />
            )}

            {/* Deadline line */}
            <ReferenceLine x={deadlineMs}
              stroke="rgba(239,68,68,0.45)" strokeDasharray="3 3" strokeWidth={1.5}
              label={{ value: 'deadline', position: 'insideTopLeft',
                fill: '#f87171', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }} />

            {/* Now line */}
            <ReferenceLine x={nowMs}
              stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'}
              strokeDasharray="2 3" strokeWidth={1}
              label={{ value: 'now', position: 'insideTopRight',
                fill: 'var(--text-faint)', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }} />

            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
              tickFormatter={fmtDate} tickLine={false} axisLine={false}
              tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false}
              tick={{ fill: 'var(--text-faint)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={(v) => `${v}%`} />

            <Tooltip content={<ChartTooltip isDark={isDark} />} />

            {/* Expected pace line */}
            <Line type="monotone" dataKey="expected" name="expected"
              stroke={expectedColor} strokeWidth={1.5} strokeDasharray="4 5"
              dot={false} connectNulls isAnimationActive={false} />

            {/* Projected fill area (ghost) */}
            <Area type="monotone" dataKey="projected" name="projected"
              stroke={accent} strokeWidth={1.5} strokeDasharray="2 5"
              fill={`url(#${projGrad})`}
              dot={false} connectNulls opacity={0.55}
              isAnimationActive={false} />

            {/* Actual progress — filled area + glowing line */}
            <Area type="monotone" dataKey="actual" name="actual"
              stroke={accent} strokeWidth={3}
              fill={`url(#${gradId})`}
              dot={false} connectNulls
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
              activeDot={{ r: 4, fill: accent, strokeWidth: 2, stroke: isDark ? '#0d1117' : '#fff' }}
              style={{ filter: `drop-shadow(0 0 4px ${accent}55)` }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Projection footer ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: `${accent}0c`, border: `1px solid ${accent}22` }}>
        <Flag size={10} style={{ color: accent }} />
        <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{projLabel}</span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
          {m.actual}% done · {m.daysToDeadline > 0 ? `${m.daysToDeadline}d left` : 'due now'}
        </span>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 justify-center">
        <LegendItem color={accent} label="Actual" />
        <LegendItem color={expectedColor} label="Expected" dashed />
        {projectedMs && <LegendItem color={accent} label="Projected" dashed />}
      </div>
    </div>
  );
};

export default PaceChart;
