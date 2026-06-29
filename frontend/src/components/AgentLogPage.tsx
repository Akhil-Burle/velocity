/**
 * AgentLogPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Agent Activity Log — extended with Phase 1–4 capabilities:
 *   Phase 1: Chain entries — expandable multi-step causal traces
 *   Phase 2: Policy Memory tab — learned behaviors panel
 *   Phase 3: Reasoning trace — "Why this, not something else?" per entry
 *   Phase 4: Deep-link from Start Here card
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Zap, RefreshCw, Undo2, ExternalLink, Brain,
  CalendarRange, Mail, AlertTriangle, Clock, Sparkles,
  ShieldAlert, Activity, CheckCircle2, GitBranch, FlaskConical,
  Link2, ChevronDown, Lightbulb, BookOpen,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { fetchAgentLog, undoAgentLogEntry, undoChainStep, fetchPolicyMemory } from '../api';
import type { AgentLogEntry, ChainStep, PolicyMemoryEntry } from '../types';
import InfoTooltip from './InfoTooltip';

// ── Feature metadata ─────────────────────────────────────────────────────────
const FEATURE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  rebalance:      { label: 'AI Rebalance',    color: '#22c55e', icon: <CalendarRange size={11} /> },
  triage:         { label: 'Triage',          color: '#f59e0b', icon: <Zap size={11} /> },
  negotiate:      { label: 'Negotiate',       color: '#38bdf8', icon: <Mail size={11} /> },
  panic:          { label: 'Panic Mode',      color: '#ef4444', icon: <ShieldAlert size={11} /> },
  reschedule:     { label: 'Smart Reschedule',color: '#a855f7', icon: <CalendarRange size={11} /> },
  drift_alert:    { label: 'Drift Alert',     color: '#f97316', icon: <AlertTriangle size={11} /> },
  checkin:        { label: 'Trust Score',     color: '#06b6d4', icon: <Activity size={11} /> },
  braindump:      { label: 'Brain Dump',      color: '#22c55e', icon: <Brain size={11} /> },
  hotstart:       { label: 'Hot-Start',       color: '#fbbf24', icon: <Sparkles size={11} /> },
  chain:          { label: 'Action Chain',    color: '#818cf8', icon: <GitBranch size={11} /> },
  policy_adapted: { label: 'Agent Memory',    color: '#ec4899', icon: <FlaskConical size={11} /> },
  omnibar:        { label: 'Omni-Bar',        color: '#10b981', icon: <Zap size={11} /> },
};

const AUTONOMY_META: Record<string, { label: string; color: string; desc: string }> = {
  autonomous: { label: 'AUTONOMOUS', color: '#ef4444', desc: 'AI acted without a user trigger' },
  assisted:   { label: 'ASSISTED',   color: '#f59e0b', desc: 'AI acted in response to user action' },
  countdown:  { label: 'COUNTDOWN',  color: '#38bdf8', desc: 'AI queued action with cancel window' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

// ── Phase 3: Reasoning trace sub-component ───────────────────────────────────
const ReasoningTrace: React.FC<{
  rejectedAlternatives?: { action: string; reason: string }[];
  isDark: boolean;
}> = ({ rejectedAlternatives, isDark }) => {
  const [open, setOpen] = useState(false);
  if (!rejectedAlternatives || rejectedAlternatives.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg transition-colors"
        style={{
          background: open ? 'rgba(129,140,248,0.1)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
          color: open ? '#818cf8' : 'var(--text-faint)',
          border: `1px solid ${open ? 'rgba(129,140,248,0.25)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
        }}
      >
        <Lightbulb size={9} />
        Why this, not something else?
        <ChevronDown size={9} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-2 space-y-1.5 border-l-2" style={{ borderColor: 'rgba(129,140,248,0.3)' }}>
              {rejectedAlternatives.map((alt, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: '#f87171' }}>✕ </span>
                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{alt.action}</span>
                  </p>
                  <p className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    → {alt.reason}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Phase 1: Chain step row ───────────────────────────────────────────────────
const ChainStepRow: React.FC<{
  step: ChainStep;
  entryId: string;
  isDark: boolean;
  onUndoStep: (stepNumber: number) => void;
}> = ({ step, entryId, isDark, onUndoStep }) => {
  const feat = FEATURE_META[step.featureKey] || FEATURE_META['rebalance'];
  const isLast = false;

  return (
    <div className="flex gap-2.5">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
          style={{ background: `${feat.color}18`, border: `1px solid ${feat.color}40`, color: feat.color }}
        >
          {step.stepNumber}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-start gap-2 mb-0.5 flex-wrap">
          <span className="text-[11px] font-semibold leading-snug" style={{ color: step.undone ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: step.undone ? 'line-through' : 'none' }}>
            {step.title}
          </span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
            {fmtTime(step.timestamp)}
          </span>
        </div>

        {step.reasoning && (
          <p className="text-[10px] font-mono leading-relaxed mb-1" style={{ color: 'var(--text-faint)' }}>
            {step.reasoning}
          </p>
        )}
        {step.outcome && (
          <p className="text-[10px] font-mono leading-relaxed" style={{ color: '#4ade80', opacity: 0.85 }}>
            → {step.outcome}
          </p>
        )}

        {/* Step undo + reasoning trace */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {step.undoable && !step.undone && (
            <button
              onClick={e => { e.stopPropagation(); onUndoStep(step.stepNumber); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <Undo2 size={8} /> Undo step
            </button>
          )}
          {step.undone && (
            <span className="text-[9px] font-mono text-green-500 flex items-center gap-1">
              <CheckCircle2 size={8} /> undone
            </span>
          )}
          <ReasoningTrace rejectedAlternatives={step.rejectedAlternatives} isDark={isDark} />
        </div>
      </div>
    </div>
  );
};

// ── Single log entry card ─────────────────────────────────────────────────────
const LogCard: React.FC<{
  entry: AgentLogEntry;
  idx: number;
  isDark: boolean;
  surfaceBg: string;
  surfaceBorder: string;
  divider: string;
  onUndo: (id: string) => void;
  onUndoStep: (id: string, stepNumber: number) => void;
}> = ({ entry, idx, isDark, surfaceBg, surfaceBorder, divider, onUndo, onUndoStep }) => {
  const [expanded, setExpanded] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const feat = FEATURE_META[entry.featureKey] || { label: entry.featureKey, color: '#94a3b8', icon: <Bot size={11} /> };
  const auto = AUTONOMY_META[entry.autonomy] || AUTONOMY_META.assisted;
  const isDone = entry.undone;
  const isChain = entry.isChain && entry.chain && entry.chain.length > 0;
  const isPolicyAdapted = entry.featureKey === 'policy_adapted';

  const handleUndo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (undoing || isDone) return;
    setUndoing(true);
    try {
      await undoAgentLogEntry(entry.id);
      onUndo(entry.id);
    } catch { /* silently fail */ }
    finally { setUndoing(false); }
  };

  // Special rendering for policy_adapted entries
  if (isPolicyAdapted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.04, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(236,72,153,0.06)',
          border: '1px solid rgba(236,72,153,0.22)',
        }}
      >
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.28)', color: '#ec4899' }}>
              <FlaskConical size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {entry.title}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.25)' }}>
                  AGENT MEMORY
                </span>
              </div>
              <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                {entry.reasoning}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <Clock size={9} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  {fmtTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden cursor-pointer"
      style={{
        background: isDone
          ? (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)')
          : isChain
            ? (isDark ? 'rgba(129,140,248,0.05)' : 'rgba(129,140,248,0.04)')
            : surfaceBg,
        border: `1px solid ${isDone
          ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')
          : isChain ? 'rgba(129,140,248,0.22)'
          : surfaceBorder}`,
        opacity: isDone ? 0.55 : 1,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* ── Main row ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
            style={{ background: `${feat.color}14`, border: `1px solid ${feat.color}28`, color: feat.color }}
          >
            {isChain ? <GitBranch size={13} /> : feat.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold leading-snug flex-1 min-w-0"
                style={{ color: isDone ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                {entry.title}
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ background: `${auto.color}14`, color: auto.color, border: `1px solid ${auto.color}28` }}
                title={auto.desc}>
                {auto.label}
              </span>
              {isChain && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}>
                  {entry.chain!.length}-STEP CHAIN
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: `${feat.color}10`, color: feat.color, border: `1px solid ${feat.color}22` }}>
                {isChain ? 'Action Chain' : feat.label}
              </span>
              <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                <Clock size={9} />
                {fmtTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
              </span>
              {entry.relatedTaskName && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: 'var(--text-muted)' }}>
                  <ExternalLink size={8} />
                  {entry.relatedTaskName.length > 28 ? entry.relatedTaskName.slice(0, 28) + '…' : entry.relatedTaskName}
                </span>
              )}
              {isDone && <span className="text-[9px] font-mono text-green-500 flex items-center gap-1"><CheckCircle2 size={9} /> undone</span>}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {entry.undoable && !isDone && (
              <motion.button onClick={handleUndo} disabled={undoing} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {undoing
                  ? <motion.div className="w-3 h-3 rounded-full border border-red-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                  : <Undo2 size={10} />}
                <span className="hidden sm:inline">Undo</span>
              </motion.button>
            )}
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }} style={{ color: 'var(--text-faint)' }}>
              <ChevronDown size={13} />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Expanded detail ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${divider}` }}
          >
            <div className="px-4 py-3.5 space-y-3" onClick={e => e.stopPropagation()}>
              {/* Phase 1: Chain steps */}
              {isChain && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <GitBranch size={10} style={{ color: '#818cf8' }} />
                    <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: '#818cf8' }}>
                      Causal reasoning chain — {entry.chain!.length} steps
                    </span>
                  </div>
                  <div className="space-y-0 pl-1">
                    {entry.chain!.map((step, i) => (
                      <div key={step.stepNumber}>
                        <ChainStepRow
                          step={step} entryId={entry.id} isDark={isDark}
                          onUndoStep={(sn) => onUndoStep(entry.id, sn)}
                        />
                        {i < entry.chain!.length - 1 && (
                          <div className="ml-2.5 w-px h-2" style={{ background: 'rgba(129,140,248,0.25)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasoning */}
              {!isChain && entry.reasoning && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain size={10} style={{ color: 'var(--text-faint)' }} />
                    <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Why AI acted</span>
                  </div>
                  <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--text-tertiary)' }}>{entry.reasoning}</p>
                </div>
              )}

              {/* Outcome */}
              {!isChain && entry.outcome && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={10} style={{ color: '#22c55e' }} />
                    <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>What happened</span>
                  </div>
                  <p className="text-xs leading-relaxed font-mono" style={{ color: 'var(--text-tertiary)' }}>{entry.outcome}</p>
                </div>
              )}

              {/* Phase 3: Reasoning trace on non-chain entries */}
              {!isChain && (
                <ReasoningTrace rejectedAlternatives={entry.rejectedAlternatives} isDark={isDark} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Phase 2: Policy Memory panel ─────────────────────────────────────────────
const PolicyMemoryPanel: React.FC<{
  isDark: boolean;
  surfaceBg: string;
  surfaceBorder: string;
}> = ({ isDark, surfaceBg, surfaceBorder }) => {
  const [policies, setPolicies] = useState<PolicyMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicyMemory()
      .then(d => setPolicies(d.policies))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div className="w-8 h-8 rounded-full border-2 border-pink-400 border-t-transparent"
          animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }} />
      </div>
    );
  }

  const learned = policies.filter(p => p.status === 'learned');
  const active  = policies.filter(p => p.status === 'active');

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl px-4 py-3.5"
        style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={13} style={{ color: '#ec4899' }} />
          <span className="text-xs font-semibold" style={{ color: '#ec4899' }}>How Agent Memory works</span>
        </div>
        <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          When you cancel the same type of autonomous action 3 times in a row, Velocity stops auto-acting
          and flags a suggestion instead. This section shows what it's learned about your preferences.
        </p>
      </div>

      {/* Learned behaviors */}
      {learned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <BookOpen size={11} style={{ color: '#ec4899' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              Learned behaviors ({learned.length})
            </span>
          </div>
          <div className="space-y-2">
            {learned.map(p => (
              <motion.div key={p.policyCategory}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.18)' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.28)' }}>
                    <FlaskConical size={10} style={{ color: '#ec4899' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                      {p.learnedMessage || `🧠 No longer auto-acting on: ${p.policyLabel}`}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                      Cancelled {p.cancelCount}× · Learned {p.learnedAt ? relativeTime(p.learnedAt) : 'recently'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                        Now: suggests instead of auto-acts
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Active tracking */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Activity size={11} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              Tracking (not yet adapted — {active.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {active.map(p => (
              <div key={p.policyCategory} className="rounded-xl px-3 py-2.5"
                style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{p.policyLabel}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                      {p.cancelCount}/{p.threshold} cancels
                    </span>
                    <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.cancelCount / p.threshold) * 100)}%`, background: '#f59e0b' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {policies.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 rounded-2xl"
          style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.18)' }}>
            <FlaskConical size={20} style={{ color: '#ec4899' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No patterns learned yet</p>
          <p className="text-xs font-mono text-center max-w-xs" style={{ color: 'var(--text-faint)' }}>
            Cancel or undo the same type of autonomous action 3 times and Velocity will adapt its behavior here.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Stats bar ─────────────────────────────────────────────────────────────────
const StatsBar: React.FC<{ entries: AgentLogEntry[]; isDark: boolean; surfaceBg: string; surfaceBorder: string }> = ({ entries, isDark, surfaceBg, surfaceBorder }) => {
  const autonomous = entries.filter(e => e.autonomy === 'autonomous').length;
  const assisted   = entries.filter(e => e.autonomy === 'assisted').length;
  const chains     = entries.filter(e => e.isChain).length;
  const features   = new Set(entries.map(e => e.featureKey)).size;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {[
        { label: 'Total Actions',    value: String(entries.length), color: 'var(--text-primary)', tooltip: null },
        { label: 'Fully Autonomous', value: String(autonomous),     color: '#ef4444', tooltip: 'Actions Velocity took entirely on its own without prompting — no user input required to trigger or complete them.' },
        { label: 'Action Chains',    value: String(chains),         color: '#818cf8', tooltip: 'Multi-step sequences where one autonomous action triggered follow-on actions — Velocity reasoning across multiple features at once.' },
        { label: 'Features Active',  value: String(features),       color: '#22c55e', tooltip: null },
      ].map(({ label, value, color, tooltip }, i) => (
        <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-xl p-3.5"
          style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
            {label}
            {tooltip && <InfoTooltip explanation={tooltip} />}
          </div>
          <div className="font-bold font-mono text-2xl" style={{ color }}>{value}</div>
        </motion.div>
      ))}
    </div>
  );
};

// ── Main AgentLogPage ─────────────────────────────────────────────────────────
const AgentLogPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [entries, setEntries]     = useState<AgentLogEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  // Phase 4: deep-link from Start Here card
  const [activeTab, setActiveTab] = useState<'log' | 'memory'>(() => {
    const hint = sessionStorage.getItem('agent_log_tab');
    if (hint === 'memory') { sessionStorage.removeItem('agent_log_tab'); return 'memory'; }
    return 'log';
  });

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAgentLog(100);
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent log');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUndo = (id: string) => setEntries(prev => prev.map(e => e.id === id ? { ...e, undone: true } : e));

  const handleUndoStep = async (entryId: string, stepNumber: number) => {
    try {
      const res = await undoChainStep(entryId, stepNumber);
      setEntries(prev => prev.map(e => e.id === entryId ? res.entry : e));
    } catch { /* silently fail */ }
  };

  const featureKeys = Array.from(new Set(entries.map(e => e.featureKey)));
  const filtered = filterKey ? entries.filter(e => e.featureKey === filterKey) : entries;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs = [
    { id: 'log' as const,    label: 'Activity Log',     icon: <Bot size={11} />,          count: entries.length },
    { id: 'memory' as const, label: 'Agent Memory',     icon: <FlaskConical size={11} />, count: null },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">

      {/* ── How This Works ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 rounded-2xl overflow-hidden"
        style={{ background: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
          <Bot size={11} style={{ color: '#22c55e' }} />
          <span className="text-[10px] font-mono uppercase tracking-widest font-semibold" style={{ color: '#22c55e' }}>
            How This Works
          </span>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Agent acts autonomously',
              body: 'Velocity monitors drift, deadlines, and behavioral signals in the background. When a threshold is crossed it acts — no button needed.',
              color: '#22c55e',
            },
            {
              step: '02',
              title: 'Every action is logged',
              body: 'Each autonomous decision is recorded here with a timestamp, the AI\'s reasoning, and what actually happened — fully transparent.',
              color: '#f59e0b',
            },
            {
              step: '03',
              title: 'You stay in control',
              body: 'Every action can be undone individually. Cancel the same action type 3 times and the agent learns your preference via Policy Memory.',
              color: '#ef4444',
            },
          ].map(({ step, title, body, color }) => (
            <div key={step} className="flex gap-3">
              <span className="text-2xl font-black font-mono leading-none shrink-0 mt-0.5"
                style={{ color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)' }}>{step}</span>
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color }}>{title}</div>
                <div className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div data-tour="tour-agent-log-page-header" className="inline-flex items-center gap-2 mb-1">
            <Bot size={13} style={{ color: '#22c55e' }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              Agent Activity Log
            </span>
            {entries.filter(e => e.autonomy === 'autonomous').length > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                {entries.filter(e => e.autonomy === 'autonomous').length} autonomous
              </motion.span>
            )}
          </div>
        </div>
        <motion.button onClick={load} whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
          <RefreshCw size={13} />
        </motion.button>
      </div>

      {/* Stats */}
      {!loading && entries.length > 0 && <StatsBar entries={entries} isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} />}

      {/* Tab bar */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-xl w-fit"
        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${surfaceBorder}` }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            data-tour={tab.id === 'memory' ? 'tour-agent-memory-tab' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background: activeTab === tab.id ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)') : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-faint)',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.icon}
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="text-[9px] font-mono px-1 py-0.5 rounded"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Activity Log */}
      {activeTab === 'log' && (
        <>
          {/* Feature filter pills */}
          {!loading && featureKeys.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => { setFilterKey(null); setPage(1); }}
                className="text-[10px] font-mono px-3 py-1.5 rounded-full"
                style={{
                  background: !filterKey ? 'rgba(34,197,94,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  color: !filterKey ? '#22c55e' : 'var(--text-faint)',
                  border: `1px solid ${!filterKey ? 'rgba(34,197,94,0.28)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                }}>
                All ({entries.length})
              </button>
              {featureKeys.map(key => {
                const meta = FEATURE_META[key];
                const count = entries.filter(e => e.featureKey === key).length;
                const isActive = filterKey === key;
                return (
                  <button key={key}
                    className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-full"
                    onClick={() => { setFilterKey(isActive ? null : key); setPage(1); }}
                    style={{
                      background: isActive ? `${meta?.color || '#94a3b8'}14` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                      color: isActive ? (meta?.color || '#94a3b8') : 'var(--text-faint)',
                      border: `1px solid ${isActive ? `${meta?.color || '#94a3b8'}30` : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                    }}>
                    {meta?.icon}{meta?.label || key} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <motion.div className="w-10 h-10 rounded-full border-2 border-green-400 border-t-transparent"
                animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
              <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>Loading agent history...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-12 rounded-2xl"
              style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
              <AlertTriangle size={24} style={{ color: '#f59e0b', opacity: 0.6 }} />
              <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>{error}</span>
              <button onClick={load} className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20 rounded-2xl"
              style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
                <Bot size={24} className="text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No agent actions yet</p>
                <p className="text-xs font-mono max-w-xs" style={{ color: 'var(--text-faint)' }}>
                  Every autonomous action — rebalancing, triaging, chained cascades — logs here with full reasoning.
                </p>
              </div>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {paginated.map((entry, i) => (
                  <LogCard key={entry.id} entry={entry} idx={i} isDark={isDark}
                    surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}
                    onUndo={handleUndo} onUndoStep={handleUndoStep} />
                ))}
              </AnimatePresence>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-2"
                  style={{ borderTop: `1px solid ${divider}` }}>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold disabled:opacity-30"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
                      ← Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                      .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                        if (idx > 0 && typeof arr[idx - 1] === 'number' && (n as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((n, i) => n === '…' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>…</span>
                      ) : (
                        <button key={n} onClick={() => setPage(n as number)}
                          className="w-7 h-7 rounded-lg text-[10px] font-mono font-semibold"
                          style={{
                            background: page === n ? 'rgba(34,197,94,0.15)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                            color: page === n ? '#22c55e' : 'var(--text-faint)',
                            border: `1px solid ${page === n ? 'rgba(34,197,94,0.3)' : surfaceBorder}`,
                          }}>
                          {n}
                        </button>
                      ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold disabled:opacity-30"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Tab: Agent Memory */}
      {activeTab === 'memory' && (
        <PolicyMemoryPanel isDark={isDark} surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} />
      )}
    </div>
  );
};

export default AgentLogPage;
