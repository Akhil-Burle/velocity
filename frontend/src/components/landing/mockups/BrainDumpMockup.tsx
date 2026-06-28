/**
 * BrainDumpMockup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated mockup for the Brain Dump feature section. Shows structured task
 * output extracted from a raw "brain dump" input, with a staggered line reveal.
 *
 * Props:
 *   triggered     – set to true by FeatureSection when it enters the viewport
 *   reducedMotion – when true, renders all lines in final visible state immediately
 *
 * Requirements: 4.4, 4.10
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface BrainDumpMockupProps {
  triggered: boolean;
  reducedMotion: boolean;
}

interface TaskLine {
  id: string;
  raw: string;
  deadline: string;
  effort: string;
  urgency: 'high' | 'medium' | 'low';
}

const TASK_LINES: TaskLine[] = [
  {
    id: 'task-1',
    raw: 'React Lab',
    deadline: 'tomorrow',
    effort: '3h',
    urgency: 'high',
  },
  {
    id: 'task-2',
    raw: 'Physics Essay',
    deadline: 'Friday',
    effort: '2h',
    urgency: 'medium',
  },
  {
    id: 'task-3',
    raw: 'Email Prof Chen',
    deadline: 'today',
    effort: '20min',
    urgency: 'high',
  },
  {
    id: 'task-4',
    raw: 'Study for Calc Midterm',
    deadline: 'next Monday',
    effort: '4h',
    urgency: 'medium',
  },
  {
    id: 'task-5',
    raw: 'Submit Lab Report',
    deadline: 'Thursday',
    effort: '1.5h',
    urgency: 'low',
  },
];

const URGENCY_COLORS: Record<TaskLine['urgency'], string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const URGENCY_BG: Record<TaskLine['urgency'], string> = {
  high: 'rgba(239,68,68,0.12)',
  medium: 'rgba(245,158,11,0.12)',
  low: 'rgba(34,197,94,0.12)',
};

/** 80ms stagger delay per line, as specified in the task */
const STAGGER_DELAY_MS = 0.08;

const BrainDumpMockup: React.FC<BrainDumpMockupProps> = ({ triggered, reducedMotion }) => {
  const shouldAnimate = triggered && !reducedMotion;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <Zap size={13} color="#22c55e" />
        <span
          className="text-xs font-semibold font-mono tracking-wide"
          style={{ color: '#22c55e' }}
        >
          brain dump → structured
        </span>
      </div>

      {/* Raw input preview */}
      <div
        className="px-4 py-3 font-mono text-xs"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          color: 'var(--text-faint)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>$ </span>
        React lab tomorrow ~3h, physics essay friday ~2h, email prof chen today...
      </div>

      {/* Extracted task lines */}
      <div className="px-3 py-3 flex flex-col gap-2">
        {TASK_LINES.map((task, index) => (
          <motion.div
            key={task.id}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={
              reducedMotion
                ? { opacity: 1, y: 0 }
                : shouldAnimate
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 10 }
            }
            transition={
              reducedMotion
                ? { duration: 0 }
                : {
                    duration: 0.3,
                    delay: index * STAGGER_DELAY_MS,
                    ease: [0.16, 1, 0.3, 1],
                  }
            }
            className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Task name */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: URGENCY_COLORS[task.urgency] }}
                aria-hidden="true"
              />
              <span
                className="text-xs font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {task.raw}
              </span>
            </div>

            {/* Meta tags */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface-md)',
                }}
              >
                {task.deadline}
              </span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: URGENCY_COLORS[task.urgency],
                  background: URGENCY_BG[task.urgency],
                }}
              >
                {task.effort}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BrainDumpMockup;
