/**
 * scripts/get-google-token.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE-TIME SCRIPT. Run this once from your terminal to authorize Velocity to
 * use YOUR Google account for Calendar + Gmail on behalf of all demo sessions.
 *
 * After running, paste the printed refresh_token into backend/.env as
 * GOOGLE_REFRESH_TOKEN=...
 *
 * The refresh token never expires unless you revoke it at:
 *   https://myaccount.google.com/permissions
 *
 * Usage:
 *   node scripts/get-google-token.js
 *
 * Requirements:
 *   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env
 *   - You must have enabled the Gmail API and Google Calendar API in your
 *     Google Cloud Console project
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { google } = require('googleapis');
const http       = require('http');
const url        = require('url');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:9876/callback';

if (!CLIENT_ID || CLIENT_ID === 'your_google_client_id_here') {
  console.error('\n❌  GOOGLE_CLIENT_ID is not set in backend/.env');
  console.error('    Create OAuth2 credentials at https://console.cloud.google.com/apis/credentials');
  console.error('    Make sure http://localhost:9876/callback is in your Authorized Redirect URIs\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope:       SCOPES,
  prompt:      'consent', // forces refresh_token to be returned every time
});

console.log('\n' + '─'.repeat(60));
console.log('  Velocity — One-Time Google Auth Setup');
console.log('─'.repeat(60));
console.log('\n  1. Open this URL in your browser:\n');
console.log('  ' + authUrl);
console.log('\n  2. Log in with the Google account you want Velocity to use.');
console.log('  3. Grant all requested permissions.');
console.log('  4. You will be redirected to localhost — the token will be');
console.log('     printed here automatically.\n');

// Spin up a one-shot local server to catch the redirect
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== '/callback') {
    res.end('Waiting for Google redirect...');
    return;
  }

  const code = parsed.query.code;
  if (!code) {
    res.end('No code received. Try again.');
    server.close();
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.end(`
      <html><body style="font-family:monospace;padding:32px;background:#0a0c10;color:#4ade80">
        <h2>✅ Authorization successful!</h2>
        <p>Close this tab and check your terminal.</p>
      </body></html>
    `);

    console.log('\n' + '─'.repeat(60));
    console.log('  ✅  Authorization successful!');
    console.log('─'.repeat(60));
    console.log('\n  Add these lines to backend/.env:\n');
    console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (tokens.access_token) {
      console.log(`  # access_token (auto-refreshed, optional to store):`);
      console.log(`  # ${tokens.access_token.slice(0, 40)}...`);
    }
    console.log('\n  Done! Restart your backend server after updating .env.\n');
    console.log('─'.repeat(60) + '\n');

    server.close();
    process.exit(0);
  } catch (err) {
    res.end('Token exchange failed: ' + err.message);
    console.error('\n❌  Token exchange failed:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(9876, () => {
  console.log('  Listening for Google redirect on http://localhost:9876/callback ...\n');
});
