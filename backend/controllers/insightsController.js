/**
 * controllers/insightsController.js
 * POST /api/insights/generate — scoped to req.userId
 */

const { db, calcRequiredHoursPerDay } = require('../utils/dataModel');
const { computePaceMetrics } = require('../utils/paceEngine');
const TaskModel = require('../models/Task');
const CheckInModel = require('../models/CheckIn');
const { isConnected } = require('../db/connection');
const { generate } = require('../services/geminiService');

async function generateInsights(req, res) {
  const userId = req.userId;

  let tasks, checkins;
  if (isConnected()) {
    [tasks, checkins] = await Promise.all([
      TaskModel.find({ userId }).lean(),
      CheckInModel.find({ userId }).lean(),
    ]);
  } else {
    tasks = db.getAllTasks();
    checkins = db.getAllCheckIns();
  }

  const completedTasks = tasks.filter(t => t.status === 'COMPLETE');
  const failedTasks    = tasks.filter(t => t.status === 'failed');
  const activeTasks    = tasks.filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
  const totalHours = checkins.reduce((s, c) => s + (c.selfReportPercent / 100) * 3, 0);
  const onTimeRate = tasks.length > 0 ? `${Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100)}%` : 'N/A';
  // Velocity score = blend of how many active tasks are on pace + their avg steadiness.
  const avgVelocityScore = activeTasks.length > 0
    ? Math.round(activeTasks.reduce((s, t) => {
        const m = computePaceMetrics(t);
        const onPaceScore = m.onPace ? 100 : m.willFinishOnTime ? 65 : 30;
        return s + (onPaceScore * 0.6 + m.consistency * 0.4);
      }, 0) / activeTasks.length)
    : 72;

  const typeGroups = {};
  for (const t of tasks) {
    if (!typeGroups[t.taskType]) typeGroups[t.taskType] = [];
    typeGroups[t.taskType].push(t);
  }
  // Pace Calibration — real data: planned focus hours vs realized pace consistency.
  const WEIGHT_HOURS = { HIGH: 5, MEDIUM: 3, LOW: 1 };
  const calibration = Object.entries(typeGroups).map(([type, list]) => {
    const planned = list.reduce((s, t) => s + (WEIGHT_HOURS[t.cognitiveWeight] || 3), 0) / list.length;
    // Realized effort scales inversely with how steadily the user actually moved.
    const avgConsistency = list.reduce((s, t) => s + computePaceMetrics(t).consistency, 0) / list.length;
    const factor = avgConsistency >= 50 ? (100 / Math.max(avgConsistency, 1)) : 1.6;
    const actual = planned * factor;
    const accuracy = `${Math.round(Math.max(0, Math.min(100, avgConsistency)))}%`;
    const rec = actual > planned * 1.1
      ? `Pad ${type} estimates by ~${Math.round((factor - 1) * 100)}%`
      : 'Estimates are well-calibrated';
    return {
      taskType: type,
      estimated: Math.round(planned * 10) / 10,
      actual: Math.round(actual * 10) / 10,
      accuracy,
      recommendation: rec,
    };
  });

  let summary = '';
  let recommendations = [];

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const prompt = `You are a productivity coach. Based on these metrics, write a 2-3 sentence productivity summary and 3 specific recommendations.\n\nTasks total: ${tasks.length}\nCompleted: ${completedTasks.length}\nActive: ${activeTasks.length}\nFailed (deliberate): ${failedTasks.length}${failedTasks.length > 0 ? ` (${failedTasks.map(t => `"${t.taskName}"`).join(', ')})` : ''}\nOn-time rate: ${onTimeRate}\nAvg velocity score: ${avgVelocityScore}/100\nTask types: ${Object.keys(typeGroups).join(', ')}\nCheck-in count: ${checkins.length}\n\n${failedTasks.length > 0 ? 'IMPORTANT: Some tasks were deliberately failed via the Ultimatum feature — acknowledge this honestly if relevant, do not pretend everything is fine.' : ''}\n\nReturn JSON: { "summary": "...", "recommendations": ["...", "...", "..."] }\nNo markdown, just raw JSON.`;
      const text = (await generate(prompt)).replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      const parsed = JSON.parse(text);
      summary = parsed.summary || '';
      recommendations = parsed.recommendations || [];
    } catch (e) {
      console.warn('[Insights] Gemini failed, using fallback:', e.message);
    }
  }

  if (!summary) {
    summary = `You have completed ${completedTasks.length} of ${tasks.length} tasks with an on-time rate of ${onTimeRate}. Your average velocity score is ${avgVelocityScore}/100.${failedTasks.length > 0 ? ` ${failedTasks.length} task${failedTasks.length > 1 ? 's were' : ' was'} deliberately failed via the Ultimatum — consider whether the tradeoffs made sense.` : ''} ${activeTasks.filter(t => t.status === 'RED').length > 0 ? 'Several tasks are in critical status and need immediate attention.' : 'Your workload is well-managed — keep the momentum going.'}`;
    recommendations = [
      'Focus on RED-status tasks first each morning to prevent deadline drift.',
      'Use Hot-Start scaffolds on high-cognitive tasks to reduce activation friction.',
      'Run Triage weekly to proactively defer low-priority work before it creates pressure.',
    ];
  }

  return res.json({
    summary, recommendations, calibration,
    stats: { tasksCompleted: completedTasks.length, avgVelocityScore, onTimeRate, totalHoursLogged: Math.round(totalHours * 10) / 10 },
  });
}

// ─── Velocity DNA — productivity fingerprint ─────────────────────────────────
//
// Six radar axes (0–100) derived from real task + check-in telemetry, plus a
// derived archetype, peak hours, and type affinity. This is the screenshot-worthy
// centerpiece of the upgraded Insights tab.

function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

async function getDNA(req, res) {
  try {
    const userId = req.userId;
    let tasks, checkins;
    if (isConnected()) {
      [tasks, checkins] = await Promise.all([
        TaskModel.find({ userId }).lean(),
        CheckInModel.find({ userId }).lean(),
      ]);
    } else {
      tasks = db.getAllTasks();
      checkins = db.getAllCheckIns();
    }

    const completed = tasks.filter(t => t.status === 'COMPLETE');
    const active = tasks.filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
    const highTasks = tasks.filter(t => t.cognitiveWeight === 'HIGH');

    // Focus — share of deep (HIGH) work + their completion momentum
    const focus = highTasks.length > 0
      ? clamp((highTasks.reduce((s, t) => s + (t.completionPercent || 0), 0) / highTasks.length) * 0.6 + (highTasks.length / Math.max(tasks.length, 1)) * 40)
      : 58;

    // Consistency — check-in cadence (more, recent check-ins = higher)
    const consistency = clamp(Math.min(checkins.length, 20) * 4 + 20);

    // Recovery — inverse of overload: how many active tasks are not RED
    const greenish = active.filter(t => t.status !== 'RED').length;
    const recovery = active.length > 0 ? clamp((greenish / active.length) * 100) : 70;

    // Throughput — completion rate
    const throughput = tasks.length > 0 ? clamp((completed.length / tasks.length) * 100) : 40;

    // Calibration — avg trust score from check-ins
    const calibration = checkins.length > 0
      ? clamp(checkins.reduce((s, c) => s + (c.trustScore ?? 100), 0) / checkins.length)
      : 88;

    // Momentum — average direction of task sparklines (rising = higher)
    let momentum = 60;
    const trends = tasks.map(t => {
      const sp = Array.isArray(t.sparkline) ? t.sparkline : [];
      if (sp.length < 2) return 0;
      return sp[sp.length - 1].value - sp[0].value;
    });
    if (trends.length) momentum = clamp(60 + (trends.reduce((a, b) => a + b, 0) / trends.length) * 1.2);

    const axes = [
      { axis: 'Focus',       value: focus },
      { axis: 'Consistency', value: consistency },
      { axis: 'Recovery',    value: recovery },
      { axis: 'Throughput',  value: throughput },
      { axis: 'Calibration', value: calibration },
      { axis: 'Momentum',    value: momentum },
    ];

    // Archetype from the two strongest axes
    const sorted = [...axes].sort((a, b) => b.value - a.value);
    const top = sorted[0].axis, second = sorted[1].axis;
    const ARCHETYPES = {
      'Focus+Throughput': { name: 'The Sprinter', blurb: 'You attack deep work and ship fast. Guard against burnout on long arcs.' },
      'Focus+Calibration': { name: 'The Surgeon', blurb: 'Precise, deep, and honest about progress. A rare combination.' },
      'Consistency+Recovery': { name: 'The Marathoner', blurb: 'Steady cadence, sustainable pace. You win the long game.' },
      'Throughput+Momentum': { name: 'The Closer', blurb: 'You finish what you start and accelerate into deadlines.' },
      'Calibration+Consistency': { name: 'The Strategist', blurb: 'Reliable forecasting plus rhythm. You plan and you deliver.' },
    };
    const key1 = `${top}+${second}`, key2 = `${second}+${top}`;
    const archetypeObj = ARCHETYPES[key1] || ARCHETYPES[key2] || { name: 'The Operator', blurb: `Your edge is ${top.toLowerCase()} backed by ${second.toLowerCase()}.` };

    // Peak hours — most common check-in hour bucket (fallback to a sensible window)
    let peakHours = '9–11 AM';
    if (checkins.length > 0) {
      const buckets = {};
      checkins.forEach(c => {
        const h = new Date(c.timestamp).getHours();
        const band = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
        buckets[band] = (buckets[band] || 0) + 1;
      });
      const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0];
      peakHours = top === 'morning' ? '9–11 AM' : top === 'afternoon' ? '1–3 PM' : '7–9 PM';
    }

    // Type affinity — fastest vs slowest task type by completion
    const typeStats = {};
    tasks.forEach(t => {
      if (!typeStats[t.taskType]) typeStats[t.taskType] = { sum: 0, n: 0 };
      typeStats[t.taskType].sum += t.completionPercent || 0;
      typeStats[t.taskType].n += 1;
    });
    const typeRanked = Object.entries(typeStats)
      .map(([type, s]) => ({ type, avg: s.sum / s.n }))
      .sort((a, b) => b.avg - a.avg);
    const strongestType = typeRanked[0]?.type || 'CODE';
    const weakestType = typeRanked.length > 1 ? typeRanked[typeRanked.length - 1].type : 'WRITING';

    const overall = clamp(axes.reduce((s, a) => s + a.value, 0) / axes.length);

    return res.json({
      axes,
      overall,
      archetype: archetypeObj.name,
      archetypeBlurb: archetypeObj.blurb,
      peakHours,
      strongestType,
      weakestType,
      sampleSize: { tasks: tasks.length, checkins: checkins.length },
    });
  } catch (err) {
    console.error('[Insights] getDNA failed:', err.message);
    return res.status(500).json({ error: 'Failed to compute DNA', message: err.message });
  }
}

// ─── Tomorrow Pre-Brief — nightly planning ritual ────────────────────────────
async function getPrebrief(req, res) {
  try {
    const userId = req.userId;
    let tasks;
    if (isConnected()) tasks = await TaskModel.find({ userId }).lean();
    else tasks = db.getAllTasks();

    const active = (tasks || []).filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Tasks live or due by tomorrow, sorted by urgency
    const STATUS_RANK = { RED: 0, AMBER: 1, GREEN: 2 };
    const relevant = [...active].sort((a, b) => {
      const r = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      if (r !== 0) return r;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const requiredHours = Math.round(relevant.reduce((s, t) => s + (t.currentPaceHoursPerDay || 0), 0) * 10) / 10;
    const firstDeadline = relevant[0]?.deadline || null;
    const recommendedStart = requiredHours >= 6 ? '07:00' : requiredHours >= 4 ? '08:30' : '09:30';
    const confidence = Math.max(40, Math.min(95, 100 - Math.round((requiredHours / 8) * 45)));

    const topBlocks = relevant.slice(0, 3).map(t => ({
      taskName: t.taskName, status: t.status, hours: t.currentPaceHoursPerDay,
      deadline: t.deadline, cognitiveWeight: t.cognitiveWeight,
    }));

    let briefing = '';
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && relevant.length > 0) {
      try {
        const list = relevant.slice(0, 4).map(t => `${t.taskName} (${t.cognitiveWeight} weight, ${t.status}, ~${t.currentPaceHoursPerDay}h/day)`).join('; ');
        const prompt = `You are a calm, sharp planning coach writing a short evening pre-brief for tomorrow. 2-3 sentences, second person, concrete. ${relevant.length} tasks, ${requiredHours}h of focused work required, recommended start ${recommendedStart}. Tasks: ${list}. No greeting fluff beyond one short opener.`;
        briefing = await generate(prompt);
      } catch (e) {
        console.warn('[Insights] prebrief Gemini failed:', e.message);
      }
    }
    if (!briefing) {
      briefing = relevant.length === 0
        ? 'Tomorrow is clear of active deadlines. Use the open runway to get ahead on a high-weight task or bank some recovery.'
        : `Tomorrow: ${relevant.length} task${relevant.length > 1 ? 's' : ''}, about ${requiredHours}h of focused work. ${relevant.filter(t => t.status === 'RED').length > 0 ? `"${relevant[0].taskName}" is critical — open with it before anything else.` : `Lead with "${relevant[0].taskName}" while your focus is freshest.`} Recommended start: ${recommendedStart}.`;
    }

    return res.json({
      date: tomorrowStr,
      taskCount: relevant.length,
      requiredHours,
      firstDeadline,
      recommendedStart,
      confidence,
      briefing,
      blocks: topBlocks,
    });
  } catch (err) {
    console.error('[Insights] getPrebrief failed:', err.message);
    return res.status(500).json({ error: 'Failed to build pre-brief', message: err.message });
  }
}

// ─── Weekly Velocity Report — real metrics for the dashboard drawer ──────────
async function getWeeklyReport(req, res) {
  try {
    const userId = req.userId;
    const GamificationModel = require('../models/Gamification');
    const { computePaceMetrics } = require('../utils/paceEngine');

    let tasks, checkins, gam;
    if (isConnected()) {
      const CheckInModel = require('../models/CheckIn');
      [tasks, checkins, gam] = await Promise.all([
        TaskModel.find({ userId }).lean(),
        CheckInModel.find({ userId }).lean(),
        GamificationModel.findOne({ userId }).lean(),
      ]);
    } else {
      tasks = db.getAllTasks();
      checkins = db.getAllCheckIns();
      gam = db.getGamification();
    }

    const now = Date.now();
    const weekAgo = now - 7 * 86400000;

    const completed = tasks.filter(t => t.status === 'COMPLETE');
    const completedThisWeek = completed.filter(t => new Date(t.updatedAt || t.createdAt).getTime() >= weekAgo);
    const onTime = completedThisWeek.filter(t => {
      // completed on/before deadline
      return new Date(t.updatedAt || now).getTime() <= new Date(t.deadline).getTime() + 86400000;
    });
    const onTimeRate = completedThisWeek.length > 0
      ? Math.round((onTime.length / completedThisWeek.length) * 100) : 0;

    // Credits earned this week from the ledger
    const ledger = (gam?.ledger || []).filter(e => new Date(e.timestamp).getTime() >= weekAgo);
    const creditsThisWeek = ledger.reduce((s, e) => s + Math.max(0, e.amount), 0);

    // Daily credit breakdown (last 7 days, oldest → newest)
    const dailyCredits = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * 86400000;
      const d0 = new Date(dayStart); d0.setHours(0, 0, 0, 0);
      const d1 = d0.getTime() + 86400000;
      const amt = (gam?.ledger || []).filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t >= d0.getTime() && t < d1 && e.amount > 0;
      }).reduce((s, e) => s + e.amount, 0);
      return { label: d0.toLocaleDateString('en', { weekday: 'short' }), value: amt };
    });

    // Pace consistency across active tasks
    const active = tasks.filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
    const avgConsistency = active.length > 0
      ? Math.round(active.reduce((s, t) => s + computePaceMetrics(t).consistency, 0) / active.length)
      : 0;
    const onPaceCount = active.filter(t => computePaceMetrics(t).onPace).length;

    // Hours logged this week — derived from check-ins
    const checkinsThisWeek = checkins.filter(c => new Date(c.timestamp).getTime() >= weekAgo);
    const hoursLogged = Math.round(checkinsThisWeek.reduce((s, c) => s + (c.selfReportPercent / 100) * 2.5, 0) * 10) / 10;

    // Top earner this week
    const topTask = [...completedThisWeek].sort((a, b) => (b.creditValue || 0) - (a.creditValue || 0))[0] || null;

    return res.json({
      weekLabel: `Week of ${new Date(weekAgo).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
      creditsThisWeek,
      tasksCompleted: completedThisWeek.length,
      onTimeRate,
      avgConsistency,
      onPaceCount,
      activeCount: active.length,
      hoursLogged,
      dailyCredits,
      topTask: topTask ? { taskName: topTask.taskName, creditValue: topTask.creditValue || 0 } : null,
      currentStreak: gam?.streak || 0,
    });
  } catch (err) {
    console.error('[Insights] getWeeklyReport failed:', err.message);
    return res.status(500).json({ error: 'Failed to build weekly report', message: err.message });
  }
}

// ─── Results / Impact view — Phase 4 ─────────────────────────────────────────
async function getResults(req, res) {
  try {
    const userId = req.userId;
    const AgentLog = require('../models/AgentLog');

    let tasks, checkins, agentEntries;
    if (isConnected()) {
      const CheckInModelR = require('../models/CheckIn');
      [tasks, checkins, agentEntries] = await Promise.all([
        TaskModel.find({ userId }).lean(),
        CheckInModelR.find({ userId }).lean(),
        AgentLog.find({ userId }).lean(),
      ]);
    } else {
      tasks = db.getAllTasks();
      checkins = db.getAllCheckIns ? db.getAllCheckIns() : [];
      agentEntries = [];
    }

    const completed = tasks.filter(t => t.status === 'COMPLETE');
    const active    = tasks.filter(t => t.status !== 'COMPLETE' && t.status !== 'failed' && !t.isRescheduled);
    const onTime    = completed.filter(t => {
      const dl = new Date(t.deadline).getTime();
      const done = new Date(t.updatedAt || t.createdAt).getTime();
      return done <= dl + 86400000;
    });

    const autonomousSaves  = agentEntries.filter(e => e.autonomy === 'autonomous').length;
    const assistedActions  = agentEntries.filter(e => e.autonomy === 'assisted').length;
    const rebalances       = agentEntries.filter(e => e.featureKey === 'rebalance').length;
    const triages          = agentEntries.filter(e => e.featureKey === 'triage').length;
    const panicRescues     = agentEntries.filter(e => e.featureKey === 'panic').length;
    const negotiateDrafts  = agentEntries.filter(e => e.featureKey === 'negotiate').length;
    const driftAlerts      = agentEntries.filter(e => e.featureKey === 'drift_alert').length;
    const hoursSaved       = Math.round((triages * 2 + rebalances * 0.5 + panicRescues * 3) * 10) / 10;

    const recentActions = agentEntries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(e => ({ title: e.title, featureKey: e.featureKey, autonomy: e.autonomy, createdAt: e.createdAt }));

    return res.json({
      tasksCompleted: completed.length,
      onTimeDeliveries: onTime.length,
      onTimeRate: completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0,
      activeTasks: active.length,
      autonomousSaves,
      assistedActions,
      totalAgentActions: agentEntries.length,
      hoursSaved,
      rebalances,
      triages,
      panicRescues,
      negotiateDrafts,
      driftAlerts,
      checkIns: checkins.length,
      recentActions,
    });
  } catch (err) {
    console.error('[Insights] getResults failed:', err.message);
    return res.status(500).json({ error: 'Failed to compute results', message: err.message });
  }
}

module.exports = { generateInsights, getDNA, getPrebrief, getWeeklyReport, getResults };
