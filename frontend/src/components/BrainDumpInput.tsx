/**
 * BrainDumpInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable input bar extracted from EntryPoint. Used on landing page and
 * dashboard task-entry bar. Includes real Web Speech API voice input,
 * and Chaos Scanner (image drop zone) in expanded mode.
 */
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mic, MicOff, Zap, Calendar, Camera } from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';
import ChaosScanner from './ChaosScanner';
import { Task } from '../types';

interface BrainDumpInputProps {
  onSubmit: (text: string) => void;
  onTasksExtracted?: (tasks: Task[]) => void;
  placeholder?: string;
  loading?: boolean;
  compact?: boolean;        // true = dashboard bar variant (smaller py)
  isDark?: boolean;
  showCalendar?: boolean;
  defaultValue?: string;
}

// ── Web Speech API type declarations ─────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | undefined;
    webkitSpeechRecognition: typeof SpeechRecognition | undefined;
  }
}

export interface BrainDumpInputHandle {
  focus: () => void;
}

const BrainDumpInput = forwardRef<BrainDumpInputHandle, BrainDumpInputProps>(({
  onSubmit,
  onTasksExtracted,
  placeholder = 'Paste your tasks or describe your workload...',
  loading = false,
  compact = false,
  isDark = true,
  showCalendar = false,
  defaultValue = '',
}, ref) => {
  const [value, setValue] = useState(defaultValue);
  const [inputFocused, setInputFocused] = useState(false);
  const [calendarSync, setCalendarSync] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Expose focus() to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // Check for Web Speech API support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // ── Voice input ────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setValue(prev => {
        const base = prev.trim();
        return base ? `${base} ${transcript}` : transcript;
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggleVoice = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
    setValue('');
  };

  // ── Compact camera (file picker for image scan) ────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onTasksExtracted) return;
    // We'll use a temporary ChaosScanner-like flow
    // Import scanImageForTasks dynamically to avoid circular imports
    const { scanImageForTasks } = await import('../api');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = (ev.target?.result as string).replace(/^data:[^;]+;base64,/, '');
        const tasks = await scanImageForTasks(base64, file.type || 'image/jpeg');
        onTasksExtracted(tasks);
        setValue('');
      } catch {
        // silently fail in compact mode
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  const py = compact ? 'py-3' : 'py-5';

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative w-full">
        <motion.div
          animate={inputFocused || listening
            ? { boxShadow: `0 0 0 1.5px rgba(34,197,94,${listening ? '0.8' : '0.5'}), 0 0 40px rgba(34,197,94,${listening ? '0.15' : '0.1'})` }
            : { boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
          transition={{ duration: 0.25 }}
          className="flex items-center rounded-2xl overflow-hidden"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.1)',
          }}
        >
          {/* Leading icon */}
          <div className="pl-5 pr-3 shrink-0">
            {listening ? (
              <WaveformAnimation />
            ) : (
              <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }}
                transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}>
                <Zap size={16} style={{ color: value ? '#22c55e' : 'var(--text-faint)' }} />
              </motion.div>
            )}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={listening ? 'Listening...' : placeholder}
            className={`flex-1 bg-transparent text-sm font-mono ${py} px-2 outline-none`}
            style={{ color: 'var(--text-primary)', caretColor: '#22c55e' }}
            disabled={loading}
          />

          {/* Right buttons */}
          <div className="pr-3 flex items-center gap-2">
            {/* Mic button */}
            {speechSupported && (
              <div className="relative">
                <motion.button
                  type="button"
                  onClick={toggleVoice}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: listening ? 'rgba(34,197,94,0.15)' : 'transparent',
                    color: listening ? '#22c55e' : 'var(--text-faint)',
                  }}
                  title={listening ? 'Stop listening' : 'Voice input — speak your tasks'}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </motion.button>
              </div>
            )}

            {/* Camera button — compact mode: file picker, expanded mode: not shown here (ChaosScanner below) */}
            {compact && onTasksExtracted && (
              <div className="relative">
                <motion.button
                  type="button"
                  data-tour="tour-camera"
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1 p-2 rounded-lg transition-all"
                  style={{
                    background: 'rgba(34,197,94,0.06)',
                    border: '1px solid rgba(34,197,94,0.18)',
                    color: 'rgba(34,197,94,0.7)',
                  }}
                  title="Scan image for tasks (Chaos Scanner)"
                >
                  <Camera size={14} />
                  <span className="hidden sm:inline text-[10px] font-mono font-semibold" style={{ color: 'rgba(34,197,94,0.8)' }}>Scan</span>
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Calendar sync button (optional) */}
            {showCalendar && (
              <motion.button
                type="button"
                onClick={() => setCalendarSync(!calendarSync)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg transition-all"
                style={{
                  background: calendarSync ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color: calendarSync ? '#22c55e' : 'var(--text-faint)',
                }}
                title="Sync Calendar"
              >
                <Calendar size={14} />
              </motion.button>
            )}

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={!value.trim() || loading}
              whileHover={value.trim() && !loading ? { scale: 1.05, x: 2 } : {}}
              whileTap={value.trim() && !loading ? { scale: 0.94 } : {}}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: value.trim() && !loading
                  ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                color: value.trim() && !loading ? '#000' : 'var(--text-faint)',
                boxShadow: value.trim() && !loading ? '0 0 0 1px rgba(34,197,94,0.3), 0 0 20px rgba(34,197,94,0.3)' : 'none',
                border: value.trim() && !loading ? '1px solid rgba(34,197,94,0.5)' : '1px solid transparent',
              }}
            >
              {loading ? (
                <motion.span className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <motion.div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent"
                    animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                  Analyzing
                </motion.span>
              ) : (
                <span className="flex items-center gap-1.5"><ArrowRight size={14} />Analyze</span>
              )}
            </motion.button>
          </div>
        </motion.div>
      </form>

      {/* ChaosScanner — only in expanded (landing page) mode */}
      <AnimatePresence>
        {!compact && onTasksExtracted && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mt-3"
          >
            <ChaosScanner onTasksExtracted={onTasksExtracted} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

BrainDumpInput.displayName = 'BrainDumpInput';

export default BrainDumpInput;
