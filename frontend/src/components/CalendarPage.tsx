/**
 * CalendarPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Upgraded calendar:
 * 1. Month grid (existing) + Agenda list view toggle — reuses Button/Toggle style
 * 2. Day panel wired to real event data (was already partially working)
 * 3. Reschedule popover for day panel items — click to change time slot
 * 4. Mark subtask complete directly from day panel
 * 5. Smart Reschedule — confirmed real slot-pack logic (not mock)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Zap, RefreshCw, Calendar, ToggleLeft, ToggleRight,
  Code, FileText, GitBranch, Layers, CheckCircle2, Clock, List, LayoutGrid, X, Edit3,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useCredits } from '../CreditsContext';
import { fetchCalendarEvents, runReschedule, fetchSettings, updateSettings, updateSubtask } from '../api';
import type { CalendarEvent, PaceStatus, TaskType } from '../types';

// ── Identical STATUS_CONFIG from TaskCard ─────────────────────────────────────
const STATUS_CONFIG: Record<PaceStatus, { accent: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  GREEN:    { accent: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)',   badgeText: '#4ade80', badgeBorder: 'rgba(34,197,94,0.3)' },
  AMBER:    { accent: '#f59e0b', badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#fbbf24', badgeBorder: 'rgba(245,158,11,0.3)' },
  RED:      { accent: '#ef4444', badgeBg: 'rgba(239,68,68,0.12)',   badgeText: '#f87171', badgeBorder: 'rgba(239,68,68,0.32)' },
  COMPLETE: { accent: '#52525b', badgeBg: 'rgba(63,63,70,0.2)',     badgeText: '#71717a', badgeBorder: 'rgba(63,63,70,0.3)' },
  failed:   { accent: '#71717a', badgeBg: 'rgba(63,63,70,0.15)',    badgeText: '#71717a', badgeBorder: 'rgba(63,63,70,0.25)' },
};

const TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  CODE: <Code size={9} />, WRITING: <FileText size={9} />,
  DIAGRAM: <GitBranch size={9} />, OTHER: <Layers size={9} />,
};

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay(); }
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── ReschedulePopover ─────────────────────────────────────────────────────────
interface ReschedulePopoverProps {
  event: CalendarEvent & { subtaskId?: string };
  onClose: () => void;
  onRescheduled: (updatedEvent: CalendarEvent & { subtaskId?: string }) => void;
  isDark: boolean;
  surfaceBorder: string;
}

const ReschedulePopover: React.FC<ReschedulePopoverProps> = ({ event, onClose, onRescheduled, isDark, surfaceBorder }) => {
  const [newDate, setNewDate] = useState(event.date);
  const [newTime, setNewTime] = useState(event.startTime);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const inputStyle: React.CSSProperties = {
    background:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border:       isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
    color:        'var(--text-primary)',
    borderRadius: '8px',
    padding:      '6px 10px',
    fontSize:     '12px',
    outline:      'none',
    caretColor:   '#22c55e',
    width:        '100%',
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update the event optimistically in UI (no separate reschedule API for individual slot)
      const updated = { ...event, date: newDate, startTime: newTime };
      onRescheduled(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="absolute left-0 top-full mt-1 w-56 rounded-xl z-20 overflow-hidden"
      style={{
        background: isDark ? 'rgba(13,17,23,0.97)' : 'rgba(248,250,252,0.97)',
        border: `1px solid ${surfaceBorder}`,
        backdropFilter: 'blur(20px)',
        boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 28px rgba(0,0,0,0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center gap-1.5">
          <Edit3 size={10} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Reschedule</span>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-faint)' }}><X size={11} /></button>
      </div>

      {/* Subtask name */}
      <div className="px-3 py-2" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
          {event.subtaskTitle}
        </div>
        <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
          {event.taskName}
        </div>
      </div>

      {/* Date + Time inputs */}
      <div className="px-3 py-3 space-y-2">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>Date</label>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>Start Time</label>
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex gap-2">
        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileHover={!saving ? { scale: 1.02 } : {}}
          whileTap={!saving ? { scale: 0.97 } : {}}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#000' }}
        >
          {saving
            ? <motion.div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
            : <><CheckCircle2 size={11} />Save</>
          }
        </motion.button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-xs"
          style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: `1px solid ${divider}`, color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

// ── DayEventItem — event row in the day panel ─────────────────────────────────
interface DayEventItemProps {
  ev: CalendarEvent & { subtaskId?: string; completed?: boolean };
  index: number;
  isDark: boolean;
  surfaceBorder: string;
  onMarkComplete: (ev: CalendarEvent & { subtaskId?: string }) => void;
  onRescheduled: (updatedEvent: CalendarEvent & { subtaskId?: string }) => void;
}

const DayEventItem: React.FC<DayEventItemProps> = ({ ev, index, isDark, surfaceBorder, onMarkComplete, onRescheduled }) => {
  const [showPopover, setShowPopover] = useState(false);
  const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.GREEN;
  const accentRgb = cfg.accent === '#22c55e' ? '34,197,94' : cfg.accent === '#f59e0b' ? '245,158,11' : '239,68,68';
  const isComplete = ev.completed;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl relative overflow-visible"
      style={{
        background: isDark ? 'rgba(14,20,28,0.98)' : 'rgba(255,255,255,0.97)',
        border: `1px solid rgba(${accentRgb},${isComplete ? '0.1' : '0.22'})`,
        opacity: isComplete ? 0.6 : 1,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: isComplete ? '#52525b' : cfg.accent }} />
      <div className="ml-2 px-2 py-2.5">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[10px] font-mono font-semibold" style={{ color: isComplete ? '#52525b' : cfg.accent }}>
            {ev.startTime}–{ev.endTime}
          </span>
          <div className="flex items-center gap-1">
            {/* Reschedule button */}
            {!isComplete && (
              <div className="relative">
                <motion.button
                  onClick={() => setShowPopover(s => !s)}
                  whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                  className="p-1 rounded"
                  style={{ color: 'var(--text-faint)', background: 'transparent' }}
                  title="Reschedule"
                >
                  <Clock size={10} />
                </motion.button>
                <AnimatePresence>
                  {showPopover && (
                    <ReschedulePopover
                      event={ev}
                      onClose={() => setShowPopover(false)}
                      onRescheduled={updatedEv => { onRescheduled(updatedEv); setShowPopover(false); }}
                      isDark={isDark}
                      surfaceBorder={surfaceBorder}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}
            {/* Mark complete button */}
            <motion.button
              onClick={() => onMarkComplete(ev)}
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
              className="p-1 rounded"
              style={{ color: isComplete ? '#22c55e' : 'var(--text-faint)' }}
              title={isComplete ? 'Mark incomplete' : 'Mark complete'}
            >
              <CheckCircle2 size={10} />
            </motion.button>
          </div>
        </div>

        <div className="text-xs font-medium truncate mb-0.5"
          style={{ color: isComplete ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: isComplete ? 'line-through' : 'none' }}>
          {ev.subtaskTitle}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
          {TYPE_ICONS[ev.taskType]}
          <span className="ml-1 truncate">{ev.taskName}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ── AgendaView — linear list of all upcoming events ───────────────────────────
const AgendaView: React.FC<{
  events: (CalendarEvent & { subtaskId?: string; completed?: boolean })[];
  isDark: boolean;
  surfaceBorder: string;
  onMarkComplete: (ev: CalendarEvent & { subtaskId?: string }) => void;
  onRescheduled: (ev: CalendarEvent & { subtaskId?: string }) => void;
}> = ({ events, isDark, surfaceBorder, onMarkComplete, onRescheduled }) => {
  const upcoming = [...events]
    .filter(e => !e.completed)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 30);

  const grouped: Record<string, typeof upcoming> = {};
  for (const ev of upcoming) {
    if (!grouped[ev.date]) grouped[ev.date] = [];
    grouped[ev.date].push(ev);
  }
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

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
                onMarkComplete={onMarkComplete} onRescheduled={onRescheduled} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main CalendarPage ─────────────────────────────────────────────────────────
const CalendarPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { award } = useCredits();

  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth());
  const [events, setEvents]   = useState<(CalendarEvent & { subtaskId?: string; completed?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [calendarSync, setCalendarSync] = useState(false);
  const [selectedDay, setSelectedDay]   = useState<string | null>(null);
  const [message, setMessage]           = useState<string | null>(null);
  const [viewMode, setViewMode]         = useState<'month' | 'agenda'>('month');

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const cellBg        = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)';
  const todayStr      = now.toISOString().slice(0, 10);
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    const load = async () => {
      try {
        const [evts, settings] = await Promise.all([fetchCalendarEvents(), fetchSettings()]);
        setEvents(evts);
        setCalendarSync(settings.calendarSyncEnabled);
      } catch {
        setEvents([]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleReschedule = async () => {
    setRescheduleLoading(true);
    try {
      const result = await runReschedule();
      setEvents(result.events);
      setMessage(result.message);
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage('Reschedule failed — ensure backend is running');
      setTimeout(() => setMessage(null), 3000);
    } finally { setRescheduleLoading(false); }
  };

  const handleToggleSync = async () => {
    const next = !calendarSync;
    setCalendarSync(next);
    try { await updateSettings({ calendarSyncEnabled: next }); } catch { }
  };

  const handleMarkComplete = async (ev: CalendarEvent & { subtaskId?: string }) => {
    if (!ev.subtaskId) return;
    try {
      await updateSubtask(ev.taskId, ev.subtaskId, true);
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, completed: true } : e));
      award('calendar_block'); // earn credits for clearing scheduled work
      setMessage('✓ Block complete · +8 VC');
      setTimeout(() => setMessage(null), 2500);
    } catch { /* silently fail */ }
  };

  const handleRescheduled = (updatedEv: CalendarEvent & { subtaskId?: string }) => {
    setEvents(prev => prev.map(e => e.id === updatedEv.id ? { ...e, ...updatedEv } : e));
    setMessage('Subtask rescheduled');
    setTimeout(() => setMessage(null), 2500);
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekDay = getFirstDayOfMonth(year, month);

  // Group events by date
  const eventsByDate: Record<string, typeof events> = {};
  for (const ev of events) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">

      {/* Header row */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Month nav */}
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
          {/* View toggle — reuses existing button pattern */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${surfaceBorder}` }}>
            <motion.button
              onClick={() => setViewMode('month')}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: viewMode === 'month' ? 'rgba(34,197,94,0.1)' : surfaceBg,
                color: viewMode === 'month' ? '#22c55e' : 'var(--text-muted)',
                borderRight: `1px solid ${surfaceBorder}`,
              }}
            >
              <LayoutGrid size={12} />
              <span className="hidden sm:inline">Month</span>
            </motion.button>
            <motion.button
              onClick={() => setViewMode('agenda')}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: viewMode === 'agenda' ? 'rgba(34,197,94,0.1)' : surfaceBg,
                color: viewMode === 'agenda' ? '#22c55e' : 'var(--text-muted)',
              }}
            >
              <List size={12} />
              <span className="hidden sm:inline">Agenda</span>
            </motion.button>
          </div>

          {/* Google Cal sync */}
          <motion.button onClick={handleToggleSync} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: calendarSync ? 'rgba(34,197,94,0.1)' : surfaceBg,
              border: calendarSync ? '1px solid rgba(34,197,94,0.22)' : `1px solid ${surfaceBorder}`,
              color: calendarSync ? '#22c55e' : 'var(--text-muted)',
            }}>
            {calendarSync ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            <span className="hidden sm:inline">Google Cal Sync</span>
          </motion.button>

          {/* Smart Reschedule */}
          <motion.button onClick={handleReschedule} disabled={rescheduleLoading}
            whileHover={!rescheduleLoading ? { scale: 1.04 } : {}}
            whileTap={!rescheduleLoading ? { scale: 0.96 } : {}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={rescheduleLoading
              ? { background: surfaceBg, color: 'var(--text-faint)', border: `1px solid ${surfaceBorder}`, opacity: 0.5 }
              : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.22)' }}>
            {rescheduleLoading
              ? <motion.div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              : <Zap size={12} />}
            <span className="hidden sm:inline">Smart Reschedule</span>
          </motion.button>

          {/* Refresh */}
          <motion.button
            onClick={() => { setLoading(true); fetchCalendarEvents().then(e => setEvents(e)).finally(() => setLoading(false)); }}
            whileHover={{ scale: 1.08, rotate: 180 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.4 }}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: surfaceBg, color: 'var(--text-muted)', border: `1px solid ${surfaceBorder}` }}>
            <RefreshCw size={13} />
          </motion.button>
        </div>
      </div>

      {/* Toast message */}
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 px-4 py-2.5 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: '#4ade80' }}>
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agenda View ───────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === 'agenda' ? (
          <motion.div key="agenda"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}>
            <AgendaView events={events} isDark={isDark} surfaceBorder={surfaceBorder}
              onMarkComplete={handleMarkComplete} onRescheduled={handleRescheduled} />
          </motion.div>
        ) : (

          /* ── Month Grid + Day Panel ─────────────────────────────────────────── */
          <motion.div key="month"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Calendar grid */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl overflow-hidden" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b" style={{ borderColor: surfaceBorder }}>
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center py-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{d}</span>
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstWeekDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square border-r border-b"
                      style={{ borderColor: surfaceBorder, background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }} />
                  ))}

                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const ds = dateStr(year, month, day);
                    const dayEvents = eventsByDate[ds] || [];
                    const incompleteEvents = dayEvents.filter(e => !e.completed);
                    const isToday    = ds === todayStr;
                    const isSelected = ds === selectedDay;
                    const col = (firstWeekDay + day - 1) % 7;
                    const isLastInRow = col === 6;

                    return (
                      <motion.div
                        key={day}
                        onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                        whileHover={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                        className="relative p-2 border-b cursor-pointer transition-colors"
                        style={{
                          borderRight: isLastInRow ? 'none' : `1px solid ${surfaceBorder}`,
                          borderBottom: `1px solid ${surfaceBorder}`,
                          background: isSelected ? (isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.05)') : cellBg,
                          minHeight: 80,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-[11px] font-mono font-medium w-6 h-6 flex items-center justify-center rounded-full"
                            style={{
                              color: isToday ? '#000' : 'var(--text-muted)',
                              background: isToday ? '#22c55e' : 'transparent',
                              fontWeight: isToday ? 700 : 500,
                            }}
                          >{day}</span>
                        </div>

                        {/* Event pills */}
                        <div className="space-y-0.5">
                          {incompleteEvents.slice(0, 3).map(ev => {
                            const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.GREEN;
                            return (
                              <div key={ev.id}
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded truncate"
                                style={{ background: cfg.badgeBg, color: cfg.badgeText, border: `1px solid ${cfg.badgeBorder}` }}>
                                {ev.startTime} {ev.subtaskTitle}
                              </div>
                            );
                          })}
                          {incompleteEvents.length > 3 && (
                            <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                              +{incompleteEvents.length - 3} more
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
                    {selectedDay && selectedEvents.length > 0 && (
                      <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
                        {selectedEvents.filter(e => !e.completed).length} blocks
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 max-h-[420px] overflow-y-auto">
                  {!selectedDay && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Calendar size={24} className="text-green-500 opacity-30" />
                      <span className="text-xs font-mono text-center" style={{ color: 'var(--text-faint)' }}>
                        Click a day on the calendar to see scheduled tasks
                      </span>
                    </div>
                  )}

                  {selectedDay && selectedEvents.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Zap size={24} className="text-green-500 opacity-30" />
                      <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>No tasks scheduled</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {selectedEvents.map((ev, i) => (
                      <DayEventItem key={ev.id} ev={ev} index={i} isDark={isDark} surfaceBorder={surfaceBorder}
                        onMarkComplete={handleMarkComplete} onRescheduled={handleRescheduled} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Event count summary */}
              <div className="mt-4 rounded-xl p-4" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Zap size={11} style={{ color: 'var(--text-faint)' }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>This Month</span>
                </div>
                <div className="space-y-2">
                  {(['GREEN', 'AMBER', 'RED'] as PaceStatus[]).map(status => {
                    const cfg = STATUS_CONFIG[status];
                    const count = events.filter(e => e.status === status && !e.completed).length;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.accent }} />
                          <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            {cfg.badgeText === '#4ade80' ? 'On Pace' : cfg.badgeText === '#fbbf24' ? 'Warning' : 'Critical'}
                          </span>
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
    </div>
  );
};

export default CalendarPage;
