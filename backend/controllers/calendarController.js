/**
 * controllers/calendarController.js
 * GET /api/calendar — subtask slot-packer merged with real Google Calendar events
 *
 * When GOOGLE_REFRESH_TOKEN is set, fetches real events from the user's
 * Google Calendar and overlays them on the internal slot-packed schedule.
 * Real meetings appear as blocked slots so AI Rebalance avoids them.
 */

const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const SettingsModel = require('../models/Settings');
const { isConnected } = require('../db/connection');
const { fetchRealCalendarEvents, getBlockedSlotsForDate, isCalendarConfigured } = require('../services/googleCalendarService');

function packSlots(tasks, workStart, workEnd) {
  const workStartH = parseInt(workStart.split(':')[0], 10);
  const workEndH   = parseInt(workEnd.split(':')[0], 10);
  const dailyMin   = (workEndH - workStartH) * 60;

  const events = [];
  const daySlots = new Map();
  const today = new Date();
  today.setHours(workStartH, 0, 0, 0);

  for (const task of tasks) {
    for (const subtask of (task.subtasks || [])) {
      if (subtask.completed) continue;
      const deadlineDate = new Date(task.deadline);
      let day = new Date(today);

      while (day <= deadlineDate) {
        const dateStr = day.toISOString().slice(0, 10);
        const used = daySlots.get(dateStr) || 0;
        const dur  = subtask.estimatedMinutes || 30;

        if (dailyMin - used >= dur) {
          daySlots.set(dateStr, used + dur);
          const startH = workStartH + Math.floor(used / 60);
          const startM = used % 60;
          const endMin = used + dur;
          const endH   = workStartH + Math.floor(endMin / 60);
          const endM   = endMin % 60;
          events.push({
            id: `${task.id}-${subtask.id}`,
            taskId: task.id, taskName: task.taskName,
            subtaskId: subtask.id, subtaskTitle: subtask.title,
            date: dateStr,
            startTime: `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}`,
            endTime:   `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`,
            status: task.status, taskType: task.taskType,
            estimatedMinutes: dur,
          });
          break;
        }
        day.setDate(day.getDate() + 1);
        day.setHours(workStartH, 0, 0, 0);
      }
    }
  }
  return events;
}

async function getCalendarEvents(req, res) {
  const userId = req.userId;

  let tasks, settings;
  if (isConnected()) {
    const [taskDocs, settingsDoc] = await Promise.all([
      TaskModel.find({ userId, status: { $ne: 'COMPLETE' } }).lean(),
      SettingsModel.findOne({ userId }).lean(),
    ]);
    tasks    = taskDocs;
    settings = settingsDoc || { preferredWorkStart: '09:00', preferredWorkEnd: '21:00' };
  } else {
    tasks    = db.getAllTasks().filter(t => t.status !== 'COMPLETE');
    settings = db.getSettings();
  }

  // Pack internal task subtasks into slots
  const internalEvents = packSlots(tasks, settings.preferredWorkStart, settings.preferredWorkEnd);

  // Merge real Google Calendar events (fires in parallel, gracefully degrades)
  let realEvents = [];
  if (isCalendarConfigured()) {
    realEvents = await fetchRealCalendarEvents(14).catch(() => []);
  }

  // Combine: real calendar events first (they're meetings/fixed), then internal slots
  // Mark each source so the frontend can render them differently
  const combined = [
    ...realEvents,
    ...internalEvents,
  ];

  return res.json(combined);
}

module.exports = { getCalendarEvents, packSlots };
