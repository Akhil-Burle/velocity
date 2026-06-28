import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Clock, Brain, TrendingUp, Code, FileText, GitBranch, Layers,
  CheckCircle2, MessageSquare, Calendar, Target, Zap, Check, ListChecks,
  Plus, Trash2, Pencil, Timer, ArrowLeft, Award, Gauge, Activity,
  Hourglass, Flag, Rocket, Sparkles,
} from 'lucide-react';
import { Task, TaskType, PaceStatus, Subtask } from '../types';
import PaceChart from './PaceChart';
import { fmtHours, computePaceMetrics } from '../data';
import { updateSubtask, editSubtask, addSubtask, deleteSubtask, computeDriftScore, DriftScore } from '../api';

const STATUS_CONFIG: Record<PaceStatus, { accent: string; label: string; glowRgb: string; badgeBg: string; badgeText: string }> = {
  GREEN:   { accent: '#22c55e', label: 'On Pace',     glowRgb: '34,197,94',   badgeBg: 'rgba(34,197,94,0.1)',  badgeText: '#4ade80' },
  AMBER:   { accent: '#f59e0b', label: 'Warning',     glowRgb: '245,158,11',  badgeBg: 'rgba(245,158,11,0.1)', badgeText: '#fbbf24' },
  RED:     { accent: '#ef4444', label: 'Critical',    glowRgb: '239,68,68',   badgeBg: 'rgba(239,68,68,0.1)',  badgeText: '#f87171' },
  COMPLETE:{ accent: '#52525b', label: 'Complete',    glowRgb: '82,82,91',    badgeBg: 'rgba(82,82,91,0.1)',   badgeText: '#71717a' },
  failed:  { accent: '#71717a', label: 'Rescheduled', glowRgb: '113,113,122', badgeBg: 'rgba(82,82,91,0.1)',   badgeText: '#71717a' },
};

const TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  CODE: <Code size={13} />, WRITING: <FileText size={13} />,
  DIAGRAM: <GitBranch size={13} />, OTHER: <Layers size={13} />,
};

interface TaskDetailModalProps {
  task: Task;
  isDark?: boolean;
  onClose: () => void;
  onMarkComplete: () => void;
  onProgressUpdate: (percent: number) => void;
  onTaskUpdate?: (updatedTask: Task) => void;
  onNegotiate: () => void;
  onHotStart?: () => void;
}

// ── Subtask row ───────────────────────────────────────────────────────────────
interface SubtaskRowProps {
  subtask: Subtask; accent: string; glowRgb: string; isDark: boolean;
  ticking: boolean; disabled: boolean; dividerColor: string;
  onToggle: () => void; onEdit: (title: string, mins: number) => void; onDelete: () => void;
}
const SubtaskRow: React.FC<SubtaskRowProps> = ({
  subtask, accent, glowRgb, isDark, ticking, disabled, dividerColor,
  onToggle, onEdit, onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const [editMins, setEditMins] = useState(String(subtask.estimatedMinutes || 30));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commitEdit = () => {
    const t = editTitle.trim();
    const m = Math.max(1, parseInt(editMins) || 30);
    if (t && (t !== subtask.title || m !== subtask.estimatedMinutes)) onEdit(t, m);
    setEditing(false);
  };

  if (editing) return (
    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${dividerColor}` }}>
      <input ref={inputRef} value={editTitle} onChange={e => setEditTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
        className="flex-1 text-sm font-mono bg-transparent outline-none border-b"
        style={{ color: 'var(--text-primary)', borderColor: accent, caretColor: accent }} />
      <div className="flex items-center gap-1 shrink-0">
        <Timer size={10} style={{ color: 'var(--text-faint)' }} />
        <input value={editMins} onChange={e => setEditMins(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
          className="w-10 text-[11px] font-mono bg-transparent outline-none text-center border-b"
          style={{ color: 'var(--text-faint)', borderColor: 'rgba(255,255,255,0.12)' }} />
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>m</span>
      </div>
      <motion.button onClick={commitEdit} whileTap={{ scale: 0.9 }}
        className="text-[11px] font-mono px-2 py-0.5 rounded"
        style={{ background: `rgba(${glowRgb},0.12)`, color: accent }}>save</motion.button>
      <motion.button onClick={() => setEditing(false)} whileTap={{ scale: 0.9 }} style={{ color: 'var(--text-faint)' }}>
        <X size={12} />
      </motion.button>
    </div>
  );

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors"
      style={{ borderBottom: `1px solid ${dividerColor}` }}>
      <motion.button onClick={onToggle} disabled={disabled} whileTap={{ scale: 0.85 }}
        animate={ticking ? { scale: [1, 0.8, 1] } : {}}
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all"
        style={{
          background: subtask.completed ? `rgba(${glowRgb},0.15)` : 'transparent',
          border: subtask.completed ? `1.5px solid rgba(${glowRgb},0.5)` : `1.5px solid ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)'}`,
        }}>
        {subtask.completed && <Check size={8} style={{ color: accent }} />}
      </motion.button>
      <span className="flex-1 text-sm leading-snug" style={{
        color: subtask.completed ? 'var(--text-faint)' : 'var(--text-secondary)',
        textDecoration: subtask.completed ? 'line-through' : 'none',
      }}>{subtask.title}</span>
      {subtask.estimatedMinutes > 0 && (
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>~{subtask.estimatedMinutes}m</span>
      )}
      {!disabled && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button onClick={() => setEditing(true)} whileTap={{ scale: 0.9 }} className="p-1 rounded" style={{ color: 'var(--text-faint)' }}>
            <Pencil size={10} />
          </motion.button>
          <motion.button onClick={onDelete} whileTap={{ scale: 0.9 }} className="p-1 rounded" style={{ color: '#f87171' }}>
            <Trash2 size={10} />
          </motion.button>
        </div>
      )}
    </div>
  );
};

// ── Hero stat card ────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string;
  color: string; isDark: boolean; emphasis?: boolean;
}> = ({ icon, label, value, sub, color, isDark, emphasis }) => (
  <div className="rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 relative overflow-hidden"
    style={{
      background: emphasis ? `${color}12` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'),
      border: `1px solid ${emphasis ? `${color}33` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)')}`,
    }}>
    <div className="flex items-center gap-1.5">
      <span style={{ color }}>{icon}</span>
      <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
    </div>
    <div className="font-black font-mono leading-none" style={{ color, fontSize: emphasis ? '2rem' : '1.6rem' }}>
      {value}
    </div>
    {sub && <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
);

// ── Section card wrapper ──────────────────────────────────────────────────────
const SectionCard: React.FC<{
  icon: React.ReactNode; title: string; accent?: string; isDark: boolean;
  right?: React.ReactNode; children: React.ReactNode; bodyClass?: string; pad?: boolean;
}> = ({ icon, title, accent, isDark, right, children, bodyClass = '', pad = true }) => {
  const sectionBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.022)';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
        <div className="flex items-center gap-2">
          <span style={{ color: accent || 'var(--text-faint)' }}>{icon}</span>
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
        </div>
        {right}
      </div>
      <div className={pad ? `px-4 py-3.5 ${bodyClass}` : bodyClass}>{children}</div>
    </div>
  );
};

// ── Meta stat (small label/value row) ─────────────────────────────────────────
const MetaStat: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string }> = ({ icon, label, value, color }) => (
  <div className="flex items-center justify-between py-2">
    <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span style={{ color: 'var(--text-faint)' }}>{icon}</span>{label}
    </span>
    <span className="text-xs font-semibold font-mono" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
  </div>
);

// ══ Main modal ════════════════════════════════════════════════════════════════
const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task, isDark = true, onClose, onMarkComplete, onProgressUpdate, onTaskUpdate, onNegotiate, onHotStart,
}) => {
  const cfg = STATUS_CONFIG[task.status];
  const isComplete = task.status === 'COMPLETE';

  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? []);
  const [ticking, setTicking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [addingTitle, setAddingTitle] = useState('');
  const [addingMins, setAddingMins] = useState('30');
  const [showAddRow, setShowAddRow] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [sliderProgress, setSliderProgress] = useState(task.completionPercent);
  const [syncingSlider, setSyncingSlider] = useState(false);
  const [drift, setDrift] = useState<DriftScore | null>(null);
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  // Refs for direct DOM updates during drag — no re-render on every tick
  const modalSliderRef = useRef<HTMLInputElement>(null);
  const modalProgressBarRef = useRef<HTMLDivElement>(null);
  const modalProgressLabelRef = useRef<HTMLSpanElement>(null);
  const modalSubtaskBarRef = useRef<HTMLDivElement>(null);
  const liveSliderRef = useRef(task.completionPercent);

  const completedCount = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : null;
  const progress = sliderProgress;

  const liveTask = { ...task, subtasks, completionPercent: progress };
  const pace = computePaceMetrics(liveTask);

  // Time budgeting from subtasks
  const totalSubMins = subtasks.reduce((s, x) => s + (x.estimatedMinutes || 0), 0);
  const doneSubMins  = subtasks.filter(x => x.completed).reduce((s, x) => s + (x.estimatedMinutes || 0), 0);
  const remainingMins = totalSubMins - doneSubMins;

  useEffect(() => { if (showAddRow) addInputRef.current?.focus(); }, [showAddRow]);

  // Fetch behavioral drift (passive)
  useEffect(() => {
    let alive = true;
    computeDriftScore(task.id).then(d => { if (alive) setDrift(d); }).catch(() => {});
    return () => { alive = false; };
  }, [task.id]);

  const handleSliderChange = (val: number) => {
    liveSliderRef.current = val;
    // Direct DOM mutations during drag — zero React re-render overhead
    const pct = `${val}%`;
    const trackColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    if (modalSliderRef.current) {
      modalSliderRef.current.style.background = `linear-gradient(to right, ${cfg.accent} 0%, ${cfg.accent} ${pct}, ${trackColor} ${pct}, ${trackColor} 100%)`;
    }
    if (modalProgressBarRef.current) {
      modalProgressBarRef.current.style.width = pct;
    }
    if (modalProgressLabelRef.current) {
      modalProgressLabelRef.current.textContent = `${val}%`;
    }
    if (modalSubtaskBarRef.current) {
      modalSubtaskBarRef.current.style.width = pct;
    }
  };

  const handleSliderCommit = () => {
    const val = liveSliderRef.current;
    setSliderProgress(val);
    onProgressUpdate(val);
    onTaskUpdate?.({ ...task, subtasks, completionPercent: val });
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    setSyncingSlider(true);
    sliderDebounceRef.current = setTimeout(async () => {
      try {
        const { submitCheckIn } = await import('../api');
        await submitCheckIn(task.id, `Progress update: ${val}%`, val);
      } catch { /* silently fail */ } finally { setSyncingSlider(false); }
    }, 1200);
  };

  const propagate = (newSubtasks: Subtask[], updatedTask?: Task) => {
    setSubtasks(newSubtasks);
    const derived = updatedTask ?? {
      ...task, subtasks: newSubtasks,
      completionPercent: newSubtasks.length > 0
        ? Math.round(newSubtasks.filter(s => s.completed).length / newSubtasks.length * 100)
        : task.completionPercent,
    };
    onProgressUpdate(derived.completionPercent);
    onTaskUpdate?.(derived);
  };

  const handleToggle = async (subtaskId: string) => {
    if (ticking || isComplete) return;
    const s = subtasks.find(x => x.id === subtaskId);
    if (!s) return;
    setTicking(subtaskId);
    const optimistic = subtasks.map(x => x.id === subtaskId ? { ...x, completed: !x.completed } : x);
    propagate(optimistic);
    try {
      const res = await updateSubtask(task.id, subtaskId, !s.completed);
      propagate(res.task.subtasks ?? optimistic, res.task);
    } catch { propagate(subtasks); }
    finally { setTicking(null); }
  };

  const handleEdit = async (subtaskId: string, title: string, estimatedMinutes: number) => {
    const optimistic = subtasks.map(s => s.id === subtaskId ? { ...s, title, estimatedMinutes } : s);
    propagate(optimistic);
    try {
      const res = await editSubtask(task.id, subtaskId, { title, estimatedMinutes });
      propagate(res.task.subtasks ?? optimistic, res.task);
    } catch { propagate(subtasks); }
  };

  const handleDelete = async (subtaskId: string) => {
    if (deleting) return;
    setDeleting(subtaskId);
    const optimistic = subtasks.filter(s => s.id !== subtaskId);
    propagate(optimistic);
    try {
      const res = await deleteSubtask(task.id, subtaskId);
      propagate(res.task.subtasks ?? optimistic, res.task);
    } catch { propagate(subtasks); }
    finally { setDeleting(null); }
  };

  const handleAdd = async () => {
    const title = addingTitle.trim();
    if (!title) return;
    const mins = Math.max(1, parseInt(addingMins) || 30);
    setAddingTitle(''); setAddingMins('30'); setShowAddRow(false);
    try {
      const res = await addSubtask(task.id, title, mins);
      propagate(res.task.subtasks ?? [...subtasks, res.subtask as Subtask], res.task);
    } catch { /* silently fail */ }
  };

  const fullDate = new Date(task.deadline).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const daysLeft = Math.max(0, (new Date(task.deadline).getTime() - Date.now()) / 86400000);
  const timeLeftLabel = daysLeft < 1 ? `${Math.round(daysLeft * 24)}h` : `${daysLeft.toFixed(1)}d`;
  const showNegotiate = !task.selfOwned && task.recipientName && (task.status === 'AMBER' || task.status === 'RED');

  const prob = pace.finishProbability ?? 50;
  const probColor = prob >= 70 ? '#22c55e' : prob >= 45 ? '#f59e0b' : '#ef4444';
  const projFinishLabel = pace.projectedFinish
    ? new Date(pace.projectedFinish).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '—';

  const modalBg = isDark ? 'linear-gradient(135deg,#141b23 0%,#0f1419 100%)' : 'linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const headerBg = isDark ? 'rgba(15,20,27,0.85)' : 'rgba(255,255,255,0.85)';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="w-full sm:w-[96vw] max-w-6xl flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: modalBg,
          maxHeight: 'calc(100dvh - 72px)',
          marginTop: '72px',
          border: `1px solid rgba(${cfg.glowRgb},0.28)`,
          boxShadow: `0 0 0 1px rgba(${cfg.glowRgb},0.1), 0 40px 100px ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.22)'}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Status accent line */}
        <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg,transparent 0%,${cfg.accent} 35%,${cfg.accent} 65%,transparent 100%)` }} />

        {/* ── Sticky header ── */}
        <div className="px-5 sm:px-6 py-4 shrink-0 flex items-start gap-4"
          style={{ borderBottom: `1px solid ${dividerColor}`, background: headerBg, backdropFilter: 'blur(20px)' }}>

          {/* Back to board */}
          <motion.button onClick={onClose} whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold mt-0.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${dividerColor}`, color: 'var(--text-secondary)' }}>
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Board</span>
          </motion.button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: cfg.badgeBg, color: cfg.badgeText, border: `1px solid rgba(${cfg.glowRgb},0.28)` }}>
                <motion.span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.accent, boxShadow: `0 0 6px ${cfg.accent}` }}
                  animate={task.status === 'RED' ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 1, repeat: Infinity }} />
                {cfg.label}
              </span>
              <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
                {TYPE_ICONS[task.taskType]}{task.taskType}
              </span>
              {task.course && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
                  {task.course}
                </span>
              )}
            </div>
            <h2 className="font-bold text-lg sm:text-xl leading-snug" style={{ color: 'var(--text-primary)' }}>
              {task.taskName}
            </h2>
            <div className="flex items-center flex-wrap gap-3 mt-1.5">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Calendar size={11} />{fullDate}
              </span>
              {!task.selfOwned && task.recipientName && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Target size={11} />{task.recipientName}
                </span>
              )}
            </div>
          </div>

          <button onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">

          {/* HERO STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard isDark={isDark} emphasis icon={<Sparkles size={13} />} label="Complete" color={cfg.accent}
              value={`${progress}%`}
              sub={pace.drift >= 0 ? '✓ on/ahead of pace' : `${Math.abs(pace.drift)}% behind expected`} />
            <StatCard isDark={isDark} icon={<Gauge size={13} />} label="Required Pace" color={cfg.accent}
              value={isComplete ? '—' : fmtHours(pace.requiredHoursPerDay)} sub="focus per day" />
            <StatCard isDark={isDark} icon={<Hourglass size={13} />} label="Time Left" color={daysLeft < 1 ? '#ef4444' : daysLeft < 2 ? '#f59e0b' : '#22c55e'}
              value={timeLeftLabel} sub={`projected finish ${projFinishLabel}`} />
            <StatCard isDark={isDark} icon={<Flag size={13} />} label="On-Time Odds" color={probColor}
              value={`${prob}%`} sub={pace.willFinishOnTime ? 'on track' : 'at risk'} />
          </div>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ══ LEFT (7) ══ */}
            <div className="lg:col-span-7 space-y-5">

              {/* Progress control */}
              <SectionCard isDark={isDark} icon={<TrendingUp size={12} />} title="Progress"
                accent={cfg.accent}
                right={
                  <div className="flex items-center gap-2">
                    {syncingSlider && (
                      <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: cfg.accent }}>
                        <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.accent }}
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} />
                        saving
                      </span>
                    )}
                    <span ref={modalProgressLabelRef}
                      className="font-mono font-black text-xl" style={{ color: cfg.accent }}>{progress}%</span>
                  </div>
                }>
                <div className="h-1 rounded-full overflow-hidden mb-3"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  <div
                    ref={modalProgressBarRef}
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(90deg,${cfg.accent}bb,${cfg.accent})`,
                      boxShadow: `0 0 12px ${cfg.accent}66`,
                    }} />
                </div>
                {!isComplete && (
                  <>
                    <input
                      ref={modalSliderRef}
                      type="range" min={0} max={100}
                      defaultValue={sliderProgress}
                      onInput={e => handleSliderChange(Number((e.target as HTMLInputElement).value))}
                      onPointerUp={handleSliderCommit}
                      className="w-full velocity-slider"
                      style={{
                        '--slider-accent': cfg.accent,
                        background: `linear-gradient(to right, ${cfg.accent} 0%, ${cfg.accent} ${sliderProgress}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} ${sliderProgress}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 100%)`,
                      } as React.CSSProperties} />
                    <div className="flex justify-between mt-2">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                        drag to log progress
                      </span>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: `${cfg.accent}cc` }}>
                        {fmtHours(pace.requiredHoursPerDay)}/day to finish
                      </span>
                    </div>
                  </>
                )}
              </SectionCard>

              {/* Pace chart */}
              <SectionCard isDark={isDark} icon={<Activity size={12} />} title="Pace · Expected vs Actual"
                accent={cfg.accent}
                right={
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: `rgba(${cfg.glowRgb},0.1)`, color: cfg.accent, border: `1px solid rgba(${cfg.glowRgb},0.22)` }}>
                    {pace.status === 'RED' ? '▲ Behind' : pace.status === 'GREEN' ? '✓ On pace' : '→ Drifting'}
                  </span>
                }>
                <PaceChart task={liveTask} isDark={isDark} metrics={pace} />
              </SectionCard>

              {/* Velocity analysis */}
              {task.driftExplanation && (
                <SectionCard isDark={isDark} icon={<Zap size={12} />} title="Velocity Analysis" accent={cfg.accent}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{task.driftExplanation}</p>
                </SectionCard>
              )}
            </div>

            {/* ══ RIGHT (5) ══ */}
            <div className="lg:col-span-5 space-y-5">

              {/* Subtasks */}
              <SectionCard isDark={isDark} icon={<ListChecks size={12} />} title="Subtasks" accent={cfg.accent} pad={false}
                right={
                  <div className="flex items-center gap-2">
                    {subtasks.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                        style={{ background: `rgba(${cfg.glowRgb},0.1)`, color: cfg.accent, border: `1px solid rgba(${cfg.glowRgb},0.2)` }}>
                        {completedCount}/{subtasks.length}
                      </span>
                    )}
                    {!isComplete && (
                      <motion.button onClick={() => setShowAddRow(v => !v)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono"
                        style={{
                          background: showAddRow ? `rgba(${cfg.glowRgb},0.12)` : 'transparent',
                          border: `1px solid ${showAddRow ? `rgba(${cfg.glowRgb},0.3)` : 'transparent'}`,
                          color: showAddRow ? cfg.accent : 'var(--text-faint)',
                        }}>
                        <Plus size={10} /> add
                      </motion.button>
                    )}
                  </div>
                }>
                {/* time budget bar */}
                {totalSubMins > 0 && (
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    <span>{fmtHours(doneSubMins / 60)} done</span>
                    <span>{fmtHours(remainingMins / 60)} remaining</span>
                  </div>
                )}
                {subtasks.length > 0 && (
                  <div className="h-1 mx-4 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                    <div
                      ref={modalSubtaskBarRef}
                      className="h-full"
                      style={{
                        width: `${progress}%`,
                        background: `linear-gradient(90deg,${cfg.accent}66,${cfg.accent})`,
                      }} />
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto mt-1">
                  {subtasks.map(s => (
                    <SubtaskRow key={s.id} subtask={s} accent={cfg.accent} glowRgb={cfg.glowRgb}
                      isDark={isDark} ticking={ticking === s.id} disabled={isComplete}
                      dividerColor={dividerColor}
                      onToggle={() => handleToggle(s.id)}
                      onEdit={(t, m) => handleEdit(s.id, t, m)}
                      onDelete={() => handleDelete(s.id)} />
                  ))}
                </div>
                <AnimatePresence>
                  {showAddRow && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${dividerColor}` }}>
                        <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                          style={{ border: `1.5px dashed rgba(${cfg.glowRgb},0.4)` }}>
                          <Plus size={7} style={{ color: cfg.accent }} />
                        </div>
                        <input ref={addInputRef} value={addingTitle} onChange={e => setAddingTitle(e.target.value)}
                          placeholder="New subtask…"
                          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddRow(false); }}
                          className="flex-1 text-sm font-mono bg-transparent outline-none"
                          style={{ color: 'var(--text-primary)', caretColor: cfg.accent }} />
                        <div className="flex items-center gap-1 shrink-0">
                          <Timer size={10} style={{ color: 'var(--text-faint)' }} />
                          <input value={addingMins} onChange={e => setAddingMins(e.target.value)}
                            className="w-10 text-[11px] font-mono bg-transparent outline-none text-center"
                            style={{ color: 'var(--text-faint)' }} />
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>m</span>
                        </div>
                        <motion.button onClick={handleAdd} whileTap={{ scale: 0.9 }}
                          className="text-[11px] font-mono px-2.5 py-1 rounded-lg"
                          style={{ background: `rgba(${cfg.glowRgb},0.12)`, color: cfg.accent, border: `1px solid rgba(${cfg.glowRgb},0.2)` }}>
                          add
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {subtasks.length === 0 && !showAddRow && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
                      No subtasks yet — click <strong>add</strong> to break this down
                    </p>
                  </div>
                )}
              </SectionCard>

              {/* Behavioral estimate */}
              {drift && drift.confidence !== 'sparse' && (
                <SectionCard isDark={isDark} icon={<Brain size={12} />} title="Behavioral Estimate"
                  accent={drift.gap < -10 ? '#ef4444' : drift.gap < 0 ? '#f59e0b' : '#22c55e'}
                  right={
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-faint)' }}>
                      {drift.confidence}
                    </span>
                  }>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1" style={{ color: 'var(--text-faint)' }}>
                        <span>Reported</span><span style={{ color: 'var(--text-secondary)' }}>{drift.selfReported}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${drift.selfReported}%`, background: 'rgba(255,255,255,0.35)' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1" style={{ color: 'var(--text-faint)' }}>
                        <span>AI estimate</span>
                        <span style={{ color: drift.gap < -10 ? '#f87171' : drift.gap < 0 ? '#fbbf24' : '#4ade80' }}>{drift.inferredReal}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${drift.inferredReal}%` }}
                          transition={{ duration: 0.6 }}
                          style={{ background: drift.gap < -10 ? 'linear-gradient(90deg,#ef444488,#ef4444)' : drift.gap < 0 ? 'linear-gradient(90deg,#f59e0b88,#f59e0b)' : 'linear-gradient(90deg,#22c55e88,#22c55e)' }} />
                      </div>
                    </div>
                    {drift.explanation?.[0] && (
                      <p className="text-[11px] font-mono leading-relaxed pt-1" style={{ color: 'var(--text-muted)' }}>
                        {drift.explanation[0]}
                      </p>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* Details */}
              <SectionCard isDark={isDark} icon={<Layers size={12} />} title="Details">
                <div className="divide-y" style={{ borderColor: dividerColor }}>
                  <MetaStat icon={<Brain size={12} />} label="Cognitive Load" value={task.cognitiveWeight}
                    color={task.cognitiveWeight === 'HIGH' ? '#f87171' : task.cognitiveWeight === 'MEDIUM' ? '#fbbf24' : '#4ade80'} />
                  <MetaStat icon={<Target size={12} />} label="Ownership" value={task.selfOwned ? 'Self-owned' : (task.recipientName || '—')} />
                  {task.energyLevel && <MetaStat icon={<Zap size={12} />} label="Energy Mode" value={task.energyLevel} />}
                  {task.estimatedDuration ? <MetaStat icon={<Clock size={12} />} label="Est. Duration" value={fmtHours(task.estimatedDuration / 60)} /> : null}
                  <MetaStat icon={<Gauge size={12} />} label="Velocity" value={`${pace.velocityRate}%/d`} />
                  <MetaStat icon={<Activity size={12} />} label="Consistency" value={`${pace.consistency}%`}
                    color={pace.consistency >= 70 ? '#4ade80' : pace.consistency >= 45 ? '#fbbf24' : '#f87171'} />
                  {task.creditValue ? <MetaStat icon={<Award size={12} />} label="Reward" value={`${task.creditValue} VC`} color={cfg.accent} /> : null}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="px-5 sm:px-6 py-4 flex items-center gap-3 shrink-0"
          style={{ borderTop: `1px solid ${dividerColor}`, background: headerBg, backdropFilter: 'blur(20px)' }}>
          {!isComplete ? (
            <motion.button
              onClick={() => { setCompleting(true); setTimeout(onMarkComplete, 700); }}
              disabled={completing}
              whileHover={!completing ? { scale: 1.02 } : {}} whileTap={!completing ? { scale: 0.97 } : {}}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: completing ? 'rgba(34,197,94,0.25)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: completing ? '#4ade80' : '#000',
                boxShadow: completing ? 'none' : '0 0 20px rgba(34,197,94,0.25)',
              }}>
              <CheckCircle2 size={16} />
              {completing ? 'Marked Complete!' : 'Mark Complete'}
            </motion.button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm"
              style={{ background: isDark ? 'rgba(82,82,91,0.12)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', border: `1px solid ${dividerColor}` }}>
              <CheckCircle2 size={15} /><span>Completed</span>
            </div>
          )}

          {task.status === 'RED' && !isComplete && onHotStart && (
            <motion.button onClick={onHotStart} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <Rocket size={15} /> Panic Mode
            </motion.button>
          )}

          {showNegotiate && (
            <motion.button onClick={onNegotiate} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: task.status === 'RED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: task.status === 'RED' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)',
                color: task.status === 'RED' ? '#f87171' : '#fbbf24',
              }}>
              <MessageSquare size={15} /> Negotiate
            </motion.button>
          )}

          <button onClick={onClose} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: `1px solid ${dividerColor}`, color: 'var(--text-muted)' }}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TaskDetailModal;
