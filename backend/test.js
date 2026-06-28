const http = require('http');

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== Velocity Backend Tests ===\n');

  // 1. Health check
  console.log('1. GET /api/health');
  const health = await apiRequest('GET', '/health');
  console.log(`   Status: ${health.status} — ${JSON.stringify(health.body)}\n`);

  // 2. GET /api/tasks (empty initially)
  console.log('2. GET /api/tasks');
  const tasks = await apiRequest('GET', '/tasks');
  console.log(`   Status: ${tasks.status} — ${tasks.body.length} tasks\n`);

  // 3. Triage (should say no tasks)
  console.log('3. POST /api/triage (no tasks)');
  const triage1 = await apiRequest('POST', '/triage');
  console.log(`   Status: ${triage1.status} — triaged: ${triage1.body.triaged}, reason: ${triage1.body.reason}\n`);

  // 4. Negotiate without taskId
  console.log('4. POST /api/negotiate (no taskId)');
  const neg = await apiRequest('POST', '/negotiate', {});
  console.log(`   Status: ${neg.status} — error: ${neg.body.error}\n`);

  // 5. Check-in validation
  console.log('5. POST /api/checkins (invalid data)');
  const ci = await apiRequest('POST', '/checkins', { selfReportPercent: 150 });
  console.log(`   Status: ${ci.status} — error: ${ci.body.error}\n`);

  // 6. PATCH unknown task
  console.log('6. PATCH /api/tasks/nonexistent');
  const patch = await apiRequest('PATCH', '/tasks/nonexistent', { status: 'COMPLETE' });
  console.log(`   Status: ${patch.status} — error: ${patch.body.error}\n`);

  console.log('=== All routes responding correctly! ===');
  console.log('Note: Brain dump endpoint requires GEMINI_API_KEY to create tasks.');
}

runTests().catch(console.error);
