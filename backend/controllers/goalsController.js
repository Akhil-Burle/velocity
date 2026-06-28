/**
 * controllers/goalsController.js
 * GET /api/goals, POST /api/goals, DELETE /api/goals/:id
 */

const { db, createGoal } = require('../utils/dataModel');
const GoalModel = require('../models/Goal');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');

// Compute a goal's real progress from the completion of its linked tasks.
function computeGoalProgress(goal, tasks) {
  const ids = Array.isArray(goal.linkedTaskIds) ? goal.linkedTaskIds : [];
  if (ids.length === 0) return goal.progressPercent || 0;
  const linked = tasks.filter(t => ids.includes(t.id));
  if (linked.length === 0) return goal.progressPercent || 0;
  const sum = linked.reduce((s, t) => s + (t.status === 'COMPLETE' ? 100 : (t.completionPercent || 0)), 0);
  return Math.round(sum / linked.length);
}

async function getAllGoals(req, res) {
  const userId = req.userId;
  if (isConnected()) {
    const [goals, tasks] = await Promise.all([
      GoalModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      TaskModel.find({ userId }).lean(),
    ]);
    return res.json(goals.map(({ _id, __v, ...g }) => ({ ...g, progressPercent: computeGoalProgress(g, tasks) })));
  }
  const tasks = db.getAllTasks();
  return res.json(db.getAllGoals().map(g => ({ ...g, progressPercent: computeGoalProgress(g, tasks) })));
}

async function createGoalHandler(req, res) {
  const { title, description, targetDate, linkedTaskIds } = req.body;
  const userId = req.userId;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const goal = createGoal({ title: title.trim(), description: description || '', targetDate, linkedTaskIds });

  if (isConnected()) {
    const doc = await GoalModel.create({ ...goal, userId });
    const { _id, __v, ...cleaned } = doc.toObject();
    console.log(`[Goals] Created: ${goal.id} — "${goal.title}"`);
    return res.status(201).json(cleaned);
  }

  db.addGoal(goal);
  return res.status(201).json(goal);
}

async function deleteGoalHandler(req, res) {
  const { id } = req.params;
  const userId = req.userId;

  if (isConnected()) {
    const result = await GoalModel.deleteOne({ id, userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Goal not found' });
    return res.json({ success: true });
  }

  const ok = db.deleteGoal(id);
  if (!ok) return res.status(404).json({ error: 'Goal not found' });
  return res.json({ success: true });
}

module.exports = { getAllGoals, createGoalHandler, deleteGoalHandler };
