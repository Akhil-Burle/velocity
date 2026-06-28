/**
 * controllers/negotiateController.js
 * POST /api/negotiate — scoped to req.userId
 */

const { generateNegotiateMessage } = require('../services/geminiService');
const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');
const { appendAgentLog } = require('./agentLogController');

async function handleNegotiate(req, res) {
  const { taskId } = req.body;
  const userId = req.userId;

  if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

  let task;
  if (isConnected()) {
    task = await TaskModel.findOne({ id: taskId, userId }).lean();
  } else {
    task = db.getTaskById(taskId);
  }

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.selfOwned || !task.recipientName) {
    return res.status(400).json({ error: 'Self-owned task', message: 'Negotiate mode only works for tasks with a recipient.' });
  }

  if (task.negotiatedDraft && task.negotiatedDraft.trim().length > 0) {
    return res.json({ message: task.negotiatedDraft });
  }

  try {
    const message = await generateNegotiateMessage(task);

    if (isConnected()) {
      await TaskModel.findOneAndUpdate({ id: taskId, userId }, { $set: { negotiatedDraft: message } });
    } else {
      db.updateTask(taskId, { negotiatedDraft: message });
    }

    // Write agent log entry
    await appendAgentLog(userId, {
      featureKey: 'negotiate',
      title: `Drafted extension request for "${task.taskName}"`,
      reasoning: `Task is ${task.completionPercent || 0}% complete with deadline pressure. Gemini drafted a professional message to ${task.recipientName} requesting an extension.`,
      outcome: `Draft ready — queued for send via one-tap or countdown window.`,
      autonomy: 'assisted',
      undoable: false,
      relatedTaskId: taskId,
      relatedTaskName: task.taskName,
      metadata: { recipient: task.recipientName, completionPercent: task.completionPercent },
    }).catch(() => {});

    return res.json({ message });
  } catch (err) {
    const fallback = generateFallbackNegotiateMessage(task);
    if (isConnected()) {
      await TaskModel.findOneAndUpdate({ id: taskId, userId }, { $set: { negotiatedDraft: fallback } });
    } else {
      db.updateTask(taskId, { negotiatedDraft: fallback });
    }
    return res.json({ message: fallback, warning: 'Generated using fallback template (AI unavailable)' });
  }
}

function generateFallbackNegotiateMessage(task) {
  const recipient = task.recipientName || 'Professor';
  const completion = task.completionPercent ? `I have completed approximately ${task.completionPercent}% of the work.` : '';
  const isAcademic = /prof|professor|dr\.|instructor/i.test(recipient);
  const ask = isAcademic
    ? 'I am writing to respectfully request a brief extension on this assignment.'
    : 'I wanted to reach out about potentially extending the deadline.';
  return `Dear ${recipient},\n\n${ask} I am currently working on "${task.taskName}" and have encountered some unexpected complexity. ${completion}\n\nI am committed to delivering quality work and believe an additional 24-48 hours would allow me to complete it properly. Thank you for your understanding.\n\nBest regards,\nAlex`;
}

module.exports = { handleNegotiate };
