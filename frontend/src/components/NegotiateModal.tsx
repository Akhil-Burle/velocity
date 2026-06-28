/**
 * NegotiateModal.tsx — Phase 2 upgrade
 * ─────────────────────────────────────────────────────────────────────────────
 * "Draft ready → sending automatically in 0:09 unless you cancel or edit."
 *
 * Interaction pattern: confirm-by-exception.
 *   Phase 1 (DRAFTING)  — AI is generating the draft, show skeleton
 *   Phase 2 (COUNTDOWN) — Draft shown, countdown timer, [Cancel] [Edit]
 *   Phase 3 (EDITING)   — User clicked Edit; full editable textarea, [Send] [Cancel]
 *   Phase 4 (SENT)      — Confirmation with green check, auto-dismiss in 2.5s
 *   Phase 5 (CANCELLED) — Soft cancel state, offer to re-queue
 *
 * This makes the AI feel genuinely agentic: it queued and executed,
 * not just generated a draft for the human to click.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Mail, CheckCircle2, Pencil, Bot, Clock, AlertTriangle } from 'lucide-react';

type Phase = 'countdown' | 'editing' | 'sent' | 'cancelled';

interface NegotiateModalProps {
  taskName: string;
  recipientName: string;
  draft: string;
  isDark?: boolean;
  onClose: () => void;
  onSend: () => void;
  countdownSeconds?: number;
}

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Typing cursor blink ───────────────────────────────────────────────────────
const Cursor: React.FC = () => (
  <motion.span
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.9, repeat: Infinity }}
    className="inline-block w-[2px] h-[13px] ml-0.5 rounded-full align-middle"
    style={{ background: '#f59e0b', verticalAlign: 'middle' }}
  />
);

const NegotiateModal: React.FC<NegotiateModalProps> = ({
  taskName, recipientName, draft, isDark = true, onClose, onSend, countdownSeconds = 10,
}) => {
  const [phase, setPhase]       = useState<Phase>('countdown');
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [editedDraft, setEditedDraft] = useState(draft);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subject = `Extension Request — ${taskName}`;
  const modalBg  = isDark ? 'linear-gradient(150deg,#141b23 0%,#0f1419 100%)' : 'linear-gradient(150deg,#ffffff 0%,#fffbf0 100%)';
  const divider  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const metaBg   = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)';
  const progressPct = ((countdownSeconds - remaining) / countdownSeconds) * 100;

  // Start countdown only in 'countdown' phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(timerRef.current!);
          // Auto-execute: act without being asked
          setPhase('sent');
          onSend();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, onSend]);

  // Auto-dismiss after sent
  useEffect(() => {
    if (phase === 'sent') {
      const t = setTimeout(() => onClose(), 2800);
      return () => clearTimeout(t);
    }
  }, [phase, onClose]);

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('cancelled');
  };

  const handleEdit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('editing');
  };

  const handleSendNow = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('sent');
    onSend();
  };

  const handleRequeue = () => {
    setRemaining(countdownSeconds);
    setPhase('countdown');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.38)', backdropFilter: 'blur(10px)' }}
      onClick={phase === 'countdown' ? handleCancel : onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden relative"
        style={{
          background: modalBg,
          border: '1px solid rgba(245,158,11,0.25)',
          boxShadow: '0 0 60px rgba(245,158,11,0.08), 0 25px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar — countdown-draining */}
        {phase === 'countdown' && (
          <div className="h-[3px] w-full relative overflow-hidden" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', width: `${100 - progressPct}%`, transformOrigin: 'left' }}
              animate={{ width: `${100 - progressPct}%` }}
              transition={{ duration: 0.9, ease: 'linear' }}
            />
          </div>
        )}
        {phase !== 'countdown' && (
          <div className="h-[2px]"
            style={{ background: phase === 'sent' ? 'linear-gradient(90deg,transparent,#22c55e 40%,#22c55e 60%,transparent)' : 'linear-gradient(90deg,transparent,#f59e0b 40%,#f59e0b 60%,transparent)' }} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: phase === 'sent' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                border: `1px solid ${phase === 'sent' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
              }}>
              {phase === 'sent'
                ? <CheckCircle2 size={14} className="text-green-400" />
                : <Mail size={14} className="text-amber-400" />
              }
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {phase === 'sent' ? 'Email sent autonomously' :
                 phase === 'cancelled' ? 'Send cancelled' :
                 phase === 'editing' ? 'Edit draft' :
                 'Sending in ' + fmt(remaining)}
              </div>
              <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                {phase === 'countdown' && (
                  <>
                    <Bot size={10} style={{ color: '#f59e0b' }} />
                    <span>AI acting automatically unless you cancel</span>
                  </>
                )}
                {phase === 'editing' && <span>Editing draft for {recipientName}</span>}
                {phase === 'sent' && <span>Delivered to {recipientName} · logged in Agent Log</span>}
                {phase === 'cancelled' && <span>Draft preserved — you can re-queue anytime</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'countdown' && (
              <motion.span
                key={remaining}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-[11px] font-mono font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <Clock size={9} className="inline mr-1" />
                {fmt(remaining)}
              </motion.span>
            )}
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full text-amber-400"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)' }}>
              TRIAGE
            </span>
            <button onClick={onClose} className="transition-colors ml-1" style={{ color: 'var(--text-faint)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Sent confirmation */}
        <AnimatePresence mode="wait">
          {phase === 'sent' && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-6 py-10 flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)' }}
              >
                <CheckCircle2 size={26} className="text-green-400" />
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Extension request sent to {recipientName}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
                  AI acted autonomously · action logged · dismissing...
                </p>
              </div>
            </motion.div>
          )}

          {/* Cancelled state */}
          {phase === 'cancelled' && (
            <motion.div
              key="cancelled"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 py-6 flex flex-col items-center gap-4"
            >
              <AlertTriangle size={28} style={{ color: '#f59e0b', opacity: 0.6 }} />
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Send cancelled</p>
                <p className="text-xs font-mono max-w-xs" style={{ color: 'var(--text-faint)' }}>
                  Draft preserved. You can edit it and re-queue below.
                </p>
              </div>
              <div className="flex gap-2">
                <motion.button
                  onClick={handleRequeue}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
                >
                  <Send size={11} /> Re-queue send
                </motion.button>
                <motion.button
                  onClick={handleEdit}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: `1px solid ${divider}` }}
                >
                  <Pencil size={11} /> Edit first
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Countdown + Editing phases */}
          {(phase === 'countdown' || phase === 'editing') && (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Email meta */}
              <div className="px-5 py-3 space-y-1 text-xs font-mono" style={{ background: metaBg, borderBottom: `1px solid ${divider}` }}>
                <div className="flex gap-3">
                  <span className="w-14 shrink-0" style={{ color: 'var(--text-faint)' }}>To:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{recipientName}</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-14 shrink-0" style={{ color: 'var(--text-faint)' }}>Subject:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{subject}</span>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 max-h-52 overflow-y-auto">
                {phase === 'editing' ? (
                  <textarea
                    value={editedDraft}
                    onChange={e => setEditedDraft(e.target.value)}
                    className="w-full text-xs font-mono leading-relaxed resize-none outline-none rounded-lg p-3"
                    rows={8}
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${divider}`,
                      color: 'var(--text-secondary)',
                    }}
                    autoFocus
                  />
                ) : (
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>
                    {editedDraft}{phase === 'countdown' && remaining <= 3 && <Cursor />}
                  </pre>
                )}
              </div>

              {/* Autonomous badge */}
              {phase === 'countdown' && (
                <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                  style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <Bot size={11} style={{ color: '#f59e0b' }} />
                  <span style={{ color: 'var(--text-faint)' }}>
                    <span style={{ color: '#fbbf24' }}>Velocity is acting autonomously</span> — email will send in {fmt(remaining)} unless cancelled.
                    No productivity data is exposed.
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderTop: `1px solid ${divider}` }}>
                {phase === 'countdown' ? (
                  <>
                    <motion.button
                      onClick={handleSendNow}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-black"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                    >
                      <Send size={13} /> Send Now
                    </motion.button>
                    <motion.button
                      onClick={handleEdit}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-colors"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${divider}`, color: 'var(--text-muted)' }}
                    >
                      <Pencil size={13} /> Edit
                    </motion.button>
                    <motion.button
                      onClick={handleCancel}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="px-4 py-2.5 rounded-xl text-sm transition-colors"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                    >
                      Cancel
                    </motion.button>
                  </>
                ) : (
                  <>
                    <motion.button
                      onClick={handleSendNow}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-black"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                    >
                      <Send size={13} /> Send
                    </motion.button>
                    <motion.button
                      onClick={handleCancel}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="px-5 py-2.5 rounded-xl text-sm transition-colors"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${divider}`, color: 'var(--text-muted)' }}
                    >
                      Discard
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default NegotiateModal;
