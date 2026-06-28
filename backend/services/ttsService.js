/**
 * services/ttsService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Cloud Text-to-Speech integration for the OmniBar voice output.
 *
 * When the user speaks a command via the OmniBar mic, the AI response is
 * synthesized and returned as base64 audio. The frontend plays it back
 * for a fully hands-free experience.
 *
 * Falls back gracefully — if Cloud TTS is unavailable, returns null and the
 * frontend uses the browser's built-in Web Speech API speechSynthesis instead.
 *
 * Auth: uses GOOGLE_APPLICATION_CREDENTIALS (service account key file path)
 * OR the OAuth2 refresh token already in .env.
 * For the hackathon demo we use the REST API with an API key (GOOGLE_TTS_API_KEY
 * or falls back to GEMINI_API_KEY which is a general Google AI key).
 */

const https = require('https');

/**
 * Synthesize speech using Google Cloud TTS REST API.
 * Returns base64-encoded MP3 audio, or null if unavailable.
 *
 * @param {string} text  — text to speak (keep under 300 chars for snappy response)
 * @param {string} voice — voice name (default: en-US-Journey-F, a natural WaveNet voice)
 * @returns {Promise<string|null>}  — base64 MP3 or null
 */
async function synthesizeSpeech(text, voice = 'en-US-Journey-F') {
  // Prefer a dedicated TTS key; fall back to the general API key
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const body = JSON.stringify({
    input: { text: text.slice(0, 500) }, // cap length
    voice: {
      languageCode: 'en-US',
      name: voice,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.05,
      pitch: 0,
    },
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'texttospeech.googleapis.com',
      path:     `/v1/text:synthesize?key=${apiKey}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.audioContent) {
            resolve(parsed.audioContent); // base64 MP3
          } else {
            console.warn('[TTS] No audioContent in response:', parsed.error?.message);
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[TTS] Request failed (non-fatal):', err.message);
      resolve(null);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Is TTS available? (used by health check and Tech Stack page)
 */
function isTTSConfigured() {
  return !!(process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY);
}

module.exports = { synthesizeSpeech, isTTSConfigured };
