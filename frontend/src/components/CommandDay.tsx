/**
 * CommandDay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The Command Day View — your entire day laid out as one live operations
 * timeline. Proportional time gutter, LIVE-NOW marker, urgency-coloured focus
 * blocks, recovery buffers, an AI "Rebalance my day" action, and one-tap block
 * completion that awards Velocity Credits.
 *
 * Built entirely on the existing design system (surface cards, mono labels,
 * status palette, [0.16,1,0.3,1] easing).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarRange, Zap, RefreshCw, Coffee, Code, FileText, GitBranch, Layers,
  CheckCircle2, Sparkles, Clock, Gauge, Brain, Bot,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import { fetchDayPlan, rebalanceDayPlan, updateTask as apiUpdateTask, completeTask as apiCompleteTask, createAgentLogEntry } from '../api';
import type { DayPlan, DayBlock, PaceStatus, TaskType } from '../types';

const STATUS_ACCENT: Record<PaceStatus, string> = {
  GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444', COMPLETE: '#52525b', failed: '#71717a',
};
const STATUS_RGB: Record<PaceStatus, string> = {
  GREEN: '34,197,94', AMBER: '245,158,11', RED: '239,68,68', COMPLETE: '82,82,91', failed: '113,113,122',
};
const TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  CODE: <Code size={10} />, WRITING: <FileText size={10} />,
  DIAGRAM: <GitBranch size={10} />, OTHER: <Layers size={10} />,
};
const ENERGY_COLOR: Record<string, string> = {
  'Deep Focus': '#38bdf8', 'Quick Wins': '#22c55e', 'Brain-Dead': '#94a3b8', '': '#94a3b8',
};

const PX_PER_MIN = 1.25;

function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}

const CommandDay: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { award } = useCredits();

  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebalancing, setRebalancing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [autoNote, setAutoNote] = useState<string | null>(null); // autonomous trigger note
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [nowMins, setNowMins] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  const autoRebalancedRef = useRef(false);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const load = async () => {
    setLoading(true);
    try {
      const p = await fetchDayPlan();
      setPlan(p);

      // Phase 2 — Autonomous rebalance trigger:
      // If there are RED tasks AND we haven't auto-rebalanced this session, act immediately.
      const redCount = p.blocks.filter(b => b.type === 'focus' && b.status === 'RED').length;
      if (redCount > 0 && !autoRebalancedRef.current) {
        autoRebalancedRef.current = true;
        // Small delay so the page renders first
        setTimeout(async () => {
          try {
            const rebalanced = await rebalanceDayPlan();
            setPlan(rebalanced);
            const msg = rebalanced.note || 'Focus blocks reorganized by energy level.';
            setAutoNote(msg);
            setTimeout(() => setAutoNote(null), 8000);
            // Write to Agent Log — this IS an autonomous action
            createAgentLogEntry({
              featureKey: 'rebalance',
              title: `Auto-rebalanced ${rebalanced.blocks.filter(b => b.type === 'focus').length} focus blocks — ${redCount} critical task${redCount !== 1 ? 's' : ''} detected`,
              reasoning: `On page load, Command Day detected ${redCount} RED-status task${redCount !== 1 ? 's' : ''} in your timeline. AI automatically reorganized your day by cognitive energy without being asked — deep-focus work front-loaded, quick wins pushed to afternoon.`,
              outcome: msg,
              autonomy: 'autonomous',
              undoable: false,
              relatedTaskId: null,
              relatedTaskName: null,
              metadata: { redCount, trigger: 'page_load_slippage_detection' },
            }).catch(() => {});
          } catch {
            // Non-fatal — just don't show the note
          }
        }, 1800);
      }
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Tick the LIVE-NOW marker every 30s
  useEffect(() => {
    const t = setInterval(() => setNowMins(new Date().getHours() * 60 + new Date().getMinutes()), 30000);
    return () => clearInterval(t);
  }, []);

  const handleRebalance = async () => {
    setRebalancing(true);
    try {
      const p = await rebalanceDayPlan();
      setPlan(p);
      setNote(p.note || 'Day rebalanced.');
      award('day_rebalanced');
      setTimeout(() => setNote(null), 6000);
    } catch {
      setNote('Could not rebalance — ensure backend is running.');
      setTimeout(() => setNote(null), 4000);
    } finally {
      setRebalancing(false);
    }
  };

  const handleCompleteBlock = (block: DayBlock) => {
    if (block.type !== 'focus' || !block.taskId || completed.has(block.id)) return;
    setCompleted(prev => new Set(prev).add(block.id));
    // Mark complete on the backend and earn the pace-differential credit award
    apiCompleteTask(block.taskId)
      .then(({ creditAward }) => {
        if (creditAward && creditAward.credits > 0) award('task_complete', creditAward.credits);
      })
      .catch(() => { apiUpdateTask(block.taskId!, { status: 'COMPLETE' as PaceStatus }).catch(() => {}); });
  };

  const startMins = plan ? hhmmToMins(plan.workStart) : 9 * 60;
  const endMins   = plan ? hhmmToMins(plan.workEnd) : 21 * 60;
  const totalMins = Math.max(endMins - startMins, 60);
  const timelineHeight = totalMins * PX_PER_MIN;

  // Hour tick marks
  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    const firstHour = Math.ceil(startMins / 60) * 60;
    for (let m = firstHour; m <= endMins; m += 60) ticks.push(m);
    return ticks;
  }, [startMins, endMins]);

  const nowVisible = nowMins >= startMins && nowMins <= endMins;
  const nowTop = (nowMins - startMins) * PX_PER_MIN;

  // Which block is live right now
  const liveBlockId = useMemo(() => {
    if (!plan) return null;
    return plan.blocks.find(b => {
      const s = hhmmToMins(b.start), e = hhmmToMins(b.end);
      return nowMins >= s && nowMins < e;
    })?.id ?? null;
  }, [plan, nowMins]);

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={13} style={{ color: '#22c55e' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
            Command Day · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleRebalance}
            disabled={rebalancing || loading || !plan?.blocks.length}
            whileHover={!rebalancing ? { scale: 1.04, boxShadow: '0 0 18px rgba(34,197,94,0.3)' } : {}}
            whileTap={!rebalancing ? { scale: 0.96 } : {}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={rebalancing || loading || !plan?.blocks.length
              ? { background: surfaceBg, color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, opacity: 0.5 }
              : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
            {rebalancing
              ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              : <Sparkles size={12} />}
            <span className="hidden sm:inline">AI · Rebalance my day</span>
            <span className="sm:hidden">Rebalance</span>
          </motion.button>
          <motion.button onClick={load} whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
            <RefreshCw size={13} />
          </motion.button>
        </div>
      </div>

      {/* ── Capacity summary bar ─────────────────────────────────────────────── */}
      {plan && (
        <CapacityBar plan={plan} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} />
      )}

      {/* ── AI rebalance note (manual) ──────────────────────────────────────── */}
      <AnimatePresence>
        {note && (
          <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl overflow-hidden"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <Sparkles size={13} style={{ color: '#22c55e', marginTop: 1, flexShrink: 0 }} />
            <span className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{note}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Autonomous rebalance banner (no user trigger) ──────────────────── */}
      <AnimatePresence>
        {autoNote && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Bot size={13} style={{ color: '#f87171', marginTop: 1, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                    AUTONOMOUS
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    acted without being asked
                  </span>
                </div>
                <span className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                  {autoNote}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <motion.div className="w-12 h-12 rounded-full border-2 border-green-400 border-t-transparent"
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
          <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>Building your day...</span>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────────── */}
      {!loading && plan && plan.blocks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 rounded-2xl"
          style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
          <CalendarRange size={28} className="text-green-500 opacity-30" />
          <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>No active tasks to schedule</span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Add tasks on the Dashboard and they'll lay themselves out here.</span>
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      {!loading && plan && plan.blocks.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${divider}` }}>
            <div className="flex items-center gap-2">
              <Clock size={11} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                {fmt12(plan.workStart)} — {fmt12(plan.workEnd)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Legend color="#38bdf8" label="Deep Focus" />
              <Legend color="#22c55e" label="Quick Wins" />
              <Legend color="#94a3b8" label="Buffer" />
            </div>
          </div>

          <div className="relative px-3 sm:px-5 py-5">
            <div className="relative" style={{ height: timelineHeight, minHeight: 200 }}>
              {/* Hour gridlines + labels */}
              {hourTicks.map(m => {
                const top = (m - startMins) * PX_PER_MIN;
                return (
                  <div key={m} className="absolute left-0 right-0 flex items-center" style={{ top }}>
                    <span className="w-12 shrink-0 text-[9px] font-mono text-right pr-2" style={{ color: 'var(--text-faint)' }}>
                      {fmt12(`${String(Math.floor(m / 60)).padStart(2, '0')}:00`)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: divider }} />
                  </div>
                );
              })}

              {/* LIVE NOW marker */}
              {nowVisible && (
                <motion.div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-12 shrink-0 flex justify-end pr-1.5">
                    <motion.span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded"
                      style={{ background: '#ef4444', color: '#fff' }}
                      animate={{ opacity: [1, 0.55, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
                      NOW
                    </motion.span>
                  </div>
                  <div className="flex-1 relative">
                    <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,#ef4444,rgba(239,68,68,0.1))' }} />
                    <motion.div className="absolute -left-0.5 -top-1 w-2 h-2 rounded-full" style={{ background: '#ef4444' }}
                      animate={{ boxShadow: ['0 0 0px rgba(239,68,68,0.6)', '0 0 10px rgba(239,68,68,0.9)', '0 0 0px rgba(239,68,68,0.6)'] }}
                      transition={{ duration: 1.8, repeat: Infinity }} />
                  </div>
                </motion.div>
              )}

              {/* Blocks */}
              {plan.blocks.map((block, i) => (
                <TimelineBlock
                  key={block.id}
                  block={block}
                  startMins={startMins}
                  index={i}
                  isLive={block.id === liveBlockId}
                  isDone={completed.has(block.id)}
                  isDark={isDark}
                  onComplete={() => handleCompleteBlock(block)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Capacity summary bar ──────────────────────────────────────────────────────
const CapacityBar: React.FC<{ plan: DayPlan; isDark: boolean; surfaceBg: string; surfaceBorder: string }> = ({ plan, isDark, surfaceBg, surfaceBorder }) => {
  const { summary } = plan;
  const over = summary.loadPercent > 100;
  const loadColor = summary.loadPercent > 100 ? '#ef4444' : summary.loadPercent > 80 ? '#f59e0b' : '#22c55e';
  const STATS = [
    { icon: Gauge, label: 'Day Load', value: `${summary.loadPercent}%`, color: loadColor },
    { icon: Clock, label: 'Focus Required', value: `${summary.requiredHours}h`, color: '#f59e0b' },
    { icon: CalendarRange, label: 'Capacity', value: `${summary.capacityHours}h`, color: '#38bdf8' },
    { icon: Layers, label: 'Scheduled', value: `${summary.scheduledCount}/${summary.taskCount}`, color: 'var(--text-primary)' },
  ];
  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {STATS.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl p-3.5" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={11} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
            </div>
            <div className="font-bold font-mono text-xl" style={{ color }}>{value}</div>
          </motion.div>
        ))}
      </div>
      {/* Load meter */}
      <div className="rounded-full h-2 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }}>
        <motion.div className="h-full rounded-full"
          initial={{ width: 0 }} animate={{ width: `${Math.min(summary.loadPercent, 100)}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: over ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#22c55e,#16a34a)' }} />
      </div>
      {over && (
        <div className="flex items-center gap-1.5 mt-2">
          <Zap size={11} style={{ color: '#ef4444' }} />
          <span className="text-[11px] font-mono" style={{ color: '#f87171' }}>
            Over capacity by {Math.round(summary.requiredHours - summary.capacityHours)}h — rebalance or defer a task.
          </span>
        </div>
      )}
    </div>
  );
};

// ── A single timeline block, absolutely positioned by its start time ──────────
const TimelineBlock: React.FC<{
  block: DayBlock; startMins: number; index: number;
  isLive: boolean; isDone: boolean; isDark: boolean; onComplete: () => void;
}> = ({ block, startMins, index, isLive, isDone, isDark, onComplete }) => {
  const top = (hhmmToMins(block.start) - startMins) * PX_PER_MIN;
  const height = Math.max(block.durationMins * PX_PER_MIN - 4, 26);
  const isBuffer = block.type === 'buffer';
  const accent = isDone ? '#22c55e' : (STATUS_ACCENT[block.status] || '#22c55e');
  const rgb = STATUS_RGB[block.status] || '34,197,94';
  const energyColor = ENERGY_COLOR[block.energyLevel || ''] || '#94a3b8';

  if (isBuffer) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
        className="absolute" style={{ top, left: 48, right: 0, height }}>
        <div className="h-full ml-2 rounded-lg flex items-center gap-2 px-3"
          style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
          <Coffee size={11} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{block.title}</span>
          <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--text-faint)' }}>{block.durationMins}m</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute" style={{ top, left: 48, right: 0, height }}>
      {/* time label in gutter */}
      <span className="absolute -left-[48px] top-0 w-12 text-right pr-2 text-[9px] font-mono"
        style={{ color: isLive ? '#ef4444' : 'var(--text-muted)', fontWeight: isLive ? 700 : 400 }}>
        {fmt12(block.start)}
      </span>

      <motion.div
        whileHover={{ scale: 1.008 }}
        className="h-full ml-2 rounded-xl relative overflow-hidden cursor-pointer group"
        onClick={onComplete}
        style={{
          background: isDone
            ? (isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)')
            : (isDark ? 'rgba(14,20,28,0.98)' : 'rgba(255,255,255,0.97)'),
          border: `1px solid rgba(${rgb},${isLive ? 0.5 : 0.22})`,
          boxShadow: isLive ? `0 0 16px rgba(${rgb},0.25)` : 'none',
        }}
        animate={isLive ? { boxShadow: [`0 0 8px rgba(${rgb},0.2)`, `0 0 20px rgba(${rgb},0.4)`, `0 0 8px rgba(${rgb},0.2)`] } : {}}
        transition={isLive ? { duration: 2.4, repeat: Infinity } : {}}
      >
        {/* accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
        {/* completion fill */}
        {!isDone && block.completionPercent ? (
          <div className="absolute left-0 top-0 bottom-0 opacity-[0.06]" style={{ width: `${block.completionPercent}%`, background: accent }} />
        ) : null}

        <div className="relative h-full ml-2 px-3 py-2 flex flex-col justify-center min-h-0">
          <div className="flex items-center gap-2 min-w-0">
            {block.taskType && <span style={{ color: accent, flexShrink: 0 }}>{TYPE_ICONS[block.taskType]}</span>}
            <span className="text-xs font-semibold truncate"
              style={{ color: isDone ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
              {block.title}
            </span>
            {isLive && !isDone && (
              <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                LIVE
              </span>
            )}
            {/* complete check */}
            <span className="ml-auto shrink-0" style={{ color: isDone ? '#22c55e' : 'var(--text-faint)', opacity: isDone ? 1 : 0.4 }}>
              <CheckCircle2 size={14} />
            </span>
          </div>

          {height > 44 && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                {fmt12(block.start)}–{fmt12(block.end)} · {block.durationMins}m
              </span>
              {block.energyLevel && (
                <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: `${energyColor}14`, color: energyColor, border: `1px solid ${energyColor}28` }}>
                  <Brain size={8} /> {block.energyLevel}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
    <span className="w-2 h-2 rounded-full" style={{ background: color }} /> {label}
  </span>
);

export default CommandDay;
