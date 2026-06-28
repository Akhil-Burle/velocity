/**
 * controllers/behavioralDriftController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1 — Behavioral Drift Score
 *
 * Computes a per-task "real progress" estimate from behavioral signals —
 * WITHOUT requiring any new manual input from the user. Compares this
 * inferred estimate against the user's last self-reported percentage and
 * surfaces the gap as a "Drift Score."
 *
 * SIGNALS (weighted most → least reliable):
 *   a. Subtask completion ratio          — primary, mechanical, fully trustworthy
 *   b. Staleness vs. expected pace       — reuses computePaceMetrics().expected
 *   c. Panic Mode usage                  — strong negative tell
 *   d. OmniBar language sentiment        — minor bonus, capped at ±15% influence
 *
 * CONFIDENCE GATE: if signal data is sparse, returns a neutral "not enough
 * activity" state rather than showing a potentially wrong accusation.
 *
 * ROUTES:
 *   POST /api/agent/drift-score           → compute drift for one task
 *   POST /api/agent/drift-score-batch     → compute for all active tasks
 *   POST /api/agent/drift-signal          → OmniBar language delta extraction
 */

const TaskModel  = require('../models/Task');
const AgentLog   = require('../models/AgentLog');
const { isConnected } = require('../db/connection');
const { computePaceMetrics, computeFinishProbability } = require('../utils/paceEngine');
const { appendAgentLog }     = require('./agentLogController');
// We call Gemini for the language signal — use the same pattern as other controllers
const geminiService = require('../services/geminiService');

const DAY_MS = 86400000;

// ─── Signal weights ─────────────────────────────────────────────────────────
// Must sum to 1.0 before the language bonus is applied
const W_SUBTASK   = 0.55; // most reliable — binary ground truth
const W_STALENESS = 0.30; // time-based decay from expected pace
const W_PANIC     = 0.15; // presence/absence of Panic Mode signal
const LANGUAGE_CAP = 0.15; // max fraction language can shift the final estimate

// ─── Minimum signal threshold before showing a drift badge ─────────────────
// A task needs at least one of these to show drift:
//   • ≥ 1 subtask that is completed, OR
//   • ≥ 1 check-in (i.e., sparkline has ≥ 1 entry), OR
//   • Panic Mode was triggered
// If none of these are present, return a "sparse data" neutral state.
function hasEnoughSignal(task) {
  const completedSubtasks = (task.subtasks || []).filter(s => s.completed).length;
  const checkInCount = (task.sparkline || []).length;
  const panicUsed = !!(task.panicScaffold && task.panicScaffold.generatedAt);
  return completedSubtasks > 0 || checkInCount > 0 || panicUsed;
}

// ─── Signal a: subtask completion ratio ─────────────────────────────────────
// Returns 0–100 inferred progress based solely on subtask ticks.
// Returns null if the task has no subtasks.
function subtaskSignal(task) {
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) return null;
  return Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100);
}

// ─── Signal b: staleness vs. expected pace ─────────────────────────────────
// Compares actual (self-reported) progress against what the pace engine
// *expects* given time elapsed. Returns an adjustment from -40 to 0:
//   • 0: progress is at or ahead of the pace line → no penalty
//   • negative: progress is behind the expected line → downward pressure
//
// This uses the SAME computePaceMetrics().expected already used for
// Velocity Degradation Alerts and Trust Decay (Phase 3) — no duplication.
function stalenessSignal(task, now = Date.now()) {
  const metrics = computePaceMetrics(task, now);
  const actual   = task.completionPercent || 0;
  const expected = metrics.expected;

  // How stale is the last check-in?
  const sparkline = task.sparkline || [];
  let staleDays = 0;
  if (sparkline.length > 0) {
    const lastPt = [...sparkline]
      .filter(p => p.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    if (lastPt) {
      staleDays = (now - new Date(lastPt.timestamp).getTime()) / DAY_MS;
    }
  }

  // If progress is behind the expected line AND data is stale → additional penalty
  const paceGap = actual - expected; // negative = behind
  const stalenessMultiplier = staleDays > 1 ? Math.min(staleDays / 2, 1.5) : 1;

  // Map: 0 behind → 0, 20% behind → -12, 40% behind → -20, with staleness amplifier
  const rawPenalty = Math.max(0, -paceGap) * 0.3 * stalenessMultiplier;
  return Math.round(Math.max(-40, -rawPenalty));
}

// ─── Signal c: Panic Mode as negative tell ──────────────────────────────────
// If Panic Mode was triggered, the user's self-reported progress was almost
// certainly optimistic when Panic Mode fired. We apply a meaningful downward
// adjustment to the inferred real progress, scaled by how long ago it happened.
function panicSignal(task, now = Date.now()) {
  const panicAt = task.panicScaffold && task.panicScaffold.generatedAt
    ? new Date(task.panicScaffold.generatedAt).getTime()
    : null;
  if (!panicAt) return 0; // no panic mode ever triggered

  const daysSincePanic = (now - panicAt) / DAY_MS;
  // Panic very recently → strong signal (-20); decays over 7 days to -5
  if (daysSincePanic < 1) return -20;
  if (daysSincePanic < 3) return -15;
  if (daysSincePanic < 7) return -10;
  return -5; // still a signal even if it was a while ago
}

// ─── Core: compute behavioral drift ─────────────────────────────────────────
// Returns:
//   {
//     inferredReal:   number (0-100) — our best estimate of true progress
//     selfReported:   number         — task.completionPercent
//     gap:            number         — inferredReal - selfReported (negative = user is ahead of reality)
//     confidence:     'high'|'medium'|'low'|'sparse'
//     signals:        { subtask, staleness, panic, language }
//     explanation:    string[]       — human-readable breakdown of each signal
//   }
function computeBehavioralDrift(task, languageDelta = null, now = Date.now()) {
  // Sparse-data guard
  if (!hasEnoughSignal(task)) {
    return {
      inferredReal:  task.completionPercent || 0,
      selfReported:  task.completionPercent || 0,
      gap:           0,
      confidence:    'sparse',
      signals:       { subtask: null, staleness: 0, panic: 0, language: 0 },
      explanation:   ['Not enough activity yet to estimate real progress.'],
    };
  }

  const selfReported = task.completionPercent || 0;
  const subtask      = subtaskSignal(task);       // null if no subtasks
  const staleAdj     = stalenessSignal(task, now);// ≤ 0 adjustment
  const panicAdj     = panicSignal(task, now);    // ≤ 0 adjustment

  // Build weighted inferred estimate
  // Start from self-reported as baseline, then adjust by signal gaps
  let inferredReal;
  const explanation = [];

  if (subtask !== null) {
    // We have subtask data — primary signal
    // Blend subtask ratio (0.55 weight) with a staleness-adjusted self-reported (0.30 weight)
    // + panic penalty (0.15 weight)
    const stalenessBase = Math.max(0, selfReported + staleAdj);
    inferredReal = (subtask * W_SUBTASK) + (stalenessBase * W_STALENESS) + (selfReported * W_PANIC);

    const completedSubs = (task.subtasks || []).filter(s => s.completed).length;
    const totalSubs     = (task.subtasks || []).length;
    explanation.push(`Subtasks ${completedSubs}/${totalSubs} complete (${subtask}% done by this measure)`);
  } else {
    // No subtasks — use staleness-adjusted self-reported
    inferredReal = Math.max(0, selfReported + staleAdj);
    explanation.push('No subtask data — estimate based on check-in recency and pace');
  }

  // Apply panic penalty directly (don't weight it, just cap-subtract)
  inferredReal = Math.max(0, inferredReal + panicAdj);
  if (panicAdj < 0) {
    const daysSincePanic = task.panicScaffold && task.panicScaffold.generatedAt
      ? Math.round((now - new Date(task.panicScaffold.generatedAt).getTime()) / DAY_MS)
      : 0;
    explanation.push(`Panic Mode was triggered ${daysSincePanic}d ago — indicates past overestimation`);
  }

  if (staleAdj < -2) {
    explanation.push(`Progress data is stale — last check-in was behind the expected pace line`);
  }

  // Apply language delta (capped at ±15% of the final value)
  let langEffect = 0;
  if (languageDelta !== null && typeof languageDelta === 'number' && !isNaN(languageDelta)) {
    const capAmount = inferredReal * LANGUAGE_CAP;
    langEffect = Math.max(-capAmount, Math.min(capAmount, languageDelta * (capAmount / 20)));
    inferredReal = Math.max(0, Math.min(100, inferredReal + langEffect));
    if (Math.abs(languageDelta) > 3) {
      explanation.push(`Language signal: ${languageDelta > 0 ? 'confident' : 'struggling'} tone detected in recent Omni-Bar input`);
    }
  }

  inferredReal = Math.round(Math.max(0, Math.min(100, inferredReal)));
  const gap = inferredReal - selfReported;

  // Confidence: how many distinct signals do we have?
  const signalCount = [subtask !== null, (task.sparkline || []).length > 0, panicAdj < 0, Math.abs(languageDelta || 0) > 3]
    .filter(Boolean).length;
  const confidence = signalCount >= 3 ? 'high' : signalCount >= 2 ? 'medium' : 'low';

  return {
    inferredReal,
    selfReported,
    gap,
    confidence,
    signals: {
      subtask: subtask,
      staleness: staleAdj,
      panic: panicAdj,
      language: Math.round(langEffect),
    },
    explanation,
  };
}

// ─── Route handler: POST /api/agent/drift-score ──────────────────────────────
async function handleDriftScore(req, res) {
  const { taskId } = req.body;
  const userId = req.userId;
  const now = Date.now();

  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  let task;
  if (isConnected()) {
    task = await TaskModel.findOne({ id: taskId, userId }).lean();
  } else {
    const { db } = require('../utils/dataModel');
    task = db.getTaskById ? db.getTaskById(taskId) : null;
  }
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const drift = computeBehavioralDrift(task, null, now);

  // Auto-log significant drift detections (gap > 25%) to the Activity Log
  if (Math.abs(drift.gap) > 25 && drift.confidence !== 'sparse') {
    const existing = isConnected()
      ? await AgentLog.findOne({ userId, featureKey: 'behavioral_drift', relatedTaskId: taskId,
          createdAt: { $gt: new Date(now - 6 * 3600000).toISOString() } }).lean()
      : null;

    if (!existing) {
      appendAgentLog(userId, {
        featureKey: 'behavioral_drift',
        title: `Detected a ${Math.abs(drift.gap)}% gap between reported and real progress on "${task.taskName}"`,
        reasoning: `Self-reported: ${drift.selfReported}% · Behavioral estimate: ${drift.inferredReal}%. Signals: ${drift.explanation.join('; ')}.`,
        outcome: `Flagged for attention — consider re-evaluating reported progress.`,
        autonomy: 'autonomous',
        undoable: false,
        relatedTaskId: taskId,
        relatedTaskName: task.taskName,
        metadata: { gap: drift.gap, inferredReal: drift.inferredReal, selfReported: drift.selfReported,
                    confidence: drift.confidence, signals: drift.signals },
      }).catch(() => {});
    }
  }

  return res.json({ taskId, ...drift, taskName: task.taskName });
}

// ─── Route handler: POST /api/agent/drift-score-batch ───────────────────────
// Computes drift for all active tasks at once (called by frontend on load)
async function handleDriftScoreBatch(req, res) {
  const userId = req.userId;
  const now = Date.now();

  let tasks;
  if (isConnected()) {
    tasks = await TaskModel.find({ userId }).lean();
  } else {
    const { db } = require('../utils/dataModel');
    tasks = db.getAllTasks ? db.getAllTasks() : [];
  }

  const activeTasks = (tasks || []).filter(
    t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed'
  );

  const results = activeTasks.map(task => ({
    taskId: task.id,
    taskName: task.taskName,
    ...computeBehavioralDrift(task, null, now),
  }));

  // Auto-log any large-gap detections (gap > 25%)
  for (const r of results) {
    if (Math.abs(r.gap) > 25 && r.confidence !== 'sparse') {
      const existing = isConnected()
        ? await AgentLog.findOne({ userId, featureKey: 'behavioral_drift', relatedTaskId: r.taskId,
            createdAt: { $gt: new Date(now - 6 * 3600000).toISOString() } }).lean().catch(() => null)
        : null;
      if (!existing) {
        appendAgentLog(userId, {
          featureKey: 'behavioral_drift',
          title: `Detected a ${Math.abs(r.gap)}% gap between reported and real progress on "${r.taskName}"`,
          reasoning: `Self-reported: ${r.selfReported}% · Behavioral estimate: ${r.inferredReal}%. Signals: ${r.explanation.join('; ')}.`,
          outcome: `Flagged for attention — reported number doesn't match behavioral evidence.`,
          autonomy: 'autonomous',
          undoable: false,
          relatedTaskId: r.taskId,
          relatedTaskName: r.taskName,
          metadata: { gap: r.gap, inferredReal: r.inferredReal, selfReported: r.selfReported,
                      confidence: r.confidence, signals: r.signals },
        }).catch(() => {});
      }
    }
  }

  // Compute Velocity Vector while we have all tasks in memory
  // (aggregate: magnitude + direction for Phase 4)
  const vector = computeVelocityVector(results, activeTasks, tasks);

  return res.json({ driftScores: results, velocityVector: vector, generatedAt: new Date(now).toISOString() });
}

// ─── Velocity Vector computation (Phase 4 data) ─────────────────────────────
// Returns:
//   magnitude: 0–100 (how much is getting done — blended actual velocity)
//   direction: 'good'|'mixed'|'poor'  (whether trajectory aims at deadlines)
//   alignment: 0–100 (how aligned real progress is with deadline requirements)
//   worstOffenders: top 3 tasks dragging the vector
function computeVelocityVector(driftResults, tasks, allTasks) {
  // If there are no active tasks but there ARE completed tasks, that's a
  // success state — show a positive/neutral vector, not the "no data" failure state.
  const hasAnyTasks = allTasks && allTasks.length > 0;
  const hasActiveTasks = tasks && tasks.length > 0;

  if (!hasActiveTasks) {
    if (hasAnyTasks) {
      // All tasks are done — positive state
      return { magnitude: 100, direction: 'good', alignment: 100, worstOffenders: [] };
    }
    // Genuinely no tasks at all
    return { magnitude: 0, direction: 'good', alignment: 100, worstOffenders: [] };
  }

  const now = Date.now();

  const scored = tasks.map(task => {
    const m = computePaceMetrics(task, now);
    const p = computeFinishProbability(task, now);
    const drift = driftResults.find(d => d.taskId === task.id);
    const driftGap = drift ? Math.abs(drift.gap) : 0;
    return { task, metrics: m, probability: p, driftGap };
  });

  // Magnitude: weighted average of actual velocity rates (normalized 0-100)
  // We normalize by requiredRate so "faster than needed" = good
  const magnitudeScores = scored.map(s => {
    if (s.metrics.requiredRate <= 0) return 80; // no pace needed → good
    return Math.min(100, Math.round((s.metrics.velocityRate / Math.max(s.metrics.requiredRate, 0.1)) * 80));
  });
  const magnitude = Math.round(magnitudeScores.reduce((a, b) => a + b, 0) / Math.max(scored.length, 1));

  // Alignment: weighted average finish probability, penalized by average drift gap
  const avgProb     = Math.round(scored.reduce((s, r) => s + r.probability, 0) / Math.max(scored.length, 1));
  const avgDriftGap = Math.round(scored.reduce((s, r) => s + r.driftGap, 0) / Math.max(scored.length, 1));
  const alignment   = Math.round(Math.max(0, avgProb - avgDriftGap * 0.5));

  // Direction
  const direction = alignment >= 70 ? 'good' : alignment >= 45 ? 'mixed' : 'poor';

  // Worst offenders: tasks with highest drift gap + lowest probability
  const worstOffenders = [...scored]
    .sort((a, b) => {
      const scoreA = a.driftGap * 0.6 + (100 - a.probability) * 0.4;
      const scoreB = b.driftGap * 0.6 + (100 - b.probability) * 0.4;
      return scoreB - scoreA;
    })
    .slice(0, 3)
    .map(s => ({
      taskId:       s.task.id,
      taskName:     s.task.taskName,
      driftGap:     s.driftGap,
      probability:  s.probability,
      status:       s.task.status,
      velocityRate: s.metrics.velocityRate,
      requiredRate: s.metrics.requiredRate,
    }));

  return { magnitude, direction, alignment, worstOffenders };
}

// ─── Route handler: POST /api/agent/drift-signal ────────────────────────────
// Extracts a confidence delta (-20 to +20) from an OmniBar utterance
// referencing a specific task's progress.
async function handleDriftSignal(req, res) {
  const { taskId, utterance } = req.body;
  const userId = req.userId;

  if (!utterance) return res.json({ delta: null });

  let task = null;
  if (taskId) {
    if (isConnected()) {
      task = await TaskModel.findOne({ id: taskId, userId }).lean();
    }
  }

  const taskName = task ? task.taskName : 'the task';

  try {
    const prompt = `Analyze this utterance from a productivity app user. They are working on: "${taskName}".

Utterance: "${utterance}"

Does this utterance express confidence or progress about this specific task?
Return a JSON object with one key "delta":
- Positive number (+5 to +20) if the utterance expresses confidence, progress, or "almost done" sentiment about this task
- Negative number (-5 to -20) if the utterance expresses being stuck, struggling, or "barely started" about this task  
- 0 or null if the utterance doesn't reference this task's progress at all

Examples:
- "almost done with the OS assignment" → {"delta": 15}
- "barely started the virtual memory simulator" → {"delta": -15}
- "stuck on X" where X matches task → {"delta": -10}
- "what should I work on" → {"delta": null}
- unrelated utterance → {"delta": null}

Return ONLY the JSON. No markdown.`;

    const text = await geminiService.generate(prompt);
    const parsed = JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim());
    const delta = parsed.delta !== undefined ? parsed.delta : null;
    return res.json({ delta: typeof delta === 'number' ? Math.max(-20, Math.min(20, delta)) : null });
  } catch {
    return res.json({ delta: null });
  }
}

module.exports = {
  handleDriftScore,
  handleDriftScoreBatch,
  handleDriftSignal,
  computeBehavioralDrift,
  computeVelocityVector,
};
