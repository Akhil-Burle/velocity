/**
 * OmniBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature Block 2: Global floating command palette (Ctrl+K / ⌘K).
 *
 * Phase 1: Structured-output intent classifier → 8 canonical intents
 * Phase 2: Execution, not display
 *   - HIGH confidence   → CountdownToast (10s) → auto-executes via omni-execute
 *   - MEDIUM confidence → CountdownToast (14s) with clearer framing
 *   - LOW / unclear     → context-aware action buttons (not always Triage/Panic)
 *   - query intent      → text answer only, no action
 * Phase 3: Voice-out — uses real Google Cloud TTS (with browser fallback)
 * Phase 4: Visual consistency — countdown uses existing CountdownToast component
 *
 * Every executed action:
 *   a. Writes to Activity Log via /api/agent/omni-execute (origin: 'omnibar')
 *   b. Respects Adaptive Policy Memory (backend checks before classifying high-conf)
 *   c. Cascades via existing chain logic if needed (rebalance→negotiate)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, X, Zap, AlertTriangle, Bot, CheckCircle2 } from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';
import CountdownToast from './CountdownToast';
import { Task } from '../types';
import { classifyOmniIntent, executeOmniIntent, recordPolicyCancel, OmniClassifyResult } from '../api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001/api';

// ── Web Speech API type guard ──────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | undefined;
    webkitSpeechRecognition: typeof SpeechRecognition | undefined;
  }
}

interface OmniBarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after an action executes so the parent can refresh its state */
  onActionComplete: (intent: string, taskId: string | null, result: Record<string, unknown>) => void;
  isDark?: boolean;
  tasks: Task[];
}

// Detect OS for keyboard shortcut display
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const KBD_LABEL = IS_MAC ? '⌘K' : 'Ctrl+K';

const QUICK_CHIPS = [
  "I'm behind on everything",
  'I need to email my professor',
  'What should I work on right now',
  "I have no time today, everything's colliding",
  'Triage my work now',
];

// ── Intent display config ─────────────────────────────────────────────────────
const INTENT_CONFIG: Record<string, {
  color: CountdownColor;
  label: string;
  icon: string;
  duration: number; // countdown seconds
}> = {
  create_task:   { color: 'green',  label: 'Creating task',      icon: '✏️', duration: 10 },
  run_triage:    { color: 'amber',  label: 'Running Triage',     icon: '⚡', duration: 10 },
  panic_mode:    { color: 'red',    label: 'Activating Panic Mode', icon: '🚨', duration: 10 },
  smart_routing: { color: 'blue',   label: 'Routing to top task', icon: '🎯', duration: 8  },
  negotiate:     { color: 'amber',  label: 'Drafting extension',  icon: '📧', duration: 12 },
  rebalance:     { color: 'green',  label: 'Rebalancing schedule', icon: '📅', duration: 10 },
  query:         { color: 'blue',   label: 'Answering',           icon: '💬', duration: 0  },
  unclear:       { color: 'amber',  label: 'Needs clarification', icon: '❓', duration: 0  },
};

// Context-aware fallback buttons for low-confidence / unclear results
const CONTEXT_BUTTONS: Record<string, Array<{ label: string; action: string }>> = {
  create_task:   [{ label: 'Create Task', action: 'create_task' }, { label: 'Run Triage', action: 'run_triage' }],
  run_triage:    [{ label: 'Run Triage', action: 'run_triage' }, { label: 'Rebalance Day', action: 'rebalance' }],
  panic_mode:    [{ label: 'Panic Mode', action: 'panic_mode' }, { label: 'Run Triage', action: 'run_triage' }],
  smart_routing: [{ label: 'Show Top Task', action: 'smart_routing' }, { label: 'Run Triage', action: 'run_triage' }],
  negotiate:     [{ label: 'Draft Extension', action: 'negotiate' }, { label: 'Run Triage', action: 'run_triage' }],
  rebalance:     [{ label: 'Rebalance Day', action: 'rebalance' }, { label: 'Run Triage', action: 'run_triage' }],
  query:         [{ label: 'Run Triage', action: 'run_triage' }, { label: 'Panic Mode', action: 'panic_mode' }],
  unclear:       [{ label: 'Run Triage', action: 'run_triage' }, { label: 'Panic Mode', action: 'panic_mode' }],
};

type CountdownColor = 'amber' | 'green' | 'red' | 'blue';

type OmniPhase =
  | 'idle'
  | 'typing'
  | 'parsing'
  | 'countdown_high'
  | 'countdown_medium'
  | 'buttons'
  | 'query_answer'
  | 'executing'
  | 'done'
  | 'error';

const OmniBar: React.FC<OmniBarProps> = ({ isOpen, onClose, onActionComplete, isDark = true, tasks }) => {
  const [value, setValue]         = useState('');
  const [listening, setListening] = useState(false);
  const [phase, setPhase]         = useState<OmniPhase>('idle');
  const [classified, setClassified] = useState<OmniClassifyResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [speaking, setSpeaking]   = useState(false);

  const inputRef      = useRef<HTMLInputElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  // Keep a ref to latest classified for use inside callbacks
  const classifiedRef = useRef<OmniClassifyResult | null>(null);
  const valueRef      = useRef('');

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
    fetch(`${BASE_URL}/agent/tts/status`)
      .then(r => r.json())
      .then(d => setTtsAvailable(d.configured))
      .catch(() => {});
  }, []);

  // Keep refs in sync
  useEffect(() => { classifiedRef.current = classified; }, [classified]);
  useEffect(() => { valueRef.current = value; }, [value]);

  // ── Voice output (Google Cloud TTS → browser fallback) ─────────────────────
  const speak = useCallback(async (text: string) => {
    if (!ttsEnabled) return;
    setSpeaking(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.play().catch(() => setSpeaking(false));
        return;
      }
    } catch { /* fall through */ }
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setSpeaking(false);
    }
  }, [ttsEnabled]);

  // Auto-focus + reset on open
  useEffect(() => {
    if (isOpen) {
      setValue('');
      setClassified(null);
      setError(null);
      setDoneMessage(null);
      setPhase('idle');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Core: classify intent then decide phase ─────────────────────────────────
  const runClassify = useCallback(async (text: string) => {
    if (!text.trim()) { setPhase('idle'); setClassified(null); return; }
    setPhase('parsing');
    setError(null);
    try {
      const result = await classifyOmniIntent(text.trim());
      setClassified(result);

      // Speak the explanation text (Phase 3)
      if (result.explanation) speak(result.explanation);

      // Decide which phase to enter based on intent + confidence
      if (result.intent === 'query') {
        setPhase('query_answer');
        return;
      }
      if (result.intent === 'unclear' || result.confidence === 'low') {
        setPhase('buttons');
        return;
      }
      if (result.confidence === 'high') {
        setPhase('countdown_high');
        return;
      }
      // medium confidence
      setPhase('countdown_medium');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Classification failed');
      setPhase('error');
    }
  }, [speak]);

  const handleInput = (text: string) => {
    setValue(text);
    setPhase(text.trim() ? 'typing' : 'idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runClassify(text), 700);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runClassify(value);
    }
  };

  // ── Execute the action (called when countdown reaches 0) ───────────────────
  const executeAction = useCallback(async (c: OmniClassifyResult | null, text: string) => {
    if (!c) return;
    setPhase('executing');
    try {
      const execResult = await executeOmniIntent(c.intent, text, c.taskId, c.params, c.confidence);
      setDoneMessage(c.explanation);
      setPhase('done');
      // Notify parent to refresh tasks/log
      onActionComplete(c.intent, c.taskId, execResult.result || {});
      // Close after showing done state
      setTimeout(() => { onClose(); }, 2200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution failed');
      setPhase('error');
    }
  }, [onActionComplete, onClose]);

  // ── Cancel countdown → record policy cancel ────────────────────────────────
  const handleCountdownCancel = useCallback(async () => {
    const c = classifiedRef.current;
    if (c) {
      // Write a policy-cancel event so policy memory can learn from this
      const featureMap: Record<string, string> = {
        run_triage: 'triage', panic_mode: 'panic',
        negotiate: 'negotiate', rebalance: 'rebalance',
      };
      const fk = featureMap[c.intent];
      if (fk) {
        // We use a synthetic log entry id since we cancelled before executing
        recordPolicyCancel(`omnibar-cancelled-${Date.now()}`, fk, c.params as Record<string, unknown>).catch(() => {});
      }
    }
    setPhase('buttons'); // fall back to button mode instead of closing
  }, []);

  // ── Button click (low confidence / user chose manually) ────────────────────
  const handleButtonClick = useCallback((intentOverride: string) => {
    const c = classifiedRef.current || {
      intent: intentOverride as OmniClassifyResult['intent'],
      confidence: 'medium' as const,
      params: {},
      explanation: 'Acting on your selection.',
      taskId: null,
    };
    const merged = { ...c, intent: intentOverride as OmniClassifyResult['intent'], confidence: 'medium' as const };
    setClassified(merged);
    setPhase('countdown_medium');
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
    recognition.onend   = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setValue(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        runClassify(transcript);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [runClassify]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // ── Derived display values ──────────────────────────────────────────────────
  const paletteBg    = isDark ? 'rgba(13,17,23,0.98)' : 'rgba(248,250,252,0.98)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const matchedTask  = classified?.taskId ? tasks.find(t => t.id === classified.taskId) : null;
  const intentCfg    = classified ? INTENT_CONFIG[classified.intent] || INTENT_CONFIG.unclear : INTENT_CONFIG.unclear;
  const contextBtns  = classified ? (CONTEXT_BUTTONS[classified.intent] || CONTEXT_BUTTONS.unclear) : CONTEXT_BUTTONS.unclear;

  // Countdown message text
  function countdownMessage(): string {
    if (!classified) return 'Acting...';
    const isHigh = classified.confidence === 'high';
    return isHigh ? classified.explanation : `I think: ${classified.explanation}`;
  }

  function countdownSubtext(): string {
    if (matchedTask) return matchedTask.taskName;
    if (classified?.params?.taskName) return String(classified.params.taskName);
    return '';
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[13vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(20px)' }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden"
            style={{
              background: paletteBg,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 0 1px rgba(34,197,94,0.15), 0 40px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Top accent line */}
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #22c55e 30%, #38bdf8 70%, transparent)' }} />

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${dividerColor}` }}>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                {KBD_LABEL}
              </span>
              <span className="text-xs font-mono flex-1" style={{ color: 'var(--text-faint)' }}>
                Omni-Bar · Describe your problem
              </span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>ESC to close</span>
              {speechSupported && (
                <motion.button
                  onClick={listening ? stopListening : startListening}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: listening ? 'rgba(34,197,94,0.15)' : 'transparent', color: listening ? '#22c55e' : 'var(--text-faint)' }}
                >
                  {listening ? <MicOff size={13} /> : <Mic size={13} />}
                </motion.button>
              )}
              {(ttsAvailable || 'speechSynthesis' in window) && (
                <motion.button
                  onClick={() => {
                    setTtsEnabled(e => !e);
                    if (speaking) { audioRef.current?.pause(); window.speechSynthesis?.cancel(); setSpeaking(false); }
                  }}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  title={ttsEnabled ? 'Voice responses: ON' : 'Voice responses: OFF'}
                  style={{ background: ttsEnabled ? 'rgba(56,189,248,0.15)' : 'transparent', color: ttsEnabled ? '#38bdf8' : 'var(--text-faint)' }}
                >
                  {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </motion.button>
              )}
              <motion.button onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ color: 'var(--text-faint)' }}>
                <X size={14} />
              </motion.button>
            </div>

            {/* Input area */}
            <div className="flex items-center px-4 py-3 gap-3" style={{ borderBottom: `1px solid ${dividerColor}` }}>
              {listening ? (
                <WaveformAnimation />
              ) : (
                <Zap size={14} style={{ color: value ? '#22c55e' : 'var(--text-faint)', flexShrink: 0 }} />
              )}
              <input
                ref={inputRef}
                value={value}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="I'm never finishing the physics paper..."
                className="flex-1 bg-transparent text-sm font-mono outline-none"
                style={{ color: 'var(--text-primary)', caretColor: '#22c55e' }}
              />
            </div>

            {/* Response area — height animated by content */}
            <div className="min-h-[80px]">
              <AnimatePresence mode="wait">

                {/* IDLE: quick chips */}
                {(phase === 'idle') && (
                  <motion.div key="chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="px-4 py-3 flex flex-wrap gap-2">
                    {QUICK_CHIPS.map(chip => (
                      <motion.button key={chip}
                        onClick={() => { setValue(chip); runClassify(chip); }}
                        whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                        className="text-[11px] font-mono px-2.5 py-1 rounded-full"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
                          color: 'var(--text-faint)',
                        }}>
                        {chip}
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {/* PARSING */}
                {phase === 'parsing' && (
                  <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-5">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }}
                        animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                    <span className="text-xs font-mono ml-1" style={{ color: 'var(--text-faint)' }}>Classifying intent...</span>
                  </motion.div>
                )}

                {/* EXECUTING */}
                {phase === 'executing' && (
                  <motion.div key="executing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-4 py-4">
                    <motion.div className="w-4 h-4 rounded-full border-2 border-green-400 border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                    <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Executing — writing to activity log...</span>
                  </motion.div>
                )}

                {/* DONE */}
                {phase === 'done' && (
                  <motion.div key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-4 py-4">
                    <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>Done — logged to Activity Log</p>
                      {doneMessage && <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>{doneMessage}</p>}
                    </div>
                  </motion.div>
                )}

                {/* ERROR */}
                {phase === 'error' && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-4">
                    <AlertTriangle size={13} style={{ color: '#f87171' }} />
                    <span className="text-xs font-mono" style={{ color: '#f87171' }}>{error}</span>
                  </motion.div>
                )}

                {/* QUERY ANSWER — just text, no action */}
                {phase === 'query_answer' && classified && (
                  <motion.div key="query" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot size={11} style={{ color: '#38bdf8' }} />
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: '#38bdf8' }}>Answer</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {classified.explanation}
                    </p>
                  </motion.div>
                )}

                {/* COUNTDOWN HIGH — autonomous action imminent */}
                {phase === 'countdown_high' && classified && (
                  <motion.div key="countdown_high" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="px-4 py-3">
                    {/* Policy downgrade notice */}
                    {classified._policyDowngraded && (
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded-lg"
                        style={{ background: 'rgba(236,72,153,0.08)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.2)' }}>
                        🧠 Policy memory: downgraded from auto-act → confirm
                      </div>
                    )}
                    <CountdownToast
                      message={countdownMessage()}
                      subtext={countdownSubtext() || undefined}
                      duration={intentCfg.duration || 10}
                      color={intentCfg.color}
                      onExecute={() => executeAction(classified, value)}
                      onCancel={handleCountdownCancel}
                      isDark={isDark}
                    />
                  </motion.div>
                )}

                {/* COUNTDOWN MEDIUM — slightly longer, clearer framing */}
                {phase === 'countdown_medium' && classified && (
                  <motion.div key="countdown_medium" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot size={11} style={{ color: 'var(--text-faint)' }} />
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                        Medium confidence — will act unless you cancel
                      </span>
                    </div>
                    {matchedTask && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full mb-1"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <span className="w-1 h-1 rounded-full bg-amber-400" />
                        {matchedTask.taskName}
                      </span>
                    )}
                    <CountdownToast
                      message={countdownMessage()}
                      subtext={countdownSubtext() || undefined}
                      duration={(intentCfg.duration || 10) + 4}
                      color={intentCfg.color}
                      onExecute={() => executeAction(classified, value)}
                      onCancel={handleCountdownCancel}
                      isDark={isDark}
                    />
                  </motion.div>
                )}

                {/* BUTTONS — low confidence or post-cancel fallback */}
                {phase === 'buttons' && classified && (
                  <motion.div key="buttons" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="px-4 py-3 space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {classified.explanation}
                    </p>
                    {matchedTask && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <span className="w-1 h-1 rounded-full bg-amber-400" />
                        {matchedTask.taskName}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {contextBtns.map(btn => {
                        const cfg = INTENT_CONFIG[btn.action] || INTENT_CONFIG.unclear;
                        const colorMap: Record<string, React.CSSProperties> = {
                          red:   { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
                          amber: { background: 'rgba(245,158,11,0.1)',  color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' },
                          green: { background: 'rgba(34,197,94,0.1)',   color: '#4ade80', border: '1px solid rgba(34,197,94,0.28)' },
                          blue:  { background: 'rgba(56,189,248,0.1)',  color: '#38bdf8', border: '1px solid rgba(56,189,248,0.28)' },
                        };
                        return (
                          <motion.button key={btn.action}
                            onClick={() => handleButtonClick(btn.action)}
                            whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg font-mono"
                            style={colorMap[cfg.color] || colorMap.amber}>
                            {btn.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Bottom padding */}
            <div className="h-2" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OmniBar;
