/**
 * routes/agent.js
 */
const express = require('express');
const router  = express.Router();
const {
  handlePanicScaffold,
  handleOmniParse,
  handleOmniExecute,
} = require('../controllers/agentController');
const { synthesizeSpeech, isTTSConfigured } = require('../services/ttsService');

router.post('/panic-scaffold', handlePanicScaffold);
router.post('/omni-parse',     handleOmniParse);

/**
 * POST /api/agent/omni-execute
 * Body: { intent, utterance, taskId, params, confidence }
 *
 * Called after countdown completes (or immediately on high confidence) to
 * actually run the classified action and write to the Activity Log.
 * This is the key execution endpoint — it calls the real triage/negotiate/
 * rebalance/create controllers directly, not duplicated logic.
 */
router.post('/omni-execute', handleOmniExecute);

/**
 * POST /api/agent/tts
 * Body: { text: string, voice?: string }
 * Returns: { audioBase64: string (MP3), fallback: boolean }
 *
 * Powers OmniBar voice output via Google Cloud Text-to-Speech.
 * Falls back gracefully (fallback: true) if TTS is unavailable.
 */
router.post('/tts', async (req, res) => {
  const { text, voice } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (!isTTSConfigured()) {
    return res.json({ audioBase64: null, fallback: true, reason: 'TTS not configured' });
  }

  try {
    const audioBase64 = await synthesizeSpeech(text.trim(), voice);
    return res.json({ audioBase64, fallback: !audioBase64 });
  } catch (err) {
    console.warn('[TTS route] Error:', err.message);
    return res.json({ audioBase64: null, fallback: true, reason: err.message });
  }
});

/**
 * GET /api/agent/tts/status
 * Returns whether TTS is configured (for frontend to decide to show TTS toggle).
 */
router.get('/tts/status', (_req, res) => {
  res.json({ configured: isTTSConfigured() });
});

module.exports = router;
