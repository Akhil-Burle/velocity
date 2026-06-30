/**
 * controllers/forecastController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/agent/forecast
 *
 * The Velocity Forecast Agent — runs silently, acts first, asks later.
 *
 * For every active task it computes:
 *   - finishProbability  (0–100)
 *   - trend              (improving / declining / stable)
 *   - riskLevel          (safe / watch / critical)
 *   - recoveryAction     (specific thing to do RIGHT NOW)
 *   - trustDecay         (stale progress: how much to drain the display %)
 *
 * When a task is "critical" (probability < 45%) and hasn't had an agent
 * action logged in the last 2 hours, the agent proactively writes a
 * drift_alert entry to the Agent Log — unprompted, autonomous.
 *
 * Returns the full forecast so the frontend can render it live.
 */

const TaskModel = require('../models/Task');
const { db } = require('../utils/dataModel');
const { isConnected } = require('../db/connection');
const { computePaceMetrics, computeFinishProbability } = require('../utils/paceEngine');
const { appendAgentLog } = require('./agentLogController');
const AgentLog = require('../models/AgentLog');

const DAY_MS = 86400000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h without check-in = stale
const AUTO_LOG_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h between autonomous alerts per task
const CRITICAL_THRESHOLD = 45;   // below this → agent acts
const WATCH_THRESHOLD = 65;       // below this → watch

// In-memory fallback cache for drift-alert deduplication when MongoDB is not
// connected. Prevents the same task from generating a flood of log entries on
// every forecast call (which can happen on rapid re-renders).
// Key: `${userId}:${taskId}`, Value: timestamp of last alert.
const _inMemoryAlertCache = new Map();

// ─── Recovery action generator ────────────────────────────────────────────────
// Pure deterministic — no AI call needed. The specificity comes from the data.

function generateRecoveryAction(task, metrics, probability) {
  const daysLeft = Math.max(0, metrics.daysToDeadline);
  const remaining = 100 - (task.completionPercent || 0);
  const hoursNeeded = metrics.requiredHoursPerDay;
  const recipient = task.recipientName;

  if (probability < 20) {
    if (!task.selfOwned && recipient) {
      return `Request extension from ${recipient} now — at current pace this misses by ${Math.abs(metrics.drift)}%.`;
    }
    return `Block ${hoursNeeded.toFixed(1)}h today — all other tasks must wait. ${remaining}% remaining, ${daysLeft.toFixed(1)} days left.`;
  }

  if (probability < 45) {
    if (metrics.velocityRate < metrics.requiredRate * 0.5) {
      return `Velocity is ${metrics.velocityRate}%/day but needs ${metrics.requiredRate}%/day. Double today's session length.`;
    }
    if (!task.selfOwned && recipient && daysLeft < 2) {
      return `Negotiate with ${recipient} — only ${daysLeft.toFixed(1)} days left at ${task.completionPercent || 0}% complete.`;
    }
    return `${hoursNeeded.toFixed(1)}h/day required to finish on time. Start your next session immediately.`;
  }

  if (probability < 65) {
    const unfinishedSubtasks = (task.subtasks || []).filter(s => !s.completed);
    if (unfinishedSubtasks.length > 0) {
      return `Knock out "${unfinishedSubtasks[0].title}" (~${unfinishedSubtasks[0].estimatedMinutes || 30} min) to build momentum.`;
    }
    return `${remaining}% remaining. Log a check-in after your next session to keep pace accurate.`;
  }

  return null; // No action needed above 65%
}

// ─── Trend detection (last 3 sparkline intervals) ────────────────────────────

function detectTrend(sparkline) {
  if (!sparkline || sparkline.length < 3) return 'stable';
  const pts = [...sparkline]
    .filter(p => p.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-4);
  if (pts.length < 3) return 'stable';

  // Compute rate for last two intervals
  const rates = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = (new Date(pts[i].timestamp).getTime() - new Date(pts[i-1].timestamp).getTime()) / DAY_MS;
    if (dt > 0.001) rates.push((pts[i].value - pts[i-1].value) / dt);
  }
  if (rates.length < 2) return 'stable';

  const recent = rates[rates.length - 1];
  const prior  = rates[rates.length - 2];
  if (recent > prior + 2) return 'improving';
  if (recent < prior - 2) return 'declining';
  return 'stable';
}

// ─── Trust decay — how much to drain stale progress ──────────────────────────
// If the last check-in was >24h ago, the honest estimate is drifting toward
// the expected line. Return how many percent to drain from displayed progress.

function computeTrustDecay(task, metrics, now = Date.now()) {
  const sparkline = task.sparkline || [];
  if (sparkline.length === 0) return 0;

  const lastPt = [...sparkline]
    .filter(p => p.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  if (!lastPt) return 0;

  const staleness = now - new Date(lastPt.timestamp).getTime();
  if (staleness < STALE_THRESHOLD_MS) return 0;

  // Each day of staleness, progress drifts toward expected by 15%
  const staleDays = staleness / DAY_MS;
  const drift = Math.min(staleDays * 15, 40); // cap at 40% drain
  return Math.round(drift);
}

// ─── Check if we already logged an alert for this task recently ───────────────

async function recentAlertExists(userId, taskId) {
  try {
    const cutoff = new Date(Date.now() - AUTO_LOG_COOLDOWN_MS).toISOString();
    if (isConnected()) {
      const recent = await AgentLog.findOne({
        userId,
        featureKey: 'drift_alert',
        relatedTaskId: taskId,
        createdAt: { $gt: cutoff },
      }).lean();
      return !!recent;
    }
    // In-memory mode: use local cache for deduplication
    const key = `${userId}:${taskId}`;
    const lastAlerted = _inMemoryAlertCache.get(key);
    return lastAlerted && (Date.now() - lastAlerted) < AUTO_LOG_COOLDOWN_MS;
  } catch {
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handleForecast(req, res) {
  const userId = req.userId;
  const now = Date.now();

  let tasks;
  if (isConnected()) {
    tasks = await TaskModel.find({ userId }).lean();
  } else {
    tasks = db.getAllTasks();
  }

  const activeTasks = (tasks || []).filter(
    t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed'
  );

  const forecasts = [];
  const autonomousActions = [];

  for (const task of activeTasks) {
    const metrics     = computePaceMetrics(task, now);
    const probability = computeFinishProbability(task, now);
    const trend       = detectTrend(task.sparkline);
    const trustDecay  = computeTrustDecay(task, metrics, now);
    const recovery    = generateRecoveryAction(task, metrics, probability);

    const riskLevel =
      probability < CRITICAL_THRESHOLD ? 'critical' :
      probability < WATCH_THRESHOLD    ? 'watch'    : 'safe';

    forecasts.push({
      taskId:      task.id,
      taskName:    task.taskName,
      probability,
      trend,
      riskLevel,
      recovery,
      trustDecay,
      daysToDeadline: metrics.daysToDeadline,
      drift:          metrics.drift,
      velocityRate:   metrics.velocityRate,
      requiredRate:   metrics.requiredRate,
      consistency:    metrics.consistency,
    });

    // ── Autonomous agent action: proactive drift alert ────────────────────────
    // Fire when: probability < CRITICAL_THRESHOLD AND haven't alerted recently
    if (riskLevel === 'critical' && recovery) {
      const alreadyAlerted = await recentAlertExists(userId, task.id);
      if (!alreadyAlerted) {
        const daysLeft = Math.max(0, metrics.daysToDeadline).toFixed(1);
        const logEntry = await appendAgentLog(userId, {
          featureKey: 'drift_alert',
          title:     `⚡ ${task.taskName} — ${probability}% finish probability, ${daysLeft} days left`,
          reasoning: `Velocity detected that "${task.taskName}" has drifted to a ${probability}% finish probability. Current pace: ${metrics.velocityRate}%/day. Required: ${metrics.requiredRate}%/day. Drift from expected line: ${metrics.drift}%. Consistency score: ${metrics.consistency}/100.`,
          outcome:   `Recommended action: ${recovery}`,
          autonomy:  'autonomous',
          undoable:  false,
          relatedTaskId:   task.id,
          relatedTaskName: task.taskName,
          metadata: {
            probability,
            trend,
            drift: metrics.drift,
            velocityRate: metrics.velocityRate,
            requiredRate: metrics.requiredRate,
            daysToDeadline: metrics.daysToDeadline,
            trustDecay,
          },
        }).catch(() => null);

        if (logEntry) {
          // Update in-memory cache so subsequent rapid calls are deduplicated
          // even if MongoDB isn't available yet for the cooldown query.
          _inMemoryAlertCache.set(`${userId}:${task.id}`, Date.now());
          autonomousActions.push({
            taskId:   task.id,
            taskName: task.taskName,
            probability,
            recovery,
            logEntryId: logEntry.id,
          });
        }
      }
    }
  }

  // ── Portfolio Health — weighted average by urgency ────────────────────────
  // Tasks with lower probability weight more heavily (the weak links matter most)
  let portfolioHealth;
  if (forecasts.length === 0) {
    // No active tasks — if all tasks are complete that's 100%, if no tasks at all also 100%
    portfolioHealth = 100;
  } else {
    const weights = forecasts.map(f => {
      // Weight by live risk level (derived from probability) — not stale DB status
      // critical (<45%) counts 3×, watch (<65%) 2×, safe 1×
      const w = f.riskLevel === 'critical' ? 3 : f.riskLevel === 'watch' ? 2 : 1;
      return { probability: f.probability, weight: w };
    });
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    portfolioHealth = Math.round(
      weights.reduce((s, w) => s + w.probability * w.weight, 0) / Math.max(totalWeight, 1)
    );
  }

  return res.json({
    portfolioHealth,
    forecasts,
    autonomousActions,
    generatedAt: new Date(now).toISOString(),
  });
}

module.exports = { handleForecast };
