/**
 * controllers/rescheduleController.js
 * POST /api/reschedule — Smart slot-packing reschedule (real conflict resolution)
 * Uses the same packSlots helper as calendarController for consistency.
 * Also persists the new scheduledSlot back to each subtask document.
 */

const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const SettingsModel = require('../models/Settings');
const { isConnected } = require('../db/connection');
const { packSlots } = require('./calendarController');
const { appendAgentLog } = require('./agentLogController');

async function handleReschedule(req, res) {
  const userId = req.userId;

  if (isConnected()) {
    const [tasks, settingsDoc] = await Promise.all([
      TaskModel.find({ userId, status: { $ne: 'COMPLETE' } }).lean(),
      SettingsModel.findOne({ userId }).lean(),
    ]);
    const settings = settingsDoc || { preferredWorkStart: '09:00', preferredWorkEnd: '21:00' };
    const events = packSlots(tasks, settings.preferredWorkStart, settings.preferredWorkEnd);

    // Persist scheduledSlot back onto each subtask
    // Group events by taskId
    const byTask = {};
    for (const ev of events) {
      if (!byTask[ev.taskId]) byTask[ev.taskId] = [];
      byTask[ev.taskId].push(ev);
    }

    for (const [taskId, taskEvents] of Object.entries(byTask)) {
      const task = tasks.find(t => t.id === taskId);
      if (!task) continue;
      const updatedSubtasks = task.subtasks.map(sub => {
        const ev = taskEvents.find(e => e.subtaskId === sub.id);
        return ev ? { ...sub, scheduledSlot: `${ev.date}T${ev.startTime}` } : sub;
      });
      await TaskModel.findOneAndUpdate(
        { id: taskId, userId },
        { $set: { subtasks: updatedSubtasks, isRescheduled: true, updatedAt: new Date().toISOString() } }
      );
    }

    console.log(`[Reschedule] Packed ${events.length} subtask slots for user ${userId}`);

    // Write agent log entry
    await appendAgentLog(userId, {
      featureKey: 'reschedule',
      title: `Smart-packed ${events.length} subtask slots across calendar`,
      reasoning: `AI analyzed all active tasks and subtask durations, then auto-packed every subtask into your work hours (${settings.preferredWorkStart}–${settings.preferredWorkEnd}) respecting deadlines and available capacity.`,
      outcome: `${events.length} subtask blocks scheduled. Calendar updated without manual drag-and-drop.`,
      autonomy: 'autonomous',
      undoable: false,
      metadata: { slotsScheduled: events.length, workStart: settings.preferredWorkStart, workEnd: settings.preferredWorkEnd },
    }).catch(() => {});

    return res.json({
      success: true,
      rescheduled: events.length,
      events,
      message: `Packed ${events.length} subtask blocks into your work hours (${settings.preferredWorkStart}–${settings.preferredWorkEnd}).`,
    });
  }

  // In-memory fallback
  const tasks = db.getAllTasks().filter(t => !t.isRescheduled && t.status !== 'COMPLETE');
  const settings = db.getSettings();
  const events = packSlots(tasks, settings.preferredWorkStart, settings.preferredWorkEnd);
  return res.json({
    success: true,
    rescheduled: events.length,
    events,
    message: `Packed ${events.length} subtask blocks into your work hours (${settings.preferredWorkStart}–${settings.preferredWorkEnd}).`,
  });
}

module.exports = { handleReschedule };
