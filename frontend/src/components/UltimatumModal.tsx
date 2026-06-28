/**
 * UltimatumModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A deliberate, uncomfortable-by-design moment. Forces the user to consciously
 * choose which task fails — no silent dismiss, no remind-later.
 *
 * Design rules:
 *  - No new colors. Uses existing critical-red tokens: #ef4444 / #f87171.
 *  - Reuses existing Modal, Card, and Button patterns verbatim.
 *  - Discomfort comes from content and interaction, not visual novelty.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Brain, AlertTriangle, Calendar, X } from 'lucide-react';
import { Task } from '../types';
import { resolveUltimatum } from '../api';
import { fmtHours } from '../data';

interface UltimatumModalProps {
  taskA: Task; // includes failureCost
  taskB: Task; // includes failureCost
  isDark?: boolean;
  onResolved: (losingTask: Task, winningTask: Task, confirmation: string) => void;
  onEscape: () => void; // "Manually adjust my schedule instead" — goes to Calendar
}

function formatDeadlineVerbose(iso: string): string {
  const d = new Date(iso);
  const diffH = (d.getTime() - Date.now()) / 3600000;
  const abs = new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (diffH < 0) return `Overdue · ${abs}`;
  if (diffH < 24) return `Due in ${Math.round(diffH)}h · ${abs}`;
  if (diffH < 48) return `Due tomorrow · ${abs}`;
  return `Due ${abs} · ${(diffH / 24).toFixed(0)} days`;
}

const WEIGHT_LABEL: Record<string, string> = {
  LOW: 'Low cognitive load',
  MEDIUM: 'Medium cognitive load',
  HIGH: 'High cognitive load',
};

// ── Single task card ─────────────────────────────────────────────────────────

interface ConflictCardProps {
  task: Task;
  isDark: boolean;
  onChooseFail: () => void;
  disabled: boolean;
  isChosen: boolean;
}

const ConflictCard: React.FC<ConflictCardProps> = ({
  task, isDark, onChooseFail, disabled, isChosen,
}) => {
  const sectionBg    = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)';
  const sectionBorder= isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.07)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.07)';
  const cardBg       = isDark ? 'rgba(14,20,28,0.98)'      : 'rgba(255,255,255,0.97)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        background: cardBg,
        border: `1px solid rgba(239,68,68,0.28)`,
        boxShadow: isChosen
          ? '0 0 0 2px rgba(239,68,68,0.6), 0 8px 32px rgba(239,68,68,0.15)'
          : '0 2px 12px rgba(0,0,0,0.2)',
        opacity: disabled && !isChosen ? 0.4 : 1,
      }}
    >
      {/* Left accent bar — red, always */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
           style={{ background: '#ef4444' }} />

      {/* Bottom progress bar — unchanged completion */}
      <div className="absolute bottom-0 left-[3px] right-0 h-[2px]"
           style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' }}>
        <div className="h-full"
          style={{
            width: `${task.completionPercent}%`,
            background: 'linear-gradient(90deg,rgba(239,68,68,0.6),#ef4444)',
            boxShadow: '0 0 8px rgba(239,68,68,0.4)',
          }} />
      </div>

      <div className="px-4 pt-4 pb-5 ml-[3px] flex flex-col flex-1">
        {/* Task name */}
        <div className="flex items-start gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]"
                style={{ background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <h3 className="font-semibold text-[14px] leading-snug tracking-tight"
              style={{ color: 'var(--text-primary)' }}>
            {task.taskName}
          </h3>
        </div>

        {/* Meta row */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar size={10} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {formatDeadlineVerbose(task.deadline)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Brain size={10} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {WEIGHT_LABEL[task.cognitiveWeight]}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={10} style={{ color: '#f87171' }} />
            <span className="text-[11px] font-mono" style={{ color: '#f87171' }}>
              {fmtHours(task.currentPaceHoursPerDay)}/day required
            </span>
          </div>
        </div>

        {/* Failure cost — the honest Gemini-generated line */}
        <div className="mb-4 px-3 py-2.5 rounded-lg flex-1"
             style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
            If this fails:{' '}
          </span>
          <span className="text-[11px] leading-relaxed" style={{ color: '#fca5a5' }}>
            {task.failureCost || 'This task will not be completed.'}
          </span>
        </div>

        {/* The button */}
        <div className="mt-auto" style={{ borderTop: `1px solid ${dividerColor}`, paddingTop: '12px' }}>
          <motion.button
            onClick={onChooseFail}
            disabled={disabled}
            whileHover={!disabled ? { scale: 1.02, y: -1 } : {}}
            whileTap={!disabled ? { scale: 0.97 } : {}}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all"
            style={isChosen
              ? {
                  background: 'rgba(239,68,68,0.22)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.5)',
                  cursor: 'default',
                }
              : {
                  background: 'rgba(239,68,68,0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.22)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }
            }
          >
            {isChosen ? (
              <>
                <AlertTriangle size={12} />
                Marked as failing
              </>
            ) : (
              'Let this one fail'
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Modal shell ──────────────────────────────────────────────────────────────

const UltimatumModal: React.FC<UltimatumModalProps> = ({
  taskA, taskB, isDark = true, onResolved, onEscape,
}) => {
  const [resolving, setResolving] = useState(false);
  const [chosenLoser, setChosenLoser] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modalBg = isDark
    ? 'linear-gradient(140deg,#0e0f14 0%,#0a0b10 100%)'
    : 'linear-gradient(140deg,#ffffff 0%,#f8fafc 100%)';
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const handleChooseFail = async (loser: Task, winner: Task) => {
    if (resolving || chosenLoser) return;
    setChosenLoser(loser.id);
    setResolving(true);
    setError(null);

    try {
      const result = await resolveUltimatum(winner.id, loser.id);
      setConfirmation(result.confirmation);
      // Give user 2.2s to read the confirmation before closing
      setTimeout(() => {
        onResolved(result.losingTask, result.winningTask, result.confirmation);
      }, 2200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve ultimatum');
      setChosenLoser(null);
      setResolving(false);
    }
  };

  return (
    // No onClick on backdrop — intentionally non-dismissable
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: modalBg,
          border: '1px solid rgba(239,68,68,0.3)',
          boxShadow: '0 0 0 1px rgba(239,68,68,0.15), 0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(239,68,68,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="h-[2px]"
             style={{ background: 'linear-gradient(90deg,transparent,#ef4444 30%,#ef4444 70%,transparent)' }} />

        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                </motion.div>
                <span className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: '#f87171' }}>
                  Ultimatum
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}>
                You cannot finish both of these.
              </h2>
              <p className="text-xs mt-1.5 leading-relaxed"
                 style={{ color: 'var(--text-muted)' }}>
                Your schedule is infeasible. One of these tasks will not be completed.
                Choose consciously which one fails.
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation screen */}
        <AnimatePresence mode="wait">
          {confirmation ? (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-6 py-10 flex flex-col items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle size={18} style={{ color: '#f87171' }} />
              </div>
              <p className="text-sm text-center leading-relaxed font-mono max-w-sm"
                 style={{ color: 'var(--text-secondary)' }}>
                {confirmation}
              </p>
              <p className="text-[10px] font-mono"
                 style={{ color: 'var(--text-faint)' }}>
                This decision has been logged.
              </p>
            </motion.div>
          ) : (
            <motion.div key="choose" exit={{ opacity: 0 }}>
              {/* Two-card layout */}
              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConflictCard
                  task={taskA}
                  isDark={isDark}
                  onChooseFail={() => handleChooseFail(taskA, taskB)}
                  disabled={resolving || chosenLoser !== null}
                  isChosen={chosenLoser === taskA.id}
                />
                <ConflictCard
                  task={taskB}
                  isDark={isDark}
                  onChooseFail={() => handleChooseFail(taskB, taskA)}
                  disabled={resolving || chosenLoser !== null}
                  isChosen={chosenLoser === taskB.id}
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-6 mb-3 px-4 py-2.5 rounded-lg text-xs font-mono"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer — the only escape hatch */}
              <div className="px-6 py-4 flex items-center justify-between"
                   style={{ borderTop: `1px solid ${divider}` }}>
                <span className="text-[10px] font-mono"
                      style={{ color: 'var(--text-faint)' }}>
                  This decision cannot be reversed through Triage.
                </span>
                <motion.button
                  onClick={onEscape}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${divider}`,
                    color: 'var(--text-faint)',
                  }}
                >
                  <X size={11} />
                  Manually adjust my schedule instead
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default UltimatumModal;
