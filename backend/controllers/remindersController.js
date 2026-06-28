/**
 * controllers/remindersController.js
 * GET /api/reminders/active — scoped to req.userId
 */

const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const HabitModel = require('../models/Habit');
const CheckInModel = require('../models/CheckIn');
const SettingsModel = require('../models/Settings');
const { isConnected } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

async function getActiveReminders(req, res) {
  const userId = req.userId;
  const now = Date.now();
  const reminders = [];

  let tasks, habits, checkins, workEndH;

  if (isConnected()) {
    const [t, h, c, settings] = await Promise.all([
      TaskModel.find({ userId }).lean(),
      HabitModel.find({ userId }).lean(),
      CheckInModel.find({ userId }).lean(),
      SettingsModel.findOne({ userId }).lean(),
    ]);
    tasks = t; habits = h; checkins = c;
    workEndH = settings ? parseInt(settings.preferredWorkEnd.split(':')[0], 10) : 21;
  } else {
    tasks = db.getAllTasks();
    habits = db.getAllHabits();
    checkins = db.getAllCheckIns();
    const settings = db.getSettings();
    workEndH = parseInt(settings.preferredWorkEnd.split(':')[0], 10);
  }

  // 1. Deadline reminders
  for (const task of tasks) {
    if (task.isRescheduled || task.status === 'COMPLETE') continue;
    const hoursLeft = (new Date(task.deadline).getTime() - now) / 3600000;
    if (hoursLeft < 0) {
      reminders.push({ id: uuidv4(), type: 'deadline', urgency: 'high', title: 'Overdue Task', body: `"${task.taskName}" is overdue. Consider negotiating or completing now.`, relatedId: task.id, createdAt: new Date().toISOString() });
    } else if (hoursLeft < 24) {
      reminders.push({ id: uuidv4(), type: 'deadline', urgency: 'high', title: 'Due in < 24 hours', body: `"${task.taskName}" is due in ${Math.round(hoursLeft)}h. Focus now.`, relatedId: task.id, createdAt: new Date().toISOString() });
    } else if (hoursLeft < 48 && task.status === 'RED') {
      reminders.push({ id: uuidv4(), type: 'deadline', urgency: 'medium', title: 'Critical Task Tomorrow', body: `"${task.taskName}" (Critical) is due in ${Math.round(hoursLeft)}h.`, relatedId: task.id, createdAt: new Date().toISOString() });
    }
  }

  // 2. Check-in reminders
  for (const task of tasks) {
    if (task.isRescheduled || task.status === 'COMPLETE') continue;
    const taskCheckins = checkins.filter(c => c.taskId === task.id);
    if (taskCheckins.length === 0) continue;
    const lastCheckin = Math.max(...taskCheckins.map(c => new Date(c.timestamp).getTime()));
    const hoursSince = (now - lastCheckin) / 3600000;
    if (hoursSince > 24) {
      reminders.push({ id: uuidv4(), type: 'checkin', urgency: 'low', title: 'Check-in Due', body: `No update on "${task.taskName}" in ${Math.round(hoursSince)}h. Log your progress.`, relatedId: task.id, createdAt: new Date().toISOString() });
    }
  }

  // 3. Habit reminders
  const today = new Date().toISOString().slice(0, 10);
  const currentH = new Date().getHours();
  for (const habit of habits) {
    const todayDone = habit.history.find(e => e.date === today && e.completed);
    if (!todayDone && currentH >= workEndH - 2) {
      reminders.push({ id: uuidv4(), type: 'habit', urgency: 'low', title: 'Habit Reminder', body: `Don't break your streak! Complete "${habit.title}" before the day ends.`, relatedId: habit.id, createdAt: new Date().toISOString() });
    }
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  reminders.sort((a, b) => (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2));

  console.log(`[Reminders] ${reminders.length} active reminders for user ${userId}`);
  return res.json(reminders.slice(0, 10));
}

module.exports = { getActiveReminders };
