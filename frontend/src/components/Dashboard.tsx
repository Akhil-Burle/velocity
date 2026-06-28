import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useInView, useDragControls } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap, FastForward, CheckCircle, ChevronRight,
  RefreshCw, TrendingUp, Clock, LayoutGrid, AlertTriangle, Plus,
} from 'lucide-react';import { Task, PaceStatus } from '../types';

// OS-aware keyboard shortcut label
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const KBD_LABEL = IS_MAC ? '⌘K' : 'Ctrl+K';
import { calcRequiredHoursPerDay, derivePaceStatus, computePaceMetrics, fmtHours } from '../data';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import TaskCard from './TaskCard';
import HotStartPanel from './HotStartPanel';
import NegotiateModal from './NegotiateModal';
import TaskDetailModal from './TaskDetailModal';
import CreateTaskModal from './CreateTaskModal';
import VelocityReport from './VelocityReport';
import SkeletonCard from './SkeletonCard';
import BrainDumpInput from './BrainDumpInput';
import BurnoutChart from './BurnoutChart';
import ForecastPanel from './ForecastPanel';
import OmniBar from './OmniBar';
import {
  submitBrainDump,
  fetchTasks,
  updateTask as apiUpdateTask,
  completeTask as apiCompleteTask,
  getHotStart,
  runTriage,
  getNegotiateDraft,
  evaluateUltimatum,
  runPanicScaffold,
} from '../api';
import UltimatumModal from './UltimatumModal';
import PanicModePanel from './PanicModePanel';
import GuidedTour from './GuidedTour';
import StartHereCard from './StartHereCard';
import CountdownToast from './CountdownToast';
import { useToast } from './Toast';
import DeadlineConfirmModal from './DeadlineConfirmModal';
import type { TourStep } from './GuidedTour';
import InfoTooltip from './InfoTooltip';

interface DashboardProps { brainDumpText?: string; }
interface NegotiateTarget { taskId: string; taskName: string; recipientName: string; draft: string; }
interface UltimatumState { taskA: Task; taskB: Task; }
interface PanicState { task: Task; checklist: string[]; boilerplate: string; repoUrl?: string; loading: boolean; }

const SKELETON_MS = 1200;

// ── Animated number counter ───────────────────────────────────────────────────
const Counter: React.FC<{ to: number | string; duration?: number }> = ({ to, duration = 800 }) => {
  const num = parseFloat(String(to));
  const suffix = String(to).replace(String(num), '');
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || isNaN(num)) return;
    let start = 0; const steps = 40; const step = num / steps;
    const t = setInterval(() => {
      start += step;
      if (start >= num) { setVal(num); clearInterval(t); } else setVal(parseFloat(start.toFixed(1)));
    }, duration / steps);
    return () => clearInterval(t);
  }, [inView, num, duration]);

  if (isNaN(num)) return <span>{to}</span>;
  return <span ref={ref}>{Number.isInteger(num) ? val : val.toFixed(1)}{suffix}</span>;
};

// ── Section divider ────────────────────────────────────────────────────────────
const SectionDivider: React.FC<{ label: string; count?: number; dimmed?: boolean; accent?: string; isDark: boolean }> = ({ label, count, dimmed, accent, isDark }) => {
  const labelColor = dimmed ? (isDark ? '#52525b' : '#94a3b8') : (accent ?? (isDark ? '#94a3b8' : '#64748b'));
  const lineColor = dimmed ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)');
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono uppercase tracking-widest shrink-0" style={{ color: labelColor }}>
        {label}
        {count !== undefined && (
          <motion.span key={count} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: `1px solid ${lineColor}`, color: labelColor }}>
            {count}
          </motion.span>
        )}
      </span>
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 h-px origin-left" style={{ background: lineColor }} />
      <ChevronRight size={11} style={{ color: dimmed ? (isDark ? '#3f3f46' : '#cbd5e1') : (isDark ? '#52525b' : '#94a3b8') }} />
    </div>
  );
};

// ── Stat chip ─────────────────────────────────────────────────────────────────
const StatChip: React.FC<{ value: string; label: string; color: string; pulse?: boolean; isDark: boolean }> = ({ value, label, color, pulse, isDark }) => (
  <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono"
    style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pulse ? 'animate-pulse' : ''}`} style={{ background: color }} />
    <span style={{ color }}>{value}</span>
    <span style={{ color: isDark ? '#71717a' : '#64748b' }}>{label}</span>
  </motion.div>
);

// ── DraggableTaskCard — wraps Reorder.Item with per-card drag controls ────────
// dragControls lets the user drag only by the GripVertical handle, not the whole card.
interface DraggableTaskCardProps {
  task: Task;
  idx: number;
  fastForwarded: boolean;
  isDark: boolean;
  onNegotiate: () => void;
  onHotStart: () => void;
  onMarkComplete: () => void;
  onProgressUpdate: (pct: number) => void;
  onTaskUpdate: (updated: Task) => void;
  onOpenDetail: (task: Task) => void;
}
const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({
  task, idx, fastForwarded, isDark, onNegotiate, onHotStart, onMarkComplete, onProgressUpdate, onTaskUpdate, onOpenDetail,
}) => {
  const controls = useDragControls();
  return (
    <Reorder.Item key={task.id} value={task} as="div" dragListener={false} dragControls={controls}>
      <motion.div
        data-tour={idx === 0 ? 'tour-task-card' : undefined}
        initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92, y: -10 }}
        transition={{ delay: idx * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
        <TaskCard
          task={task}
          isHot={task.status === 'RED' && fastForwarded}
          isDark={isDark}
          onNegotiate={onNegotiate}
          onHotStart={onHotStart}
          onMarkComplete={onMarkComplete}
          onProgressUpdate={onProgressUpdate}
          onTaskUpdate={onTaskUpdate}
          onOpenDetail={onOpenDetail}
          dragControls={controls}
        />
      </motion.div>
    </Reorder.Item>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard: React.FC<DashboardProps> = ({ brainDumpText }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { award } = useCredits();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hotStartTask, setHotStartTask] = useState<Task | null>(null);
  const [hotStartContent, setHotStartContent] = useState('');
  const [negotiateTarget, setNegotiateTarget] = useState<NegotiateTarget | null>(null);
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [fastForwarded, setFastForwarded] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [negotiateLoading, setNegotiateLoading] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const [ultimatum, setUltimatum] = useState<UltimatumState | null>(null);
  // Zero-Hour state
  const [panicState, setPanicState]     = useState<PanicState | null>(null);
  // OmniBar state
  const [omniBarOpen, setOmniBarOpen]   = useState(false);
  const [forecastHealth, setForecastHealth] = useState<number | null>(null);
  const [pendingDeadlineTasks, setPendingDeadlineTasks] = useState<Task[]>([]);
  // Pending triage — shows a countdown toast before actually applying the reschedule
  const [pendingTriage, setPendingTriage] = useState<{ taskId: string; taskName: string } | null>(null);
  const prevStatusRef = useRef<Record<string, PaceStatus>>({});
  // Detail modal — lifted to Dashboard level so Reorder re-renders never close it
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // ── Tour target refs ───────────────────────────────────────────────────────
  const [tourDone, setTourDone] = useState(false);

  // All tour steps use data-tour selector — no direct refs needed
  const TOUR_STEPS: TourStep[] = [
    {
      target: 'tour-agent-log-link',
      title: '① Agent Log — start here',
      body: 'This is where Velocity proves it\'s truly agentic. Every autonomous AI action is logged here with timestamps and plain-English reasoning.',
      placement: 'bottom',
      color: '#22c55e',
    },
    {
      target: 'tour-panic',
      title: '② Panic Mode',
      body: 'On RED tasks, "Activate Panic Mode" autonomously generates a rescue checklist + boilerplate and commits it to a real GitHub repo — no extra input.',
      placement: 'top',
      color: '#ef4444',
    },
    {
      target: 'tour-braindump',
      title: '③ Brain Dump',
      body: 'Type anything here — "React lab due Friday, DBMS homework." AI parses deadlines, priority, and cognitive load instantly.',
      placement: 'bottom',
      color: '#22c55e',
    },
    {
      target: 'tour-omni',
      title: '④ AI Command Bar  ' + KBD_LABEL,
      body: 'Press ' + KBD_LABEL + ' anywhere to talk to Velocity in plain English. "I\'m behind on everything" → AI picks the right action.',
      placement: 'bottom',
      color: '#22c55e',
    },
    {
      target: 'tour-camera',
      title: '⑤ Chaos Scanner',
      body: 'Click "Scan" and drop a photo of your whiteboard, syllabus, or schedule. Gemini Vision extracts every task automatically.',
      placement: 'bottom',
      color: '#22c55e',
    },
    {
      target: 'tour-burnout',
      title: '⑥ Burnout Horizon',
      body: '14-day workload forecast. Red = over capacity today. Click "Run Triage Now" to let AI decide what to defer.',
      placement: 'top',
      color: '#ef4444',
    },
    {
      target: 'tour-triage',
      title: '⑦ Triage + Ultimatum',
      body: 'Click Triage when overloaded. If two tasks can\'t both finish, the Ultimatum modal forces a conscious choice about what fails.',
      placement: 'bottom',
      color: '#f59e0b',
    },
    {
      target: 'tour-task-card',
      title: '⑧ Task Cards + Drag',
      body: 'Each card shows live pace, a sparkline, and ⠿ drag handle to reorder. Click a card for the full detail view + progress slider.',
      placement: 'right',
      color: '#22c55e',
    },
    {
      target: 'tour-negotiate',
      title: '⑨ Negotiate',
      body: 'Tasks owed to someone show "Negotiate" — AI drafts a professional extension email. One-Tap Send delivers it immediately.',
      placement: 'top',
      color: '#f59e0b',
    },
  ];
  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  const loadTasks = async () => {
    setLoading(true);
    try {
      if (brainDumpText && brainDumpText.trim()) {
        const newTasks = await submitBrainDump(brainDumpText);
        setTasks(newTasks);
      } else {
        const existingTasks = await fetchTasks();
        setTasks(existingTasks);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tasks';
      addToast({ type: 'error', message: `${msg}. Is the backend reachable?`, duration: 6000 });
      setTasks([]);
    } finally {
      setTimeout(() => setLoading(false), SKELETON_MS);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [brainDumpText]);

  const activeTasks     = tasks.filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
  const rescheduledTasks= tasks.filter(t => t.isRescheduled || t.status === 'failed'); // failed tasks fold into rescheduled
  const completedTasks  = tasks.filter(t => t.status === 'COMPLETE');
  const onPaceCount = activeTasks.filter(t => t.status === 'GREEN').length;
  const criticalCount = activeTasks.filter(t => t.status === 'RED').length;
  const warningCount = activeTasks.filter(t => t.status === 'AMBER').length;
  const avgHoursRaw = activeTasks.length > 0
    ? activeTasks.reduce((s, t) => s + t.currentPaceHoursPerDay, 0) / activeTasks.length : 0;
  const avgHours = fmtHours(avgHoursRaw);
  // Real velocity score — blend of on-pace ratio + steadiness across active tasks
  const velocityScoreNum = activeTasks.length > 0
    ? Math.round(activeTasks.reduce((s, t) => {
        const m = t.paceMetrics || computePaceMetrics(t);
        const onPaceScore = m.onPace ? 100 : m.willFinishOnTime ? 65 : 30;
        return s + (onPaceScore * 0.6 + m.consistency * 0.4);
      }, 0) / activeTasks.length)
    : 0;
  const velocityScore = activeTasks.length > 0 ? String(velocityScoreNum) : '—';
  const velocityColor = activeTasks.length === 0
    ? 'var(--text-faint)'
    : velocityScoreNum >= 70 ? '#22c55e' : velocityScoreNum >= 50 ? '#f59e0b' : '#ef4444';

  const recalcTelemetry = useCallback((list: Task[]): Task[] =>
    list.map(t => {
      if (t.status === 'COMPLETE' || t.isRescheduled) return t;
      const m = computePaceMetrics(t);
      return { ...t, currentPaceHoursPerDay: m.requiredHoursPerDay, status: m.status, paceMetrics: m };
    }), []);

  // ── Quick task entry from dashboard bar ────────────────────────────────────
  const handleQuickEntry = async (text: string) => {
    setEntryLoading(true);
    try {
      const newTasks = await submitBrainDump(text);
      // Split: tasks with confirmed deadlines go straight to board,
      // tasks without confirmed deadlines go to the deadline picker
      const confirmed   = newTasks.filter(t => t.deadlineExplicit !== false && t.deadline);
      const unconfirmed = newTasks.filter(t => t.deadlineExplicit === false || !t.deadline);
      if (confirmed.length > 0) setTasks(prev => [...prev, ...confirmed]);
      if (unconfirmed.length > 0) setPendingDeadlineTasks(unconfirmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add task';
      addToast({ type: 'error', message: `Quick Entry: ${msg}` });
    } finally {
      setEntryLoading(false);
    }
  };

  const handleFastForward = () => {
    if (fastForwarded) return;
    setFastForwarded(true);
    setTasks(prev => prev.map((t, i) => {
      if (i === 0) return { ...t, currentPaceHoursPerDay: 6.0, status: 'RED' as PaceStatus };
      if (i === tasks.length - 1) return { ...t, isRescheduled: true };
      return t;
    }));
    setTimeout(() => {
      setTasks(prev => {
        const firstActive = prev.find(t => t.status === 'RED' && !t.isRescheduled);
        if (firstActive) { setHotStartTask(firstActive); setHotStartContent(firstActive.hotStartContent || '// Hot-start scaffold loading...'); }
        return prev;
      });
    }, 420);
  };

  const handleMarkComplete = async (taskId: string) => {
    setHotStartTask(null); setHotStartContent('');
    // Optimistic UI — mark complete and clear rescheduled flag so it moves to Completed section
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETE' as PaceStatus, isRescheduled: false } : t));
    try {
      const { creditAward } = await apiCompleteTask(taskId);
      if (creditAward && creditAward.credits > 0) {
        award('task_complete', creditAward.credits);
      }
    } catch {
      // Fall back to a plain status update if the complete endpoint fails
      apiUpdateTask(taskId, { status: 'COMPLETE' as PaceStatus }).catch(() => {});
    }
  };

  const handleOpenHotStart = async (task: Task) => {
    const hoursUntil = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
    const isPanic = hoursUntil < 24; // FIXED: was < 2, now < 24

    if (isPanic) {
      // Zero-Hour: Panic Mode — show panel immediately with loading state
      setPanicState({ task, checklist: [], boilerplate: '', loading: true });
      try {
        const result = await runPanicScaffold(task.id);
        setPanicState({
          task,
          checklist:  result.checklist,
          boilerplate: result.boilerplate,
          repoUrl:    result.repoUrl,
          loading:    false,
        });
        setTasks(prev => prev.map(t => t.id === task.id
          ? { ...t, panicScaffold: { checklist: result.checklist, boilerplate: result.boilerplate, repoUrl: result.repoUrl } }
          : t
        ));
        award('panic_resolved');
      } catch (err: unknown) {
        addToast({ type: 'error', message: `Panic Mode: ${err instanceof Error ? err.message : 'Scaffold failed'}` });
        setPanicState(null);
      }
    } else {
      // Legacy path: regular hot-start for non-critical tasks
      setHotStartTask(task);
      setHotStartContent(task.hotStartContent || '');
      try {
        const result = await getHotStart(task.id);
        setHotStartContent(result.scaffold);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, hotStartContent: result.scaffold } : t));
      } catch (err: unknown) {
        addToast({ type: 'error', message: `Hot-Start: ${err instanceof Error ? err.message : 'Hot-start failed'}` });
      }
    }
  };

  const handleOpenNegotiate = async (task: Task) => {
    if (!task.recipientName) return;
    if (task.negotiatedDraft?.trim()) {
      setNegotiateTarget({ taskId: task.id, taskName: task.taskName, recipientName: task.recipientName, draft: task.negotiatedDraft });
      return;
    }
    setNegotiateLoading(true);
    try {
      const result = await getNegotiateDraft(task.id);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, negotiatedDraft: result.message } : t));
      setNegotiateTarget({ taskId: task.id, taskName: task.taskName, recipientName: task.recipientName, draft: result.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate draft';
      console.error('[Negotiate] Error:', msg);
      addToast({ type: 'error', message: `Negotiate: ${msg}` });
    } finally {
      setNegotiateLoading(false);
    }
  };

  const handleSendEmail = () => {
    if (negotiateTarget) setSentEmails(prev => new Set(prev).add(negotiateTarget.taskId));
    setNegotiateTarget(null);
  };

  const handleTriage = async () => {
    setTriageLoading(true);
    try {
      // First: check for a genuine two-task conflict → Ultimatum
      const evalResult = await evaluateUltimatum();
      if (evalResult.triggered) {
        setUltimatum({ taskA: evalResult.taskA, taskB: evalResult.taskB });
        return; // modal takes over; do NOT run regular triage
      }
      // No head-to-head conflict — run normal triage (single lowest-priority reschedule)
      const result = await runTriage();
      if (result.triaged && result.triagedTask) {
        award('triage_run');
        // Phase 2: show countdown toast — act after window, not immediately
        setPendingTriage({ taskId: result.triagedTask.id, taskName: result.triagedTask.taskName });
      } else {
        addToast({ type: 'info', message: `Triage: ${result.reason}` });
      }
    } catch (err: unknown) {
      addToast({ type: 'error', message: `Triage: ${err instanceof Error ? err.message : 'Triage failed'}` });
    } finally {
      setTriageLoading(false);
    }
  };

  const handleUltimatumResolved = (losingTask: Task, _winningTask: Task, _confirmation: string) => {
    setUltimatum(null);
    // The losing task gets rescheduled — the user made a conscious call to defer it,
    // not abandon it. "Not Completed" is reserved for tasks that hit their deadline untouched.
    setTasks(prev => prev.map(t => t.id === losingTask.id ? { ...t, isRescheduled: true } : t));
  };

  const handleUltimatumEscape = () => {
    setUltimatum(null);
    navigate('/calendar');
  };

  // ── CMD+K OmniBar keyboard shortcut ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmniBarOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Auto-recalc telemetry every 60s — real-time drift detection ─────────────
  useEffect(() => {
    // On first load: snapshot statuses — do NOT toast on initial RED tasks.
    // We only want to notify when a task *degrades* during the session.
    const initialTimer = setTimeout(() => {
      setTasks(prev => {
        const updated = recalcTelemetry(prev);
        // Just snapshot statuses — no toast on load
        updated.forEach(t => { prevStatusRef.current[t.id] = t.status; });
        return updated;
      });
    }, 3500);

    const interval = setInterval(() => {
      setTasks(prev => {
        const updated = recalcTelemetry(prev);
        updated.forEach(t => {
          const prevStatus = prevStatusRef.current[t.id];
          if (prevStatus && prevStatus !== t.status) {
            const degraded =
              (prevStatus === 'GREEN' && (t.status === 'AMBER' || t.status === 'RED')) ||
              (prevStatus === 'AMBER' && t.status === 'RED');
            if (degraded) {
              addToast({ type: 'warning', message: `${t.taskName.slice(0, 35)} degraded to ${t.status}`, duration: 4000 });
            }
          }
          prevStatusRef.current[t.id] = t.status;
        });
        return updated;
      });
    }, 60000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [recalcTelemetry]);

  // ── OmniBar action handler (legacy — kept for handleTriage / handleOpenHotStart calls
  //    via the OmniBar's button-fallback path in low-confidence cases)
  // The new execution path (countdown → omni-execute) bypasses this entirely.
  // This is now only called if a parent still passes onAction; kept for safety.
  const handleOmniAction = useCallback((intent: string, taskId: string | null) => {
    const task = taskId ? tasks.find(t => t.id === taskId) : null;
    switch (intent) {
      case 'panic': case 'panic_mode':
        if (task) handleOpenHotStart(task);
        break;
      case 'triage': case 'run_triage':
        handleTriage();
        break;
      case 'negotiate':
        if (task) handleOpenNegotiate(task);
        break;
      case 'mark_complete':
        if (taskId) handleMarkComplete(taskId);
        break;
      default:
        break;
    }
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReorder = (newOrder: Task[]) => {
    const rest = tasks.filter(t => t.isRescheduled || t.status === 'COMPLETE');
    setTasks([...newOrder, ...rest]);
  };

  const STATS = [
    { icon: LayoutGrid,  label: 'Active Tasks',   value: loading ? '—' : String(activeTasks.length),    color: 'var(--text-primary)' },
    { icon: Clock,       label: 'Avg/day',        value: loading ? '—' : avgHours,                     color: '#f59e0b' },
    { icon: TrendingUp,  label: 'Portfolio Health', value: loading ? '—' : forecastHealth !== null ? `${forecastHealth}%` : `${velocityScore}`, color: forecastHealth !== null ? (forecastHealth >= 70 ? '#22c55e' : forecastHealth >= 50 ? '#f59e0b' : '#ef4444') : velocityColor },
    { icon: CheckCircle, label: 'Completed',        value: loading ? '—' : String(completedTasks.length), color: '#22c55e' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Start Here card — first-load grader guide ─────────────────────── */}
      <StartHereCard
        onTriggerPanic={() => {
          const redTask = tasks.find(t => t.status === 'RED' && !t.isRescheduled);
          if (redTask) handleOpenHotStart(redTask);
        }}
      />
      {/* ── Quick task entry bar ────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${surfaceBorder}` }}>
        <div className="flex items-center gap-3 mb-2">
          <Zap size={11} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
            Quick Task Entry
          </span>
          <AnimatePresence>
            {!loading && onPaceCount > 0 && <StatChip key="gn" value={`${onPaceCount}`} label="On Pace" color="#22c55e" isDark={isDark} />}
            {!loading && warningCount > 0 && <StatChip key="am" value={`${warningCount}`} label="Warning" color="#f59e0b" isDark={isDark} />}
            {!loading && criticalCount > 0 && <StatChip key="rd" value={`${criticalCount}`} label="Critical" color="#ef4444" pulse isDark={isDark} />}
          </AnimatePresence>
          {/* OmniBar Ctrl+K / ⌘K pill */}
          <div className="relative ml-auto">
            <motion.button
              data-tour="tour-omni"
              onClick={() => setOmniBarOpen(true)}
              whileHover={{ scale: 1.05, boxShadow: '0 0 12px rgba(34,197,94,0.25)' }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold"
              style={{
                background: 'rgba(34,197,94,0.08)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.22)',
              }}
            >
              <span style={{ fontSize: 11 }}>⌨</span>
              <span className="hidden sm:inline">{KBD_LABEL}</span>
            </motion.button>
          </div>
        </div>
        <div data-tour="tour-braindump">
          <BrainDumpInput
            onSubmit={handleQuickEntry}
            onTasksExtracted={(newTasks) => setTasks(prev => [...prev, ...newTasks])}
            loading={entryLoading}
            compact={true}
            isDark={isDark}
            placeholder="Add a task or describe new work..."
          />
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 relative z-10 px-4 sm:px-6 py-6 pb-28 transition-all duration-300"
        style={{ marginRight: (hotStartTask || panicState) ? 480 : 0 }}>

        {/* Action buttons row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {sentEmails.size > 0 && (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-green-500 font-mono">
                  <CheckCircle size={11} /><span>{sentEmails.size} sent</span>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Create Task button */}
            <motion.button
              onClick={() => setCreateModalOpen(true)}
              whileHover={{ scale: 1.04, boxShadow: '0 0 16px rgba(34,197,94,0.25)' }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.28)' }}
            >
              <Plus size={12} />
              <span className="hidden sm:inline">New Task</span>
            </motion.button>
          </div>
          <div className="flex items-center gap-2">
            {/* Triage button */}
            <div className="relative">
              <motion.button onClick={handleTriage} disabled={loading || triageLoading}
                data-tour="tour-triage"
                whileHover={!loading && !triageLoading ? { scale: 1.04 } : {}}
                whileTap={!loading && !triageLoading ? { scale: 0.96 } : {}}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={loading || triageLoading
                  ? { background: 'var(--bg-surface)', color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, cursor: 'not-allowed', opacity: 0.5 }
                  : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.22)' }}>
                {triageLoading
                  ? <motion.div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                  : <Zap size={12} />}
                <span className="hidden sm:inline">Triage</span>
              </motion.button>
            </div>

            {/* ETA Check button — Zero-Hour Feature 2 */}
            <motion.button onClick={handleFastForward} disabled={fastForwarded || loading}
              whileHover={!fastForwarded && !loading ? { scale: 1.04 } : {}}
              whileTap={!fastForwarded && !loading ? { scale: 0.96 } : {}}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={fastForwarded || loading
                ? { background: 'var(--bg-surface)', color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, cursor: 'not-allowed', opacity: 0.5 }
                : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
              <FastForward size={12} />
              <span className="hidden sm:inline">Fast Forward</span>
            </motion.button>

            <motion.button onClick={() => setTasks(prev => recalcTelemetry(prev))} disabled={loading}
              whileHover={!loading ? { scale: 1.08, rotate: 180 } : {}} whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
              <RefreshCw size={13} />
            </motion.button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {STATS.map(({ icon: Icon, label, value, color }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1)' }}
              className="rounded-xl p-4 cursor-default"
              style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={11} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
                {label === 'Portfolio Health' && (
                  <InfoTooltip explanation="Likelihood all active tasks finish on time — weighted across deadlines. See the Forecast panel below for per-task breakdown." />
                )}
                {label === 'Avg/day' && (
                  <InfoTooltip explanation="Average hours per day required across all active tasks to reach their deadlines at current pace." />
                )}
              </div>
              <div className="font-bold font-mono text-2xl" style={{ color }}>
                {loading
                  ? <motion.div className="h-7 w-10 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  : <Counter to={value} />}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Burnout Horizon — compact collapsible widget */}
        {!loading && activeTasks.length > 0 && (
          <BurnoutChart tasks={tasks} isDark={isDark} onTriggerTriage={handleTriage} />
        )}

        {/* Velocity Forecast Agent */}
        {!loading && activeTasks.length > 0 && (
          <ForecastPanel
            isDark={isDark}
            surfaceBorder={surfaceBorder}
            taskCount={activeTasks.length}
            onHealthUpdate={setForecastHealth}
            onAutonomousAction={() => {
              // Nudge user toward Agent Log when proactive alerts fire
              addToast({ type: 'info', message: 'Agent logged proactive drift alerts → Agent Log', duration: 5000 });
            }}
          />
        )}

        {/* Active tasks */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.4 }}>
          <SectionDivider label="Active Tasks" count={loading ? undefined : activeTasks.length} isDark={isDark} />
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                <SkeletonCard isDark={isDark} />
              </motion.div>
            ))}
          </div>
        ) : activeTasks.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-col items-center gap-3 py-16" style={{ color: 'var(--text-faint)' }}>
            <Zap size={32} className="text-green-500 opacity-40" />
            <p className="text-sm font-mono">No active tasks. Add one via the entry bar above.</p>
          </motion.div>
        ) : (
          <Reorder.Group axis="y" values={activeTasks} onReorder={handleReorder} as="div"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4"
            style={{ gridAutoRows: 'min-content' }}>
            <AnimatePresence>
              {activeTasks.map((task, idx) => (
                <DraggableTaskCard
                  key={task.id}
                  task={task}
                  idx={idx}
                  fastForwarded={fastForwarded}
                  isDark={isDark}
                  onNegotiate={() => handleOpenNegotiate(task)}
                  onHotStart={() => handleOpenHotStart(task)}
                  onMarkComplete={() => handleMarkComplete(task.id)}
                  onProgressUpdate={pct => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completionPercent: pct } : t))}
                  onTaskUpdate={updated => setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))}
                  onOpenDetail={task => setDetailTask(task)}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        {/* Rescheduled */}
        <AnimatePresence>
          {rescheduledTasks.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }} className="mt-10">
              <SectionDivider label="Rescheduled (Triage)" count={rescheduledTasks.length} dimmed accent="#f59e0b" isDark={isDark} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {rescheduledTasks.map((task, idx) => (
                  <motion.div key={task.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.4 }}>
                    <TaskCard task={task} isDark={isDark} isRescheduled
                      onMarkComplete={() => handleMarkComplete(task.id)}
                      onNegotiate={() => handleOpenNegotiate(task)} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completed */}
        <AnimatePresence>
          {completedTasks.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }} className="mt-10">
              <SectionDivider label="Completed" count={completedTasks.length} dimmed isDark={isDark} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {completedTasks.map((task, idx) => (
                  <motion.div key={task.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}>
                    <TaskCard
                      task={task}
                      isDark={isDark}
                      onMarkNotCompleted={() => setTasks(prev => prev.map(t =>
                        t.id === task.id ? { ...t, isRescheduled: true, status: 'GREEN' as const, completionPercent: t.completionPercent < 100 ? t.completionPercent : 0 } : t
                      ))}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Panels */}
      <AnimatePresence>
        {/* Zero-Hour Panic Mode Panel (replaces HotStartPanel when deadline < 2h) */}
        {panicState && (
          <PanicModePanel
            key="panic"
            task={panicState.task}
            checklist={panicState.checklist}
            boilerplate={panicState.boilerplate}
            repoUrl={panicState.repoUrl}
            loading={panicState.loading}
            isDark={isDark}
            onClose={() => setPanicState(null)}
            onMarkComplete={() => { handleMarkComplete(panicState.task.id); setPanicState(null); }}
          />
        )}
        {/* Legacy HotStartPanel for non-panic tasks */}
        {hotStartTask && !panicState && (
          <HotStartPanel key="hs" taskName={hotStartTask.taskName} code={hotStartContent || hotStartTask.hotStartContent}
            isDark={isDark} onClose={() => { setHotStartTask(null); setHotStartContent(''); }} onMarkComplete={() => handleMarkComplete(hotStartTask.id)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {negotiateLoading && (
          <motion.div key="neg-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="flex flex-col items-center gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent"
                animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              <span className="text-xs font-mono text-amber-400">Drafting with Gemini…</span>
            </div>
          </motion.div>
        )}
        {negotiateTarget && (
          <NegotiateModal key="neg"
            taskName={negotiateTarget.taskName}
            recipientName={negotiateTarget.recipientName}
            draft={negotiateTarget.draft}
            isDark={isDark}
            onClose={() => setNegotiateTarget(null)}
            onSend={handleSendEmail}
            countdownSeconds={10}
          />
        )}
      </AnimatePresence>
      <VelocityReport isDark={isDark} />

      {/* Ultimatum modal — non-dismissable, forces conscious choice */}
      <AnimatePresence>
        {ultimatum && (
          <UltimatumModal
            key="ultimatum"
            taskA={ultimatum.taskA}
            taskB={ultimatum.taskB}
            isDark={isDark}
            onResolved={handleUltimatumResolved}
            onEscape={handleUltimatumEscape}
          />
        )}
      </AnimatePresence>

      {/* Triage countdown toast — confirm-by-exception pattern */}
      <AnimatePresence>
        {pendingTriage && (
          <motion.div
            key="triage-countdown"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-2"
          >
            <CountdownToast
              message={`Rescheduling "${pendingTriage.taskName.slice(0, 35)}${pendingTriage.taskName.length > 35 ? '…' : ''}"`}
              subtext="Lowest-priority task deferred — AI freed capacity"
              duration={8}
              color="amber"
              isDark={isDark}
              onExecute={() => {
                setTasks(prev => prev.map(t => t.id === pendingTriage.taskId ? { ...t, isRescheduled: true } : t));
                setPendingTriage(null);
                award('triage_run');
              }}
              onCancel={() => setPendingTriage(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* OmniBar — CMD+K command palette */}
      <OmniBar
        isOpen={omniBarOpen}
        onClose={() => setOmniBarOpen(false)}
        onActionComplete={(intent, taskId, result) => {
          // Refresh tasks after any action that might have changed them
          const actionsNeedingRefresh = ['create_task', 'run_triage', 'panic_mode', 'negotiate', 'rebalance', 'smart_routing'];
          if (actionsNeedingRefresh.includes(intent)) {
            // Re-fetch tasks from the backend to pick up changes
            loadTasks().catch(() => {});
          }
          // For smart_routing, also highlight the top task if returned
          if (intent === 'smart_routing' && result?.topTask) {
            const top = result.topTask as { id?: string; taskName?: string };
            if (top?.taskName) {
              addToast({ type: 'info', message: `Top priority: ${top.taskName.slice(0, 40)}`, duration: 5000 });
            }
          }
        }}
        isDark={isDark}
        tasks={activeTasks}
      />

      {/* Guided tour — first-load only, non-blocking */}
      {!tourDone && (
        <GuidedTour steps={TOUR_STEPS} onDone={() => setTourDone(true)} startDelay={2000} />
      )}

      {/* Deadline confirmation modal — for tasks Gemini couldn't date */}
      <AnimatePresence>
        {pendingDeadlineTasks.length > 0 && (
          <DeadlineConfirmModal
            key="deadline-confirm"
            tasks={pendingDeadlineTasks}
            isDark={isDark}
            onConfirm={confirmed => {
              setTasks(prev => [...prev, ...confirmed]);
              setPendingDeadlineTasks([]);
            }}
            onDismiss={() => {
              // Add with a 7-day fallback deadline so they still land on the board
              const withFallback = pendingDeadlineTasks.map(t => ({
                ...t,
                deadline: t.deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
              }));
              setTasks(prev => [...prev, ...withFallback]);
              setPendingDeadlineTasks([]);
            }}
          />
        )}
      </AnimatePresence>

      {/* Create Task modal */}
      <AnimatePresence>
        {createModalOpen && (
          <CreateTaskModal
            key="create-task"
            isDark={isDark}
            onClose={() => setCreateModalOpen(false)}
            onCreated={newTask => {
              setTasks(prev => [newTask, ...prev]);
              addToast({ type: 'success', message: `"${newTask.taskName}" added to your board`, duration: 3000 });
            }}
          />
        )}
      </AnimatePresence>

      {/* Task detail modal — rendered at Dashboard level so Reorder re-renders never unmount it */}
      <AnimatePresence>
        {detailTask && (
          <TaskDetailModal
            key={detailTask.id}
            task={detailTask}
            isDark={isDark}
            onClose={() => setDetailTask(null)}
            onMarkComplete={() => { handleMarkComplete(detailTask.id); setDetailTask(null); }}
            onProgressUpdate={val => {
              setTasks(prev => prev.map(t => t.id === detailTask.id ? { ...t, completionPercent: val } : t));
            }}
            onTaskUpdate={updated => {
              setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
              setDetailTask(updated); // keep modal in sync without closing
            }}
            onNegotiate={() => {
              const t = tasks.find(x => x.id === detailTask.id);
              if (t) handleOpenNegotiate(t);
            }}
            onHotStart={() => {
              const t = tasks.find(x => x.id === detailTask.id);
              if (t) { setDetailTask(null); handleOpenHotStart(t); }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
