/**
 * GoalsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Goals & Habits page. Visually identical to Dashboard — same card shapes,
 * stat card pattern, progress bar style, and typography. Uses BrainDumpInput
 * for quick task capture.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, CheckCircle2, Zap, Flame,
  Calendar, TrendingUp, X, RefreshCw,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import BrainDumpInput from './BrainDumpInput';
import { fetchGoals, createGoal, deleteGoal, fetchHabits, createHabit, habitCheckIn, deleteHabit, fetchTasks } from '../api';
import type { Goal, Habit, Task } from '../types';

// ── Heatmap — 30-day consistency grid ────────────────────────────────────────
const HeatmapGrid: React.FC<{ history: Habit['history']; isDark: boolean }> = ({ history, isDark }) => {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const entry = history.find(h => h.date === dateStr);
    return { date: dateStr, completed: entry?.completed ?? false, dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' })[0] };
  });

  return (
    <div className="flex gap-1 flex-wrap mt-2">
      {days.map((day, i) => (
        <motion.div
          key={day.date}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.012, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-4 h-4 rounded-sm"
          style={{
            background: day.completed
              ? (i > 20 ? 'rgba(34,197,94,0.85)' : i > 10 ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.35)')
              : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'),
            border: day.completed
              ? '1px solid rgba(34,197,94,0.4)'
              : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          }}
          title={day.date}
        />
      ))}
    </div>
  );
};

// ── Modal for creating goal ───────────────────────────────────────────────────
const CreateGoalModal: React.FC<{ isDark: boolean; onClose: () => void; onCreated: (g: Goal) => void }> = ({ isDark, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.1)',
    color: 'var(--text-primary)',
    borderRadius: '12px',
    padding: '10px 14px',
    width: '100%',
    fontSize: '13px',
    outline: 'none',
    caretColor: '#22c55e',
  };

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const g = await createGoal({ title: title.trim(), description: desc.trim() });
      onCreated(g);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: isDark ? 'linear-gradient(120deg,#141b23 0%,#0f1419 100%)' : 'linear-gradient(120deg,#ffffff 0%,#f8fafc 100%)', border: '1px solid rgba(34,197,94,0.28)', boxShadow: '0 0 0 1px rgba(34,197,94,0.12), 0 30px 70px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#22c55e,transparent)' }} />
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-green-400" />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Goal</span>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-faint)' }}><X size={15} /></button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title..." style={inputStyle} autoFocus
            onKeyDown={e => e.key === 'Enter' && submit()} />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)..."
            rows={3} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
        </div>
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: `1px solid ${divider}` }}>
          <motion.button onClick={submit} disabled={!title.trim() || loading}
            whileHover={title.trim() && !loading ? { scale: 1.02 } : {}} whileTap={title.trim() && !loading ? { scale: 0.97 } : {}}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: title.trim() && !loading ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--bg-surface)', color: title.trim() && !loading ? '#000' : 'var(--text-faint)', boxShadow: title.trim() && !loading ? '0 0 16px rgba(34,197,94,0.2)' : 'none' }}>
            {loading ? <motion.div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} /> : <><CheckCircle2 size={14} />Create Goal</>}
          </motion.button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: `1px solid ${divider}`, color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const GoalsPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { award } = useCredits();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [claimedGoals, setClaimedGoals] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    const load = async () => {
      try {
        const [g, h, t] = await Promise.all([fetchGoals(), fetchHabits(), fetchTasks()]);
        setGoals(g); setHabits(h); setTasks(t);
      } catch (e) {
        setError('Could not reach backend — using empty state');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDeleteGoal = async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    try { await deleteGoal(id); } catch { setGoals(prev => [...prev]); }
  };

  const handleAddHabit = async () => {
    if (!newHabitTitle.trim()) return;
    try {
      const h = await createHabit({ title: newHabitTitle.trim(), frequency: 'daily' });
      setHabits(prev => [...prev, h]);
      setNewHabitTitle('');
    } catch (e) { setError('Failed to create habit'); }
  };

  const handleHabitCheckIn = async (id: string, completed: boolean) => {
    try {
      const updated = await habitCheckIn(id, completed);
      setHabits(prev => prev.map(h => h.id === id ? updated : h));
      // Earn Velocity Credits for showing up
      if (completed) {
        award('habit_checkin');
        if (updated.streak > 0 && updated.streak % 7 === 0) {
          award('habit_streak');
          setError(`🔥 ${updated.streak}-day streak! +50 VC bonus`);
          setTimeout(() => setError(null), 3500);
        }
      }
    } catch (e) { setError('Failed to update habit'); }
  };

  const handleClaimGoal = (goalId: string) => {
    if (claimedGoals.has(goalId)) return;
    award('goal_complete');
    setClaimedGoals(prev => new Set(prev).add(goalId));
  };

  const handleDeleteHabit = async (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    try { await deleteHabit(id); } catch { }
  };

  // Stat card data (mirrors dashboard stat card pattern)
  const totalStreak = habits.reduce((s, h) => s + h.streak, 0);
  const activeGoals = goals.length;
  const habitsToday = habits.filter(h => {
    const today = new Date().toISOString().slice(0, 10);
    return h.history.find(e => e.date === today && e.completed);
  }).length;

  const STATS = [
    { icon: Target,     label: 'Active Goals',   value: String(activeGoals),    color: '#22c55e' },
    { icon: Flame,      label: 'Total Streak',   value: `${totalStreak}d`,      color: '#f59e0b' },
    { icon: CheckCircle2, label: 'Done Today',   value: `${habitsToday}/${habits.length}`, color: '#22c55e' },
    { icon: TrendingUp, label: 'Habit Score',    value: habits.length > 0 ? `${Math.round((habitsToday / habits.length) * 100)}%` : '—', color: '#38bdf8' },
  ];

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div key={i} className="rounded-xl p-4" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}>
              <div className="h-2.5 rounded-full w-2/3 mb-3" style={{ background: isDark ? '#1c1c22' : '#e2e8f0' }} />
              <div className="h-7 rounded w-1/2" style={{ background: isDark ? '#161619' : '#e8edf3' }} />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">

      {/* Quick task capture */}
      <div className="mb-6 pb-6" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={11} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Quick Add — Link to a Goal</span>
        </div>
        <BrainDumpInput
          onSubmit={text => setError(`Task captured: "${text}" — link to a goal via Dashboard`)}
          compact isDark={isDark}
          placeholder="Describe a task to link to a goal..."
        />
      </div>

      {/* Stat cards — identical pattern to Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {STATS.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1)' }}
            className="rounded-xl p-4 cursor-default"
            style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={11} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
            </div>
            <div className="font-bold font-mono text-2xl" style={{ color }}>{value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Goals column ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: isDark ? '#71717a' : '#64748b' }}>Goals</span>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 h-px w-24 origin-left" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }} />
            </div>
            <motion.button onClick={() => setShowCreateGoal(true)}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)', boxShadow: '0 0 0 1px rgba(34,197,94,0.15), 0 0 10px rgba(34,197,94,0.1)' }}>
              <Plus size={12} />New Goal
            </motion.button>
          </div>

          {goals.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-12 rounded-xl"
              style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
              <Target size={28} className="text-green-500 opacity-30" />
              <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No goals yet. Create your first one!</span>
            </motion.div>
          )}

          <div className="space-y-3">
            {goals.map((goal, i) => {
              const progress = goal.progressPercent ?? 0;
              const failedLinked = tasks.filter(
                t => t.status === 'failed' && Array.isArray(goal.linkedTaskIds) && goal.linkedTaskIds.includes(t.id)
              );
              return (
                <motion.div key={goal.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -2, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1)' }}
                  className="rounded-xl overflow-hidden relative"
                  style={{ background: isDark ? 'rgba(14,20,28,0.98)' : 'rgba(255,255,255,0.97)', border: `1px solid ${failedLinked.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.2)'}` }}>
                  {/* Left accent bar — red if any linked task failed */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                       style={{ background: failedLinked.length > 0 ? '#ef4444' : '#22c55e' }} />

                  <div className="px-5 pt-4 pb-4 ml-[3px]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: failedLinked.length > 0 ? '#ef4444' : '#22c55e',
                                         boxShadow: failedLinked.length > 0 ? '0 0 6px #ef4444' : '0 0 6px #22c55e' }} />
                          <span className="font-semibold text-[14px] truncate tracking-tight" style={{ color: 'var(--text-primary)' }}>{goal.title}</span>
                        </div>
                        {goal.description && (
                          <p className="text-xs ml-3.5 mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{goal.description}</p>
                        )}
                      </div>
                      <motion.button onClick={() => handleDeleteGoal(goal.id)}
                        whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }}
                        className="shrink-0 p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-faint)', background: 'transparent' }}>
                        <Trash2 size={11} />
                      </motion.button>
                    </div>

                    {/* Failed task note — honest, specific */}
                    {failedLinked.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="mb-3 px-3 py-2 rounded-lg text-[11px] font-mono overflow-hidden"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#fca5a5' }}>
                        {failedLinked.length === 1
                          ? `1 linked task did not complete: "${failedLinked[0].taskName}"`
                          : `${failedLinked.length} linked tasks did not complete`}
                      </motion.div>
                    )}

                    {/* Progress bar — exact same as TaskDetailModal progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Progress</span>
                        <span className="font-mono font-bold text-xs" style={{ color: failedLinked.length > 0 ? '#f87171' : '#22c55e' }}>{progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                        <motion.div className="h-full rounded-full"
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                          style={{
                            background: failedLinked.length > 0
                              ? 'linear-gradient(90deg,rgba(239,68,68,0.6),#ef4444)'
                              : 'linear-gradient(90deg,#22c55ecc,#22c55e)',
                            boxShadow: failedLinked.length > 0 ? '0 0 8px rgba(239,68,68,0.4)' : '0 0 8px rgba(34,197,94,0.6)',
                          }} />
                      </div>
                    </div>

                    {/* Goal-complete reward claim */}
                    {progress >= 100 && (
                      <div className="mt-3">
                        {claimedGoals.has(goal.id) ? (
                          <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-mono font-semibold"
                            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                            <CheckCircle2 size={12} /> Reward claimed · +200 VC
                          </div>
                        ) : (
                          <motion.button onClick={() => handleClaimGoal(goal.id)}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                            animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0)', '0 0 16px rgba(34,197,94,0.4)', '0 0 0px rgba(34,197,94,0)'] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold"
                            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000' }}>
                            <Zap size={12} /> Goal complete — Claim 200 VC
                          </motion.button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom progress bar — like task card */}
                  <div className="absolute bottom-0 left-[3px] right-0 h-[2px]" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' }}>
                    <motion.div className="h-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.4 }}
                      style={{
                        background: failedLinked.length > 0
                          ? 'linear-gradient(90deg,rgba(239,68,68,0.4),#ef4444)'
                          : 'linear-gradient(90deg,#22c55e88,#22c55e)',
                        boxShadow: failedLinked.length > 0 ? '0 0 8px rgba(239,68,68,0.3)' : '0 0 8px rgba(34,197,94,0.5)',
                      }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Habits column ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: isDark ? '#71717a' : '#64748b' }}>Habits</span>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 h-px w-24 origin-left" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }} />
            </div>
          </div>

          {/* New habit input */}
          <div className="flex gap-2 mb-4">
            <input
              value={newHabitTitle}
              onChange={e => setNewHabitTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
              placeholder="New daily habit..."
              className="flex-1 text-sm font-mono px-4 py-2.5 rounded-xl outline-none transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.1)',
                color: 'var(--text-primary)', caretColor: '#22c55e',
              }}
            />
            <motion.button onClick={handleAddHabit} disabled={!newHabitTitle.trim()}
              whileHover={newHabitTitle.trim() ? { scale: 1.04 } : {}} whileTap={newHabitTitle.trim() ? { scale: 0.96 } : {}}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: newHabitTitle.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--bg-surface)', color: newHabitTitle.trim() ? '#000' : 'var(--text-faint)' }}>
              <Plus size={14} />Add
            </motion.button>
          </div>

          {habits.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-12 rounded-xl"
              style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
              <Flame size={28} className="text-amber-500 opacity-30" />
              <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No habits yet. Add your first daily habit!</span>
            </motion.div>
          )}

          <div className="space-y-3">
            {habits.map((habit, i) => {
              const today = new Date().toISOString().slice(0, 10);
              const doneToday = habit.history.find(e => e.date === today && e.completed);

              return (
                <motion.div key={habit.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl overflow-hidden"
                  style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={() => handleHabitCheckIn(habit.id, !doneToday)}
                          whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                          style={{
                            background: doneToday ? 'rgba(34,197,94,0.15)' : 'transparent',
                            border: doneToday ? '1.5px solid rgba(34,197,94,0.5)' : `1.5px solid ${surfaceBorder}`,
                            color: doneToday ? '#22c55e' : 'var(--text-faint)',
                          }}>
                          {doneToday && <CheckCircle2 size={12} />}
                        </motion.button>
                        <span className="text-sm font-medium" style={{ color: doneToday ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: doneToday ? 'none' : 'none' }}>
                          {habit.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Streak counter — stat-card style number */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{ background: habit.streak > 0 ? 'rgba(245,158,11,0.1)' : 'var(--bg-surface)', border: habit.streak > 0 ? '1px solid rgba(245,158,11,0.25)' : `1px solid ${surfaceBorder}` }}>
                          <Flame size={9} style={{ color: habit.streak > 0 ? '#f59e0b' : 'var(--text-faint)' }} />
                          <span className="text-[11px] font-mono font-bold" style={{ color: habit.streak > 0 ? '#fbbf24' : 'var(--text-faint)' }}>
                            {habit.streak}d
                          </span>
                        </div>
                        <motion.button onClick={() => handleDeleteHabit(habit.id)}
                          whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }}
                          style={{ color: 'var(--text-faint)' }}>
                          <Trash2 size={11} />
                        </motion.button>
                      </div>
                    </div>

                    {/* 30-day heatmap */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar size={9} style={{ color: 'var(--text-faint)' }} />
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>30-day streak</span>
                      </div>
                      <HeatmapGrid history={habit.history} isDark={isDark} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateGoal && (
          <CreateGoalModal isDark={isDark} onClose={() => setShowCreateGoal(false)}
            onCreated={g => setGoals(prev => [...prev, g])} />
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', backdropFilter: 'blur(12px)' }}>
            <span className="text-xs font-mono text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 opacity-60 hover:opacity-100 text-xs">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoalsPage;
