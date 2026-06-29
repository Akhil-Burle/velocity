/**
 * CalendarPage.tsx
 * Fully synced with Command Day — same ordering, same block times.
 * Clicking a task block opens TaskDetailModal (identical to CommandDay).
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Zap, RefreshCw, Calendar,
  ToggleLeft, ToggleRight, CheckCircle2, List, LayoutGrid,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import { fetchCalendarEvents, fetchTasks, updateTask as apiUpdateTask, completeTask as apiCompleteTask, pushCalendarSync } from '../api';
import TaskDetailModal from './TaskDetailModal';
import type { CalendarEvent, PaceStatus, Task } from '../types';

const STATUS_CONFIG: Record<PaceStatus, { accent: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  GREEN:    { accent: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)',   badgeText: '#4ade80', badgeBorder: 'rgba(34,197,94,0.3)' },
  AMBER:    { accent: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#fbbf24', badgeBorder: 'rgba(245,158,11,0.3)' },
  RED:      { accent: '#ef4444', badgeBg: 'rgba(239,68,68,0.12)',   badgeText: '#f87171', badgeBorder: 'rgba(239,68,68,0.32)' },
  COMPLETE: { accent: '#52525b', badgeBg: 'rgba(63,63,70,0.2)',     badgeText: '#71717a', badgeBorder: 'rgba(63,63,70,0.3)' },
  failed:   { accent: '#71717a', badgeBg: 'rgba(63,63,70,0.15)',    badgeText: '#71717a', badgeBorder: 'rgba(63,63,70,0.25)' },
};

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay(); }
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Agenda view ───────────────────────────────────────────────────────────────
const AgendaView: React.FC<{
  events: CalendarEvent[];
  isDark: boolean;
  surfaceBorder: string;
  onEventClick: (ev: CalendarEvent) => void;
  onMarkComplete: (ev: CalendarEvent) => void;
}> = ({ events, isDark, surfaceBorder, onEventClick, onMarkComplete }) => {
  const divider  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const upcoming = [...events]
    .filter(e => e.type !== 'buffer' && !e.completed)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 30);

  const grouped: Record<string, CalendarEvent[]> = {};
  for (const ev of upcoming) {
    if (!grouped[ev.date]) grouped[ev.date] = [];
    grouped[ev.date].push(ev);
  }

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Zap size={28} className="text-green-500 opacity-30" />
        <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No upcoming scheduled tasks</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayEvts]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
            <div className="flex-1 h-px" style={{ background: divider }} />
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', color: 'var(--text-faint)', border: `1px solid ${divider}` }}>
              {dayEvts.length} {dayEvts.length === 1 ? 'block' : 'blocks'}
            </span>
          </div>
          <div className="space-y-2">
            {dayEvts.map((ev, i) => (
              <DayEventItem key={ev.id} ev={ev} index={i} isDark={isDark} surfaceBorder={surfaceBorder}
                onEventClick={onEventClick} onMarkComplete={onMarkComplete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── DayEventItem ─────────────────────────────────────────────────────────────
const DayEventItem: React.FC<{
  ev: CalendarEvent;
  index: number;
  isDark: boolean;
  surfaceBorder: string;
  onEventClick: (ev: CalendarEvent) => void;
  onMarkComplete: (ev: CalendarEvent) => void;
}> = ({ ev, index, isDark, onEventClick, onMarkComplete }) => {
  const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.GREEN;
  const isComplete = !!ev.completed;
  const isBuffer   = ev.type === 'buffer';

  if (isBuffer) {
    return (
      <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.04 }}
        className="rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ background: isDark ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.02)',
                 border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}` }}>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
          {ev.startTime}–{ev.endTime}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>Recovery buffer</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => !isComplete && onEventClick(ev)}
      className="rounded-xl relative overflow-visible cursor-pointer"
      style={{
        background: isDark ? 'rgba(14,20,28,0.98)' : 'rgba(255,255,255,0.97)',
        border: `1px solid rgba(${cfg.accent === '#22c55e' ? '34,197,94' : cfg.accent === '#f59e0b' ? '245,158,11' : '239,68,68'},${isComplete ? '0.1' : '0.22'})`,
        opacity: isComplete ? 0.6 : 1,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: isComplete ? '#52525b' : cfg.accent }} />
      <div className="ml-2 px-2 py-2.5">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[10px] font-mono font-semibold" style={{ color: isComplete ? '#52525b' : cfg.accent }}>
            {ev.startTime}–{ev.endTime}
          </span>
          <motion.button
            onClick={e => { e.stopPropagation(); onMarkComplete(ev); }}
            whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
            className="p-1 rounded"
            style={{ color: isComplete ? '#22c55e' : 'var(--text-faint)' }}
            title={isComplete ? 'Completed' : 'Mark complete'}
          >
            <CheckCircle2 size={10} />
          </motion.button>
        </div>
        <div className="text-xs font-medium truncate mb-0.5"
          style={{ color: isComplete ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: isComplete ? 'line-through' : 'none' }}>
          {ev.taskName}
        </div>
        {ev.completionPercent !== undefined && ev.completionPercent > 0 && !isComplete && (
          <div className="text-[10px] font-mono" style={{ color: cfg.accent }}>{ev.completionPercent}% done</div>
        )}
        {!isComplete && ev.task && (
          <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>tap to open details →</div>
        )}
      </div>
    </motion.div>
  );
};

// ── Main CalendarPage ─────────────────────────────────────────────────────────
const CalendarPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { award } = useCredits();

  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode]       = useState<'month' | 'agenda'>('month');
  const [message, setMessage]         = useState<string | null>(null);
  const [detailTask, setDetailTask]   = useState<Task | null>(null);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const cellBg        = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const todayStr      = now.toISOString().slice(0, 10);

  const reload = async () => {
    setLoading(true);
    try {
      const [evts, tasks] = await Promise.all([fetchCalendarEvents(), fetchTasks()]);
      setEvents(evts);
      setAllTasks(tasks);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  // When a calendar event is clicked, find the full task from allTasks
  // (fallback: use the task embedded in the event from the backend)
  const handleEventClick = (ev: CalendarEvent) => {
    if (!ev.taskId) return;
    const fullTask = allTasks.find(t => t.id === ev.taskId) ?? ev.task ?? null;
    if (fullTask) setDetailTask(fullTask);
  };

  const handleMarkComplete = async (ev: CalendarEvent) => {
    if (!ev.taskId) return;
    try {
      await apiCompleteTask(ev.taskId);
      setEvents(prev => prev.map(e => e.taskId === ev.taskId ? { ...e, completed: true } : e));
      award('calendar_block');
      setMessage('✓ Task complete');
      setTimeout(() => setMessage(null), 2500);
    } catch { /* silently fail */ }
  };

  const handleToggleSync = () => {
    setMessage('Google Calendar Sync requires app verification. Demo calendar data is loaded automatically.');
    setTimeout(() => setMessage(null), 4000);
  };

  const handleReschedule = async () => {
    setRescheduleLoading(true);
    try {
      const result = await pushCalendarSync();
      if (result.success) {
        setMessage(`✓ Synced ${result.created} events to Google Calendar`);
      } else {
        // Not configured — show the informational message from backend
        setMessage(result.message);
      }
      // Refresh local events too
      const evts = await fetchCalendarEvents();
      setEvents(evts);
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setMessage('Sync failed — ensure backend is running');
      setTimeout(() => setMessage(null), 3000);
    } finally { setRescheduleLoading(false); }
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekDay = getFirstDayOfMonth(year, month);

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }
  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <motion.button onClick={prevMonth} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}`, color: 'var(--text-muted)' }}>
            <ChevronLeft size={14} />
          </motion.button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <motion.button onClick={nextMonth} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}`, color: 'var(--text-muted)' }}>
            <ChevronRight size={14} />
          </motion.button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${surfaceBorder}` }}>
            {(['month', 'agenda'] as const).map((mode, i) => (
              <motion.button key={mode} onClick={() => setViewMode(mode)} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
                style={{
                  background: viewMode === mode ? 'rgba(34,197,94,0.1)' : surfaceBg,
                  color: viewMode === mode ? '#22c55e' : 'var(--text-muted)',
                  borderRight: i === 0 ? `1px solid ${surfaceBorder}` : 'none',
                }}>
                {mode === 'month' ? <LayoutGrid size={12} /> : <List size={12} />}
                <span className="hidden sm:inline capitalize">{mode}</span>
              </motion.button>
            ))}
          </div>

          {/* Google Cal sync — shows friendly error for unverified users */}
          <div className="flex flex-col items-center gap-0.5">
            <motion.button onClick={handleToggleSync} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}`, color: 'var(--text-muted)' }}>
              <ToggleLeft size={14} />
              <span className="hidden sm:inline">Google Sign-In</span>
            </motion.button>
            <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z"/></svg>
              test mode only
            </span>
          </div>

          {/* Push to Google Calendar */}
          <div className="flex flex-col items-center gap-0.5">
            <motion.button onClick={handleReschedule} disabled={rescheduleLoading}
              whileHover={!rescheduleLoading ? { scale: 1.04 } : {}} whileTap={!rescheduleLoading ? { scale: 0.96 } : {}}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={rescheduleLoading
                ? { background: surfaceBg, color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, opacity: 0.5 }
                : { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.28)' }}>
              {rescheduleLoading
                ? <motion.div className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                : <Zap size={12} />}
              <span className="hidden sm:inline">Sync to Google Cal</span>
            </motion.button>
            <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z"/></svg>
              test mode only
            </span>
          </div>

          <motion.button onClick={reload} whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
            <RefreshCw size={13} />
          </motion.button>
        </div>
      </div>

      {/* Google Calendar info note */}
      <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="#38bdf8" className="shrink-0 mt-0.5">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z"/>
        </svg>
        <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          <span style={{ color: '#38bdf8' }}>Calendar sync works in test mode only.</span>
          {' '}Google Sign-In and two-way calendar push are available to authorized test users.
          Public access requires Google app verification.
        </p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 px-4 py-2.5 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: '#4ade80' }}>
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <motion.div className="w-8 h-8 rounded-full border-2 border-green-400 border-t-transparent"
            animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
        </div>
      )}

      {!loading && (
        <AnimatePresence mode="wait">
          {viewMode === 'agenda' ? (
            <motion.div key="agenda" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <AgendaView events={events} isDark={isDark} surfaceBorder={surfaceBorder}
                onEventClick={handleEventClick} onMarkComplete={handleMarkComplete} />
            </motion.div>
          ) : (
            <motion.div key="month" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Month grid */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl overflow-hidden" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                  <div className="grid grid-cols-7 border-b" style={{ borderColor: surfaceBorder }}>
                    {DAY_NAMES.map(d => (
                      <div key={d} className="text-center py-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstWeekDay }).map((_, i) => (
                      <div key={`e-${i}`} className="aspect-square border-r border-b"
                        style={{ borderColor: surfaceBorder, background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const ds          = dateStr(year, month, day);
                      const dayEvts     = (eventsByDate[ds] || []).filter(e => e.type !== 'buffer');
                      const incomplete  = dayEvts.filter(e => !e.completed);
                      const isToday     = ds === todayStr;
                      const isSelected  = ds === selectedDay;
                      const col         = (firstWeekDay + day - 1) % 7;
                      return (
                        <motion.div key={day}
                          onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                          whileHover={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                          className="relative p-2 border-b cursor-pointer transition-colors"
                          style={{
                            borderRight: col === 6 ? 'none' : `1px solid ${surfaceBorder}`,
                            borderBottom: `1px solid ${surfaceBorder}`,
                            background: isSelected ? (isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.05)') : cellBg,
                            minHeight: 80,
                          }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono w-6 h-6 flex items-center justify-center rounded-full"
                              style={{ color: isToday ? '#000' : 'var(--text-muted)', background: isToday ? '#22c55e' : 'transparent', fontWeight: isToday ? 700 : 500 }}>
                              {day}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {incomplete.slice(0, 3).map(ev => {
                              const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.GREEN;
                              return (
                                <div key={ev.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded truncate"
                                  style={{ background: cfg.badgeBg, color: cfg.badgeText, border: `1px solid ${cfg.badgeBorder}` }}>
                                  {ev.startTime} {ev.taskName}
                                </div>
                              );
                            })}
                            {incomplete.length > 3 && (
                              <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                                +{incomplete.length - 3} more
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Day detail panel */}
              <div>
                <div className="rounded-2xl overflow-hidden sticky top-6" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${surfaceBorder}` }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} style={{ color: 'var(--text-faint)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selectedDay
                          ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                          : 'Select a day'}
                      </span>
                      {selectedDay && selectedEvents.filter(e => e.type !== 'buffer').length > 0 && (
                        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
                          {selectedEvents.filter(e => e.type !== 'buffer' && !e.completed).length} blocks
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 max-h-[420px] overflow-y-auto">
                    {!selectedDay && (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <Calendar size={24} className="text-green-500 opacity-30" />
                        <span className="text-xs font-mono text-center" style={{ color: 'var(--text-faint)' }}>
                          Click a day to see scheduled tasks
                        </span>
                      </div>
                    )}
                    {selectedDay && selectedEvents.filter(e => e.type !== 'buffer').length === 0 && (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <Zap size={24} className="text-green-500 opacity-30" />
                        <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No tasks scheduled</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {selectedEvents.map((ev, i) => (
                        <DayEventItem key={ev.id} ev={ev} index={i} isDark={isDark} surfaceBorder={surfaceBorder}
                          onEventClick={handleEventClick} onMarkComplete={handleMarkComplete} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status summary */}
                <div className="mt-4 rounded-xl p-4" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Zap size={11} style={{ color: 'var(--text-faint)' }} />
                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Upcoming</span>
                  </div>
                  <div className="space-y-2">
                    {(['RED', 'AMBER', 'GREEN'] as PaceStatus[]).map(status => {
                      const cfg   = STATUS_CONFIG[status];
                      const count = events.filter(e => e.status === status && !e.completed && e.type !== 'buffer').length;
                      const label = status === 'RED' ? 'Critical' : status === 'AMBER' ? 'Warning' : 'On Pace';
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.accent }} />
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{label}</span>
                          </div>
                          <span className="text-[11px] font-mono font-semibold" style={{ color: cfg.accent }}>{count}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${divider}` }}>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>Completed</span>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: '#52525b' }}>
                        {events.filter(e => e.completed).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* TaskDetailModal — same as CommandDay */}
      <AnimatePresence>
        {detailTask && (
          <TaskDetailModal
            task={detailTask}
            isDark={isDark}
            onClose={() => setDetailTask(null)}
            onMarkComplete={() => {
              apiCompleteTask(detailTask.id).catch(() => {});
              setEvents(prev => prev.map(e => e.taskId === detailTask.id ? { ...e, completed: true } : e));
              setDetailTask(null);
            }}
            onProgressUpdate={(percent) => {
              apiUpdateTask(detailTask.id, { completionPercent: percent }).catch(() => {});
              setDetailTask(prev => prev ? { ...prev, completionPercent: percent } : null);
            }}
            onTaskUpdate={(updated) => {
              setAllTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
              setDetailTask(updated);
            }}
            onNegotiate={() => setDetailTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarPage;
