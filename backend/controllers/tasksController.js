/**
 * controllers/tasksController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET   /api/tasks            — all tasks (with live pace metrics attached)
 * PATCH /api/tasks/:id        — update any field (timestamps sparkline on progress)
 * POST  /api/tasks/:id/complete — mark complete + compute pace-differential credits
 *
 * DEMO_MODE: auto-seeds a rich, pace-realistic dashboard on first request.
 */

const { db, calcRequiredHoursPerDay, derivePaceStatus } = require('../utils/dataModel');
const { computePaceMetrics, computeTaskCredits, computeCompletionAward } = require('../utils/paceEngine');
const TaskModel = require('../models/Task');
const { isConnected } = require('../db/connection');

const IS_DEMO = process.env.DEMO_MODE === 'true';

// Attach live pace metrics + backfill credit value for any task being returned.
function decorateTask(task) {
  const creditValue = task.creditValue || computeTaskCredits(task);
  const paceMetrics = computePaceMetrics(task);
  return { ...task, creditValue, paceMetrics };
}

// ─── Demo seed data with realistic pace histories ─────────────────────────────

// Build a timestamped sparkline that tells a pace "story" between two dates.
function paceHistory(createdAt, currentPct, story) {
  const start = new Date(createdAt).getTime();
  const now = Date.now();
  const span = Math.max(now - start, 3600000);
  const points = 6;
  const out = [];
  for (let i = 0; i < points; i++) {
    const frac = i / (points - 1);
    const t = new Date(start + span * frac).toISOString();
    let v;
    if (story === 'steady')   v = currentPct * frac;
    else if (story === 'behind') v = currentPct * Math.pow(frac, 1.8);     // slow start
    else if (story === 'ahead')  v = currentPct * Math.pow(frac, 0.6);     // fast start
    else if (story === 'cramming') v = currentPct * (frac < 0.7 ? frac * 0.3 : (frac - 0.7) / 0.3 * 0.7 + 0.21);
    else v = currentPct * frac;
    out.push({ value: Math.round(Math.min(v, currentPct)), timestamp: t });
  }
  out[out.length - 1].value = currentPct;
  return out;
}

async function autoSeedIfEmpty(userId) {
  if (!IS_DEMO || !isConnected()) return;
  const count = await TaskModel.countDocuments({ userId });
  if (count > 0) return;

  const { v4: uuidv4 } = require('uuid');
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const daysFromNow = (n) => iso(now + n * 86400000);
  const daysAgo = (n) => iso(now - n * 86400000);
  const sub = (title, mins, done = false) => ({ id: uuidv4(), title, estimatedMinutes: mins, scheduledSlot: null, completed: done });

  function build(spec) {
    const createdAt = spec.createdAt;
    const task = {
      userId, id: uuidv4(),
      taskName: spec.taskName, deadline: spec.deadline,
      taskType: spec.taskType, cognitiveWeight: spec.cognitiveWeight,
      selfOwned: spec.selfOwned, recipientName: spec.recipientName || null,
      driftExplanation: spec.drift || '',
      hotStartContent: '', negotiatedDraft: '',
      completionPercent: spec.pct,
      sparkline: paceHistory(createdAt, spec.pct, spec.story),
      isRescheduled: false, rawInput: spec.taskName,
      subtasks: spec.subtasks || [],
      energyLevel: spec.energy || '', estimatedDuration: spec.duration || 60,
      mode: 'normal', createdAt, updatedAt: iso(now),
      creditsAwarded: spec.pct >= 100,
    };
    task.creditValue = computeTaskCredits(task);
    const m = computePaceMetrics(task);
    task.currentPaceHoursPerDay = m.requiredHoursPerDay;
    task.status = spec.pct >= 100 ? 'COMPLETE' : m.status;
    return task;
  }

  const tasks = [
    build({
      taskName: 'Build Auth Route — Express/JWT',
      createdAt: daysAgo(3), deadline: daysFromNow(0.9),
      taskType: 'CODE', cognitiveWeight: 'HIGH', selfOwned: true,
      pct: 15, story: 'behind', energy: 'Deep Focus', duration: 85,
      drift: 'Started slow — only 15% done with the deadline tomorrow. Pace projects a miss.',
      subtasks: [sub('POST /auth/login endpoint', 20), sub('JWT sign & verify', 30), sub('requireAuth middleware', 20, true), sub('Test with Postman', 15)],
    }),
    build({
      taskName: 'Write Physics Essay — Wave Mechanics',
      createdAt: daysAgo(4), deadline: daysFromNow(2),
      taskType: 'WRITING', cognitiveWeight: 'HIGH', selfOwned: false, recipientName: 'Prof. Chen',
      pct: 38, story: 'steady', energy: 'Deep Focus', duration: 215,
      drift: 'Behind the ideal line but moving at a steady pace — recoverable with focus.',
      subtasks: [sub('Outline all sections', 20, true), sub('Write intro & wave basics', 60, true), sub('Interference & diffraction', 90), sub('Conclusion & citations', 45)],
    }),
    build({
      taskName: 'Fix Navbar Responsive Bug — React',
      createdAt: daysAgo(5), deadline: daysFromNow(5),
      taskType: 'CODE', cognitiveWeight: 'MEDIUM', selfOwned: true,
      pct: 72, story: 'ahead', energy: 'Quick Wins', duration: 70,
      drift: '72% done and ahead of schedule. Steady commits — on track to finish early.',
      subtasks: [sub('Identify breakpoint issues', 20, true), sub('Fix CSS media queries', 30, true), sub('Test on mobile viewports', 25), sub('PR review pass', 15)],
    }),
    build({
      taskName: 'Pay Electricity Bill — $68.50',
      createdAt: daysAgo(1), deadline: daysFromNow(4),
      taskType: 'OTHER', cognitiveWeight: 'LOW', selfOwned: true,
      pct: 0, story: 'steady', energy: 'Brain-Dead', duration: 5,
      drift: 'Tiny 5-minute task. Plenty of runway — knock it out on any break.',
      subtasks: [sub('Log into utility portal', 2), sub('Process payment', 3)],
    }),
    build({
      taskName: 'Set Up MongoDB Atlas Cluster',
      createdAt: daysAgo(3), deadline: daysAgo(1),
      taskType: 'CODE', cognitiveWeight: 'LOW', selfOwned: true,
      pct: 100, story: 'steady', energy: 'Quick Wins', duration: 20,
      drift: 'Done. Cluster online, connection string set.',
      subtasks: [sub('Create cluster', 10, true), sub('Add IP whitelist', 5, true), sub('Set connection string', 5, true)],
    }),
  ];

  await TaskModel.insertMany(tasks);
  console.log(`[DemoMode] Auto-seeded ${tasks.length} pace-realistic tasks for: ${userId}`);
}

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
// Manual task creation — no AI, instant, all fields explicit.

async function createTask(req, res) {
  const userId = req.userId;
  const {
    taskName, deadline, taskType = 'OTHER', cognitiveWeight = 'MEDIUM',
    selfOwned = true, recipientName = null,
    completionPercent = 0, energyLevel = '', estimatedDuration = 60,
    driftExplanation = '', subtasks = [],
  } = req.body;

  if (!taskName || !taskName.trim()) {
    return res.status(400).json({ error: 'taskName is required' });
  }
  if (!deadline) {
    return res.status(400).json({ error: 'deadline is required' });
  }

  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();

  const raw = {
    userId,
    id: uuidv4(),
    taskName: taskName.trim(),
    deadline,
    taskType: ['CODE', 'WRITING', 'DIAGRAM', 'OTHER'].includes(taskType) ? taskType : 'OTHER',
    cognitiveWeight: ['LOW', 'MEDIUM', 'HIGH'].includes(cognitiveWeight) ? cognitiveWeight : 'MEDIUM',
    selfOwned: Boolean(selfOwned),
    recipientName: selfOwned ? null : (recipientName || null),
    completionPercent: Math.max(0, Math.min(100, Number(completionPercent) || 0)),
    energyLevel: ['Deep Focus', 'Quick Wins', 'Brain-Dead', ''].includes(energyLevel) ? energyLevel : '',
    estimatedDuration: Math.max(1, Number(estimatedDuration) || 60),
    driftExplanation: driftExplanation || '',
    hotStartContent: '', negotiatedDraft: '',
    isRescheduled: false,
    rawInput: `[manual] ${taskName.trim()}`,
    sparkline: completionPercent > 0
      ? [{ value: Number(completionPercent), timestamp: now }]
      : [],
    subtasks: (subtasks || []).map((s, i) => ({
      id: uuidv4(),
      title: String(s.title || `Step ${i + 1}`).trim(),
      estimatedMinutes: Math.max(1, Number(s.estimatedMinutes) || 30),
      scheduledSlot: null,
      completed: Boolean(s.completed),
    })),
    panicScaffold: { checklist: [], boilerplate: '', repoUrl: '', generatedAt: '' },
    mode: 'normal',
    createdAt: now,
    updatedAt: now,
    creditsAwarded: false,
  };

  raw.creditValue = computeTaskCredits(raw);
  const metrics = computePaceMetrics(raw);
  raw.currentPaceHoursPerDay = metrics.requiredHoursPerDay;
  raw.status = raw.completionPercent >= 100 ? 'COMPLETE' : metrics.status;

  if (isConnected()) {
    await TaskModel.create(raw);
    const { _id, __v, ...cleaned } = raw;
    return res.status(201).json(decorateTask(cleaned));
  }

  db.addTask ? db.addTask(raw) : null;
  return res.status(201).json(decorateTask(raw));
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────

async function getAllTasks(req, res) {
  const userId = req.userId;

  if (isConnected()) {
    await autoSeedIfEmpty(userId);
    const tasks = await TaskModel.find({ userId }).sort({ deadline: 1 }).lean();

    // Auto-reschedule any task whose deadline has passed but is still active
    // (not complete, not already rescheduled). Sets isRescheduled: true and
    // pushes the deadline forward by the same original span so pace adapts.
    const now = Date.now();
    const toReschedule = tasks.filter(t =>
      !t.isRescheduled &&
      t.status !== 'COMPLETE' &&
      t.status !== 'failed' &&
      new Date(t.deadline).getTime() < now &&
      (t.completionPercent || 0) < 100
    );

    if (toReschedule.length > 0) {
      await Promise.all(toReschedule.map(t =>
        TaskModel.findOneAndUpdate(
          { id: t.id, userId },
          { $set: { isRescheduled: true, updatedAt: new Date(now).toISOString() } }
        ).catch(() => {})
      ));
    }

    // Re-fetch after any auto-reschedule mutations
    const fresh = toReschedule.length > 0
      ? await TaskModel.find({ userId }).sort({ deadline: 1 }).lean()
      : tasks;

    return res.json(fresh.map(({ _id, __v, ...t }) => decorateTask(t)));
  }

  const tasks = [...db.getAllTasks()].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );
  return res.json(tasks.map(decorateTask));
}

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────

async function updateTask(req, res) {
  const { id } = req.params;
  const userId = req.userId;
  const updates = { ...req.body };

  ['id', 'createdAt', 'rawInput', 'userId', 'creditValue', 'creditsAwarded', 'paceMetrics'].forEach(k => delete updates[k]);

  if (isConnected()) {
    const task = await TaskModel.findOne({ id, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found', message: `No task with id "${id}"` });

    // Append a timestamped sparkline point whenever progress is logged
    if (typeof updates.completionPercent === 'number') {
      const current = Array.isArray(task.sparkline) ? task.sparkline : [];
      updates.sparkline = [...current, { value: updates.completionPercent, timestamp: new Date().toISOString() }].slice(-30);
    }

    updates.updatedAt = new Date().toISOString();
    let updated = await TaskModel.findOneAndUpdate({ id, userId }, { $set: updates }, { new: true, lean: true });

    // Recompute pace status from the fresh state (unless explicitly completed)
    if (updated.status !== 'COMPLETE') {
      const m = computePaceMetrics(updated);
      updated = await TaskModel.findOneAndUpdate(
        { id, userId },
        { $set: { status: m.status, currentPaceHoursPerDay: m.requiredHoursPerDay } },
        { new: true, lean: true }
      );
    }

    const { _id, __v, ...cleaned } = updated;
    return res.json(decorateTask(cleaned));
  }

  // In-memory fallback
  const task = db.getTaskById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (typeof updates.completionPercent === 'number') {
    const current = Array.isArray(task.sparkline) ? task.sparkline : [];
    updates.sparkline = [...current, { value: updates.completionPercent, timestamp: new Date().toISOString() }].slice(-30);
  }
  let updated = db.updateTask(id, updates);
  if (updated.status !== 'COMPLETE') {
    const m = computePaceMetrics(updated);
    updated = db.updateTask(id, { status: m.status, currentPaceHoursPerDay: m.requiredHoursPerDay });
  }
  return res.json(decorateTask(updated));
}

// ─── POST /api/tasks/:id/complete ─────────────────────────────────────────────
// Marks a task complete and returns the pace-differential credit award.

async function completeTask(req, res) {
  const { id } = req.params;
  const userId = req.userId;
  const completedAt = Date.now();

  if (isConnected()) {
    const task = await TaskModel.findOne({ id, userId }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.creditsAwarded) {
      return res.json({ task: decorateTask(task), creditAward: { credits: 0, alreadyAwarded: true } });
    }

    const award = computeCompletionAward(task, completedAt);
    const sparkline = [...(task.sparkline || []), { value: 100, timestamp: new Date(completedAt).toISOString() }].slice(-30);

    const updated = await TaskModel.findOneAndUpdate(
      { id, userId },
      { $set: { status: 'COMPLETE', completionPercent: 100, creditsAwarded: true, currentPaceHoursPerDay: 0, sparkline, updatedAt: new Date().toISOString() } },
      { new: true, lean: true }
    );
    const { _id, __v, ...cleaned } = updated;
    console.log(`[Tasks] Completed ${id} → +${award.credits} VC (${award.reason})`);
    return res.json({ task: decorateTask(cleaned), creditAward: award });
  }

  const task = db.getTaskById(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.creditsAwarded) return res.json({ task: decorateTask(task), creditAward: { credits: 0, alreadyAwarded: true } });
  const award = computeCompletionAward(task, completedAt);
  const sparkline = [...(task.sparkline || []), { value: 100, timestamp: new Date(completedAt).toISOString() }].slice(-30);
  const updated = db.updateTask(id, { status: 'COMPLETE', completionPercent: 100, creditsAwarded: true, currentPaceHoursPerDay: 0, sparkline });
  return res.json({ task: decorateTask(updated), creditAward: award });
}

module.exports = { getAllTasks, createTask, updateTask, completeTask };
