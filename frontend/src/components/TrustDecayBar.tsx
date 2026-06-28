/**
 * TrustDecayBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 — Trust Decay visual layer.
 *
 * Shows a progress bar that slowly drains from the last self-reported value
 * toward the "expected given pace" value as time passes without a check-in.
 *
 * Uses the SAME "expected progress given elapsed time and required pace"
 * calculation built in Phase 1 (computePaceMetrics().expected from paceEngine).
 * No math is duplicated.
 *
 * States:
 *   • Fresh (< 24h since check-in): shows normal self-reported bar, no drain
 *   • Stale (24h+ since check-in): starts draining, shows "Last reported N days ago"
 *   • Very stale (48h+): drains further, label more prominent
 *   • No check-ins: shows raw self-reported with stale indicator
 *
 * A fresh check-in resets the bar immediately.
 *
 * Design: reads from the same color tokens as Phase 1 DriftBadge for visual family.
 */
import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RefreshCw } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

interface TrustDecayBarProps {
  selfReported: number;        // 0–100 — what user last reported (task.completionPercent)
  expectedProgress: number;    // 0–100 — paceEngine.expected (where they should be)
  lastCheckInAt: string | null; // ISO timestamp of last sparkline entry
  trustDecay: number;          // 0–40 — from forecastController.computeTrustDecay
  status: string;              // GREEN | AMBER | RED
  isDark?: boolean;
  onCheckInClick?: () => void; // optional — opens the check-in slider
}

const DECAY_WINDOW_MS = 48 * 3600000; // 48h to drain fully to expected

const STATUS_COLOR: Record<string, string> = {
  GREEN:  '#22c55e',
  AMBER:  '#f59e0b',
  RED:    '#ef4444',
  COMPLETE: '#52525b',
};

function formatStaleness(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffH  = Math.round(diffMs / 3600000);
  const diffD  = Math.round(diffMs / 86400000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  return `${diffD}d ago`;
}

const TrustDecayBar: React.FC<TrustDecayBarProps> = ({
  selfReported, expectedProgress, lastCheckInAt, trustDecay,
  status, isDark = true, onCheckInClick,
}) => {
  const isComplete = status === 'COMPLETE' || selfReported >= 100;
  if (isComplete) return null;

  const color = STATUS_COLOR[status] || '#22c55e';

  // Compute the "decayed display value" — how far along the drain we are
  const staleness = useMemo(() => {
    if (!lastCheckInAt) return 0;
    return Math.min(1, Math.max(0, (Date.now() - new Date(lastCheckInAt).getTime()) / DECAY_WINDOW_MS));
  }, [lastCheckInAt]);

  const isStale = staleness > 0.05 || trustDecay > 5;
  
  // Displayed progress: interpolates from selfReported → (selfReported - trustDecay) over DECAY_WINDOW_MS
  const displayProgress = useMemo(() => {
    if (!isStale) return selfReported;
    return Math.max(0, Math.round(selfReported - trustDecay * staleness));
  }, [selfReported, trustDecay, staleness, isStale]);

  // Animate the decay — tick every 60s in "real time" during a session
  const [animatedProgress, setAnimatedProgress] = useState(selfReported);
  useEffect(() => {
    setAnimatedProgress(displayProgress);
  }, [displayProgress]);

  const stalenessLabel = lastCheckInAt ? formatStaleness(lastCheckInAt) : null;
  const showDecayLabel = isStale && trustDecay > 5 && stalenessLabel;

  return (
    <div className="mt-1.5 space-y-1">
      {/* Progress bar */}
      <div className="relative">
        {/* Background track */}
        <div className="h-1.5 rounded-full overflow-hidden"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }}>

          {/* Self-reported (faded) — shows the "claimed" value as a ghost */}
          {isStale && (
            <div
              className="absolute h-full rounded-full"
              style={{
                width: `${selfReported}%`,
                background: `${color}22`,
                transition: 'width 0.6s ease',
              }}
            />
          )}

          {/* Decaying actual bar */}
          <motion.div
            className="h-full rounded-full relative"
            animate={{ width: `${animatedProgress}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: isStale
                ? `linear-gradient(90deg, ${color}66, ${color}99)`
                : `linear-gradient(90deg, ${color}88, ${color})`,
              boxShadow: isStale ? 'none' : `0 0 6px ${color}44`,
            }}
          />
        </div>

        {/* Drain indicator — tiny droplet at the decay position */}
        {isStale && trustDecay > 5 && (
          <motion.div
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${animatedProgress}%`,
              background: `${color}66`,
            }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </div>

      {/* Staleness label */}
      <AnimatePresence>
        {showDecayLabel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-1">
              <Clock size={8} style={{ color: '#f59e0b' }} />
              <span className="text-[9px] font-mono" style={{ color: '#f59e0b' }}>
                Last reported {stalenessLabel} — showing adjusted estimate
              </span>
              <InfoTooltip
                size={10}
                explanation="Progress bar drains toward the pace-expected value when no check-in is logged for 48h — resets immediately when you update the slider."
              />
            </div>
            {onCheckInClick && (
              <motion.button
                onClick={e => { e.stopPropagation(); onCheckInClick(); }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="flex items-center gap-0.5 text-[9px] font-mono"
                style={{ color: '#22c55e' }}
                title="Update progress now"
              >
                <RefreshCw size={7} />
                update
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrustDecayBar;
