/**
 * controllers/habitsController.js
 * GET /api/habits, POST /api/habits, PATCH /api/habits/:id/checkin, DELETE /api/habits/:id
 */

const { db, createHabit } = require('../utils/dataModel');
const HabitModel = require('../models/Habit');
const { isConnected } = require('../db/connection');

async function getAllHabits(req, res) {
  const userId = req.userId;
  if (isConnected()) {
    const habits = await HabitModel.find({ userId }).sort({ createdAt: 1 }).lean();
    return res.json(habits.map(({ _id, __v, ...h }) => h));
  }
  return res.json(db.getAllHabits());
}

async function createHabitHandler(req, res) {
  const { title, frequency } = req.body;
  const userId = req.userId;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  const freq = frequency === 'weekly' ? 'weekly' : 'daily';
  const habit = createHabit({ title: title.trim(), frequency: freq });

  if (isConnected()) {
    const doc = await HabitModel.create({ ...habit, userId });
    const { _id, __v, ...cleaned } = doc.toObject();
    return res.status(201).json(cleaned);
  }
  db.addHabit(habit);
  return res.status(201).json(habit);
}

async function habitCheckIn(req, res) {
  const { id } = req.params;
  const { completed } = req.body;
  const userId = req.userId;

  if (isConnected()) {
    const habit = await HabitModel.findOne({ id, userId }).lean();
    if (!habit) return res.status(404).json({ error: 'Habit not found' });

    const today = new Date().toISOString().slice(0, 10);
    const newHistory = [...habit.history];
    const existingIdx = newHistory.findIndex(h => h.date === today);
    if (existingIdx >= 0) newHistory[existingIdx] = { date: today, completed: !!completed };
    else newHistory.push({ date: today, completed: !!completed });

    // Recalculate streak
    let streak = 0;
    const sorted = [...newHistory].sort((a, b) => b.date.localeCompare(a.date));
    for (const entry of sorted) { if (entry.completed) streak++; else break; }

    const updated = await HabitModel.findOneAndUpdate(
      { id, userId },
      { $set: { history: newHistory, streak } },
      { new: true, lean: true }
    );
    const { _id, __v, ...cleaned } = updated;
    return res.json(cleaned);
  }

  // In-memory fallback
  const habit = db.getHabitById(id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  const today = new Date().toISOString().slice(0, 10);
  const existingIdx = habit.history.findIndex(h => h.date === today);
  const newHistory = [...habit.history];
  if (existingIdx >= 0) newHistory[existingIdx] = { date: today, completed: !!completed };
  else newHistory.push({ date: today, completed: !!completed });
  let streak = 0;
  const sorted = [...newHistory].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of sorted) { if (entry.completed) streak++; else break; }
  return res.json(db.updateHabit(id, { history: newHistory, streak }));
}

async function deleteHabitHandler(req, res) {
  const { id } = req.params;
  const userId = req.userId;
  if (isConnected()) {
    const result = await HabitModel.deleteOne({ id, userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Habit not found' });
    return res.json({ success: true });
  }
  const ok = db.deleteHabit(id);
  if (!ok) return res.status(404).json({ error: 'Habit not found' });
  return res.json({ success: true });
}

module.exports = { getAllHabits, createHabitHandler, habitCheckIn, deleteHabitHandler };
