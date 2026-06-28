/**
 * ForecastPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The Velocity Forecast Agent's visual output.
 *
 * Shows:
 *   - Portfolio Health: weighted finish probability across all active tasks
 *   - Per-task probability bars with trend arrows
 *   - Recovery actions for at-risk tasks
 *   - Trust decay indicator when progress data is stale
 *
 * Runs the forecast on mount and every 5 minutes silently.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, RefreshCw, Eye } from 'lucide-react';
import { runForecast, TaskForecast, ForecastResult } from '../api';
import InfoTooltip from './InfoTooltip';

interface ForecastPanelProps {
  isDark: boolean;
  surfaceBorder: string;
  taskCount: number; // only fetch if tasks exist
  onAutonomousAction?: () => void; // called when agent logs something proactively
  onHealthUpdate?: (health: number) => void; // syncs portfolio health to stat card
}

// Probability → colour
function probColor(p: number): string {
  if (p >= 75) return '#22c55e';
  if (p >= 55) return '#f59e0b';
  if (p >= 35) return '#ef4444';
  return '#dc2626';
}

function probLabel(p: number): string {
  if (p >= 80) return 'On track';
  if (p >= 65) return 'Watch';
  if (p >= 45) return 'At risk';
  return 'Critical';
}

const TrendIcon: React.FC<{ trend: TaskForecast['trend']; color: string }> = ({ trend, color }) => {
  if (trend === 'improving') return <TrendingUp size={11} style={{ color: '#22c55e' }} />;
  if (trend === 'declining') return <TrendingDown size={11} style={{ color: '#ef4444' }} />;
  return <Minus size={11} style={{ color }} />;
};

// Animated probability number
const ProbNumber: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let frame = 0;
    const start = display;
    const diff = value - start;
    const steps = 30;
    const tick = () => {
      frame++;
      setDisplay(Math.round(start + diff * (frame / steps)));
      if (frame < steps) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className="font-mono font-bold tabular-nums" style={{ color, fontSize: 13 }}>
      {display}%
    </span>
  );
};

const ForecastPanel: React.FC<ForecastPanelProps> = ({
  isDark, surfaceBorder, taskCount, onAutonomousAction, onHealthUpdate,
}) => {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (taskCount === 0) return;
    if (!silent) setLoading(true);
    try {
      const result = await runForecast();
      setForecast(result);
      setLastRefresh(new Date());
      onHealthUpdate?.(result.portfolioHealth);
      if (result.autonomousActions.length > 0) {
        onAutonomousAction?.();
      }
    } catch {
      // silently fail — forecast is supplementary
    } finally {
      setLoading(false);
    }
  }, [taskCount, onAutonomousAction]);

  // Load on mount, refresh every 5 min silently
  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  if (!forecast && !loading) return null;

  const health = forecast?.portfolioHealth ?? 0;
  const healthColor = probColor(health);
  const criticalTasks = forecast?.forecasts.filter(f => f.riskLevel === 'critical') ?? [];
  const watchTasks    = forecast?.forecasts.filter(f => f.riskLevel === 'watch') ?? [];
  const safeTasks     = forecast?.forecasts.filter(f => f.riskLevel === 'safe') ?? [];

  const bg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.9)';
  const headerBorder = criticalTasks.length > 0
    ? 'rgba(239,68,68,0.3)'
    : watchTasks.length > 0
    ? 'rgba(245,158,11,0.25)'
    : 'rgba(34,197,94,0.2)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="mb-6 rounded-xl overflow-hidden"
      style={{ background: bg, border: `1px solid ${headerBorder}` }}
    >
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div
        className="w-full flex items-center justify-between px-4 py-2.5 gap-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Zap size={11} style={{ color: healthColor, flexShrink: 0 }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
            Portfolio Health
          </span>
          <InfoTooltip explanation="Weighted probability every active task finishes by its deadline — lower than pace score when deadlines are tight even if daily progress looks steady." />

          {/* Big probability number */}
          {loading && !forecast ? (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>calculating…</span>
          ) : (
            <motion.span
              key={health}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono font-black tabular-nums"
              style={{ color: healthColor, fontSize: 15, letterSpacing: '-0.02em' }}
            >
              {health}%
            </motion.span>
          )}

          {/* Risk pills */}
          {criticalTasks.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
              <AlertTriangle size={9} />
              {criticalTasks.length} critical
            </span>
          )}
          {watchTasks.length > 0 && criticalTasks.length === 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
              {watchTasks.length} to watch
            </span>
          )}
          {criticalTasks.length === 0 && watchTasks.length === 0 && safeTasks.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)' }}>
              all on track
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Last refresh */}
          {lastRefresh && (
            <span className="text-[9px] font-mono hidden sm:inline" style={{ color: 'var(--text-faint)' }}>
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <motion.button
            onClick={e => { e.stopPropagation(); load(false); }}
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.4 }}
            disabled={loading}
            style={{ color: 'var(--text-faint)', opacity: loading ? 0.4 : 1 }}
          >
            <RefreshCw size={11} />
          </motion.button>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <Eye size={12} style={{ color: 'var(--text-faint)' }} />
          </motion.div>
        </div>
      </div>

      {/* ── Expanded task forecast rows ─────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && forecast && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', borderTop: `1px solid ${surfaceBorder}` }}
          >
            <div className="px-4 py-3 space-y-3">
              {forecast.forecasts
                .sort((a, b) => a.probability - b.probability) // worst first
                .map((f, i) => {
                  const color = probColor(f.probability);
                  return (
                    <motion.div
                      key={f.taskId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      {/* Task row */}
                      <div className="flex items-center gap-2 mb-1">
                        <TrendIcon trend={f.trend} color={color} />
                        <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                          {f.taskName}
                        </span>
                        <ProbNumber value={f.probability} color={color} />
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                          {probLabel(f.probability)}
                        </span>
                      </div>

                      {/* Probability bar */}
                      <div className="h-1 rounded-full overflow-hidden mb-1.5"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${f.probability}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
                        />
                      </div>

                      {/* Trust decay warning */}
                      {f.trustDecay > 10 && (
                        <p className="text-[10px] font-mono mb-1" style={{ color: '#f59e0b' }}>
                          ⚠ Progress data is {Math.round(f.trustDecay / 15)}d stale — actual estimate may be lower
                        </p>
                      )}

                      {/* Recovery action */}
                      {f.recovery && (
                        <p className="text-[10px] font-mono leading-relaxed"
                          style={{ color: f.riskLevel === 'critical' ? '#f87171' : 'var(--text-faint)' }}>
                          → {f.recovery}
                        </p>
                      )}

                      {/* Pace micro-stats */}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                          actual {f.velocityRate}%/d
                        </span>
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                          needed {f.requiredRate}%/d
                        </span>
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                          {f.daysToDeadline.toFixed(1)}d left
                        </span>
                      </div>
                    </motion.div>
                  );
                })}

              {/* Autonomous action notice */}
              {forecast.autonomousActions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg mt-1"
                  style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
                >
                  <Zap size={10} className="text-green-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-mono" style={{ color: '#4ade80' }}>
                    Agent logged {forecast.autonomousActions.length} proactive drift alert{forecast.autonomousActions.length > 1 ? 's' : ''} → see Agent Log
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ForecastPanel;
