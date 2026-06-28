/**
 * controllers/braindumpController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/braindump  (requires JWT auth → req.userId)
 * Parses brain dump text via Gemini, stores extracted tasks in MongoDB
 * (scoped to req.userId), falls back to in-memory if DB not connected.
 */

const { extractTasksFromBrainDump, extractTasksFromImage } = require('../services/geminiService');
const { db, createTask } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');

async function handleBrainDump(req, res) {
  const { text, imageData, mimeType } = req.body;
  const userId = req.userId;

  // ── Image path (Chaos Scanner) ────────────────────────────────────────────
  if (imageData) {
    if (typeof imageData !== 'string' || imageData.length < 100) {
      return res.status(400).json({ error: 'Invalid imageData', message: 'imageData must be a base64-encoded image string' });
    }
    const imageMimeType = mimeType || 'image/jpeg';

    try {
      console.log(`[BrainDump] Extracting tasks from image for user ${userId} (${imageMimeType}, ${Math.round(imageData.length / 1024)}KB)`);
      // Strip data URL prefix if present
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const rawTasks = await extractTasksFromImage(base64Data, imageMimeType);

      if (!rawTasks || rawTasks.length === 0) {
        return res.status(422).json({
          error: 'No tasks extracted from image',
          message: 'Could not identify any tasks in the image. Try a clearer photo.',
        });
      }

      const createdTasks = rawTasks.map(rawTask => createTask({ ...rawTask, rawInput: `[Image: ${imageMimeType}]` }));

      if (isConnected()) {
        await TaskModel.insertMany(createdTasks.map(t => ({ ...t, userId })));
      } else {
        createdTasks.forEach(t => db.addTask(t));
      }

      console.log(`[BrainDump] Created ${createdTasks.length} tasks from image for user ${userId}`);
      return res.status(201).json(createdTasks);
    } catch (err) {
      console.error('[BrainDump] Image extraction error:', err.message);
      if (err.message.includes('API_KEY') || err.message.includes('GEMINI_API_KEY')) {
        return res.status(503).json({ error: 'AI service unavailable', message: 'Gemini API key is not configured.' });
      }
      return res.status(500).json({ error: 'Image processing failed', message: err.message });
    }
  }

  // ── Text path (original brain dump) ───────────────────────────────────────
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing or empty text field',
      message: 'Please provide a non-empty text string or imageData in the request body',
    });
  }

  if (text.trim().length < 5) {
    return res.status(400).json({
      error: 'Text too short',
      message: 'Brain dump text must be at least 5 characters long',
    });
  }

  try {
    console.log(`[BrainDump] Extracting tasks for user ${userId}: "${text.slice(0, 80)}..."`);
    const rawTasks = await extractTasksFromBrainDump(text.trim());

    if (!rawTasks || rawTasks.length === 0) {
      return res.status(422).json({
        error: 'No tasks extracted',
        message: 'Could not identify any concrete tasks from the provided text. Try being more specific.',
      });
    }

    const createdTasks = rawTasks.map(rawTask => createTask({ ...rawTask, rawInput: text.trim() }));

    if (isConnected()) {
      const docsToInsert = createdTasks.map(t => ({ ...t, userId }));
      await TaskModel.insertMany(docsToInsert);
    } else {
      createdTasks.forEach(t => db.addTask(t));
    }

    console.log(`[BrainDump] Created ${createdTasks.length} tasks for user ${userId}`);
    return res.status(201).json(createdTasks);

  } catch (err) {
    console.error('[BrainDump] Error:', err.message);
    if (err.message.includes('API_KEY') || err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'AI service unavailable', message: 'Gemini API key is not configured.' });
    }
    if (err.message.includes('quota') || err.message.includes('rate')) {
      return res.status(429).json({ error: 'AI rate limit exceeded', message: 'Please wait a moment and try again.' });
    }
    return res.status(500).json({ error: 'Brain dump processing failed', message: err.message });
  }
}

module.exports = { handleBrainDump };
