/**
 * services/googleCalendarService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Google Calendar API integration.
 *
 * Uses the server-owned OAuth refresh token (GOOGLE_REFRESH_TOKEN) to read
 * the demo account's real calendar events. These events feed directly into:
 *   - Command Day / getDayPlan  — real meetings block time in the schedule
 *   - AI Rebalance              — avoids scheduling focus blocks over real events
 *   - Smart Reschedule          — packs subtasks around real calendar gaps
 *
 * Auth model: single server-owned refresh token. All demo sessions share the
 * same Google account — standard for hackathon demos. The refresh token
 * auto-renews access tokens via googleapis OAuth2 client.
 *
 * Scopes required (already granted via get-google-token.js):
 *   https://www.googleapis.com/auth/calendar.readonly
 */

const { google } = require('googleapis');

let _oauth2Client = null;
let _calendarApi  = null;

function getCalendarClient() {
  if (_calendarApi) return _calendarApi;

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || clientId === 'your_google_client_id_here' ||
      !clientSecret || !refreshToken) {
    return null; // Google Calendar not configured — fall back to internal data
  }

  _oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/agent/oauth/callback'
  );
  _oauth2Client.setCredentials({ refresh_token: refreshToken });

  _calendarApi = google.calendar({ version: 'v3', auth: _oauth2Client });
  console.log('[CalendarService] Google Calendar API client initialized');
  return _calendarApi;
}

/**
 * Fetch real calendar events for the next N days from the user's primary calendar.
 * Returns an array of simplified event objects compatible with the existing
 * CalendarEvent shape used by Command Day and the calendar view.
 *
 * @param {number} daysAhead  — how many days forward to fetch (default 7)
 * @returns {Promise<Array>}  — simplified event objects, or [] if unavailable
 */
async function fetchRealCalendarEvents(daysAhead = 7) {
  const calendar = getCalendarClient();
  if (!calendar) {
    console.log('[CalendarService] No credentials — skipping real calendar fetch');
    return [];
  }

  try {
    const now = new Date();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin:    now.toISOString(),
      timeMax:    timeMax.toISOString(),
      singleEvents: true,
      orderBy:   'startTime',
      maxResults: 50,
      fields:    'items(id,summary,start,end,status,eventType)',
    });

    const items = response.data.items || [];

    // Map to our internal CalendarEvent shape (meeting/blocking type)
    return items
      .filter(ev => ev.status !== 'cancelled')
      .map(ev => {
        const start = ev.start?.dateTime || ev.start?.date;
        const end   = ev.end?.dateTime   || ev.end?.date;
        const startDate = new Date(start);
        const endDate   = new Date(end);

        // All-day events have no time component — skip for scheduling purposes
        const isAllDay = !ev.start?.dateTime;

        return {
          id:            `gcal-${ev.id}`,
          taskId:        null,
          taskName:      ev.summary || 'Untitled Event',
          subtaskTitle:  '',
          date:          startDate.toISOString().slice(0, 10),
          startTime:     isAllDay ? '00:00' : `${String(startDate.getHours()).padStart(2,'0')}:${String(startDate.getMinutes()).padStart(2,'0')}`,
          endTime:       isAllDay ? '23:59' : `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`,
          status:        'GREEN',
          taskType:      'OTHER',
          estimatedMinutes: isAllDay ? 0 : Math.round((endDate - startDate) / 60000),
          isRealCalendarEvent: true,
          isAllDay,
          source:        'google_calendar',
        };
      })
      .filter(ev => !ev.isAllDay); // exclude all-day events from time blocking
  } catch (err) {
    console.warn('[CalendarService] Failed to fetch real calendar events (non-fatal):', err.message);
    return [];
  }
}

/**
 * Get blocked time ranges from real calendar events on a specific date.
 * Used by Command Day and Rebalance to avoid scheduling over real meetings.
 *
 * @param {string} dateStr  — 'YYYY-MM-DD'
 * @returns {Array<{startMins: number, endMins: number, title: string}>}
 */
async function getBlockedSlotsForDate(dateStr) {
  const events = await fetchRealCalendarEvents(14);
  return events
    .filter(ev => ev.date === dateStr && !ev.isAllDay)
    .map(ev => {
      const [sh, sm] = ev.startTime.split(':').map(Number);
      const [eh, em] = ev.endTime.split(':').map(Number);
      return {
        startMins: sh * 60 + sm,
        endMins:   eh * 60 + em,
        title:     ev.taskName,
      };
    });
}

/**
 * Is Google Calendar connected and working?
 */
function isCalendarConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

module.exports = { fetchRealCalendarEvents, getBlockedSlotsForDate, isCalendarConfigured };
