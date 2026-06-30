/**
 * CommandDay.tsx — Redesigned
 * Full operations timeline with task detail modal, drag-to-complete,
 * live NOW marker, capacity bar, AI rebalance, and energy-mode grouping.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarRange, Zap, RefreshCw, Coffee, Code, FileText, GitBranch, Layers,
  CheckCircle2, Sparkles, Clock, Gauge, Brain, Bot, ChevronRight,
  AlertTriangle, Target, TrendingUp, X, ArrowLeft, Activity,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import {
  fetchDayPlan, rebalanceDayPlan, fetchTasks,
  updateTask as apiUpdateTask, completeTask as apiCompleteTask,
  createAgentLogEntry,
} from '../api';
import InfoTooltip from './InfoTooltip';
import TaskDetailModal from './TaskDetailModal';
import type { DayPlan, DayBlock, PaceStatus, TaskType, Task } from '../types';
import { fmtHours, computePaceMetrics } from '../data';

const STATUS_ACCENT: Record<PaceStatus, string> = {
  GREEN: '#22c55e', AMBER: '#f59e0b', RED: '#ef4444', COMPLETE: '#52525b', failed: '#71717a',
};
const STATUS_RGB: Record<PaceStatus, string> = {
  GREEN: '34,197,94', AMBER: '245,158,11', RED: '239,68,68', COMPLETE: '82,82,91', failed: '113,113,122',
};
const TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  CODE: <Code size={11} />, WRITING: <FileText size={11} />,
  DIAGRAM: <GitBranch size={11} />, OTHER: <Layers size={11} />,
};
const ENERGY_COLOR: Record<string, string> = {
  'Deep Focus': '#38bdf8', 'Quick Wins': '#22c55e', 'Brain-Dead': '#94a3b8', '': '#94a3b8',
};

const PX_PER_MIN = 1.35;

function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')}${ap}`;
}

// ── Block detail side panel ───────────────────────────────────────────────────
const BlockDetailPanel: React.FC<{
  block: DayBlock;
  task: Task | null;
  isDark: boolean;
  onClose: () => void;
  onOpenTaskModal: (task: Task) => void;
  onComplete: () => void;
  isDone: boolean;
}> = ({ block, task, isDark, onClose, onOpenTaskModal, onComplete, isDone }) => {
  const accent = STATUS_ACCENT[block.status] || '#22c55e';
  const rgb = STATUS_RGB[block.status] || '34,197,94';
  const pace = task ? computePaceMetrics(task) : null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="fixed right-0 top-0 h-full z-40 flex flex-col"
      style={{
        width: 340,
        background: isDark ? 'rgba(10,14,20,0.99)' : 'rgba(248,250,252,0.99)',
        borderLeft: `1px solid rgba(${rgb},0.25)`,
        backdropFilter: 'blur(24px)',
        boxShadow: `-20px 0 60px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)'}`,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* accent top bar */}
      <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />

      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}` }}>
        <div className="flex items-center gap-2">
          <span style={{ color: accent }}>{block.taskType ? TYPE_ICONS[block.taskType] : <Target size={11} />}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
            Focus Block
          </span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-faint)' }}>
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* title + time */}
        <div>
          <h3 className="font-bold text-base leading-snug mb-1" style={{ color: 'var(--text-primary)' }}>
            {block.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              <Clock size={10} /> {fmt12(block.start)} – {fmt12(block.end)}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: `rgba(${rgb},0.1)`, color: accent, border: `1px solid rgba(${rgb},0.22)` }}>
              {block.durationMins}m
            </span>
            {block.energyLevel && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: `${ENERGY_COLOR[block.energyLevel]}14`, color: ENERGY_COLOR[block.energyLevel], border: `1px solid ${ENERGY_COLOR[block.energyLevel]}28` }}>
                <Brain size={9} /> {block.energyLevel}
              </span>
            )}
          </div>
        </div>

        {/* progress bar */}
        {block.completionPercent !== undefined && (
          <div>
            <div className="flex justify-between text-[10px] font-mono mb-1.5" style={{ color: 'var(--text-faint)' }}>
              <span>Progress</span>
              <span style={{ color: accent }}>{block.completionPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                animate={{ width: `${block.completionPercent}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: `linear-gradient(90deg,${accent}88,${accent})` }} />
            </div>
          </div>
        )}

        {/* pace metrics from task */}
        {pace && (
          <div className="rounded-xl p-3 space-y-2.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}` }}>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Live Pace</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Required', value: `${fmtHours(pace.requiredHoursPerDay)}/d`, color: accent },
                { label: 'Drift', value: `${pace.drift > 0 ? '+' : ''}${pace.drift}%`, color: pace.drift >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'On-Time', value: `${pace.finishProbability ?? 50}%`, color: (pace.finishProbability ?? 50) >= 70 ? '#22c55e' : '#f59e0b' },
                { label: 'Consistency', value: `${pace.consistency}%`, color: pace.consistency >= 70 ? '#22c55e' : '#f59e0b' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg p-2" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                  <div className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-faint)' }}>{label}</div>
                  <div className="text-sm font-black font-mono" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* drift explanation */}
        {task?.driftExplanation && (
          <div className="rounded-xl p-3"
            style={{ background: `rgba(${rgb},0.06)`, border: `1px solid rgba(${rgb},0.15)` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Activity size={10} style={{ color: accent }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accent }}>Velocity Signal</span>
            </div>
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {task.driftExplanation}
            </p>
          </div>
        )}
      </div>

      {/* footer actions */}
      <div className="px-5 py-4 shrink-0 space-y-2"
        style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}` }}>
        {task && (
          <motion.button onClick={() => onOpenTaskModal(task)}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.22)`, color: accent }}>
            <TrendingUp size={13} /> Open Full Task Detail
            <ChevronRight size={12} className="ml-auto" />
          </motion.button>
        )}
        {!isDone ? (
          <motion.button onClick={onComplete}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000', boxShadow: '0 0 16px rgba(34,197,94,0.25)' }}>
            <CheckCircle2 size={13} /> Mark Block Complete
          </motion.button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs"
            style={{ background: isDark ? 'rgba(82,82,91,0.1)' : 'rgba(0,0,0,0.04)', color: 'var(--text-faint)' }}>
            <CheckCircle2 size={13} style={{ color: '#22c55e' }} /> Completed
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ── Capacity bar ──────────────────────────────────────────────────────────────
const CapacityBar: React.FC<{ plan: DayPlan; isDark: boolean }> = ({ plan, isDark }) => {
  const { summary } = plan;
  const over = summary.loadPercent > 100;
  const loadColor = summary.loadPercent > 100 ? '#ef4444' : summary.loadPercent > 80 ? '#f59e0b' : '#22c55e';
  const STATS = [
    { icon: Gauge,        label: 'Day Load',       value: `${summary.loadPercent}%`,                             color: loadColor,           tip: 'Focus hours as % of your 8h/day capacity.' },
    { icon: Clock,        label: 'Focus Required',  value: fmtHours(summary.requiredHours),                      color: '#f59e0b',            tip: null },
    { icon: CalendarRange,label: 'Capacity',        value: fmtHours(summary.capacityHours),                      color: '#38bdf8',            tip: null },
    { icon: Layers,       label: 'Scheduled',       value: `${summary.scheduledCount}/${summary.taskCount}`,      color: 'var(--text-primary)',tip: null },
  ];
  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {STATS.map(({ icon: Icon, label, value, color, tip }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl p-4"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={11} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
              {tip && <InfoTooltip explanation={tip} />}
            </div>
            <div className="font-black font-mono text-xl leading-none" style={{ color }}>{value}</div>
          </motion.div>
        ))}
      </div>
      <div className="rounded-full h-2 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }}>
        <motion.div className="h-full rounded-full"
          initial={{ width: 0 }} animate={{ width: `${Math.min(summary.loadPercent, 100)}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: over ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#22c55e,#16a34a)' }} />
      </div>
      {over && (
        <div className="flex items-center gap-1.5 mt-2">
          <AlertTriangle size={11} style={{ color: '#ef4444' }} />
          <span className="text-[11px] font-mono" style={{ color: '#f87171' }}>
            Over capacity by {Math.round(summary.requiredHours - summary.capacityHours)}h — rebalance or defer a task.
          </span>
        </div>
      )}
    </div>
  );
};

// ── Single timeline block ─────────────────────────────────────────────────────
const TimelineBlock: React.FC<{
  block: DayBlock; startMins: number; index: number;
  isLive: boolean; isDone: boolean; isDark: boolean;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ block, startMins, index, isLive, isDone, isDark, isSelected, onSelect }) => {
  const top    = (hhmmToMins(block.start) - startMins) * PX_PER_MIN;
  const height = Math.max(block.durationMins * PX_PER_MIN - 4, 28);
  const isBuffer = block.type === 'buffer';
  const accent = isDone ? '#22c55e' : (STATUS_ACCENT[block.status] || '#22c55e');
  const rgb    = STATUS_RGB[block.status] || '34,197,94';
  const energyColor = ENERGY_COLOR[block.energyLevel || ''] || '#94a3b8';

  if (isBuffer) {
    return (
      <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        className="absolute" style={{ top, left: 56, right: 8, height }}>
        <div className="h-full rounded-xl flex items-center gap-2 px-3"
          style={{ background: isDark ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.02)', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}` }}>
          <Coffee size={10} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{block.title}</span>
          <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--text-faint)' }}>{block.durationMins}m</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute" style={{ top, left: 56, right: 8, height }}>

      <motion.div
        whileHover={{ scale: 1.012, x: 2 }}
        onClick={onSelect}
        className="h-full rounded-2xl relative overflow-hidden cursor-pointer select-none"
        style={{
          background: isSelected
            ? (isDark ? `rgba(${rgb},0.14)` : `rgba(${rgb},0.08)`)
            : isDone
              ? (isDark ? 'rgba(34,197,94,0.07)' : 'rgba(34,197,94,0.05)')
              : (isDark ? 'rgba(14,20,28,0.98)' : 'rgba(255,255,255,0.97)'),
          border: `1px solid rgba(${rgb},${isSelected ? 0.55 : isLive ? 0.45 : 0.2})`,
          boxShadow: isSelected
            ? `0 0 0 2px rgba(${rgb},0.3), 0 4px 20px rgba(${rgb},0.15)`
            : isLive
              ? `0 0 18px rgba(${rgb},0.25)`
              : '0 1px 4px rgba(0,0,0,0.12)',
        }}
        animate={isLive && !isSelected ? { boxShadow: [`0 0 8px rgba(${rgb},0.15)`, `0 0 22px rgba(${rgb},0.35)`, `0 0 8px rgba(${rgb},0.15)`] } : {}}
        transition={isLive ? { duration: 2.4, repeat: Infinity } : {}}
      >
        {/* left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accent }} />
        {/* completion fill */}
        {!isDone && block.completionPercent ? (
          <div className="absolute left-0 top-0 bottom-0 opacity-[0.18]"
            style={{ width: `${block.completionPercent}%`, background: `linear-gradient(90deg,${accent}cc,${accent}44)` }} />
        ) : null}

        <div className="relative h-full pl-4 pr-3 py-2 flex flex-col justify-center">
          <div className="flex items-center gap-2 min-w-0">
            {block.taskType && <span style={{ color: accent, flexShrink: 0 }}>{TYPE_ICONS[block.taskType]}</span>}
            <span className="text-xs font-semibold leading-snug flex-1"
              style={{
                color: isDone ? 'var(--text-faint)' : 'var(--text-primary)',
                textDecoration: isDone ? 'line-through' : 'none',
                wordBreak: 'break-word',
              }}>
              {block.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {isLive && !isDone && (
                <motion.span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                  animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
                  LIVE
                </motion.span>
              )}
              {isDone
                ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                : <ChevronRight size={12} style={{ color: `rgba(${rgb},0.45)` }} />
              }
            </div>
          </div>
          {height > 42 && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[9px] font-mono" style={{ color: isLive ? '#f87171' : 'var(--text-faint)' }}>
                {fmt12(block.start)}–{fmt12(block.end)}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-faint)' }}>
                {block.durationMins}m
              </span>
              {block.energyLevel && (
                <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: `${energyColor}12`, color: energyColor, border: `1px solid ${energyColor}25` }}>
                  <Brain size={8} /> {block.energyLevel}
                </span>
              )}
              {block.completionPercent !== undefined && block.completionPercent > 0 && !isDone && (
                <span className="text-[9px] font-mono" style={{ color: accent }}>{block.completionPercent}% done</span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const CommandDay: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { award } = useCredits();

  const [plan, setPlan]           = useState<DayPlan | null>(null);
  const [allTasks, setAllTasks]   = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rebalancing, setRebalancing] = useState(false);
  const [note, setNote]           = useState<string | null>(null);
  const [autoNote, setAutoNote]   = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [nowMins, setNowMins]     = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  const [selectedBlock, setSelectedBlock] = useState<DayBlock | null>(null);
  const [detailTask, setDetailTask]       = useState<Task | null>(null);
  const autoRebalancedRef = useRef(false);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, tasks] = await Promise.all([fetchDayPlan(), fetchTasks()]);
      setPlan(p);
      setAllTasks(tasks);
      const redCount = p.blocks.filter(b => b.type === 'focus' && b.status === 'RED').length;
      if (redCount > 0 && !autoRebalancedRef.current) {
        autoRebalancedRef.current = true;
        setTimeout(async () => {
          try {
            const rebalanced = await rebalanceDayPlan();
            setPlan(rebalanced);
            const msg = rebalanced.note || 'Focus blocks reorganized by energy level.';
            setAutoNote(msg);
            setTimeout(() => setAutoNote(null), 8000);
            createAgentLogEntry({
              featureKey: 'rebalance',
              title: `Auto-rebalanced — ${redCount} critical task${redCount !== 1 ? 's' : ''} detected`,
              reasoning: `Command Day detected ${redCount} RED-status task${redCount !== 1 ? 's' : ''} on load and autonomously reorganized the day.`,
              outcome: msg, autonomy: 'autonomous', undoable: false,
              relatedTaskId: null, relatedTaskName: null,
              metadata: { redCount, trigger: 'page_load_slippage_detection' },
            }).catch(() => {});
          } catch { /* non-fatal */ }
        }, 1800);
      }
    } catch { setPlan(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    } finally { setRebalancing(false); }
  };

  const handleCompleteBlock = useCallback((block: DayBlock) => {
    if (block.type !== 'focus' || !block.taskId || completed.has(block.id)) return;
    setCompleted(prev => new Set(prev).add(block.id));
    apiCompleteTask(block.taskId)
      .then(({ creditAward }) => {
        if (creditAward?.credits > 0) award('task_complete', creditAward.credits);
      })
      .catch(() => { apiUpdateTask(block.taskId!, { status: 'COMPLETE' as PaceStatus }).catch(() => {}); });
  }, [completed, award]);

  const handleSelectBlock = useCallback((block: DayBlock) => {
    if (block.type === 'buffer') return;
    setSelectedBlock(prev => prev?.id === block.id ? null : block);
  }, []);

  // find matching task for selected block
  const selectedTask = useMemo(() => {
    if (!selectedBlock?.taskId) return null;
    return allTasks.find(t => t.id === selectedBlock.taskId) ?? null;
  }, [selectedBlock, allTasks]);

  const startMins = plan ? hhmmToMins(plan.workStart) : 9 * 60;
  const endMins   = plan ? hhmmToMins(plan.workEnd)   : 21 * 60;
  const totalMins = Math.max(endMins - startMins, 60);
  const timelineHeight = totalMins * PX_PER_MIN;

  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    const firstHour = Math.ceil(startMins / 60) * 60;
    for (let m = firstHour; m <= endMins; m += 60) ticks.push(m);
    return ticks;
  }, [startMins, endMins]);

  const nowVisible = nowMins >= startMins && nowMins <= endMins;
  const nowTop = (nowMins - startMins) * PX_PER_MIN;

  const liveBlockId = useMemo(() => {
    if (!plan) return null;
    return plan.blocks.find(b => {
      const s = hhmmToMins(b.start), e = hhmmToMins(b.end);
      return nowMins >= s && nowMins < e;
    })?.id ?? null;
  }, [plan, nowMins]);

  // summary stats for the day
  const focusBlocks = plan?.blocks.filter(b => b.type === 'focus') ?? [];
  const doneCount   = focusBlocks.filter(b => completed.has(b.id)).length;
  const critCount   = focusBlocks.filter(b => b.status === 'RED' && !completed.has(b.id)).length;

  return (
    <div className="relative min-h-screen flex flex-col" onClick={() => setSelectedBlock(null)}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 px-5 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3"
        style={{ background: isDark ? 'rgba(13,17,23,0.95)' : 'rgba(248,250,252,0.95)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${divider}` }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <CalendarRange size={12} style={{ color: '#22c55e' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Command Day</span>
            {critCount > 0 && (
              <motion.span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                {critCount} critical
              </motion.span>
            )}
          </div>
          <h1 className="font-bold text-lg leading-none" style={{ color: 'var(--text-primary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* session progress */}
          {!loading && focusBlocks.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: isDark ? 'rgba(34,197,94,0.07)' : 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
              <span className="text-[10px] font-mono font-semibold" style={{ color: '#4ade80' }}>
                {doneCount}/{focusBlocks.length} done
              </span>
            </div>
          )}
          <motion.button onClick={handleRebalance}
            disabled={rebalancing || loading || !plan?.blocks.length}
            data-tour="tour-command-day-rebalance"
            whileHover={!rebalancing ? { scale: 1.04 } : {}}
            whileTap={!rebalancing ? { scale: 0.96 } : {}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={rebalancing || loading || !plan?.blocks.length
              ? { background: surfaceBg, color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, opacity: 0.5 }
              : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)', boxShadow: '0 0 0 1px rgba(34,197,94,0.15), 0 0 12px rgba(34,197,94,0.12)' }}>
            {rebalancing
              ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              : <Sparkles size={12} />}
            <span className="hidden sm:inline">AI Rebalance</span>
          </motion.button>
          <motion.button onClick={load} whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
            <RefreshCw size={13} />
          </motion.button>
        </div>
      </div>

      {/* ── Banners ────────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-6 pt-4">
        <AnimatePresence>
          {note && (
            <motion.div key="note" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mb-4 flex items-start gap-2 px-4 py-3 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)' }}>
              <Sparkles size={12} style={{ color: '#22c55e', marginTop: 1, flexShrink: 0 }} />
              <span className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{note}</span>
            </motion.div>
          )}
          {autoNote && (
            <motion.div key="autonote" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
              <div data-tour="tour-command-day-rebalance" className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Bot size={12} style={{ color: '#f87171', marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>AUTONOMOUS</span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>acted without being asked</span>
                  </div>
                  <span className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{autoNote}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-5 sm:px-6 pb-16" onClick={e => e.stopPropagation()}>
        {plan && <CapacityBar plan={plan} isDark={isDark} />}

        {loading && (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <motion.div className="w-12 h-12 rounded-full border-2 border-green-400 border-t-transparent"
              animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
            <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>Building your day...</span>
          </div>
        )}

        {!loading && plan && plan.blocks.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 rounded-2xl"
            style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
            <CalendarRange size={28} className="text-green-500 opacity-30" />
            <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>No active tasks to schedule</span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Add tasks on the Dashboard and they'll appear here.</span>
          </div>
        )}

        {!loading && plan && plan.blocks.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
            {/* timeline header */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `1px solid ${divider}` }}>
              <div className="flex items-center gap-2">
                <Clock size={11} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  {fmt12(plan.workStart)} — {fmt12(plan.workEnd)}
                </span>
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  · click any block to inspect
                </span>
              </div>
              <div className="flex items-center gap-3">
                {[['#38bdf8','Deep Focus'],['#22c55e','Quick Wins'],['#94a3b8','Buffer']].map(([c,l]) => (
                  <span key={l} className="hidden sm:flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>

            {/* timeline body */}
            <div className="relative px-4 sm:px-6 py-5">
              <div className="relative" style={{ height: timelineHeight, minHeight: 200 }}>
                {/* hour gridlines */}
                {hourTicks.map(m => {
                  const top = (m - startMins) * PX_PER_MIN;
                  return (
                    <div key={m} className="absolute left-0 right-0 flex items-center pointer-events-none" style={{ top }}>
                      <span className="w-14 shrink-0 text-right pr-3 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                        {fmt12(`${String(Math.floor(m / 60)).padStart(2,'0')}:00`)}
                      </span>
                      <div className="flex-1 h-px" style={{ background: divider }} />
                    </div>
                  );
                })}

                {/* LIVE NOW marker */}
                {nowVisible && (
                  <motion.div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none" style={{ top: nowTop }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="w-14 shrink-0 flex justify-end pr-2">
                      <motion.span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#ef4444', color: '#fff' }}
                        animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
                        NOW
                      </motion.span>
                    </div>
                    <div className="flex-1 relative">
                      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,#ef4444,rgba(239,68,68,0.08))' }} />
                      <motion.div className="absolute -left-0.5 -top-[3px] w-2 h-2 rounded-full" style={{ background: '#ef4444' }}
                        animate={{ boxShadow: ['0 0 0 rgba(239,68,68,0.6)','0 0 10px rgba(239,68,68,0.9)','0 0 0 rgba(239,68,68,0.6)'] }}
                        transition={{ duration: 1.8, repeat: Infinity }} />
                    </div>
                  </motion.div>
                )}

                {/* Blocks */}
                {plan.blocks.map((block, i) => (
                  <TimelineBlock key={block.id} block={block} startMins={startMins} index={i}
                    isLive={block.id === liveBlockId}
                    isDone={completed.has(block.id)}
                    isDark={isDark}
                    isSelected={selectedBlock?.id === block.id}
                    onSelect={() => handleSelectBlock(block)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Block detail side panel ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedBlock && (
          <BlockDetailPanel
            key={selectedBlock.id}
            block={selectedBlock}
            task={selectedTask}
            isDark={isDark}
            onClose={() => setSelectedBlock(null)}
            onOpenTaskModal={(task) => { setDetailTask(task); setSelectedBlock(null); }}
            onComplete={() => { handleCompleteBlock(selectedBlock); }}
            isDone={completed.has(selectedBlock.id)}
          />
        )}
      </AnimatePresence>

      {/* ── Full task detail modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {detailTask && (
          <TaskDetailModal
            task={detailTask}
            isDark={isDark}
            onClose={() => setDetailTask(null)}
            onMarkComplete={() => {
              setCompleted(prev => {
                const b = plan?.blocks.find(bl => bl.taskId === detailTask.id);
                if (b) { const n = new Set(prev); n.add(b.id); return n; }
                return prev;
              });
              setDetailTask(null);
            }}
            onProgressUpdate={pct => {
              setAllTasks(prev => prev.map(t => t.id === detailTask.id ? { ...t, completionPercent: pct } : t));
            }}
            onTaskUpdate={updated => {
              setAllTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
              setDetailTask(updated);
            }}
            onNegotiate={() => setDetailTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CommandDay;
