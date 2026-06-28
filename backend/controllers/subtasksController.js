/**
 * controllers/subtasksController.js
 * PATCH /api/tasks/:id/subtasks/:subtaskId
 */

const { db, derivePaceStatus } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');

async function updateSubtask(req, res) {
  const { id, subtaskId } = req.params;
  const { completed } = req.body;
  const userId = req.userId;

  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'Invalid body', message: '"completed" must be a boolean' });
  }

  if (isConnected()) {
    const task = await TaskModel.findOne({ id, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const subtaskIdx = (task.subtasks || []).findIndex(s => s.id === subtaskId);
    if (subtaskIdx === -1) return res.status(404).json({ error: 'Subtask not found' });

    const updatedSubtasks = task.subtasks.map((s, i) =>
      i === subtaskIdx ? { ...s, completed } : s
    );
    const completedCount = updatedSubtasks.filter(s => s.completed).length;
    const completionPercent = Math.round((completedCount / updatedSubtasks.length) * 100);
    const sparkline = [...(task.sparkline || []).slice(-6), { value: completionPercent }];

    await TaskModel.findOneAndUpdate(
      { id, userId },
      { $set: { subtasks: updatedSubtasks, completionPercent, sparkline, updatedAt: new Date().toISOString() } }
    );

    const updatedSubtask = updatedSubtasks[subtaskIdx];
    console.log(`[Subtasks] ${subtaskId} in task ${id} marked ${completed ? 'complete' : 'incomplete'}`);
    return res.json(updatedSubtask);
  }

  // In-memory fallback
  const task = db.getTaskById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const subtaskIdx = (task.subtasks || []).findIndex(s => s.id === subtaskId);
  if (subtaskIdx === -1) return res.status(404).json({ error: 'Subtask not found' });
  const updatedSubtasks = [...task.subtasks];
  updatedSubtasks[subtaskIdx] = { ...updatedSubtasks[subtaskIdx], completed };
  const completedCount = updatedSubtasks.filter(s => s.completed).length;
  const completionPercent = Math.round((completedCount / updatedSubtasks.length) * 100);
  const sparkline = [...(task.sparkline || []).slice(-6), { value: completionPercent }];
  db.updateTask(id, { subtasks: updatedSubtasks, completionPercent, sparkline });
  return res.json(updatedSubtasks[subtaskIdx]);
}

module.exports = { updateSubtask };
