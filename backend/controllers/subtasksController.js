/**
 * controllers/subtasksController.js
 * PATCH /api/tasks/:id/subtasks/:subtaskId  — toggle completed, update title/mins
 * POST  /api/tasks/:id/subtasks             — add a new subtask
 * DELETE /api/tasks/:id/subtasks/:subtaskId — remove a subtask
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/dataModel');
const { computePaceMetrics } = require('../utils/paceEngine');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');

// Recompute pace from subtask state WITHOUT touching completionPercent.
// Subtask ticks update the objective evidence (for drift detection) but
// must NOT overwrite the user's self-reported completionPercent — that
// would collapse the gap that behavioral drift measures.
// We still recompute pace/status so required hours/day stays accurate.
function deriveTaskUpdates(updatedSubtasks, task, now = new Date().toISOString()) {
  // Keep the user's self-reported number — do NOT derive it from subtask ratio.
  const completionPercent = task.completionPercent || 0;

  // Append a sparkline point weighted by estimated minutes, not raw ratio.
  // This gives a more honest picture of effort: a 90-min subtask ticked
  // counts more than a 5-min one.
  const totalMins     = updatedSubtasks.reduce((s, sub) => s + (sub.estimatedMinutes || 30), 0);
  const completedMins = updatedSubtasks.filter(s => s.completed).reduce((s, sub) => s + (sub.estimatedMinutes || 30), 0);
  const subtaskEvidencePct = totalMins > 0
    ? Math.round((completedMins / totalMins) * 100)
    : Math.round((updatedSubtasks.filter(s => s.completed).length / Math.max(updatedSubtasks.length, 1)) * 100);

  const sparkline = [
    ...(Array.isArray(task.sparkline) ? task.sparkline : []).slice(-29),
    { value: subtaskEvidencePct, timestamp: now, source: 'subtask' },
  ];

  const projected = { ...task, subtasks: updatedSubtasks, completionPercent, sparkline };
  const paceMetrics = computePaceMetrics(projected);

  return {
    subtasks: updatedSubtasks,
    // completionPercent intentionally NOT included — slider owns this
    sparkline,
    currentPaceHoursPerDay: paceMetrics.requiredHoursPerDay,
    status: projected.status !== 'COMPLETE' && projected.status !== 'failed'
      ? paceMetrics.status
      : projected.status,
    updatedAt: now,
  };
}

// ─── PATCH /:subtaskId — toggle completed, or update title/estimatedMinutes ──
async function updateSubtask(req, res) {
  const { id, subtaskId } = req.params;
  const { completed, title, estimatedMinutes } = req.body;
  const userId = req.userId;

  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: '"completed" must be a boolean' });
  }

  const now = new Date().toISOString();

  if (isConnected()) {
    const task = await TaskModel.findOne({ id, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const subtaskIdx = (task.subtasks || []).findIndex(s => s.id === subtaskId);
    if (subtaskIdx === -1) return res.status(404).json({ error: 'Subtask not found' });

    const updatedSubtasks = task.subtasks.map((s, i) => {
      if (i !== subtaskIdx) return s;
      return {
        ...s,
        ...(completed !== undefined ? { completed } : {}),
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(estimatedMinutes !== undefined ? { estimatedMinutes: Number(estimatedMinutes) } : {}),
      };
    });

    const taskUpdates = deriveTaskUpdates(updatedSubtasks, task, now);
    const updated = await TaskModel.findOneAndUpdate(
      { id, userId },
      { $set: taskUpdates },
      { new: true, lean: true }
    );

    const { _id, __v, ...cleaned } = updated;
    return res.json({ subtask: updatedSubtasks[subtaskIdx], task: cleaned });
  }

  // In-memory
  const task = db.getTaskById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const subtaskIdx = (task.subtasks || []).findIndex(s => s.id === subtaskId);
  if (subtaskIdx === -1) return res.status(404).json({ error: 'Subtask not found' });
  const updatedSubtasks = task.subtasks.map((s, i) => i !== subtaskIdx ? s : {
    ...s,
    ...(completed !== undefined ? { completed } : {}),
    ...(title !== undefined ? { title: String(title).trim() } : {}),
    ...(estimatedMinutes !== undefined ? { estimatedMinutes: Number(estimatedMinutes) } : {}),
  });
  const taskUpdates = deriveTaskUpdates(updatedSubtasks, task, now);
  const updated = db.updateTask(id, taskUpdates);
  return res.json({ subtask: updatedSubtasks[subtaskIdx], task: updated });
}

// ─── POST / — add a new subtask ───────────────────────────────────────────────
async function addSubtask(req, res) {
  const { id } = req.params;
  const { title, estimatedMinutes = 30 } = req.body;
  const userId = req.userId;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const newSubtask = {
    id: uuidv4(),
    title: String(title).trim(),
    estimatedMinutes: Math.max(1, Number(estimatedMinutes) || 30),
    scheduledSlot: null,
    completed: false,
  };

  const now = new Date().toISOString();

  if (isConnected()) {
    const task = await TaskModel.findOne({ id, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    const taskUpdates = deriveTaskUpdates(updatedSubtasks, task, now);
    const updated = await TaskModel.findOneAndUpdate(
      { id, userId },
      { $set: taskUpdates },
      { new: true, lean: true }
    );
    const { _id, __v, ...cleaned } = updated;
    return res.status(201).json({ subtask: newSubtask, task: cleaned });
  }

  const task = db.getTaskById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const updatedSubtasks = [...(task.subtasks || []), newSubtask];
  const taskUpdates = deriveTaskUpdates(updatedSubtasks, task, now);
  const updated = db.updateTask(id, taskUpdates);
  return res.status(201).json({ subtask: newSubtask, task: updated });
}

// ─── DELETE /:subtaskId — remove a subtask ────────────────────────────────────
async function deleteSubtask(req, res) {
  const { id, subtaskId } = req.params;
  const userId = req.userId;
  const now = new Date().toISOString();

  if (isConnected()) {
    const task = await TaskModel.findOne({ id, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updatedSubtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
    const taskUpdates = deriveTaskUpdates(updatedSubtasks, task, now);
    const updated = await TaskModel.findOneAndUpdate(
      { id, userId },
      { $set: taskUpdates },
      { new: true, lean: true }
    );
    const { _id, __v, ...cleaned } = updated;
    return res.json({ task: cleaned });
  }

  const task = db.getTaskById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const updatedSubtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
  const taskUpdates = deriveTaskUpdates(updatedSubtasks, task, now);
  const updated = db.updateTask(id, taskUpdates);
  return res.json({ task: updated });
}

module.exports = { updateSubtask, addSubtask, deleteSubtask };
