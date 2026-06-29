/**
 * services/googleCalendarService.js
 *
 * Two-way Google Calendar sync.
 * - READ  : getBlockedSlotsForDate, fetchRealCalendarEvents
 * - WRITE : createCalendarEvent, deleteCalendarEvent, syncVelocityToCalendar
 *
 * Works in Google OAuth test mode — only the authorized test user needs
 * to have gone through the OAuth flow once to generate a refresh token.
 * Store that token as GOOGLE_REFRESH_TOKEN in backend/.env.
 *
 * All functions fail silently (return safe defaults) when credentials
 * are not configured, so demo mode is never broken.
 */

const { google } = (() => {
  try { return require('googleapis'); }
  catch { return { google: null }; }
})();

// ── Auth helper — reused by every function ────────────────────────────────────

function getAuthClient() {
  if (!google) return null;
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) return null;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

/**
 * Returns true only when all required OAuth env vars are present.
 */
function isCalendarConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

// ── READ ──────────────────────────────────────────────────────────────────────

/**
 * Returns blocked time slots from Google Calendar for a given date.
 * Each slot: { startMins, endMins, title, gcalId }
 */
async function getBlockedSlotsForDate(dateStr) {
  const auth = getAuthClient();
  if (!auth) return [];

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const start = new Date(dateStr + 'T00:00:00');
    const end   = new Date(dateStr + 'T23:59:59');

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items || [])
      .filter(e => e.start?.dateTime && e.end?.dateTime)
      .map(e => {
        const s = new Date(e.start.dateTime);
        const f = new Date(e.end.dateTime);
        return {
          startMins: s.getHours() * 60 + s.getMinutes(),
          endMins:   f.getHours() * 60 + f.getMinutes(),
          title:     e.summary || 'Meeting',
          gcalId:    e.id,
        };
      });
  } catch (err) {
    console.warn('[GoogleCalendar] getBlockedSlotsForDate failed:', err.message);
    return [];
  }
}

/**
 * Fetches real calendar events for the next N days.
 */
async function fetchRealCalendarEvents(days = 14) {
  const auth = getAuthClient();
  if (!auth) return [];

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const start = new Date();
    const end   = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const pad = n => String(n).padStart(2, '0');

    return (res.data.items || [])
      .filter(e => e.start?.dateTime && e.end?.dateTime)
      .map(e => {
        const s = new Date(e.start.dateTime);
        const f = new Date(e.end.dateTime);
        return {
          id:           `gcal-${e.id}`,
          gcalId:       e.id,
          type:         'meeting',
          taskId:       null,
          taskName:     e.summary || 'Meeting',
          subtaskTitle: e.summary || 'Meeting',
          date:         s.toISOString().slice(0, 10),
          startTime:    `${pad(s.getHours())}:${pad(s.getMinutes())}`,
          endTime:      `${pad(f.getHours())}:${pad(f.getMinutes())}`,
          status:       'GREEN',
          taskType:     'OTHER',
          isRealCalendarEvent: true,
          task:         null,
        };
      });
  } catch (err) {
    console.warn('[GoogleCalendar] fetchRealCalendarEvents failed:', err.message);
    return [];
  }
}

// ── WRITE ─────────────────────────────────────────────────────────────────────

/**
 * Creates a Google Calendar event for a Velocity task block.
 * Returns the created event's Google Calendar ID, or null on failure.
 *
 * @param {object} block  { taskName, date, startTime, endTime, status, cognitiveWeight }
 * @returns {string|null} gcalEventId
 */
async function createCalendarEvent(block) {
  const auth = getAuthClient();
  if (!auth) return null;

  try {
    const calendar = google.calendar({ version: 'v3', auth });

    // Build RFC3339 datetimes in local time (use UTC offset of the server)
    const tzOffset = -new Date().getTimezoneOffset(); // minutes ahead of UTC
    const tzSign   = tzOffset >= 0 ? '+' : '-';
    const tzHH     = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMM     = String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const tz       = `${tzSign}${tzHH}:${tzMM}`;

    const startDT = `${block.date}T${block.startTime}:00${tz}`;
    const endDT   = `${block.date}T${block.endTime}:00${tz}`;

    // Colour: red=11 for RED, yellow=5 for AMBER, green=2 for GREEN
    const colorId = block.status === 'RED' ? '11' : block.status === 'AMBER' ? '5' : '2';

    const energyLabel = block.cognitiveWeight === 'HIGH' ? '🧠 Deep Focus' : '⚡ Quick Win';

    const event = {
      summary:     `⚡ ${block.taskName}`,
      description: `Scheduled by Velocity\nType: ${energyLabel}\nStatus: ${block.status}\n\nOpen Velocity to update progress.`,
      start:       { dateTime: startDT },
      end:         { dateTime: endDT },
      colorId,
      // Tag with Velocity source so we can identify & delete our own events
      extendedProperties: {
        private: {
          velocityTaskId: block.taskId || '',
          velocitySync:   'true',
        },
      },
    };

    const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
    console.log(`[GoogleCalendar] Created event: ${res.data.id} — ${block.taskName}`);
    return res.data.id;
  } catch (err) {
    console.warn('[GoogleCalendar] createCalendarEvent failed:', err.message);
    return null;
  }
}

/**
 * Deletes a Google Calendar event by its gcalEventId.
 * Silent no-op if event not found or already deleted.
 */
async function deleteCalendarEvent(gcalEventId) {
  const auth = getAuthClient();
  if (!auth || !gcalEventId) return;

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: gcalEventId });
    console.log(`[GoogleCalendar] Deleted event: ${gcalEventId}`);
  } catch (err) {
    // 410 Gone = already deleted — not an error
    if (err.code !== 410 && err.status !== 410) {
      console.warn('[GoogleCalendar] deleteCalendarEvent failed:', err.message);
    }
  }
}

/**
 * Full two-way sync:
 * 1. Delete all existing Velocity-owned events in the next 14 days
 * 2. Push fresh events from the Velocity schedule
 *
 * Returns { created, deleted, errors }
 */
async function syncVelocityToCalendar(velocityEvents) {
  const auth = getAuthClient();
  if (!auth) return { created: 0, deleted: 0, errors: ['Not configured'] };

  const calendar = google.calendar({ version: 'v3', auth });
  let deleted = 0;
  let created = 0;
  const errors = [];

  try {
    // Step 1: find and delete all previously synced Velocity events (next 14 days)
    const start = new Date();
    const end   = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const existing = await calendar.events.list({
      calendarId:    'primary',
      timeMin:       start.toISOString(),
      timeMax:       end.toISOString(),
      singleEvents:  true,
      maxResults:    200,
      privateExtendedProperty: 'velocitySync=true',
    });

    for (const ev of (existing.data.items || [])) {
      await deleteCalendarEvent(ev.id);
      deleted++;
    }
  } catch (err) {
    errors.push(`Delete sweep failed: ${err.message}`);
  }

  // Step 2: create fresh events for all focus blocks
  for (const ev of velocityEvents.filter(e => e.type === 'focus' && e.taskId)) {
    const gcalId = await createCalendarEvent(ev);
    if (gcalId) created++;
    else errors.push(`Failed to create: ${ev.taskName}`);
  }

  return { created, deleted, errors };
}

module.exports = {
  isCalendarConfigured,
  getAuthClient,
  getBlockedSlotsForDate,
  fetchRealCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  syncVelocityToCalendar,
};
