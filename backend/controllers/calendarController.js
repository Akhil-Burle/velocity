/**
 * controllers/calendarController.js
 * GET /api/calendar
 *
 * Uses the SAME packing logic as dayplanController so the Calendar and
 * Command Day are always in sync.  For today, the order and block times
 * match Command Day exactly.  For future days, each task is projected
 * forward day-by-day until it either fits or its deadline passes.
 *
 * Each returned event carries the full task object so the frontend can
 * open TaskDetailModal without a second fetch.
 */

const { db }          = require('../utils/dataModel');
const TaskModel       = require('../models/Task');
const SettingsModel   = require('../models/Settings');
const { isConnected } = require('../db/connection');
const { isCalendarConfigured, syncVelocityToCalendar } = require('../services/googleCalendarService');

// ── helpers (mirrors dayplanController) ──────────────────────────────────────

const STATUS_RANK = { RED: 0, AMBER: 1, GREEN: 2, COMPLETE: 3, failed: 4 };

function hhmmToMins(hhmm, fallback) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return fallback;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function minsToHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function blockMinutesFor(task) {
  if (task.estimatedDuration && task.estimatedDuration > 0)
    return Math.max(30, Math.min(150, Math.round(task.estimatedDuration)));
  const hrs = task.currentPaceHoursPerDay || 1;
  return Math.max(30, Math.min(150, Math.round(hrs * 60)));
}
function energyFor(task) {
  if (task.energyLevel) return task.energyLevel;
  return task.cognitiveWeight === 'HIGH' ? 'Deep Focus' : 'Quick Wins';
}

/**
 * Build calendar events that match Command Day's ordering.
 *
 * For each day from today up to HORIZON days ahead we run the same
 * urgency sort as getDayPlan and pack tasks into the work window.
 * A task that fits gets one event on that date and is removed from
 * the pool for subsequent days.  Tasks that can't fit before their
 * deadline are skipped (same behaviour as Command Day: they appear
 * as "unscheduled" in the summary).
 *
 * Recovery buffers (every 2 focus sessions) are included as events
 * with type "buffer" so the calendar can optionally render them.
 */
function buildSyncedEvents(tasks, startMins, endMins, horizonDays = 14) {
  const today = new Date().toISOString().slice(0, 10);
  const events = [];

  // Sort once: urgency (RED→GREEN) then nearest deadline — same as getDayPlan
  const ordered = [...tasks].sort((a, b) => {
    const r = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (r !== 0) return r;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  // Track which tasks have been scheduled and how much capacity is left per day
  const scheduled   = new Set();
  // dayUsed: date → minutes used so far
  const dayUsed     = {};

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const dateStr = addDays(today, dayOffset);
    if (!dayUsed[dateStr]) dayUsed[dateStr] = 0;

    let cursor         = startMins + dayUsed[dateStr];
    let focusSinceBreak = 0;

    for (const task of ordered) {
      if (scheduled.has(task.id)) continue;

      // Skip tasks whose deadline has passed
      if (new Date(task.deadline) < new Date(dateStr + 'T00:00:00')) continue;

      const dur = blockMinutesFor(task);

      // Recovery buffer
      if (focusSinceBreak >= 2 && cursor + 20 + dur <= endMins) {
        events.push({
          id:            `buffer-${dateStr}-${cursor}`,
          type:          'buffer',
          taskId:        null,
          taskName:      'Recovery buffer',
          subtaskTitle:  'Recovery buffer',
          date:          dateStr,
          startTime:     minsToHHMM(cursor),
          endTime:       minsToHHMM(cursor + 20),
          status:        'GREEN',
          taskType:      'OTHER',
          durationMins:  20,
          energyLevel:   'Brain-Dead',
          task:          null,
        });
        cursor += 20;
        focusSinceBreak = 0;
      }

      if (cursor + dur > endMins) break; // day full

      events.push({
        id:             `cal-${task.id}-${dateStr}`,
        type:           'focus',
        taskId:         task.id,
        taskName:       task.taskName,
        // For CalendarEvent compat — use task name as the "subtask title"
        subtaskTitle:   task.taskName,
        subtaskId:      null,
        date:           dateStr,
        startTime:      minsToHHMM(cursor),
        endTime:        minsToHHMM(cursor + dur),
        status:         task.status,
        taskType:       task.taskType,
        durationMins:   dur,
        energyLevel:    energyFor(task),
        completionPercent: task.completionPercent || 0,
        deadline:       task.deadline,
        cognitiveWeight: task.cognitiveWeight,
        // Full task object for TaskDetailModal
        task,
      });

      cursor += dur;
      focusSinceBreak += 1;
      scheduled.add(task.id);
    }

    dayUsed[dateStr] = cursor - startMins;
  }

  return events;
}

async function getCalendarEvents(req, res) {
  try {
    const userId = req.userId;

    let tasks, settings;
    if (isConnected()) {
      const [taskDocs, settingsDoc] = await Promise.all([
        TaskModel.find({ userId, status: { $nin: ['COMPLETE', 'failed'] }, isRescheduled: { $ne: true } }).lean(),
        SettingsModel.findOne({ userId }).lean(),
      ]);
      tasks    = taskDocs;
      settings = settingsDoc || { preferredWorkStart: '09:00', preferredWorkEnd: '21:00' };
    } else {
      tasks    = db.getAllTasks().filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
      settings = db.getSettings() || { preferredWorkStart: '09:00', preferredWorkEnd: '21:00' };
    }

    const startMins = hhmmToMins(settings.preferredWorkStart, 9 * 60);
    const endMins   = hhmmToMins(settings.preferredWorkEnd, 21 * 60);

    const events = buildSyncedEvents(tasks, startMins, endMins, 14);

    return res.json(events);
  } catch (err) {
    console.error('[Calendar] getCalendarEvents failed:', err.message);
    return res.status(500).json({ error: 'Failed to build calendar events', message: err.message });
  }
}

/**
 * POST /api/calendar/sync
 * Pushes the full Velocity 14-day schedule to Google Calendar.
 * Deletes previously synced Velocity events first (clean slate).
 * No-ops with a clear message when GOOGLE_REFRESH_TOKEN is not set.
 */
async function pushSyncToGoogleCalendar(req, res) {
  if (!isCalendarConfigured()) {
    return res.status(200).json({
      success: false,
      message: 'Google Calendar not configured. Add GOOGLE_REFRESH_TOKEN to backend/.env.',
      created: 0, deleted: 0,
    });
  }

  try {
    const userId = req.userId;

    let tasks, settings;
    if (isConnected()) {
      const [taskDocs, settingsDoc] = await Promise.all([
        TaskModel.find({ userId, status: { $nin: ['COMPLETE', 'failed'] }, isRescheduled: { $ne: true } }).lean(),
        SettingsModel.findOne({ userId }).lean(),
      ]);
      tasks    = taskDocs;
      settings = settingsDoc || { preferredWorkStart: '09:00', preferredWorkEnd: '21:00' };
    } else {
      tasks    = db.getAllTasks().filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
      settings = db.getSettings() || { preferredWorkStart: '09:00', preferredWorkEnd: '21:00' };
    }

    const startMins = hhmmToMins(settings.preferredWorkStart, 9 * 60);
    const endMins   = hhmmToMins(settings.preferredWorkEnd, 21 * 60);
    const events    = buildSyncedEvents(tasks, startMins, endMins, 14);

    const result = await syncVelocityToCalendar(events);

    return res.json({
      success: result.errors.length === 0,
      message: `Synced ${result.created} events to Google Calendar (${result.deleted} old events removed).`,
      ...result,
    });
  } catch (err) {
    console.error('[Calendar] pushSyncToGoogleCalendar failed:', err.message);
    return res.status(500).json({ error: 'Sync failed', message: err.message });
  }
}

module.exports = { getCalendarEvents, pushSyncToGoogleCalendar };
