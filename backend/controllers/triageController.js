/**
 * controllers/triageController.js
 * POST /api/triage — scoped to req.userId
 */

const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');
const { appendAgentLog } = require('./agentLogController');

const WEIGHT_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

async function handleTriage(req, res) {
  const userId = req.userId;

  let allTasks;
  if (isConnected()) {
    allTasks = await TaskModel.find({ userId }).lean();
  } else {
    allTasks = db.getAllTasks();
  }

  const activeSelfOwned = allTasks.filter(t =>
    !t.isRescheduled && t.status !== 'COMPLETE' && t.selfOwned === true
  );

  if (activeSelfOwned.length === 0) {
    return res.json({ triaged: false, reason: 'No active self-owned tasks to triage.', triagedTask: null });
  }

  const totalEstimatedMinutes = activeSelfOwned.reduce((sum, task) => {
    const subtaskMins = (task.subtasks || []).filter(s => !s.completed).reduce((s, sub) => s + (sub.estimatedMinutes || 30), 0);
    return sum + (subtaskMins || 60);
  }, 0);

  const nearestDeadline = activeSelfOwned.reduce((min, task) => {
    const dl = new Date(task.deadline).getTime();
    return dl < min ? dl : min;
  }, Infinity);

  const hoursUntilDeadline = Math.max((nearestDeadline - Date.now()) / 3600000, 0);
  const availableMinutes = Math.round((hoursUntilDeadline / 24) * 2 * 60);

  if (totalEstimatedMinutes <= availableMinutes) {
    return res.json({
      triaged: false,
      reason: `Workload is manageable. Estimated ${Math.round(totalEstimatedMinutes / 60)}h of work with ${Math.round(availableMinutes / 60)}h available. No triage needed.`,
      triagedTask: null,
    });
  }

  const nearestTask = activeSelfOwned.find(t => new Date(t.deadline).getTime() === nearestDeadline);
  const candidates = activeSelfOwned.filter(t => t.id !== nearestTask?.id);
  if (candidates.length === 0) {
    return res.json({ triaged: false, reason: 'Only one active self-owned task — cannot triage.', triagedTask: null });
  }

  candidates.sort((a, b) => {
    const wDiff = (WEIGHT_ORDER[a.cognitiveWeight] || 0) - (WEIGHT_ORDER[b.cognitiveWeight] || 0);
    return wDiff !== 0 ? wDiff : new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
  });

  const taskToTriage = candidates[0];
  let updated;

  if (isConnected()) {
    updated = await TaskModel.findOneAndUpdate(
      { id: taskToTriage.id, userId },
      { $set: { isRescheduled: true, updatedAt: new Date().toISOString() } },
      { new: true, lean: true }
    );
    const { _id, __v, ...cleaned } = updated;
    updated = cleaned;
  } else {
    updated = db.updateTask(taskToTriage.id, { isRescheduled: true });
  }

  const overloadBy = Math.round((totalEstimatedMinutes - availableMinutes) / 60);
  const reason = `Overloaded by ~${overloadBy}h. "${taskToTriage.taskName}" (${taskToTriage.cognitiveWeight} weight) was rescheduled to free up capacity.`;

  // Write agent log entry
  await appendAgentLog(userId, {
    featureKey: 'triage',
    title: `Auto-triaged "${taskToTriage.taskName}" to free capacity`,
    reasoning: `Workload exceeded available time by ~${overloadBy}h. Among all reschedulable tasks, "${taskToTriage.taskName}" had the lowest cognitive weight (${taskToTriage.cognitiveWeight}) and furthest deadline — safest to defer.`,
    outcome: `Task rescheduled. ${activeSelfOwned.length - 1} tasks remain active.`,
    autonomy: 'assisted',
    undoable: true,
    relatedTaskId: taskToTriage.id,
    relatedTaskName: taskToTriage.taskName,
    metadata: { overloadHours: overloadBy, tasksCounted: activeSelfOwned.length },
  }).catch(() => {});

  console.log(`[Triage] Triaged task: ${taskToTriage.id} — ${taskToTriage.taskName}`);
  return res.json({ triaged: true, reason, triagedTask: updated });
}

module.exports = { handleTriage };
