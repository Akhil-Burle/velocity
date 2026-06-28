import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Clock, Brain, TrendingUp, Code, FileText, GitBranch, Layers,
  CheckCircle2, MessageSquare, Calendar, Target, Zap,
} from 'lucide-react';
import { Task, TaskType, PaceStatus } from '../types';
import PaceChart from './PaceChart';

const STATUS_CONFIG: Record<PaceStatus, { accent: string; label: string; glowRgb: string; badgeBg: string; badgeText: string }> = {
  GREEN:   { accent: '#22c55e', label: 'On Pace',       glowRgb: '34,197,94',   badgeBg: 'rgba(34,197,94,0.1)',  badgeText: '#4ade80' },
  AMBER:   { accent: '#f59e0b', label: 'Warning',       glowRgb: '245,158,11',  badgeBg: 'rgba(245,158,11,0.1)', badgeText: '#fbbf24' },
  RED:     { accent: '#ef4444', label: 'Critical',      glowRgb: '239,68,68',   badgeBg: 'rgba(239,68,68,0.1)',  badgeText: '#f87171' },
  COMPLETE:{ accent: '#52525b', label: 'Complete',      glowRgb: '82,82,91',    badgeBg: 'rgba(82,82,91,0.1)',   badgeText: '#71717a' },
  failed:  { accent: '#71717a', label: 'Not Completed', glowRgb: '113,113,122', badgeBg: 'rgba(63,63,70,0.1)',   badgeText: '#71717a' },
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
  onNegotiate: () => void;
  onHotStart?: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task, isDark = true, onClose, onMarkComplete, onProgressUpdate, onNegotiate, onHotStart,
}) => {
  const cfg = STATUS_CONFIG[task.status];
  const isComplete = task.status === 'COMPLETE';
  const [progress, setProgress] = useState(task.completionPercent);
  const [completing, setCompleting] = useState(false);

  const adjustedHours = isComplete ? 0
    : Math.max(0.1, +(task.currentPaceHoursPerDay * ((100 - progress) / (100 - (task.completionPercent || 0) || 100))).toFixed(1));

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value); setProgress(val); onProgressUpdate(val);
  };
  const handleComplete = () => { setCompleting(true); setTimeout(onMarkComplete, 700); };

  const fullDate = new Date(task.deadline).toLocaleString([], {
    weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const daysLeft = Math.max(0, (new Date(task.deadline).getTime() - Date.now()) / 86400000);
  const showNegotiate = !task.selfOwned && task.recipientName && (task.status === 'AMBER' || task.status === 'RED');

  // Theme tokens
  const modalBg = isDark ? 'linear-gradient(120deg,#141b23 0%,#0f1419 100%)' : 'linear-gradient(120deg,#ffffff 0%,#f8fafc 100%)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const sectionBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
  const metaBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)';

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
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: modalBg,
          border: `1px solid rgba(${cfg.glowRgb},0.28)`,
          boxShadow: `0 0 0 1px rgba(${cfg.glowRgb},0.12), 0 30px 70px ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.18)'}, 0 0 60px rgba(${cfg.glowRgb},0.1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${cfg.accent},transparent)` }} />

        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${dividerColor}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}`, animation: task.status === 'RED' ? 'pulse 1.2s infinite' : undefined }} />
                <h2 className="font-bold text-base tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>{task.taskName}</h2>
              </div>
              <div className="flex items-center flex-wrap gap-2 ml-[18px]">
                {task.course && <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>{task.course}</span>}
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
            <button onClick={onClose} className="transition-colors shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Drift explanation */}
          <div className="rounded-xl px-4 py-3" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={11} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Velocity Analysis</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{task.driftExplanation}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Deadline */}
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

            {/* Pace metric */}
            <div className="rounded-xl p-3.5"
              style={{ background: `rgba(${cfg.glowRgb},0.06)`, border: `1px solid rgba(${cfg.glowRgb},0.22)` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={10} style={{ color: cfg.accent }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Required Pace</span>
              </div>
              <p className="font-black font-mono text-2xl leading-none" style={{ color: cfg.accent }}>
                {isComplete ? '0.0' : adjustedHours}
                <span className="text-sm font-semibold ml-1" style={{ color: `${cfg.accent}99` }}>h/day</span>
              </p>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                {task.cognitiveWeight} weight · {isComplete ? 'done' : 'active'}
              </p>
            </div>

            {/* Cognitive weight */}
            <div className="rounded-xl p-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Brain size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Cognitive Load</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: metaBg, color: 'var(--text-secondary)', border: `1px solid ${sectionBorder}` }}>
                {task.cognitiveWeight} Load
              </span>
              <p className="text-[10px] font-mono mt-2" style={{ color: 'var(--text-muted)' }}>
                Base: {task.cognitiveWeight === 'HIGH' ? '5h' : task.cognitiveWeight === 'MEDIUM' ? '3h' : '1h'} est.
              </p>
            </div>

            {/* Ownership */}
            <div className="rounded-xl p-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Ownership</span>
              </div>
              <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                {task.selfOwned ? 'Self-owned' : task.recipientName}
              </span>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                {task.selfOwned ? 'Personal task' : 'Requires external sign-off'}
              </p>
            </div>
          </div>

          {/* Pace tracker — expected vs actual over time */}
          <div className="rounded-xl px-4 py-3.5" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pace Tracker · Expected vs Actual</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: `rgba(${cfg.glowRgb},0.1)`, color: cfg.accent, border: `1px solid rgba(${cfg.glowRgb},0.22)` }}>
                {task.status === 'RED' ? '▲ Behind' : task.status === 'GREEN' ? '✓ On pace' : '→ Drifting'}
              </span>
            </div>
            {/* Pass the live progress state so the chart updates as user moves the slider */}
            <PaceChart task={{ ...task, completionPercent: progress }} isDark={isDark} />
          </div>

          {/* Progress */}
          <div className="rounded-xl px-4 py-4" style={{ background: sectionBg, border: `1px solid ${sectionBorder}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Progress Log
                  {task.cognitiveWeight === 'HIGH' && (
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: isDark ? 'rgba(113,113,122,0.3)' : 'rgba(0,0,0,0.07)', color: 'var(--text-tertiary)' }}>
                      HIGH WEIGHT
                    </span>
                  )}
                </span>
              </div>
              <span className="font-mono font-bold text-sm" style={{ color: cfg.accent }}>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
              <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                style={{ background: `linear-gradient(90deg,${cfg.accent}cc,${cfg.accent})`, boxShadow: `0 0 8px ${cfg.accent}60` }} />
            </div>
            {!isComplete && (
              <>
                <input type="range" min={0} max={100} value={progress} onChange={handleSlider}
                  className="w-full velocity-slider" style={{ '--slider-accent': cfg.accent } as React.CSSProperties} />
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>0%</span>
                  <motion.span key={adjustedHours} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] font-mono font-semibold" style={{ color: cfg.accent }}>
                    Adjusted: {adjustedHours}h/day
                  </motion.span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>100%</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: `1px solid ${dividerColor}` }}>
          {!isComplete ? (
            <motion.button onClick={handleComplete} disabled={completing}
              whileHover={!completing ? { scale: 1.02 } : {}} whileTap={!completing ? { scale: 0.97 } : {}}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold relative overflow-hidden"
              style={{ background: completing ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: completing ? '#4ade80' : '#000', boxShadow: '0 0 16px rgba(34,197,94,0.2)' }}>
              <AnimatePresence mode="wait">
                {completing
                  ? <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2"><CheckCircle2 size={15} />Marked Complete!</motion.span>
                  : <motion.span key="cta" className="flex items-center gap-2"><CheckCircle2 size={15} />Mark Complete</motion.span>}
              </AnimatePresence>
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
              style={{ background: task.status === 'RED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: task.status === 'RED' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)', color: task.status === 'RED' ? '#f87171' : '#fbbf24' }}>
              <MessageSquare size={13} />Negotiate
            </motion.button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: `1px solid ${dividerColor}`, color: 'var(--text-muted)' }}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TaskDetailModal;
