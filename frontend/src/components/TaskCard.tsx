import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useDragControls } from 'framer-motion';
import {
  Clock, Brain, TrendingUp, HelpCircle, X,
  MessageSquare, Code, FileText, GitBranch, Layers, Check, CheckCircle2,
  AlertTriangle, GripVertical, ShieldCheck,
} from 'lucide-react';
import { Task, PaceStatus, TaskType } from '../types';
import PaceChart from './PaceChart';
import { computePaceMetrics } from '../data';
import TaskDetailModal from './TaskDetailModal';
import { submitCheckIn } from '../api';

// ─── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PaceStatus, {
  accent: string; badgeBg: string; badgeText: string; badgeBorder: string;
  label: string; glowRgb: string; progressGlow: string;
}> = {
  GREEN:   { accent: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)',  badgeText: '#4ade80', badgeBorder: 'rgba(34,197,94,0.3)',   label: 'On Pace',       glowRgb: '34,197,94',  progressGlow: 'rgba(34,197,94,0.5)'  },
  AMBER:   { accent: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#fbbf24', badgeBorder: 'rgba(245,158,11,0.3)',  label: 'Warning',       glowRgb: '245,158,11', progressGlow: 'rgba(245,158,11,0.5)' },
  RED:     { accent: '#ef4444', badgeBg: 'rgba(239,68,68,0.12)',  badgeText: '#f87171', badgeBorder: 'rgba(239,68,68,0.32)',  label: 'Critical',      glowRgb: '239,68,68',  progressGlow: 'rgba(239,68,68,0.5)'  },
  COMPLETE:{ accent: '#52525b', badgeBg: 'rgba(63,63,70,0.2)',    badgeText: '#71717a', badgeBorder: 'rgba(63,63,70,0.3)',   label: 'Complete',      glowRgb: '82,82,91',   progressGlow: 'rgba(82,82,91,0.3)'   },
  failed:  { accent: '#71717a', badgeBg: 'rgba(63,63,70,0.15)',   badgeText: '#71717a', badgeBorder: 'rgba(63,63,70,0.25)',  label: 'Not Completed', glowRgb: '113,113,122',progressGlow: 'rgba(113,113,122,0.2)' },
};

const WEIGHT_BADGE_DARK: Record<string, string> = {
  LOW: 'bg-zinc-800/70 text-zinc-400 border border-zinc-700/50',
  MEDIUM: 'bg-zinc-700/60 text-zinc-300 border border-zinc-600/50',
  HIGH: 'bg-zinc-600/50 text-zinc-100 border border-zinc-500/50',
};
const WEIGHT_BADGE_LIGHT: Record<string, string> = {
  LOW: 'bg-slate-200/80 text-slate-600 border border-slate-300/60',
  MEDIUM: 'bg-slate-300/60 text-slate-700 border border-slate-400/50',
  HIGH: 'bg-slate-400/40 text-slate-800 border border-slate-500/40',
};
const WEIGHT_LABEL: Record<string, string> = { LOW: 'Low Load', MEDIUM: 'Med Load', HIGH: 'High Load' };

const TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  CODE: <Code size={9} />, WRITING: <FileText size={9} />,
  DIAGRAM: <GitBranch size={9} />, OTHER: <Layers size={9} />,
};

// ─── Props ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isHot?: boolean;
  isDark?: boolean;
  isRescheduled?: boolean;
  onNegotiate?: () => void;
  onHotStart?: () => void;
  onMarkComplete?: () => void;
  onProgressUpdate?: (percent: number) => void;
  dragControls?: ReturnType<typeof useDragControls>;
}

// ─── Component ────────────────────────────────────────────────────────────

const TaskCard: React.FC<TaskCardProps> = ({
  task, isHot, isDark = true, isRescheduled = false, onNegotiate, onHotStart, onMarkComplete, onProgressUpdate, dragControls,
}) => {
  const [whyOpen, setWhyOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [completingFlash, setCompletingFlash] = useState(false);
  const [localProgress, setLocalProgress] = useState(task.completionPercent);
  const [hovered, setHovered] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Blocks the card's own onClick from opening the modal when an action button
  // (Negotiate, Panic Mode) was just clicked.
  const actionClickedRef = useRef(false);

  // Debounce ref for check-in sync
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Magnetic tilt
  const rotX = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });
  const rotY = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });
  const glowX = useSpring(useMotionValue(50), { stiffness: 120, damping: 16 });
  const glowY = useSpring(useMotionValue(50), { stiffness: 120, damping: 16 });

  const cfg = STATUS_CONFIG[task.status];
  const isComplete = task.status === 'COMPLETE';
  const showWhy = task.status === 'AMBER' || task.status === 'RED';
  // Negotiate: visible for ANY external task (selfOwned=false) that's not complete — no status gate
  const showNeg = !task.selfOwned && !!task.recipientName && task.status !== 'COMPLETE' && task.status !== 'failed';

  // Live pace metrics (reflect the in-progress slider value)
  const pace = computePaceMetrics({ ...task, completionPercent: localProgress });
  const driftColor = pace.drift >= -3 ? '#22c55e' : pace.drift >= -15 ? '#f59e0b' : '#ef4444';
  const creditValue = task.creditValue || 0;

  const basePct = task.completionPercent || 0;
  const adjustedHours = isComplete ? 0
    : +(task.currentPaceHoursPerDay * Math.max(0, (100 - localProgress) / Math.max(1, 100 - basePct))).toFixed(1);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isComplete) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    rotY.set(((e.clientX - cx) / rect.width) * 6);
    rotX.set(-((e.clientY - cy) / rect.height) * 6);
    glowX.set(((e.clientX - rect.left) / rect.width) * 100);
    glowY.set(((e.clientY - rect.top) / rect.height) * 100);
  };
  const handleMouseLeave = () => {
    rotX.set(0); rotY.set(0);
    glowX.set(50); glowY.set(50);
    setHovered(false);
  };

  const handleQuickComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isComplete || completingFlash) return;
    setCompletingFlash(true);
    setTimeout(() => { onMarkComplete?.(); setCompletingFlash(false); }, 700);
  };

  // Debounced check-in sync when slider changes
  const syncCheckIn = useCallback((val: number) => {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    setSyncing(true);
    syncDebounceRef.current = setTimeout(async () => {
      try {
        await submitCheckIn(task.id, `Progress update: ${val}%`, val);
      } catch {
        // silently fail — the local state is already updated
      } finally {
        setSyncing(false);
      }
    }, 1500);
  }, [task.id]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = Number(e.target.value);
    setLocalProgress(val);
    onProgressUpdate?.(val);
    syncCheckIn(val);
  };

  // Dynamic glow background follows cursor
  const glowBg = useTransform([glowX, glowY], ([x, y]) =>
    `radial-gradient(ellipse 60% 50% at ${x}% ${y}%, rgba(${cfg.glowRgb},${isComplete ? 0.02 : hovered ? 0.11 : 0.05}) 0%, transparent 80%)`
  );

  const cardBorder = isRescheduled
    ? '1.5px dashed rgba(245,158,11,0.5)'
    : isDark ? `1px solid rgba(${cfg.glowRgb},0.28)` : `1px solid rgba(${cfg.glowRgb},0.35)`;
  const cardShadow = isHot
    ? `0 0 0 1.5px rgba(${cfg.glowRgb},0.45), 0 8px 40px rgba(${cfg.glowRgb},0.2)`
    : hovered
      ? `0 0 0 1px rgba(${cfg.glowRgb},0.3), 0 12px 40px rgba(${cfg.glowRgb},0.15), 0 4px 12px rgba(0,0,0,0.3)`
      : `0 0 0 1px transparent, 0 2px 8px rgba(0,0,0,0.15)`;
  const whyBg = isDark ? (task.status === 'RED' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)') : (task.status === 'RED' ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)');
  const whyBorder = task.status === 'RED' ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(245,158,11,0.18)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const weightBadge = isDark ? WEIGHT_BADGE_DARK[task.cognitiveWeight] : WEIGHT_BADGE_LIGHT[task.cognitiveWeight];
  const cardBaseBg = isRescheduled
    ? (isDark ? 'rgba(15,13,10,0.97)' : 'rgba(255,252,245,0.97)')
    : (isDark ? 'rgba(14,20,28,0.98)' : 'rgba(255,255,255,0.97)');

  return (
    <>
      <motion.div
        style={{
          rotateX: rotX, rotateY: rotY,
          transformStyle: 'preserve-3d',
          border: cardBorder,
          background: cardBaseBg,
          cursor: isComplete ? 'default' : 'pointer',
          boxShadow: cardShadow,
        } as React.CSSProperties}
        animate={completingFlash ? { scale: [1, 1.04, 0.96, 1] } : {}}
        transition={{ duration: 0.55 }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (actionClickedRef.current) { actionClickedRef.current = false; return; }
          if (!isComplete) setModalOpen(true);
        }}
        className="relative rounded-xl overflow-hidden"
      >
        {/* Magnetic cursor glow */}
        <motion.div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background: glowBg }} />

        {/* Left accent bar */}
        <motion.div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
          style={{ background: cfg.accent }}
          animate={isHot ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
          transition={isHot ? { duration: 0.9, repeat: Infinity } : {}} />

        {/* Critical pulse overlay */}
        {isHot && (
          <motion.div className="absolute inset-0 pointer-events-none rounded-xl"
            style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.1) 0%, transparent 70%)' }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }} />
        )}

        {/* Complete flash overlay */}
        <AnimatePresence>
          {completingFlash && (
            <motion.div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ background: 'rgba(34,197,94,0.15)', backdropFilter: 'blur(1px)' }}>
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1.2, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                <CheckCircle2 size={32} className="text-green-400" style={{ filter: 'drop-shadow(0 0 10px rgba(34,197,94,0.8))' }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover quick-complete button */}
        {!isComplete && (
          <motion.button onClick={handleQuickComplete}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={hovered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.18, type: 'spring', stiffness: 260, damping: 18 }}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
            }}
            title="Mark complete">
            <Check size={12} style={{ color: isDark ? '#71717a' : '#94a3b8' }} />
          </motion.button>
        )}

        <div className="px-5 pt-4 pb-3 ml-[3px]">
          {/* Drag handle — always visible, serves as the drag initiator */}
          {dragControls && !isComplete && (
            <div
              data-tour="drag-handle"
              onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
              className="absolute top-2 left-4 z-10 flex items-center justify-center w-6 h-5 rounded cursor-grab active:cursor-grabbing"
              style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)', touchAction: 'none' }}
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </div>
          )}
          {/* Card header */}
          <div className="flex items-start justify-between gap-2 mb-3 pr-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <motion.span className={`w-1.5 h-1.5 rounded-full shrink-0`}
                  style={{ background: cfg.accent, boxShadow: `0 0 6px ${cfg.accent}` }}
                  animate={task.status === 'RED' ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                  transition={{ duration: 0.9, repeat: Infinity }} />
                <span className="font-semibold text-[14px] truncate tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {task.taskName}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-3.5">
                {task.course && <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>{task.course}</span>}
                <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  {TYPE_ICONS[task.taskType]}&nbsp;{task.taskType}
                </span>
                {creditValue > 0 && !isComplete && (
                  <span className="flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}
                    title="Velocity Credits earned on completion (pace-adjusted)">
                    ◆ {creditValue}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {showWhy && (
                <motion.button onClick={e => { e.stopPropagation(); setWhyOpen(v => !v); }}
                  whileHover={{ scale: 1.18, rotate: 10 }} whileTap={{ scale: 0.88 }}
                  className="flex items-center justify-center w-6 h-6 rounded-full transition-all"
                  style={{
                    background: whyOpen ? (isDark ? 'rgba(82,82,91,0.6)' : 'rgba(0,0,0,0.08)') : (task.status === 'RED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'),
                    color: whyOpen ? 'var(--text-secondary)' : (task.status === 'RED' ? '#f87171' : '#fbbf24'),
                  }}>
                  <AnimatePresence mode="wait">
                    {whyOpen ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={10} /></motion.span>
                      : <motion.span key="h" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><HelpCircle size={10} /></motion.span>}
                  </AnimatePresence>
                </motion.button>
              )}
              <motion.span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: cfg.badgeBg, color: cfg.badgeText, border: `1px solid ${cfg.badgeBorder}` }}
                layout>
                {cfg.label}
              </motion.span>
              {isRescheduled && (
                <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide"
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                  TRIAGED
                </motion.span>
              )}
            </div>
          </div>

          {/* Why panel */}
          <AnimatePresence>
            {whyOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden">
                <div className="mb-3 px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
                  style={{ background: whyBg, border: whyBorder }}>
                  <span className="font-mono" style={{ color: 'var(--text-faint)' }}>// drift · </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{task.driftExplanation}</span>
                  {/* Trust Score chip — shown when driftExplanation references a trust gap */}
                  {task.driftExplanation && /trust|discrepancy|self-report/i.test(task.driftExplanation) && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <ShieldCheck size={10} style={{ color: '#22c55e' }} />
                      <span className="text-[10px] font-mono" style={{ color: '#4ade80' }}>
                        Trust Score visible · move the slider below to update
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats */}
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              {/* Pace metric */}
              <motion.div className="flex items-baseline gap-1 px-2.5 py-1.5 rounded-lg"
                style={{ background: `rgba(${cfg.glowRgb},0.08)`, border: `1px solid rgba(${cfg.glowRgb},0.18)` }}
                whileHover={{ scale: 1.03 }}>
                <TrendingUp size={10} style={{ color: cfg.accent }} className="shrink-0 mb-0.5" />
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>Required:</span>
                <motion.span key={adjustedHours} initial={{ opacity: 0.5, y: -3 }} animate={{ opacity: 1, y: 0 }}
                  className="font-black font-mono text-base leading-none" style={{ color: cfg.accent }}>
                  {isComplete ? '0.0' : adjustedHours}
                </motion.span>
                <span className="text-[10px] font-mono" style={{ color: `${cfg.accent}88` }}>h/day</span>
              </motion.div>

              <div className="flex items-center gap-1.5">
                <Clock size={9} style={{ color: 'var(--text-faint)' }} />
                <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDeadline(task.deadline)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Brain size={9} style={{ color: 'var(--text-faint)' }} />
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${weightBadge}`}>
                  {WEIGHT_LABEL[task.cognitiveWeight]}
                </span>
              </div>
            </div>

            {/* Pace readout — drift + velocity */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                {syncing && (
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-green-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    title="Syncing check-in..."
                  />
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  {isComplete ? 'done' : pace.drift >= 0 ? 'ahead' : 'behind'}
                </span>
              </div>
              {!isComplete && (
                <>
                  <span className="font-mono font-bold text-base leading-none" style={{ color: driftColor }}>
                    {pace.drift > 0 ? '+' : ''}{pace.drift}%
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    {pace.velocityRate}%/d · need {pace.requiredRate}%/d
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Pace chart — expected vs actual over time */}
          {!isComplete && (
            <div className="mt-3">
              <PaceChart task={{ ...task, completionPercent: localProgress }} isDark={isDark} compact metrics={pace} />
            </div>
          )}

          {/* Progress log slider — available on every active task */}
          {!isComplete && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 pt-3 overflow-hidden relative" style={{ borderTop: `1px solid ${dividerColor}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>Progress Log</span>
                <motion.span key={`${localProgress}-${pace.requiredHoursPerDay}`}
                  initial={{ opacity: 0.5, x: 4 }} animate={{ opacity: 1, x: 0 }}
                  className="font-mono text-[11px] font-semibold" style={{ color: cfg.accent }}>
                  {localProgress}% — {pace.requiredHoursPerDay}h/day to finish
                </motion.span>
              </div>
              <div className="relative">
                <input type="range" min={0} max={100} value={localProgress} onChange={handleSlider}
                  onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                  className="w-full velocity-slider"
                  style={{ '--slider-accent': cfg.accent } as React.CSSProperties} />
                {/* Inline hint — always correct, no portal positioning needed */}
                <span style={{
                  position: 'absolute', right: 0, top: -16,
                  fontSize: 8, fontFamily: 'JetBrains Mono, monospace',
                  color: `${cfg.accent}70`, pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>
                  drag to log progress · syncs trust score
                </span>
              </div>
            </motion.div>
          )}

          {/* Negotiate */}
          {showNeg && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${dividerColor}` }}>
              <motion.button onClick={e => { e.stopPropagation(); actionClickedRef.current = true; onNegotiate?.(); }}
                data-tour="tour-negotiate"
                whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: task.status === 'RED' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  border: task.status === 'RED' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  color: task.status === 'RED' ? '#f87171' : '#fbbf24',
                }}>
                <MessageSquare size={10} />
                Negotiate with {task.recipientName}
              </motion.button>
            </div>
          )}

          {/* Panic Mode button — always visible for RED tasks */}
          {task.status === 'RED' && !isComplete && (
            <div className={`${showNeg ? 'mt-2' : 'mt-3 pt-3'}`} style={showNeg ? {} : { borderTop: `1px solid ${dividerColor}` }}>
              <motion.button
                data-tour="tour-panic"
                onClick={e => { e.stopPropagation(); actionClickedRef.current = true; onHotStart?.(); }}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.22)',
                  color: '#f87171',
                }}
                animate={isHot ? { boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 10px rgba(239,68,68,0.4)', '0 0 0px rgba(239,68,68,0)'] } : {}}
                transition={isHot ? { duration: 1.4, repeat: Infinity } : {}}
              >
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.0, repeat: Infinity }}
                >
                  <AlertTriangle size={10} />
                </motion.div>
                ⚡ Activate Panic Mode
              </motion.button>
            </div>
          )}
        </div>

        {/* Bottom progress bar */}
        <div className="absolute bottom-0 left-[3px] right-0 h-[2px]" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' }}>
          <motion.div className="h-full"
            initial={{ width: 0 }}
            animate={{ width: `${isComplete ? 100 : localProgress}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.4 }}
            style={{ background: `linear-gradient(90deg,${cfg.accent}88,${cfg.accent})`, boxShadow: `0 0 8px ${cfg.progressGlow}` }} />
        </div>
      </motion.div>

      {/* Detail modal */}
      <AnimatePresence>
        {modalOpen && (
          <TaskDetailModal
            task={{ ...task, completionPercent: localProgress, currentPaceHoursPerDay: isComplete ? 0 : adjustedHours }}
            isDark={isDark}
            onClose={() => setModalOpen(false)}
            onMarkComplete={() => { setModalOpen(false); onMarkComplete?.(); }}
            onProgressUpdate={val => { setLocalProgress(val); onProgressUpdate?.(val); }}
            onNegotiate={() => onNegotiate?.()}
            onHotStart={() => { setModalOpen(false); onHotStart?.(); }} />
        )}
      </AnimatePresence>
    </>
  );
};

function formatDeadline(iso: string): string {
  const diffH = (new Date(iso).getTime() - Date.now()) / 3600000;
  if (diffH < 0) return 'Overdue';
  if (diffH < 24) return `Due in ${Math.round(diffH)}h`;
  if (diffH < 48) return 'Due tomorrow';
  return `Due ${new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

export default TaskCard;
