/**
 * DeadlineConfirmModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown when Gemini extracts a task but couldn't determine a deadline.
 * User picks the deadline before the task is added to the board.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, X, Check } from 'lucide-react';
import { Task } from '../types';

interface DeadlineConfirmModalProps {
  tasks: Task[];          // tasks missing confirmed deadlines
  isDark: boolean;
  onConfirm: (tasks: Task[]) => void;   // tasks with deadlines filled in
  onDismiss: () => void;
}

// Quick-pick options relative to now
function quickOptions(): { label: string; iso: string }[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const todayEod = new Date(now);
  todayEod.setHours(23, 59, 0, 0);

  const tonight9 = new Date(now);
  tonight9.setHours(21, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);

  const in3 = new Date(now);
  in3.setDate(in3.getDate() + 3);
  in3.setHours(23, 59, 0, 0);

  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  in7.setHours(23, 59, 0, 0);

  const opts = [];
  if (now.getHours() < 21) opts.push({ label: 'Tonight 9pm', iso: tonight9.toISOString() });
  opts.push(
    { label: 'Today end of day', iso: todayEod.toISOString() },
    { label: 'Tomorrow', iso: tomorrow.toISOString() },
    { label: 'In 3 days', iso: in3.toISOString() },
    { label: 'In 1 week', iso: in7.toISOString() },
  );
  return opts;
}

const DeadlineConfirmModal: React.FC<DeadlineConfirmModalProps> = ({
  tasks, isDark, onConfirm, onDismiss,
}) => {
  // One deadline per task — default to tomorrow EOD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [deadlines, setDeadlines] = useState<Record<string, string>>(
    Object.fromEntries(tasks.map(t => [t.id, toLocalInput(t.deadline || tomorrow.toISOString())]))
  );

  const surfaceBg     = isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.98)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const inputBg       = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const quick         = quickOptions();

  const handleConfirm = () => {
    const updated = tasks.map(t => ({
      ...t,
      deadline: new Date(deadlines[t.id]).toISOString(),
      deadlineExplicit: true,
    }));
    onConfirm(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
      >
        {/* Top accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#22c55e 30%,#38bdf8 70%,transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: `1px solid ${surfaceBorder}` }}>
          <div className="flex items-center gap-2">
            <Calendar size={13} style={{ color: '#22c55e' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              When {tasks.length === 1 ? 'is this' : 'are these'} due?
            </span>
          </div>
          <button onClick={onDismiss} style={{ color: 'var(--text-faint)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {tasks.map(task => (
            <div key={task.id}>
              <p className="text-xs font-semibold mb-2 truncate" style={{ color: 'var(--text-primary)' }}>
                {task.taskName}
              </p>

              {/* Quick picks */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {quick.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setDeadlines(d => ({ ...d, [task.id]: toLocalInput(opt.iso) }))}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full transition-all"
                    style={{
                      background: deadlines[task.id] === toLocalInput(opt.iso)
                        ? 'rgba(34,197,94,0.15)' : inputBg,
                      border: deadlines[task.id] === toLocalInput(opt.iso)
                        ? '1px solid rgba(34,197,94,0.4)' : `1px solid ${surfaceBorder}`,
                      color: deadlines[task.id] === toLocalInput(opt.iso)
                        ? '#4ade80' : 'var(--text-muted)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom datetime input */}
              <div className="flex items-center gap-2">
                <Clock size={11} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                <input
                  type="datetime-local"
                  value={deadlines[task.id]}
                  onChange={e => setDeadlines(d => ({ ...d, [task.id]: e.target.value }))}
                  className="flex-1 text-xs font-mono px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: inputBg,
                    border: `1px solid ${surfaceBorder}`,
                    color: 'var(--text-primary)',
                    colorScheme: isDark ? 'dark' : 'light',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: inputBg, border: `1px solid ${surfaceBorder}`, color: 'var(--text-muted)' }}
          >
            Skip — add anyway
          </button>
          <motion.button
            onClick={handleConfirm}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000' }}
          >
            <Check size={13} />
            Add {tasks.length === 1 ? 'task' : `${tasks.length} tasks`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DeadlineConfirmModal;
