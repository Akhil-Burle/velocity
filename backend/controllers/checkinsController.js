/**
 * controllers/checkinsController.js
 * POST /api/checkins
 */

const { db, createCheckIn, calcRequiredHoursPerDay, derivePaceStatus } = require('../utils/dataModel');
const { computePaceMetrics } = require('../utils/paceEngine');
const TaskModel = require('../models/Task');
const CheckInModel = require('../models/CheckIn');
const { isConnected } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

async function handleCheckIn(req, res) {
  const { taskId, selfReportText, selfReportPercent } = req.body;
  const userId = req.userId;

  if (!taskId) return res.status(400).json({ error: 'Missing taskId' });
  if (selfReportPercent === undefined || selfReportPercent === null)
    return res.status(400).json({ error: 'Missing selfReportPercent' });
  if (typeof selfReportPercent !== 'number' || selfReportPercent < 0 || selfReportPercent > 100)
    return res.status(400).json({ error: 'selfReportPercent must be 0–100' });

  if (isConnected()) {
    const task = await TaskModel.findOne({ id: taskId, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const subtasks = task.subtasks || [];
    const actualPercent = subtasks.length > 0
      ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
      : task.completionPercent || 0;

    const gap = Math.abs(selfReportPercent - actualPercent);
    const trustScore = Math.max(0, Math.round(100 - gap * 2));

    let mode = 'normal';
    let driftExplanation = task.driftExplanation;

    if (gap > 30) {
      mode = 'critical';
      driftExplanation = `⚠️ Trust gap detected: you reported ${selfReportPercent}% but actual subtask completion is ${actualPercent}%. Velocity requires immediate recalibration.`;
    } else if (gap > 15) {
      mode = 'amber';
      driftExplanation = `Self-reported ${selfReportPercent}% vs ${actualPercent}% actual. Minor discrepancy — check in again after your next session.`;
    }

    // Recalculate pace with updated completion — honest, engine-driven status
    const currentSparkline = Array.isArray(task.sparkline) ? task.sparkline : [];
    const newSparkline = [...currentSparkline, { value: selfReportPercent, timestamp: new Date().toISOString() }].slice(-30);
    const projected = { ...task, completionPercent: selfReportPercent, sparkline: newSparkline };
    const paceMetrics = computePaceMetrics(projected);
    const newHours = paceMetrics.requiredHoursPerDay;
    const newStatus = gap > 30 ? 'RED' : paceMetrics.status;

    // Store check-in
    const checkin = {
      userId, id: uuidv4(), taskId,
      timestamp: new Date().toISOString(),
      selfReportText: selfReportText || '', selfReportPercent, trustScore,
    };
    await CheckInModel.create(checkin);

    // Update task with recalculated pace + sparkline
    const updatedTask = await TaskModel.findOneAndUpdate(
      { id: taskId, userId },
      {
        $set: {
          mode, status: newStatus,
          completionPercent: selfReportPercent,
          currentPaceHoursPerDay: newHours,
          sparkline: newSparkline,
          driftExplanation,
          updatedAt: new Date().toISOString(),
        },
      },
      { new: true, lean: true }
    );

    const { _id, __v, ...cleaned } = updatedTask;
    console.log(`[CheckIn] Task ${taskId}: self=${selfReportPercent}% actual=${actualPercent}% gap=${gap}% trust=${trustScore} mode=${mode} status=${newStatus} drift=${paceMetrics.drift}`);
    return res.json({ task: { ...cleaned, paceMetrics }, trustScore, mode });
  }

  // In-memory fallback
  const task = db.getTaskById(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const subtasks = task.subtasks || [];
  const actualPercent = subtasks.length > 0
    ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
    : task.completionPercent || 0;
  const gap = Math.abs(selfReportPercent - actualPercent);
  const trustScore = Math.max(0, Math.round(100 - gap * 2));
  let mode = 'normal', driftExplanation = task.driftExplanation;
  if (gap > 30) { mode = 'critical'; driftExplanation = `⚠️ Trust gap: reported ${selfReportPercent}% vs actual ${actualPercent}%.`; }
  else if (gap > 15) { mode = 'amber'; }

  const currentSparkline = Array.isArray(task.sparkline) ? task.sparkline : [];
  const newSparkline = [...currentSparkline, { value: selfReportPercent, timestamp: new Date().toISOString() }].slice(-30);
  const paceMetrics = computePaceMetrics({ ...task, completionPercent: selfReportPercent, sparkline: newSparkline });
  const newStatus = gap > 30 ? 'RED' : paceMetrics.status;

  const checkin = createCheckIn({ taskId, selfReportText, selfReportPercent, trustScore });
  db.addCheckIn(checkin);
  const updatedTask = db.updateTask(taskId, {
    mode, status: newStatus, completionPercent: selfReportPercent,
    currentPaceHoursPerDay: paceMetrics.requiredHoursPerDay, sparkline: newSparkline, driftExplanation,
  });
  return res.json({ task: { ...updatedTask, paceMetrics }, trustScore, mode });
}

module.exports = { handleCheckIn };
