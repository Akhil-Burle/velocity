/**
 * controllers/ultimatumController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The Ultimatum — forces the user to consciously choose which task fails
 * when two tasks are in genuine head-to-head conflict and cannot both be
 * completed before their respective deadlines.
 *
 * Routes:
 *   POST /api/ultimatum/evaluate  — detect conflict, return both tasks + cost lines
 *   POST /api/ultimatum/resolve   — mark loser as "failed", log the decision
 */

const TaskModel     = require('../models/Task');
const GoalModel     = require('../models/Goal');
const DecisionLog   = require('../models/DecisionLog');
const { isConnected } = require('../db/connection');
const { db }        = require('../utils/dataModel');
const { generateUltimatumCosts } = require('../services/geminiService');

// ── Feasibility helpers (mirrors triageController logic) ─────────────────────

function subtaskMinutes(task) {
  return (task.subtasks || [])
    .filter(s => !s.completed)
    .reduce((s, sub) => s + (sub.estimatedMinutes || 30), 0) || 60;
}

/**
 * For a pair of tasks, check whether BOTH can fit before the EARLIER of their
 * two deadlines given a 2-hour/day availability cap.
 * Returns true if they are in genuine head-to-head conflict.
 */
function areTwoTasksInConflict(taskA, taskB) {
  const earlierDeadline = Math.min(
    new Date(taskA.deadline).getTime(),
    new Date(taskB.deadline).getTime()
  );
  const hoursUntil  = Math.max((earlierDeadline - Date.now()) / 3600000, 0);
  const availableMins = Math.round((hoursUntil / 24) * 2 * 60);
  const combinedMins  = subtaskMinutes(taskA) + subtaskMinutes(taskB);
  return combinedMins > availableMins;
}

/**
 * Among all active self-owned tasks, find the single pair that is most
 * acutely in conflict: the two whose combined remaining work most exceeds
 * the available time before the earlier of their two deadlines.
 * Returns null if no genuine two-task conflict exists.
 */
function findConflictingPair(tasks) {
  const candidates = tasks.filter(
    t => !t.isRescheduled &&
         t.status !== 'COMPLETE' &&
         t.status !== 'failed' &&
         t.selfOwned === true
  );

  if (candidates.length < 2) return null;

  let worstOverload = 0;
  let worstPair = null;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const earlierDeadline = Math.min(
        new Date(a.deadline).getTime(),
        new Date(b.deadline).getTime()
      );
      const hoursUntil    = Math.max((earlierDeadline - Date.now()) / 3600000, 0);
      const availableMins = Math.round((hoursUntil / 24) * 2 * 60);
      const combinedMins  = subtaskMinutes(a) + subtaskMinutes(b);
      const overload      = combinedMins - availableMins;

      if (overload > worstOverload) {
        worstOverload = overload;
        worstPair = [a, b];
      }
    }
  }

  return worstPair; // null if no pair is overloaded
}

// ── POST /api/ultimatum/evaluate ─────────────────────────────────────────────

async function evaluate(req, res) {
  const userId = req.userId;

  try {
    let allTasks;
    if (isConnected()) {
      allTasks = await TaskModel.find({ userId }).lean();
    } else {
      allTasks = db.getAllTasks();
    }

    const pair = findConflictingPair(allTasks);

    if (!pair) {
      return res.json({ triggered: false });
    }

    const [taskA, taskB] = pair;

    // Fetch goals for this user so cost lines can reference goal links
    let goals = [];
    if (isConnected()) {
      try {
        goals = await GoalModel.find({ userId }).lean();
      } catch (_) { /* non-fatal */ }
    } else {
      goals = db.getAllGoals ? db.getAllGoals() : [];
    }

    // Generate specific, data-driven cost lines via Gemini
    const { costA, costB } = await generateUltimatumCosts(taskA, taskB, goals);

    return res.json({
      triggered: true,
      taskA: { ...taskA, failureCost: costA },
      taskB: { ...taskB, failureCost: costB },
    });
  } catch (err) {
    console.error('[Ultimatum] evaluate error:', err);
    return res.status(500).json({ error: 'Ultimatum evaluate failed', message: err.message });
  }
}

// ── POST /api/ultimatum/resolve ───────────────────────────────────────────────

async function resolve(req, res) {
  const userId = req.userId;
  const { winningTaskId, losingTaskId } = req.body;

  if (!winningTaskId || !losingTaskId) {
    return res.status(400).json({ error: 'winningTaskId and losingTaskId are required' });
  }

  try {
    let winnerTask, loserTask;

    if (isConnected()) {
      [winnerTask, loserTask] = await Promise.all([
        TaskModel.findOne({ id: winningTaskId, userId }).lean(),
        TaskModel.findOne({ id: losingTaskId, userId  }).lean(),
      ]);
    } else {
      winnerTask = db.getTaskById(winningTaskId);
      loserTask  = db.getTaskById(losingTaskId);
    }

    if (!winnerTask || !loserTask) {
      return res.status(404).json({ error: 'One or both tasks not found for this user' });
    }

    // Mark the loser as rescheduled — the user made a conscious choice to defer it.
    // It's not abandoned — it should be picked up later with an adapted deadline.
    let updatedLoser;
    if (isConnected()) {
      const raw = await TaskModel.findOneAndUpdate(
        { id: losingTaskId, userId },
        { $set: { isRescheduled: true, updatedAt: new Date().toISOString() } },
        { new: true, lean: true }
      );
      const { _id, __v, ...cleaned } = raw;
      updatedLoser = cleaned;
    } else {
      updatedLoser = db.updateTask(losingTaskId, { isRescheduled: true });
    }

    // Log the decision
    const reasoning = `User explicitly chose to let "${loserTask.taskName}" fail in favor of "${winnerTask.taskName}".`;
    if (isConnected()) {
      try {
        await DecisionLog.create({
          userId,
          type: 'ultimatum',
          winningTaskId,
          winningTaskName: winnerTask.taskName,
          losingTaskId,
          losingTaskName: loserTask.taskName,
          reasoning,
          createdAt: new Date().toISOString(),
        });
      } catch (logErr) {
        // Non-fatal — decision already applied, just log the error
        console.warn('[Ultimatum] Decision log write failed:', logErr.message);
      }
    }

    console.log(`[Ultimatum] ${userId} chose "${winnerTask.taskName}" over "${loserTask.taskName}" — "${loserTask.taskName}" rescheduled.`);

    return res.json({
      success: true,
      losingTask: updatedLoser,
      winningTask: winnerTask,
      reasoning,
      confirmation: `"${loserTask.taskName}" rescheduled — adapt its deadline and pick it up later. "${winnerTask.taskName}" is your priority now.`,
    });
  } catch (err) {
    console.error('[Ultimatum] resolve error:', err);
    return res.status(500).json({ error: 'Ultimatum resolve failed', message: err.message });
  }
}

module.exports = { evaluate, resolve };
