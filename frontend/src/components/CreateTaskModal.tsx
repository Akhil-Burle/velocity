/**
 * CreateTaskModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual task creation modal — zero AI, instant, full control.
 *
 * Required fields (Velocity needs these for its math):
 *   • Task name
 *   • Deadline
 *
 * Optional fields (nice to have, don't break anything if empty):
 *   • Task type (CODE / WRITING / DIAGRAM / OTHER)
 *   • Cognitive weight (LOW / MEDIUM / HIGH)
 *   • Owned by me vs. owed to someone (+ recipient name)
 *   • Starting progress % (if already partially done)
 *   • Energy level (routing hint for Command Day)
 *   • Estimated session duration
 *   • Initial subtasks (inline add)
 *   • Notes / drift explanation
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Code, FileText, GitBranch, Layers, Plus, Trash2,
  Calendar, Brain, User, Users, Clock, Battery, AlignLeft,
  ChevronDown, Check, AlertTriangle, Timer,
} from 'lucide-react';
import { TaskType, CognitiveWeight, EnergyLevel } from '../types';
import { createTaskManual } from '../api';

interface NewSubtask { title: string; estimatedMinutes: number }

interface CreateTaskModalProps {
  isDark?: boolean;
  onClose: () => void;
  onCreated: (task: import('../types').Task) => void;
}

// ── small helpers ─────────────────────────────────────────────────────────────

const TYPES: { value: TaskType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'CODE',    label: 'Code',    icon: <Code size={13} />,      color: '#38bdf8' },
  { value: 'WRITING', label: 'Writing', icon: <FileText size={13} />,  color: '#a78bfa' },
  { value: 'DIAGRAM', label: 'Diagram', icon: <GitBranch size={13} />, color: '#fb923c' },
  { value: 'OTHER',   label: 'Other',   icon: <Layers size={13} />,    color: '#94a3b8' },
];

const WEIGHTS: { value: CognitiveWeight; label: string; desc: string; color: string }[] = [
  { value: 'LOW',    label: 'Low',    desc: '~1h base',  color: '#22c55e' },
  { value: 'MEDIUM', label: 'Medium', desc: '~3h base',  color: '#f59e0b' },
  { value: 'HIGH',   label: 'High',   desc: '~5h base',  color: '#ef4444' },
];

const ENERGIES: { value: EnergyLevel; label: string; desc: string }[] = [
  { value: 'Deep Focus', label: 'Deep Focus', desc: 'Requires full concentration' },
  { value: 'Quick Wins', label: 'Quick Wins', desc: 'Good for low-energy slots'   },
  { value: 'Brain-Dead', label: 'Brain-Dead', desc: 'Mechanical / routine work'   },
  { value: '',           label: 'Unset',      desc: 'Let Velocity decide'         },
];

// Minimum deadline helper — today's date string
function todayStr() {
  return new Date().toISOString().slice(0, 16);
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isDark = true, onClose, onCreated }) => {
  // ── Required ──────────────────────────────────────────────────────────────
  const [name, setName]           = useState('');
  const [deadline, setDeadline]   = useState('');

  // ── Type / weight / energy ────────────────────────────────────────────────
  const [taskType, setTaskType]           = useState<TaskType>('OTHER');
  const [cogWeight, setCogWeight]         = useState<CognitiveWeight>('MEDIUM');
  const [energy, setEnergy]               = useState<EnergyLevel>('');

  // ── Ownership ─────────────────────────────────────────────────────────────
  const [selfOwned, setSelfOwned]         = useState(true);
  const [recipient, setRecipient]         = useState('');

  // ── Progress + duration ───────────────────────────────────────────────────
  const [progress, setProgress]           = useState(0);
  const [duration, setDuration]           = useState(60);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes]                 = useState('');

  // ── Subtasks ──────────────────────────────────────────────────────────────
  const [subtasks, setSubtasks]           = useState<NewSubtask[]>([]);
  const [newSubTitle, setNewSubTitle]     = useState('');
  const [newSubMins, setNewSubMins]       = useState('30');
  const subInputRef                       = useRef<HTMLInputElement>(null);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const nameRef                           = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 80); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())    e.name     = 'Task name is required';
    if (!deadline)       e.deadline = 'Deadline is required';
    if (!selfOwned && !recipient.trim()) e.recipient = 'Recipient name is required for external tasks';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addSubtask = () => {
    const t = newSubTitle.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { title: t, estimatedMinutes: Math.max(1, parseInt(newSubMins) || 30) }]);
    setNewSubTitle('');
    setNewSubMins('30');
    subInputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const task = await createTaskManual({
        taskName: name.trim(),
        deadline: new Date(deadline).toISOString(),
        taskType,
        cognitiveWeight: cogWeight,
        selfOwned,
        recipientName: selfOwned ? undefined : recipient.trim(),
        completionPercent: progress,
        energyLevel: energy,
        estimatedDuration: duration,
        driftExplanation: notes.trim(),
        subtasks,
      });
      onCreated(task);
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to create task' });
    } finally {
      setSaving(false);
    }
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg       = isDark ? 'linear-gradient(135deg,#0d1117 0%,#111820 100%)' : 'linear-gradient(135deg,#fff 0%,#f8fafc 100%)';
  const surface  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const divider  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const inputBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const inputBdr = isDark ? 'rgba(255,255,255,0.1)'  : 'rgba(0,0,0,0.1)';

  const field = (label: string, required: boolean, error?: string, children?: React.ReactNode) => (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-[11px] font-mono font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-faint)' }}>{label}</label>
        {required && <span className="text-[9px] font-mono" style={{ color: '#ef4444' }}>required</span>}
      </div>
      {children}
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-mono mt-1 flex items-center gap-1" style={{ color: '#f87171' }}>
          <AlertTriangle size={9} />{error}
        </motion.p>
      )}
    </div>
  );

  const inputClass = "w-full text-sm font-mono px-3 py-2.5 rounded-xl outline-none transition-all";
  const inputStyle = { background: inputBg, border: `1px solid ${inputBdr}`, color: 'var(--text-primary)', caretColor: '#22c55e' };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="w-full max-w-xl rounded-2xl flex flex-col overflow-hidden"
        style={{ background: bg, border: '1px solid rgba(34,197,94,0.25)', maxHeight: '90vh',
          boxShadow: '0 0 0 1px rgba(34,197,94,0.1), 0 40px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-[2px] shrink-0"
          style={{ background: 'linear-gradient(90deg,transparent,#22c55e 40%,#38bdf8 70%,transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)' }}>
              <Zap size={13} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Task</h2>
              <p className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                Manual · no AI · instant
              </p>
            </div>
          </div>
          <motion.button onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            style={{ color: 'var(--text-faint)' }}><X size={15} /></motion.button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ── Task name ── */}
          {field('Task Name', true, errors.name,
            <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Finish OS assignment 4"
              className={inputClass} style={{ ...inputStyle,
                border: `1px solid ${errors.name ? '#ef4444' : inputBdr}`,
                fontSize: 14, fontWeight: 500 }} />
          )}

          {/* ── Deadline ── */}
          {field('Deadline', true, errors.deadline,
            <input type="datetime-local" value={deadline} min={todayStr()}
              onChange={e => setDeadline(e.target.value)}
              className={inputClass} style={{ ...inputStyle,
                border: `1px solid ${errors.deadline ? '#ef4444' : inputBdr}` }} />
          )}

          {/* ── Task type ── */}
          {field('Task Type', false, undefined,
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(t => (
                <motion.button key={t.value} onClick={() => setTaskType(t.value)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold transition-all"
                  style={{
                    background: taskType === t.value ? `${t.color}18` : surface,
                    border: `1px solid ${taskType === t.value ? `${t.color}44` : border}`,
                    color: taskType === t.value ? t.color : 'var(--text-faint)',
                  }}>
                  {t.icon}{t.label}
                </motion.button>
              ))}
            </div>
          )}

          {/* ── Cognitive weight ── */}
          {field('Cognitive Weight', false, undefined,
            <div className="grid grid-cols-3 gap-2">
              {WEIGHTS.map(w => (
                <motion.button key={w.value} onClick={() => setCogWeight(w.value)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-all"
                  style={{
                    background: cogWeight === w.value ? `${w.color}14` : surface,
                    border: `1px solid ${cogWeight === w.value ? `${w.color}40` : border}`,
                    color: cogWeight === w.value ? w.color : 'var(--text-faint)',
                  }}>
                  <span className="text-xs font-bold">{w.label}</span>
                  <span className="text-[9px] font-mono">{w.desc}</span>
                </motion.button>
              ))}
            </div>
          )}

          {/* ── Ownership ── */}
          {field('Ownership', false, errors.recipient,
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map(own => (
                  <motion.button key={String(own)} onClick={() => setSelfOwned(own)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: selfOwned === own ? 'rgba(34,197,94,0.1)' : surface,
                      border: `1px solid ${selfOwned === own ? 'rgba(34,197,94,0.35)' : border}`,
                      color: selfOwned === own ? '#4ade80' : 'var(--text-faint)',
                    }}>
                    {own ? <User size={12} /> : <Users size={12} />}
                    {own ? 'Self-owned' : 'Owed to someone'}
                  </motion.button>
                ))}
              </div>
              <AnimatePresence>
                {!selfOwned && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                    className="overflow-hidden">
                    <input value={recipient} onChange={e => setRecipient(e.target.value)}
                      placeholder="Recipient name (e.g. Prof. Chen)"
                      className={inputClass} style={{ ...inputStyle,
                        border: `1px solid ${errors.recipient ? '#ef4444' : inputBdr}`, marginTop: 4 }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Progress + Duration row ── */}
          <div className="grid grid-cols-2 gap-3">
            {field('Starting Progress', false, undefined,
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold" style={{ color: '#22c55e' }}>{progress}%</span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>already done</span>
                </div>
                <input type="range" min={0} max={100} value={progress}
                  onChange={e => setProgress(Number(e.target.value))}
                  className="w-full velocity-slider" style={{ '--slider-accent': '#22c55e' } as React.CSSProperties} />
              </div>
            )}
            {field('Session Duration', false, undefined,
              <div className="flex items-center gap-2">
                <input type="number" min={5} max={480} value={duration}
                  onChange={e => setDuration(Math.max(5, Number(e.target.value)))}
                  className={inputClass} style={inputStyle} />
                <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--text-faint)' }}>min</span>
              </div>
            )}
          </div>

          {/* ── Energy level ── */}
          {field('Energy Level', false, undefined,
            <div className="grid grid-cols-2 gap-2">
              {ENERGIES.map(e => (
                <motion.button key={e.value} onClick={() => setEnergy(e.value)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-start gap-0.5 py-2 px-3 rounded-xl text-left transition-all"
                  style={{
                    background: energy === e.value ? 'rgba(56,189,248,0.1)' : surface,
                    border: `1px solid ${energy === e.value ? 'rgba(56,189,248,0.35)' : border}`,
                  }}>
                  <span className="text-[11px] font-semibold"
                    style={{ color: energy === e.value ? '#38bdf8' : 'var(--text-secondary)' }}>
                    {e.label}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>{e.desc}</span>
                </motion.button>
              ))}
            </div>
          )}

          {/* ── Subtasks ── */}
          {field('Subtasks', false, undefined,
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
              {subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderBottom: i < subtasks.length - 1 ? `1px solid ${divider}` : 'none' }}>
                  <div className="w-4 h-4 rounded-full shrink-0"
                    style={{ border: '1.5px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)' }} />
                  <span className="flex-1 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{s.title}</span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>~{s.estimatedMinutes}m</span>
                  <motion.button onClick={() => setSubtasks(prev => prev.filter((_, j) => j !== i))}
                    whileTap={{ scale: 0.9 }} style={{ color: '#f87171' }}>
                    <Trash2 size={10} />
                  </motion.button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-2.5"
                style={{ background: surface, borderTop: subtasks.length > 0 ? `1px solid ${divider}` : 'none' }}>
                <Plus size={10} style={{ color: 'var(--text-faint)', shrink: 0 }} />
                <input ref={subInputRef} value={newSubTitle}
                  onChange={e => setNewSubTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                  placeholder="Add a subtask…"
                  className="flex-1 bg-transparent text-xs font-mono outline-none"
                  style={{ color: 'var(--text-primary)', caretColor: '#22c55e' }} />
                <input value={newSubMins} onChange={e => setNewSubMins(e.target.value)}
                  className="w-10 text-[10px] font-mono text-center bg-transparent outline-none"
                  style={{ color: 'var(--text-faint)', borderBottom: `1px solid ${border}` }} />
                <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--text-faint)' }}>m</span>
                <motion.button onClick={addSubtask} whileTap={{ scale: 0.9 }}
                  className="text-[10px] font-mono px-2 py-0.5 rounded"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                  add
                </motion.button>
              </div>
            </div>
          )}

          {/* ── Notes / context ── */}
          {field('Notes / Context', false, undefined,
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any context Velocity should know — blockers, dependencies, why it's tricky…"
              rows={3}
              className="w-full text-xs font-mono px-3 py-2.5 rounded-xl outline-none transition-all resize-none"
              style={{ ...inputStyle }} />
          )}

          {/* Submit error */}
          {errors.submit && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle size={11} />{errors.submit}
            </motion.p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderTop: `1px solid ${divider}` }}>
          <motion.button onClick={handleSubmit} disabled={saving}
            whileHover={!saving ? { scale: 1.02, boxShadow: '0 0 24px rgba(34,197,94,0.3)' } : {}}
            whileTap={!saving ? { scale: 0.97 } : {}}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: saving ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: saving ? '#4ade80' : '#000',
            }}>
            {saving
              ? <><motion.div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />Creating…</>
              : <><Zap size={14} />Create Task</>}
          </motion.button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: surface, border: `1px solid ${border}`, color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateTaskModal;
