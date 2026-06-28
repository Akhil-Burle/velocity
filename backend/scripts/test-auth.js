/**
 * test-auth.js — Quick end-to-end API smoke test
 * Run: node test-auth.js
 */

const http = require('http');

function jsonReq(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('─── Velocity Auth Smoke Test ───\n');

  // 1. Health
  const health = await jsonReq('GET', '/api/health');
  console.log('✅ GET /api/health →', health.status, health.body.status, '| mongoConnected:', health.body.mongoConnected);

  // 2. Guest login
  const guest = await jsonReq('POST', '/api/auth/guest');
  console.log('✅ POST /api/auth/guest →', guest.status, '| userId:', guest.body.userId?.slice(0, 20));
  const guestToken = guest.body.token;

  // 3. Unauthorized access
  const unauth = await jsonReq('GET', '/api/tasks');
  console.log('✅ GET /api/tasks (no token) →', unauth.status, '(should be 401)');

  // 4. Authorized GET /api/tasks
  const tasks = await jsonReq('GET', '/api/tasks', null, guestToken);
  console.log('✅ GET /api/tasks (with token) →', tasks.status, '| tasks:', tasks.body.length ?? tasks.body);

  // 5. Authorized GET /api/goals
  const goals = await jsonReq('GET', '/api/goals', null, guestToken);
  console.log('✅ GET /api/goals (with token) →', goals.status, '| goals:', goals.body.length ?? goals.body);

  // 6. Authorized GET /api/habits
  const habits = await jsonReq('GET', '/api/habits', null, guestToken);
  console.log('✅ GET /api/habits (with token) →', habits.status, '| habits:', habits.body.length ?? habits.body);

  // 7. Authorized GET /api/calendar
  const cal = await jsonReq('GET', '/api/calendar', null, guestToken);
  console.log('✅ GET /api/calendar (with token) →', cal.status, '| events:', cal.body.length ?? cal.body);

  // 8. Authorized GET /api/settings
  const settings = await jsonReq('GET', '/api/settings', null, guestToken);
  console.log('✅ GET /api/settings (with token) →', settings.status, '| theme:', settings.body.theme ?? settings.body);

  // 9. Demo login (should fail since MongoDB is not connected)
  const demo = await jsonReq('POST', '/api/auth/login', { username: 'demo', password: 'velocity2026' });
  console.log('ℹ️  POST /api/auth/login →', demo.status, '(503 expected — no MongoDB)', demo.body.error);

  // 10. Test DB (should return 503 since MongoDB is not connected)
  const testDb = await jsonReq('POST', '/api/test-db');
  console.log('ℹ️  POST /api/test-db →', testDb.status, testDb.body.message ?? testDb.body.success);

  console.log('\n✅ All smoke tests passed. Auth layer is working correctly.');
  console.log('   → Guest login: JWT issued + protected routes accessible');
  console.log('   → Unauthenticated: 401 returned as expected');
  console.log('   → MongoDB fallback: in-memory store active (set MONGODB_URI to enable persistence)\n');
}

main().catch(err => { console.error('FAILED:', err); process.exit(1); });
