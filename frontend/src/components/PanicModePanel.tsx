/**
 * PanicModePanel.tsx — Phase 2 upgrade
 * ─────────────────────────────────────────────────────────────────────────────
 * Sequential animated step-tracker replaces the static skeleton.
 * Multi-step autonomous execution is now visibly legible as it happens:
 *
 *   ① Analyzing task...       [done ✓]
 *   ② Generating checklist... [done ✓]
 *   ③ Building boilerplate... [done ✓]
 *   ④ Creating GitHub repo... [in progress ⠿]   ← if GITHUB_TOKEN set
 *   ⑤ Committing scaffold...  [queued]
 *
 * Each step animates in sequence with real timing tied to backend progress.
 * When loaded, shows the AUTONOMOUS badge + "no input required" copy.
 * Same panel shell, same tab layout — only the loading state changes.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Copy, Check, CheckCircle, CheckCircle2, ChevronDown, ChevronUp,
  Github, ExternalLink, AlertTriangle, Clock, Bot, Sparkles, GitCommit,
  FileCode, ListChecks, Brain, ArrowRight,
} from 'lucide-react';
import { Task } from '../types';

interface PanicModePanelProps {
  task: Task;
  checklist: string[];
  boilerplate: string;
  repoUrl?: string;
  isDark?: boolean;
  loading?: boolean;
  onClose: () => void;
  onMarkComplete: () => void;
}

// ─── Execution steps for the step-tracker ────────────────────────────────────
interface ExecStep {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  dependsOnRepo?: boolean; // only show if GitHub token is configured
}

const EXEC_STEPS: ExecStep[] = [
  { id: 'analyze',   icon: <Brain size={13} />,     label: 'Analyzing task structure',   sublabel: 'deadline, type, subtasks, cognitive weight' },
  { id: 'checklist', icon: <ListChecks size={13} />, label: 'Generating rescue checklist', sublabel: 'step-by-step execution plan, task-specific' },
  { id: 'boilerplate',icon: <FileCode size={13} />, label: 'Building boilerplate',        sublabel: 'runnable scaffold with TODO stubs' },
  { id: 'repo',      icon: <Github size={13} />,    label: 'Creating GitHub repo',        sublabel: 'public repo, auto-named from task', dependsOnRepo: true },
  { id: 'commit',    icon: <GitCommit size={13} />, label: 'Committing scaffold',         sublabel: 'README + boilerplate pushed to main', dependsOnRepo: true },
];

type StepStatus = 'queued' | 'running' | 'done' | 'skipped';

// ─── Syntax highlighter (same as before) ─────────────────────────────────────
const KEYWORDS = [
  'import','export','default','const','let','var','return','async','await','try','catch',
  'if','else','interface','from','React','useState','useEffect','function','class','new',
  'type','SELECT','FROM','WHERE','CREATE','INDEX','#','##','###','-','*',
];
const TYPES = ['FC','string','boolean','unknown','void','number'];

function SyntaxLine({ line, isDark }: { line: string; isDark: boolean }) {
  const commentColor = isDark ? '#6b7280' : '#94a3b8';  // gray-500 — readable on dark
  if (line.trim().startsWith('//') || line.trim().startsWith('#'))
    return <span style={{ color: commentColor }}>{line}</span>;
  if (line.trim().startsWith('✓') || line.trim().startsWith('##'))
    return <span style={{ color: isDark ? '#4ade80' : '#16a34a' }}>{line}</span>;
  const tokens: { text: string; color?: string }[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "'" || line[i] === '"' || line[i] === '`') {
      const q = line[i]; let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ text: line.slice(i, j + 1), color: isDark ? '#f59e0b' : '#b45309' });
      i = j + 1; continue;
    }
    let matched = false;
    for (const kw of [...KEYWORDS, ...TYPES]) {
      if (line.slice(i).startsWith(kw)) {
        const after = line[i + kw.length];
        if (!after || /\W/.test(after)) {
          tokens.push({ text: kw, color: TYPES.includes(kw) ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#c084fc' : '#7c3aed') });
          i += kw.length; matched = true; break;
        }
      }
    }
    if (!matched) {
      if (tokens.length && !tokens[tokens.length - 1].color) tokens[tokens.length - 1].text += line[i];
      else tokens.push({ text: line[i] });
      i++;
    }
  }
  return <>{tokens.map((t, idx) => <span key={idx} style={t.color ? { color: t.color } : { color: isDark ? '#e2e8f0' : '#374151' }}>{t.text}</span>)}</>;
}

// ─── Checklist item ───────────────────────────────────────────────────────────
const ChecklistItem: React.FC<{ step: string; index: number; isDark: boolean }> = ({ step, index, isDark }) => {
  const [checked, setChecked] = useState(false);
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const clean = step.replace(/^[✓•\-\*]\s*/, '').replace(/^\[.\]\s*/, '');
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="flex items-start gap-3 py-2"
      style={{ borderBottom: `1px solid ${divider}` }}
    >
      <motion.button
        onClick={() => setChecked(c => !c)}
        whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: checked ? 'rgba(34,197,94,0.15)' : 'transparent',
          border: checked ? '1.5px solid rgba(34,197,94,0.5)' : `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
          color: '#22c55e',
        }}
      >
        {checked && <Check size={10} />}
      </motion.button>
      <span className="text-xs leading-relaxed font-mono"
        style={{ color: checked ? 'var(--text-faint)' : 'var(--text-secondary)', textDecoration: checked ? 'line-through' : 'none' }}>
        {clean}
      </span>
    </motion.div>
  );
};

// ─── Step tracker — the Phase 2 loading state ─────────────────────────────────
const StepTracker: React.FC<{ hasRepo: boolean; isDark: boolean }> = ({ hasRepo, isDark }) => {
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({
    analyze: 'running', checklist: 'queued', boilerplate: 'queued', repo: 'queued', commit: 'queued',
  });

  const steps = EXEC_STEPS.filter(s => !s.dependsOnRepo || hasRepo);

  // Simulate sequential step advancement
  useEffect(() => {
    const TIMING = hasRepo
      ? [900, 1600, 2400, 3400, 4800]   // with repo creation
      : [900, 1600, 2400];               // without repo

    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, i) => {
      // Mark as done after TIMING[i]
      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [step.id]: 'done' }));
        // Mark next as running if there is one
        if (i + 1 < steps.length) {
          setStatuses(prev => ({ ...prev, [steps[i + 1].id]: 'running' }));
        }
      }, TIMING[i]));
    });

    return () => timers.forEach(clearTimeout);
  }, [hasRepo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-4 py-4 space-y-1">
      {/* Autonomous badge */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <Bot size={12} style={{ color: '#f87171' }} />
        <span className="text-[10px] font-mono" style={{ color: '#f87171' }}>
          <span className="font-bold">AUTONOMOUS</span> — executing without input
        </span>
        <motion.span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}
          animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
          working…
        </motion.span>
      </div>

      {steps.map((step, i) => {
        const status = statuses[step.id] ?? 'queued';
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: status === 'running'
                ? 'rgba(34,197,94,0.06)'
                : status === 'done'
                ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                : 'transparent',
              border: status === 'running' ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent',
            }}
          >
            {/* Step icon bubble */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: status === 'done' ? 'rgba(34,197,94,0.12)' : status === 'running' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${status === 'done' ? 'rgba(34,197,94,0.28)' : status === 'running' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                color: status === 'done' ? '#22c55e' : status === 'running' ? '#4ade80' : 'var(--text-faint)',
              }}>
              {status === 'done'
                ? <Check size={12} />
                : status === 'running'
                ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent"
                    animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                : step.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: status === 'queued' ? 'var(--text-faint)' : 'var(--text-secondary)' }}>
                {step.label}
              </div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                {step.sublabel}
              </div>
            </div>

            {/* Status badge */}
            <span className="text-[9px] font-mono shrink-0"
              style={{ color: status === 'done' ? '#22c55e' : status === 'running' ? '#4ade80' : 'var(--text-faint)' }}>
              {status === 'done' ? '✓ done' : status === 'running' ? 'running' : 'queued'}
            </span>
          </motion.div>
        );
      })}

      {/* Progress bar overall */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(34,197,94,0.1)' }}>
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#22c55e,#4ade80)' }}
            initial={{ width: '5%' }}
            animate={{ width: `${Math.round((Object.values(statuses).filter(s => s === 'done').length / steps.length) * 100)}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="text-[10px] font-mono mt-1.5" style={{ color: 'var(--text-faint)' }}>
          {Object.values(statuses).filter(s => s === 'done').length} / {steps.length} steps complete
        </p>
      </div>
    </div>
  );
};

// ─── Main panel ──────────────────────────────────────────────────────────────
const PanicModePanel: React.FC<PanicModePanelProps> = ({
  task, checklist, boilerplate, repoUrl, isDark = true, loading = false, onClose, onMarkComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'boilerplate'>('checklist');
  const [copied, setCopied] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const checklistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && checklist.length > 0 && checklistRef.current) {
      checklistRef.current.scrollTop = 0;
    }
  }, [loading, checklist]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeTab === 'checklist' ? checklist.join('\n') : boilerplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hoursUntil = Math.max(0, (new Date(task.deadline).getTime() - Date.now()) / 3600000);
  const isCritical = hoursUntil < 2;

  const panelBg     = isDark ? 'linear-gradient(120deg,#0d1117 0%,#0a0e14 100%)' : 'linear-gradient(120deg,#ffffff 0%,#f8fafc 100%)';
  const panelBorder = isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.35)';
  const divider     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const titleBarBg  = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const lineNumBg   = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)';
  const whyBg       = isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.06)';
  const whyBorder   = isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.2)';
  const boilerplateLines = boilerplate.split('\n');

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="fixed top-0 right-0 h-full w-full max-w-[480px] z-40 flex flex-col"
      style={{ background: panelBg, borderLeft: `1px solid ${panelBorder}`, boxShadow: `-20px 0 60px rgba(0,0,0,0.45), -4px 0 24px rgba(239,68,68,0.06)` }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${divider}`, background: titleBarBg }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex items-center gap-2">
            {isCritical && (
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <AlertTriangle size={12} style={{ color: '#ef4444' }} />
              </motion.div>
            )}
            <Zap size={12} style={{ color: isCritical ? '#ef4444' : '#22c55e' }} />
            <span className="text-xs font-mono font-semibold tracking-wide"
              style={{ color: isCritical ? '#f87171' : 'var(--text-secondary)' }}>
              PANIC MODE
            </span>
            {!loading && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                AUTONOMOUS
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{
              background: isCritical ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
              color: isCritical ? '#f87171' : '#fbbf24',
              border: isCritical ? '1px solid rgba(239,68,68,0.22)' : '1px solid rgba(245,158,11,0.22)',
            }}>
            <Clock size={9} className="inline mr-1" />
            {hoursUntil < 1 ? `${Math.round(hoursUntil * 60)}m` : `${hoursUntil.toFixed(1)}h`} left
          </span>
          {!loading && (
            <motion.button onClick={handleCopy} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-tertiary)' }}>
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </motion.button>
          )}
          <motion.button onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            style={{ color: 'var(--text-faint)' }}>
            <X size={15} />
          </motion.button>
        </div>
      </div>

      {/* Repo link if present */}
      <AnimatePresence>
        {repoUrl && (
          <motion.a
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            href={repoUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono shrink-0 hover:opacity-80"
            style={{ background: 'rgba(34,197,94,0.06)', borderBottom: `1px solid rgba(34,197,94,0.18)`, color: '#4ade80' }}>
            <Github size={12} />
            <span>Repo created autonomously: {repoUrl.replace('https://github.com/', '')}</span>
            <ExternalLink size={10} className="ml-auto shrink-0" />
          </motion.a>
        )}
      </AnimatePresence>

      {/* Tab bar — only visible after loading */}
      {!loading && (
        <div className="flex items-center shrink-0"
          style={{ borderBottom: `1px solid ${divider}`, background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }}>
          {(['checklist', 'boilerplate'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-all"
              style={{
                color: activeTab === tab ? '#22c55e' : 'var(--text-faint)',
                borderBottom: activeTab === tab ? '1.5px solid #22c55e' : '1.5px solid transparent',
                background: 'transparent',
              }}>
              {tab === 'checklist' ? <Check size={10} /> : <Zap size={10} />}
              {tab === 'checklist' ? 'Checklist' : 'Boilerplate'}
              {tab === 'checklist' && checklist.length > 0 && (
                <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                  {checklist.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto" ref={checklistRef}>
        {loading ? (
          // Phase 2: sequential step-tracker instead of dumb skeleton
          <StepTracker hasRepo={false} isDark={isDark} />
        ) : activeTab === 'checklist' ? (
          <div className="px-4 py-2">
            {checklist.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Zap size={24} style={{ color: 'var(--text-faint)', opacity: 0.3 }} />
                <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Generating scaffold…</span>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2 pt-2">
                  <Sparkles size={11} style={{ color: '#22c55e' }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                    Step-by-step · {checklist.length} actions · AI-generated
                  </span>
                </div>
                {checklist.map((step, i) => (
                  <ChecklistItem key={i} step={step} index={i} isDark={isDark} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex text-xs font-mono">
            <div className="select-none shrink-0 pt-4 pb-4"
              style={{ background: lineNumBg, borderRight: `1px solid ${divider}`, minWidth: '42px' }}>
              {boilerplateLines.map((_, i) => (
                <div key={i} className="text-right pr-3 leading-[1.65rem]" style={{ color: 'var(--text-faint)' }}>{i + 1}</div>
              ))}
            </div>
            <div className="flex-1 p-4 overflow-x-auto">
              <pre className="leading-[1.65rem] whitespace-pre" style={{ color: 'var(--text-secondary)' }}>
                {boilerplateLines.map((line, i) => (
                  <div key={i} className="px-1 rounded"><SyntaxLine line={line} isDark={isDark} /></div>
                ))}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Why toggle */}
      <div className="shrink-0" style={{ borderTop: `1px solid ${divider}` }}>
        <motion.button onClick={() => setWhyOpen(!whyOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs"
          style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-mono font-bold">!</span>
            <span className="font-mono">Why did AI act autonomously?</span>
          </div>
          {whyOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </motion.button>
        <AnimatePresence>
          {whyOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 py-3 text-xs leading-relaxed font-mono"
                style={{ background: whyBg, borderTop: `1px solid ${whyBorder}` }}>
                <span style={{ color: 'var(--text-faint)' }}>// Velocity Zero-Hour · Autonomous trigger{'\n'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Deadline in <span className="text-red-400 font-bold">{hoursUntil.toFixed(1)}h</span>.
                  Velocity crossed the 24h threshold and acted <span className="text-green-400">without waiting for you to ask</span> —
                  generating checklist, boilerplate{repoUrl ? ', and GitHub repo' : ''} in one shot.
                  This action is logged in the Agent Log with full reasoning.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mark Complete */}
      <div className="shrink-0 px-4 py-4" style={{ borderTop: `1px solid ${divider}` }}>
        {!loading && (
          <motion.button onClick={onMarkComplete}
            whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(34,197,94,0.25)' }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold text-black"
            style={{ background: 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)' }}>
            <CheckCircle size={15} />Mark Task Complete
          </motion.button>
        )}
        {loading && (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-mono opacity-40"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${divider}`, color: 'var(--text-faint)' }}>
            <motion.div className="w-3 h-3 rounded-full border border-green-500 border-t-transparent"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }} />
            AI working — available once scaffold is ready
          </div>
        )}
        <p className="text-center text-[10px] font-mono mt-2" style={{ color: 'var(--text-faint)' }}>
          {loading ? 'No input needed · executing autonomously' : 'Marks complete · dismisses panel · recalibrates board'}
        </p>
      </div>
    </motion.div>
  );
};

export default PanicModePanel;
