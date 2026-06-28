import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Clock, Brain, TrendingUp, Code, FileText, GitBranch, Layers,
  CheckCircle2, MessageSquare, Calendar, Target, Zap, Check, ListChecks,
  Plus, Trash2, Pencil, Timer,
} from 'lucide-react';
import { Task, TaskType, PaceStatus, Subtask } from '../types';
import PaceChart from './PaceChart';
import { fmtHours, computePaceMetrics } from '../data';
import { updateSubtask, editSubtask, addSubtask, deleteSubtask } from '../api';

const STATUS_CONFIG: Record<PaceStatus, { accent: string; label: string; glowRgb: string; badgeBg: string; badgeText: string }> = {
  GREEN:   { accent: '#22c55e', label: 'On Pace',       glowRgb: '34,197,94',   badgeBg: 'rgba(34,197,94,0.1)',  badgeText: '#4ade80' },
  AMBER:   { accent: '#f59e0b', label: 'Warning',       glowRgb: '245,158,11',  badgeBg: 'rgba(245,158,11,0.1)', badgeText: '#fbbf24' },
  RED:     { accent: '#ef4444', label: 'Critical',      glowRgb: '239,68,68',   badgeBg: 'rgba(239,68,68,0.1)',  badgeText: '#f87171' },
  COMPLETE:{ accent: '#52525b', label: 'Complete',      glowRgb: '82,82,91',    badgeBg: 'rgba(82,82,91,0.1)',   badgeText: '#71717a' },
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
  onTaskUpdate?: (updatedTask: Task) => void; // propagates full task changes upward
  onNegotiate: () => void;
  onHotStart?: () => void;
}

// ── Inline subtask row ────────────────────────────────────────────────────────
interface SubtaskRowProps {
  subtask: Subtask;
  accent: string;
  glowRgb: string;
  isDark: boolean;
  ticking: boolean;
  disabled: boolean;
  dividerColor: string;
  onToggle: () => void;
  onEdit: (title: string, mins: number) => void;
  onDelete: () => void;
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
    if (t && (t !== subtask.title || m !== subtask.estimatedMinutes)) {
      onEdit(t, m);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${dividerColor}` }}>
        <input ref={inputRef} value={editTitle} onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 text-xs font-mono bg-transparent outline-none border-b"
          style={{ color: 'var(--text-primary)', borderColor: accent, caretColor: accent }} />
        <div className="flex items-center gap-1 shrink-0">
          <Timer size={9} style={{ color: 'var(--text-faint)' }} />
          <input value={editMins} onChange={e => setEditMins(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
            className="w-10 text-[10px] font-mono bg-transparent outline-none text-center border-b"
            style={{ color: 'var(--text-faint)', borderColor: 'rgba(255,255,255,0.1)' }} />
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>m</span>
        </div>
        <motion.button onClick={commitEdit} whileTap={{ scale: 0.9 }}
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{ background: `rgba(${glowRgb},0.12)`, color: accent }}>
          save
        </motion.button>
        <motion.button onClick={() => setEditing(false)} whileTap={{ scale: 0.9 }} style={{ color: 'var(--text-faint)' }}>
          <X size={11} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors"
      style={{ borderBottom: `1px solid ${dividerColor}` }}>
      {/* Checkbox */}
      <motion.button onClick={onToggle} disabled={disabled} whileTap={{ scale: 0.85 }}
        animate={ticking ? { scale: [1, 0.8, 1] } : {}}
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all"
        style={{
          background: subtask.completed ? `rgba(${glowRgb},0.15)` : 'transparent',
          border: subtask.completed
            ? `1.5px solid rgba(${glowRgb},0.5)`
            : `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
        }}>
        {subtask.completed && <Check size={8} style={{ color: accent }} />}
      </motion.button>

      {/* Title */}
      <span className="flex-1 text-xs leading-snug" style={{
        color: subtask.completed ? 'var(--text-faint)' : 'var(--text-secondary)',
        textDecoration: subtask.completed ? 'line-through' : 'none',
      }}>
        {subtask.title}
      </span>

      {/* Time */}
      {subtask.estimatedMinutes > 0 && (
        <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
          ~{subtask.estimatedMinutes}m
        </span>
      )}

      {/* Actions — appear on hover */}
      {!disabled && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button onClick={() => setEditing(true)} whileTap={{ scale: 0.9 }}
            className="p-1 rounded" style={{ color: 'var(--text-faint)' }}
            title="Edit subtask">
            <Pencil size={9} />
          </motion.button>
          <motion.button onClick={onDelete} whileTap={{ scale: 0.9 }}
            className="p-1 rounded" style={{ color: '#f87171' }}
            title="Delete subtask">
            <Trash2 size={9} />
          </motion.button>
        </div>
      )}
    </div>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────
const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task, isDark = true, onClose, onMarkComplete, onProgressUpdate, onTaskUpdate, onNegotiate,
}) => {
  const cfg = STATUS_CONFIG[task.status];
  const isComplete = task.status === 'COMPLETE';

  // Local state
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? []);
  const [ticking, setTicking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [addingTitle, setAddingTitle] = useState('');
  const [addingMins, setAddingMins] = useState('30');
  const [showAddRow, setShowAddRow] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Manual progress slider — independent from subtask ratio, for override / no-subtask tasks
  const [sliderProgress, setSliderProgress] = useState(task.completionPercent);
  const [syncingSlider, setSyncingSlider] = useState(false);
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Effective progress: if there are subtasks, subtask ratio drives it;
  // if no subtasks, the manual slider drives it.
  const completedCount = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0
    ? Math.round((completedCount / subtasks.length) * 100)
    : null;
  const progress = subtaskProgress !== null ? subtaskProgress : sliderProgress;

  // Recompute pace from live progress
  const liveTask = { ...task, subtasks, completionPercent: progress };
  const pace = computePaceMetrics(liveTask);

  useEffect(() => { if (showAddRow) addInputRef.current?.focus(); }, [showAddRow]);

  // Debounced slider sync — submits a check-in when the slider is dragged
  const handleSliderChange = (val: number) => {
    setSliderProgress(val);
    onProgressUpdate(val);
    onTaskUpdate?.({ ...task, subtasks, completionPercent: val });
    // Debounce the actual API call
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    setSyncingSlider(true);
    sliderDebounceRef.current = setTimeout(async () => {
      try {
        const { submitCheckIn } = await import('../api');
        await submitCheckIn(task.id, `Progress update: ${val}%`, val);
      } catch { /* silently fail */ } finally {
        setSyncingSlider(false);
      }
    }, 1200);
  };

  // When subtasks change, bubble updated task upward so Dashboard re-renders
  const propagate = (newSubtasks: Subtask[], updatedTask?: Task) => {
    setSubtasks(newSubtasks);
    const derived = updatedTask ?? { ...task, subtasks: newSubtasks,
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
    } catch {
      propagate(subtasks); // revert
    } finally {
      setTicking(null);
    }
  };

  const handleEdit = async (subtaskId: string, title: string, estimatedMinutes: number) => {
    const optimistic = subtasks.map(s => s.id === subtaskId ? { ...s, title, estimatedMinutes } : s);
    propagate(optimistic);
    try {
      const res = await editSubtask(task.id, subtaskId, { title, estimatedMinutes });
      propagate(res.task.subtasks ?? optimistic, res.task);
    } catch {
      propagate(subtasks);
    }
  };

  const handleDelete = async (subtaskId: string) => {
    if (deleting) return;
    setDeleting(subtaskId);
    const optimistic = subtasks.filter(s => s.id !== subtaskId);
    propagate(optimistic);
    try {
      const res = await deleteSubtask(task.id, subtaskId);
      propagate(res.task.subtasks ?? optimistic, res.task);
    } catch {
      propagate(subtasks);
    } finally {
      setDeleting(null);
    }
  };

  const handleAdd = async () => {
    const title = addingTitle.trim();
    if (!title) return;
    const mins = Math.max(1, parseInt(addingMins) || 30);
    setAddingTitle('');
    setAddingMins('30');
    setShowAddRow(false);
    try {
      const res = await addSubtask(task.id, title, mins);
      propagate(res.task.subtasks ?? [...subtasks, res.subtask as Subtask], res.task);
    } catch { /* silently fail — optimistic add not needed, just retry */ }
  };

  const fullDate = new Date(task.deadline).toLocaleString([], {
    weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const daysLeft = Math.max(0, (new Date(task.deadline).getTime() - Date.now()) / 86400000);
  const showNegotiate = !task.selfOwned && task.recipientName && (task.status === 'AMBER' || task.status === 'RED');

  const modalBg = isDark ? 'linear-gradient(120deg,#141b23 0%,#0f1419 100%)' : 'linear-gradient(120deg,#ffffff 0%,#f8fafc 100%)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const sectionBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: modalBg, maxHeight: '90vh',
          border: `1px solid rgba(${cfg.glowRgb},0.28)`,
          boxShadow: `0 0 0 1px rgba(${cfg.glowRgb},0.12), 0 30px 70px ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.18)'}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[2px] shrink-0" style={{ background: `linear-gradient(90deg,transparent,${cfg.accent},transparent)` }} />

        {/* Header */}
        <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${dividerColor}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }} />
                <h2 className="font-bold text-base tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>{task.taskName}</h2>
              </div>
              <div className="flex items-center flex-wrap gap-2 ml-[18px]">
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded"
                  style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
                  {TYPE_ICONS[task.taskType]}{task.taskType}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: cfg.badgeBg, color: cfg.badgeText, border: `1px solid rgba(${cfg.glowRgb},0.25)` }}>
                  {cfg.label}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-faint)' }}><X size={16} /></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── SUBTASKS — top ───────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
            {/* Subtask header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-2">
                <ListChecks size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Subtasks</span>
                {subtasks.length > 0 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ background: `rgba(${cfg.glowRgb},0.1)`, color: cfg.accent, border: `1px solid rgba(${cfg.glowRgb},0.2)` }}>
                    {completedCount}/{subtasks.length}
                  </span>
                )}
              </div>
              {/* Live progress derived from subtasks */}
              <div className="flex items-center gap-2">
                {subtasks.length > 0 && (
                  <motion.span key={progress} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="font-mono font-black text-sm" style={{ color: cfg.accent }}>
                    {progress}%
                  </motion.span>
                )}
                {!isComplete && (
                  <motion.button onClick={() => setShowAddRow(v => !v)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono"
                    style={{ background: showAddRow ? `rgba(${cfg.glowRgb},0.12)` : 'transparent',
                      border: `1px solid ${showAddRow ? `rgba(${cfg.glowRgb},0.3)` : 'transparent'}`,
                      color: showAddRow ? cfg.accent : 'var(--text-faint)' }}>
                    <Plus size={10} /> add
                  </motion.button>
                )}
              </div>
            </div>

            {/* Subtask progress bar */}
            {subtasks.length > 0 && (
              <div className="h-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }}>
                <motion.div className="h-full" animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: `linear-gradient(90deg,${cfg.accent}66,${cfg.accent})` }} />
              </div>
            )}

            {/* Subtask rows */}
            {subtasks.map(s => (
              <SubtaskRow key={s.id} subtask={s} accent={cfg.accent} glowRgb={cfg.glowRgb}
                isDark={isDark} ticking={ticking === s.id} disabled={isComplete}
                dividerColor={sectionBorder}
                onToggle={() => handleToggle(s.id)}
                onEdit={(t, m) => handleEdit(s.id, t, m)}
                onDelete={() => handleDelete(s.id)} />
            ))}

            {/* Add new subtask row */}
            <AnimatePresence>
              {showAddRow && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                  className="overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${sectionBorder}` }}>
                    <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                      style={{ border: `1.5px dashed rgba(${cfg.glowRgb},0.4)` }}>
                      <Plus size={7} style={{ color: cfg.accent }} />
                    </div>
                    <input ref={addInputRef} value={addingTitle} onChange={e => setAddingTitle(e.target.value)}
                      placeholder="New subtask..."
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddRow(false); }}
                      className="flex-1 text-xs font-mono bg-transparent outline-none"
                      style={{ color: 'var(--text-primary)', caretColor: cfg.accent }} />
                    <div className="flex items-center gap-1 shrink-0">
                      <Timer size={9} style={{ color: 'var(--text-faint)' }} />
                      <input value={addingMins} onChange={e => setAddingMins(e.target.value)}
                        className="w-10 text-[10px] font-mono bg-transparent outline-none text-center"
                        style={{ color: 'var(--text-faint)' }} />
                      <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>m</span>
                    </div>
                    <motion.button onClick={handleAdd} whileTap={{ scale: 0.9 }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded"
                      style={{ background: `rgba(${cfg.glowRgb},0.12)`, color: cfg.accent }}>
                      add
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {subtasks.length === 0 && !showAddRow && (
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  No subtasks yet — click <strong>add</strong> to break this task down
                </p>
              </div>
            )}
          </div>

          {/* ── Progress slider ──────────────────────────────────────────── */}
          {!isComplete && (
            <div className="rounded-xl px-4 py-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={10} style={{ color: 'var(--text-faint)' }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Progress
                    {subtaskProgress !== null && (
                      <span className="ml-1.5 text-[9px] opacity-60">· driven by subtasks</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {syncingSlider && (
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  )}
                  <motion.span key={progress} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="font-mono font-black text-base" style={{ color: cfg.accent }}>
                    {progress}%
                  </motion.span>
                </div>
              </div>
              {/* Bar */}
              <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                <motion.div className="h-full rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  style={{ background: `linear-gradient(90deg,${cfg.accent}cc,${cfg.accent})`, boxShadow: `0 0 8px ${cfg.accent}60` }} />
              </div>
              {/* Slider — always shown; if subtasks exist, shows as read-only with note */}
              <input
                type="range" min={0} max={100}
                value={subtaskProgress !== null ? subtaskProgress : sliderProgress}
                onChange={e => {
                  if (subtaskProgress !== null) return; // locked when subtasks drive it
                  handleSliderChange(Number(e.target.value));
                }}
                disabled={subtaskProgress !== null}
                className="w-full velocity-slider"
                style={{
                  '--slider-accent': cfg.accent,
                  opacity: subtaskProgress !== null ? 0.45 : 1,
                  cursor: subtaskProgress !== null ? 'not-allowed' : 'pointer',
                } as React.CSSProperties}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  {subtaskProgress !== null ? 'tick subtasks above to update' : 'drag to log progress'}
                </span>
                <span className="text-[10px] font-mono font-semibold" style={{ color: `${cfg.accent}bb` }}>
                  {fmtHours(pace.requiredHoursPerDay)}/day to finish
                </span>
              </div>
            </div>
          )}

          {/* ── Deadline + Required Pace ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Deadline</span>
              </div>
              <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>{fullDate}</p>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                {daysLeft < 1 ? `${Math.round(daysLeft * 24)}h remaining` : `${daysLeft.toFixed(1)} days remaining`}
              </p>
            </div>
            <div className="rounded-xl p-3.5" style={{ background: `rgba(${cfg.glowRgb},0.06)`, border: `1px solid rgba(${cfg.glowRgb},0.22)` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={10} style={{ color: cfg.accent }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Required Pace</span>
              </div>
              <p className="font-black font-mono text-2xl leading-none" style={{ color: cfg.accent }}>
                {isComplete ? '—' : fmtHours(pace.requiredHoursPerDay)}
                <span className="text-sm font-semibold ml-1" style={{ color: `${cfg.accent}99` }}>/day</span>
              </p>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                {pace.drift >= 0 ? '✓ on pace' : `${Math.abs(pace.drift)}% behind`}
              </p>
            </div>
          </div>

          {/* ── Pace chart ─────────────────────────────────────────────────── */}
          <div className="rounded-xl px-4 py-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pace · Expected vs Actual</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: `rgba(${cfg.glowRgb},0.1)`, color: cfg.accent, border: `1px solid rgba(${cfg.glowRgb},0.22)` }}>
                {task.status === 'RED' ? '▲ Behind' : task.status === 'GREEN' ? '✓ On pace' : '→ Drifting'}
              </span>
            </div>
            <PaceChart task={liveTask} isDark={isDark} />
          </div>

          {/* ── Cognitive load + Ownership ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Brain size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Cognitive Load</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)', border: `1px solid ${sectionBorder}` }}>
                {task.cognitiveWeight} Load
              </span>
            </div>
            <div className="rounded-xl p-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Ownership</span>
              </div>
              <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                {task.selfOwned ? 'Self-owned' : task.recipientName}
              </span>
            </div>
          </div>

          {/* ── Velocity analysis ──────────────────────────────────────────── */}
          {task.driftExplanation && (
            <div className="rounded-xl px-4 py-3" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={11} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Velocity Analysis</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{task.driftExplanation}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderTop: `1px solid ${dividerColor}` }}>
          {!isComplete ? (
            <motion.button onClick={() => { setCompleting(true); setTimeout(onMarkComplete, 700); }}
              disabled={completing}
              whileHover={!completing ? { scale: 1.02 } : {}} whileTap={!completing ? { scale: 0.97 } : {}}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: completing ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: completing ? '#4ade80' : '#000', boxShadow: '0 0 16px rgba(34,197,94,0.2)' }}>
              <CheckCircle2 size={15} />
              {completing ? 'Marked Complete!' : 'Mark Complete'}
            </motion.button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
              style={{ background: isDark ? 'rgba(82,82,91,0.15)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', border: `1px solid ${isDark ? 'rgba(82,82,91,0.2)' : 'rgba(0,0,0,0.08)'}` }}>
              <CheckCircle2 size={14} /><span>Completed</span>
            </div>
          )}
          {showNegotiate && (
            <motion.button onClick={() => { onNegotiate(); onClose(); }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: task.status === 'RED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: task.status === 'RED' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)',
                color: task.status === 'RED' ? '#f87171' : '#fbbf24' }}>
              <MessageSquare size={13} />Negotiate
            </motion.button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${dividerColor}`, color: 'var(--text-muted)' }}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TaskDetailModal;
