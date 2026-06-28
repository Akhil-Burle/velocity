/**
 * NegotiateMockup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated mockup for the Negotiate feature section. Shows a drafted email
 * extension request sliding up into view when triggered.
 *
 * Props:
 *   triggered     – set to true by FeatureSection when it enters the viewport
 *   reducedMotion – when true, renders the email card in its final position
 *                   immediately, with no animation
 *
 * Requirements: 4.9, 4.10
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Send } from 'lucide-react';

interface NegotiateMockupProps {
  triggered: boolean;
  reducedMotion: boolean;
}

const NegotiateMockup: React.FC<NegotiateMockupProps> = ({ triggered, reducedMotion }) => {
  const shouldAnimate = triggered && !reducedMotion;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <Mail size={13} color="#22c55e" />
        <span
          className="text-xs font-semibold font-mono tracking-wide"
          style={{ color: '#22c55e' }}
        >
          extension request drafted
        </span>
      </div>

      {/* Email card — slides up on trigger */}
      <div className="px-4 py-4">
        <motion.div
          initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
          animate={
            reducedMotion
              ? { opacity: 1, y: 0 }
              : shouldAnimate
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 32 }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1],
                }
          }
          className="rounded-lg overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Email metadata rows */}
          <div
            className="px-4 pt-4 pb-3 flex flex-col gap-2"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {/* To */}
            <div className="flex items-baseline gap-2">
              <span
                className="text-[10px] font-mono uppercase tracking-wider w-14 shrink-0"
                style={{ color: 'var(--text-faint)' }}
              >
                To
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                prof.chen@university.edu
              </span>
            </div>

            {/* Subject */}
            <div className="flex items-baseline gap-2">
              <span
                className="text-[10px] font-mono uppercase tracking-wider w-14 shrink-0"
                style={{ color: 'var(--text-faint)' }}
              >
                Subject
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                Request: Extension for React Lab Assignment
              </span>
            </div>
          </div>

          {/* Email body */}
          <div className="px-4 py-3">
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Dear Professor Chen, I'm writing to respectfully request a 48-hour
              extension on the React Lab assignment. I've encountered a scheduling
              conflict with two overlapping deadlines this week and want to ensure
              I can submit work that meets the expected standard. I appreciate your
              understanding and am happy to discuss further if needed.
            </p>
          </div>

          {/* Send button */}
          <div
            className="px-4 pb-4"
          >
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Send email"
            >
              <Send size={12} aria-hidden="true" />
              Send
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NegotiateMockup;
