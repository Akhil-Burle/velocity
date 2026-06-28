/**
 * Toast.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A self-contained toast notification system.
 *
 * Usage:
 *   const { addToast } = useToast();
 *   addToast({ type: 'error', message: 'Something went wrong' });
 *   addToast({ type: 'warning', message: 'Task in critical velocity', duration: 5000 });
 *   addToast({ type: 'success', message: '◆ +10 VC earned' });
 *   addToast({ type: 'info', message: 'Triage complete' });
 *
 * Toasts stack in the top-right corner, slide in from the right,
 * and auto-dismiss after `duration` ms (default 4500).
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle2, Info, Zap } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 4500
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ── Config per type ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ToastType, {
  icon: React.ReactNode;
  bg: string;
  border: string;
  iconColor: string;
  textColor: string;
  progressColor: string;
}> = {
  success: {
    icon: <CheckCircle2 size={13} />,
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.28)',
    iconColor: '#22c55e',
    textColor: '#4ade80',
    progressColor: '#22c55e',
  },
  error: {
    icon: <AlertTriangle size={13} />,
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.28)',
    iconColor: '#ef4444',
    textColor: '#f87171',
    progressColor: '#ef4444',
  },
  warning: {
    icon: <Zap size={13} />,
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.28)',
    iconColor: '#f59e0b',
    textColor: '#fbbf24',
    progressColor: '#f59e0b',
  },
  info: {
    icon: <Info size={13} />,
    bg: 'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.28)',
    iconColor: '#38bdf8',
    textColor: '#7dd3fc',
    progressColor: '#38bdf8',
  },
};

// ── Single Toast item ─────────────────────────────────────────────────────────

const ToastCard: React.FC<{
  toast: ToastItem;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const cfg = TYPE_CONFIG[toast.type];
  const duration = toast.duration ?? 4500;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="relative flex items-start gap-3 px-4 py-3 rounded-2xl overflow-hidden w-full"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(20px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.25), 0 0 0 0.5px ${cfg.border}`,
        minWidth: 280,
        maxWidth: 360,
      }}
    >
      {/* Progress bar draining from bottom */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px] rounded-full"
        style={{ background: cfg.progressColor, opacity: 0.5 }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />

      {/* Icon */}
      <div className="shrink-0 mt-0.5" style={{ color: cfg.iconColor }}>
        {cfg.icon}
      </div>

      {/* Message */}
      <p className="flex-1 text-xs font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <span style={{ color: cfg.textColor, fontWeight: 600 }}>
          {toast.type === 'error' ? 'Error · ' :
           toast.type === 'warning' ? '' :
           toast.type === 'success' ? '' : ''}
        </span>
        {toast.message}
      </p>

      {/* Dismiss */}
      <motion.button
        onClick={() => onRemove(toast.id)}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
        style={{ color: 'var(--text-faint)', background: 'rgba(255,255,255,0.06)' }}
      >
        <X size={10} />
      </motion.button>
    </motion.div>
  );
};

// ── Provider ──────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? 4500;

    setToasts(prev => {
      // Cap at 4 toasts — remove oldest if over
      const next = [...prev, { ...toast, id, duration }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });

    const timer = setTimeout(() => removeToast(id), duration);
    timers.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast stack — top-right, stacks downward */}
      <div
        className="fixed top-4 right-4 z-[9998] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 360 }}
      >
        <AnimatePresence mode="sync">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastCard toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
