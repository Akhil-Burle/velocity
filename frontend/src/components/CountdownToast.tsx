/**
 * CountdownToast.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The confirm-by-exception interaction pattern for Phase 2.
 * "AI is about to act — you have X seconds to cancel or edit."
 *
 * Used consistently across:
 *   - Negotiate / Delay Email: "Sending in 0:09 · Cancel · Edit"
 *   - Triage auto-reschedule: "Rescheduling in 0:07 · Undo"
 *   - Inbox actions: "Archiving in 0:05 · Cancel"
 *
 * Props:
 *   message     — plain-English description of what the AI is about to do
 *   subtext     — optional second line (e.g. task name, recipient)
 *   duration    — countdown seconds (default 10)
 *   color       — accent color ('amber' | 'green' | 'red' | 'blue')
 *   onExecute   — called when countdown reaches 0 (AI acts)
 *   onCancel    — called if user clicks Cancel before timer
 *   onEdit      — optional "Edit" action (opens edit modal)
 *   isDark      — theme flag
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Bot, CheckCircle2 } from 'lucide-react';

export type CountdownColor = 'amber' | 'green' | 'red' | 'blue';

interface CountdownToastProps {
  message: string;
  subtext?: string;
  duration?: number;
  color?: CountdownColor;
  onExecute: () => void;
  onCancel: () => void;
  onEdit?: () => void;
  isDark?: boolean;
}

const COLOR_MAP: Record<CountdownColor, { bg: string; border: string; text: string; track: string; fill: string }> = {
  amber: {
    bg:     'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    text:   '#fbbf24',
    track:  'rgba(245,158,11,0.18)',
    fill:   '#f59e0b',
  },
  green: {
    bg:     'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.30)',
    text:   '#4ade80',
    track:  'rgba(34,197,94,0.18)',
    fill:   '#22c55e',
  },
  red: {
    bg:     'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.28)',
    text:   '#f87171',
    track:  'rgba(239,68,68,0.18)',
    fill:   '#ef4444',
  },
  blue: {
    bg:     'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.28)',
    text:   '#38bdf8',
    track:  'rgba(56,189,248,0.18)',
    fill:   '#0ea5e9',
  },
};

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const CountdownToast: React.FC<CountdownToastProps> = ({
  message,
  subtext,
  duration = 10,
  color = 'amber',
  onExecute,
  onCancel,
  onEdit,
  isDark = true,
}) => {
  const [remaining, setRemaining] = useState(duration);
  const [executed, setExecuted] = useState(false);
  const executedRef = useRef(false);
  const c = COLOR_MAP[color];

  const doExecute = useCallback(() => {
    if (executedRef.current) return;
    executedRef.current = true;
    setExecuted(true);
    onExecute();
  }, [onExecute]);

  useEffect(() => {
    if (remaining <= 0) { doExecute(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, doExecute]);

  const progressPct = ((duration - remaining) / duration) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="flex flex-col gap-2 px-4 py-3 rounded-2xl w-full max-w-sm"
      style={{
        background: isDark ? c.bg : c.bg.replace('0.10', '0.07'),
        border: `1px solid ${c.border}`,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 4px 24px ${c.bg}, 0 2px 8px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Top row: icon + message + cancel */}
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
          {executed ? <CheckCircle2 size={13} /> : <Bot size={13} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {executed ? 'Done — AI acted' : message}
          </p>
          {subtext && (
            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
              {subtext}
            </p>
          )}
        </div>

        {!executed && (
          <motion.button
            onClick={onCancel}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-faint)' }}
          >
            <X size={11} />
          </motion.button>
        )}
      </div>

      {/* Progress bar */}
      {!executed && (
        <div className="rounded-full overflow-hidden h-1" style={{ background: c.track }}>
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.9, ease: 'linear' }}
            style={{ background: c.fill }}
          />
        </div>
      )}

      {/* Bottom row: timer + action buttons */}
      {!executed && (
        <div className="flex items-center gap-2">
          {/* Countdown pill */}
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
            style={{ background: c.track, color: c.text }}>
            {formatSeconds(remaining)}
          </span>

          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
            then acting automatically
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {onEdit && (
              <motion.button
                onClick={onEdit}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Pencil size={9} />
                Edit
              </motion.button>
            )}
            <motion.button
              onClick={onCancel}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold"
              style={{ background: `${c.bg}`, color: c.text, border: `1px solid ${c.border}` }}
            >
              Cancel
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CountdownToast;
