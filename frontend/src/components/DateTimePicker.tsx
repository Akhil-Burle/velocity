/**
 * DateTimePicker.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A fully custom calendar + time picker styled to match Velocity's dark/light
 * design system. No external dependencies — uses only Framer Motion and
 * Lucide icons already in the project.
 *
 * Props:
 *   value    — ISO date string (or '') controlled from parent
 *   onChange — called with a new ISO string whenever date/time changes
 *   isDark   — theme flag
 *   error    — shows red border when truthy
 *   minDate  — earliest selectable date (Date object), defaults to today
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Clock, X } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (iso: string) => void;
  isDark?: boolean;
  error?: boolean;
  minDate?: Date;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + '  ·  '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── component ─────────────────────────────────────────────────────────────────

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  isDark = true,
  error = false,
  minDate,
}) => {
  const today = minDate ?? new Date();
  today.setHours(0, 0, 0, 0);

  // Parse current value into parts
  const parsed = value ? new Date(value) : null;

  const [open, setOpen]             = useState(false);
  const [viewYear, setViewYear]     = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth]   = useState(parsed?.getMonth() ?? new Date().getMonth());
  const [selYear, setSelYear]       = useState(parsed?.getFullYear() ?? null as number | null);
  const [selMonth, setSelMonth]     = useState(parsed?.getMonth() ?? null as number | null);
  const [selDay, setSelDay]         = useState(parsed?.getDate() ?? null as number | null);
  const [selHour, setSelHour]       = useState(parsed?.getHours() ?? 23);
  const [selMin, setSelMin]         = useState(parsed?.getMinutes() ?? 59);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Sync internal state when value prop changes from outside
  useEffect(() => {
    const d = value ? new Date(value) : null;
    if (d && !isNaN(d.getTime())) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelYear(d.getFullYear());
      setSelMonth(d.getMonth());
      setSelDay(d.getDate());
      setSelHour(d.getHours());
      setSelMin(d.getMinutes());
    }
  }, [value]);

  const emitChange = useCallback((
    y: number, mo: number, d: number, h: number, m: number,
  ) => {
    const iso = new Date(y, mo, d, h, m, 0).toISOString();
    onChange(iso);
  }, [onChange]);

  const selectDay = (day: number) => {
    setSelYear(viewYear);
    setSelMonth(viewMonth);
    setSelDay(day);
    emitChange(viewYear, viewMonth, day, selHour, selMin);
  };

  const handleHourChange = (h: number) => {
    const clamped = Math.max(0, Math.min(23, h));
    setSelHour(clamped);
    if (selYear !== null && selMonth !== null && selDay !== null) {
      emitChange(selYear, selMonth, selDay, clamped, selMin);
    }
  };

  const handleMinChange = (m: number) => {
    const clamped = Math.max(0, Math.min(59, m));
    setSelMin(clamped);
    if (selYear !== null && selMonth !== null && selDay !== null) {
      emitChange(selYear, selMonth, selDay, selHour, clamped);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid
  const totalDays   = daysInMonth(viewYear, viewMonth);
  const startOffset = firstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (day: number) =>
    selYear === viewYear && selMonth === viewMonth && selDay === day;

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return d < today;
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const popupBg     = isDark ? '#0d1117' : '#ffffff';
  const popupBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
  const headerColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
  const dayFaint    = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
  const dayNormal   = isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.82)';
  const hoverBg     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const triggerBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const triggerBdr  = error
    ? '#ef4444'
    : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const inputNumStyle: React.CSSProperties = {
    width: 40,
    textAlign: 'center',
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: 8,
    color: headerColor,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 700,
    padding: '4px 0',
    outline: 'none',
    caretColor: '#22c55e',
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono text-left transition-all"
        style={{
          background: triggerBg,
          border: `1px solid ${triggerBdr}`,
          color: value ? headerColor : dayFaint,
          boxShadow: open ? `0 0 0 2px rgba(34,197,94,0.25)` : 'none',
        }}
      >
        <Calendar size={14} style={{ color: value ? '#22c55e' : dayFaint, flexShrink: 0 }} />
        <span className="flex-1">{value ? formatDisplay(value) : 'Pick a date & time…'}</span>
        {value && (
          <motion.span
            whileHover={{ scale: 1.2 }}
            onClick={e => { e.stopPropagation(); onChange(''); setSelDay(null); setSelYear(null); setSelMonth(null); }}
            style={{ color: dayFaint, cursor: 'pointer' }}
          >
            <X size={12} />
          </motion.span>
        )}
      </button>

      {/* ── Popup ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 z-50 mt-2 rounded-2xl overflow-hidden"
            style={{
              width: 308,
              background: popupBg,
              border: `1px solid ${popupBorder}`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            }}
          >
            {/* ── Month nav ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <motion.button
                type="button"
                onClick={prevMonth}
                whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: dayFaint, background: hoverBg }}
              >
                <ChevronLeft size={14} />
              </motion.button>

              <span className="text-sm font-bold" style={{ color: headerColor }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>

              <motion.button
                type="button"
                onClick={nextMonth}
                whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: dayFaint, background: hoverBg }}
              >
                <ChevronRight size={14} />
              </motion.button>
            </div>

            {/* ── Day-of-week header ────────────────────────────────── */}
            <div className="grid grid-cols-7 px-3 pb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-mono font-semibold py-1"
                  style={{ color: dayFaint }}>
                  {d}
                </div>
              ))}
            </div>

            {/* ── Calendar grid ─────────────────────────────────────── */}
            <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const selected  = isSelected(day);
                const todayCell = isToday(day);
                const past      = isPast(day);

                return (
                  <motion.button
                    key={day}
                    type="button"
                    disabled={past}
                    onClick={() => selectDay(day)}
                    whileHover={!past ? { scale: 1.15 } : {}}
                    whileTap={!past ? { scale: 0.9 } : {}}
                    className="h-8 w-full flex items-center justify-center rounded-lg text-xs font-mono font-semibold transition-colors"
                    style={{
                      background: selected
                        ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                        : todayCell
                          ? isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.1)'
                          : 'transparent',
                      color: selected
                        ? '#000'
                        : past
                          ? isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)'
                          : todayCell
                            ? '#22c55e'
                            : dayNormal,
                      border: todayCell && !selected
                        ? '1px solid rgba(34,197,94,0.35)'
                        : '1px solid transparent',
                      cursor: past ? 'default' : 'pointer',
                    }}
                  >
                    {day}
                  </motion.button>
                );
              })}
            </div>

            {/* ── Time picker ───────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 px-4 py-3 mx-3 mb-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <Clock size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: dayFaint }}>Time</span>

              <div className="flex items-center gap-1.5 ml-auto">
                {/* Hour */}
                <div className="flex flex-col items-center gap-0.5">
                  <motion.button type="button" whileTap={{ scale: 0.85 }}
                    onClick={() => handleHourChange(selHour + 1)}
                    style={{ color: dayFaint, lineHeight: 1 }}>
                    <ChevronRight size={11} style={{ transform: 'rotate(-90deg)' }} />
                  </motion.button>
                  <input
                    type="number" min={0} max={23}
                    value={pad(selHour)}
                    onChange={e => handleHourChange(parseInt(e.target.value) || 0)}
                    style={inputNumStyle}
                  />
                  <motion.button type="button" whileTap={{ scale: 0.85 }}
                    onClick={() => handleHourChange(selHour - 1)}
                    style={{ color: dayFaint, lineHeight: 1 }}>
                    <ChevronRight size={11} style={{ transform: 'rotate(90deg)' }} />
                  </motion.button>
                </div>

                <span className="text-base font-bold font-mono" style={{ color: headerColor, marginBottom: 2 }}>:</span>

                {/* Minute */}
                <div className="flex flex-col items-center gap-0.5">
                  <motion.button type="button" whileTap={{ scale: 0.85 }}
                    onClick={() => handleMinChange(selMin + 1)}
                    style={{ color: dayFaint, lineHeight: 1 }}>
                    <ChevronRight size={11} style={{ transform: 'rotate(-90deg)' }} />
                  </motion.button>
                  <input
                    type="number" min={0} max={59}
                    value={pad(selMin)}
                    onChange={e => handleMinChange(parseInt(e.target.value) || 0)}
                    style={inputNumStyle}
                  />
                  <motion.button type="button" whileTap={{ scale: 0.85 }}
                    onClick={() => handleMinChange(selMin - 1)}
                    style={{ color: dayFaint, lineHeight: 1 }}>
                    <ChevronRight size={11} style={{ transform: 'rotate(90deg)' }} />
                  </motion.button>
                </div>

                {/* AM/PM display (read-only, just informational) */}
                <span className="text-[11px] font-mono ml-1" style={{ color: dayFaint }}>
                  {selHour < 12 ? 'AM' : 'PM'}
                </span>
              </div>
            </div>

            {/* ── Confirm button ────────────────────────────────────── */}
            <div className="px-3 pb-3">
              <motion.button
                type="button"
                disabled={selDay === null}
                onClick={() => setOpen(false)}
                whileHover={selDay !== null ? { scale: 1.02 } : {}}
                whileTap={selDay !== null ? { scale: 0.97 } : {}}
                className="w-full py-2 rounded-xl text-xs font-bold font-mono transition-all"
                style={{
                  background: selDay !== null
                    ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                    : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: selDay !== null ? '#000' : dayFaint,
                  cursor: selDay === null ? 'default' : 'pointer',
                }}
              >
                {selDay !== null
                  ? `Confirm — ${MONTHS[selMonth!].slice(0,3)} ${selDay}, ${pad(selHour)}:${pad(selMin)}`
                  : 'Select a day first'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateTimePicker;
