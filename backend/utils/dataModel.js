/**
 * utils/dataModel.js
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory store + factory functions for Tasks, Subtasks, CheckIns,
 * Goals, Habits, and Settings.
 */

const { v4: uuidv4 } = require('uuid');
const { computeTaskCredits } = require('./paceEngine');

// ─── In-memory store ─────────────────────────────────────────────────────────

const store = {
  tasks:    [],  // Task[]
  checkins: [],  // CheckIn[]
  goals:    [],  // Goal[]
  habits:   [],  // Habit[]
  settings: {    // Settings (singleton)
    preferredWorkStart: '09:00',
    preferredWorkEnd: '21:00',
    accountabilityEmail: '',
    dailyBriefingEnabled: true,
    dailyBriefingTime: '08:00',
    theme: 'dark',
    accentColor: '#22c55e',
    calendarSyncEnabled: false,
    notificationsEnabled: true,
    autoTriageEnabled: false,
  },
  gamification: null, // VelocityProfile (singleton) — lazily seeded
};

// ─── Pace calculation helpers (mirrors frontend data.ts) ─────────────────────

const WEIGHT_BASE_HOURS = { HIGH: 5, MEDIUM: 3, LOW: 1 };

function calcRequiredHoursPerDay(weight, isoDeadline) {
  const base = WEIGHT_BASE_HOURS[weight] || 3;
  const deadline = new Date(isoDeadline).getTime();
  const now = Date.now();
  const diffDays = Math.max((deadline - now) / (1000 * 60 * 60 * 24), 0.1);
  return Math.round((base / diffDays) * 10) / 10;
}

function derivePaceStatus(hoursPerDay) {
  if (hoursPerDay < 2) return 'GREEN';
  if (hoursPerDay <= 4) return 'AMBER';
  return 'RED';
}

// ─── Subtask factory ─────────────────────────────────────────────────────────

function createSubtask(data) {
  return {
    id: uuidv4(),
    title: data.title || 'Untitled subtask',
    estimatedMinutes: data.estimatedMinutes || 30,
    scheduledSlot: data.scheduledSlot || null,
    completed: false,
  };
}

// ─── Task factory ─────────────────────────────────────────────────────────────

function createTask(data) {
  const now = new Date().toISOString();

  const typeMap = {
    code: 'CODE', document: 'WRITING', writing: 'WRITING',
    diagram: 'DIAGRAM', other: 'OTHER',
  };
  const taskType = typeMap[(data.taskType || 'other').toLowerCase()] || 'OTHER';
  const cognitiveWeight = (data.cognitiveWeight || 'medium').toUpperCase();
  const recipientName = data.recipient || null;
  const selfOwned = !recipientName;
  const deadline = data.deadline || null; // null = user hasn't confirmed yet
  const currentPaceHoursPerDay = calcRequiredHoursPerDay(cognitiveWeight, deadline);
  const status = derivePaceStatus(currentPaceHoursPerDay);
  const subtasks = (data.subtasks || []).map(createSubtask);
  const completionPercent = subtasks.length > 0
    ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100) : 0;
  // Pace tracking starts now: a single timestamped baseline point.
  const sparkline = [{ value: completionPercent, timestamp: now }];

  const taskShell = {
    taskName: data.title || data.taskName || 'Untitled Task',
    deadline, taskType, cognitiveWeight, subtasks,
  };
  const creditValue = computeTaskCredits(taskShell);

  return {
    id: uuidv4(),
    taskName: taskShell.taskName,
    deadline, taskType, cognitiveWeight, selfOwned, recipientName,
    currentPaceHoursPerDay, status,
    driftExplanation: data.driftExplanation || generateDriftExplanation(cognitiveWeight, deadline, completionPercent),
    hotStartContent: '', negotiatedDraft: '', completionPercent, sparkline,
    isRescheduled: false,
    rawInput: data.rawInput || '',
    subtasks, mode: 'normal',
    creditValue,            // credits earned on completion (pace-adjusted at finish)
    creditsAwarded: false,  // guards against double-awarding
    createdAt: now, updatedAt: now,
  };
}

// ─── CheckIn factory ─────────────────────────────────────────────────────────

function createCheckIn(data) {
  return {
    id: uuidv4(), taskId: data.taskId,
    timestamp: new Date().toISOString(),
    selfReportText: data.selfReportText || '',
    selfReportPercent: data.selfReportPercent || 0,
    trustScore: data.trustScore || 100,
  };
}

// ─── Goal factory ─────────────────────────────────────────────────────────────

function createGoal(data) {
  return {
    id: uuidv4(),
    title: data.title || 'Untitled Goal',
    description: data.description || '',
    linkedTaskIds: data.linkedTaskIds || [],
    targetDate: data.targetDate || null,
    progressPercent: 0,
    createdAt: new Date().toISOString(),
  };
}

// ─── Velocity Credits / Gamification engine ──────────────────────────────────
//
// The credit economy is the retention spine of the app. Lifetime credits map to
// a level curve (start(L) = 125·(L-1)²) and a title band. Achievements unlock
// off a derived stat snapshot. Everything below is pure + deterministic so the
// in-memory and Mongo paths produce identical results.

const LEVEL_TITLES = [
  'Drifter', 'Initiate', 'Mover', 'Operator', 'Tactician',
  'Strategist', 'Vanguard', 'Velocity Master', 'Apex Operator',
];

// Credit awards per action type — single source of truth (frontend mirrors labels)
// task_complete is dynamic (amount computed by the pace engine), so it has no
// fixed amount here — callers always pass an explicit amount for it.
const CREDIT_RULES = {
  task_complete:        { amount: 50,  label: 'Task completed' },        // fallback only
  checkin:              { amount: 5,   label: 'Progress check-in' },
  stay_green:           { amount: 10,  label: 'Held the green line' },
  ai_tool_use:          { amount: 2,   label: 'AI co-pilot used' },
  panic_resolved:       { amount: 30,  label: 'Panic Mode cleared' },
  triage_run:           { amount: 8,   label: 'Triage executed' },
  day_rebalanced:       { amount: 12,  label: 'Day rebalanced' },
  streak_bonus:         { amount: 25,  label: 'Daily streak bonus' },
  // Habits, goals & calendar integration
  habit_checkin:        { amount: 15,  label: 'Habit completed' },
  habit_streak:         { amount: 50,  label: 'Habit streak milestone' },
  goal_complete:        { amount: 200, label: 'Goal achieved' },
  calendar_block:       { amount: 8,   label: 'Scheduled block done' },
};

/** Level / title / progress for a given lifetime credit total. */
function levelInfo(lifetimeCredits) {
  const credits = Math.max(0, Math.round(lifetimeCredits || 0));
  let level = 1;
  while (125 * level * level <= credits) level++;
  const floor = 125 * (level - 1) * (level - 1);
  const ceil  = 125 * level * level;
  const span  = ceil - floor;
  const progressPercent = Math.max(0, Math.min(100, Math.round(((credits - floor) / span) * 100)));
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    levelFloor: floor,
    levelCeil: ceil,
    progressPercent,
    creditsToNext: Math.max(0, ceil - credits),
  };
}

// Achievement catalog — `icon` is a lucide name the frontend maps to a component.
const ACHIEVEMENTS = [
  { id: 'first_blood',  name: 'First Blood',     icon: 'Swords',     desc: 'Complete your first task',        test: s => s.tasksCompleted >= 1 },
  { id: 'momentum',     name: 'Momentum',        icon: 'Rocket',     desc: 'Complete 5 tasks',                test: s => s.tasksCompleted >= 5 },
  { id: 'green_machine',name: 'Green Machine',   icon: 'ShieldCheck',desc: 'Hold the green line 5 times',     test: s => s.greenHolds >= 5 },
  { id: 'clutch',       name: 'Clutch',          icon: 'Flame',      desc: 'Clear a Panic Mode task',         test: s => s.panicResolved >= 1 },
  { id: 'streak_7',     name: 'Week Warrior',    icon: 'CalendarCheck', desc: 'Reach a 7-day streak',         test: s => s.longestStreak >= 7 },
  { id: 'streak_30',    name: 'Unbreakable',     icon: 'Trophy',     desc: 'Reach a 30-day streak',           test: s => s.longestStreak >= 30 },
  { id: 'credit_1k',    name: 'Four Figures',    icon: 'Coins',      desc: 'Earn 1,000 lifetime VC',          test: s => s.lifetimeCredits >= 1000 },
  { id: 'credit_5k',    name: 'High Roller',     icon: 'Gem',        desc: 'Earn 5,000 lifetime VC',          test: s => s.lifetimeCredits >= 5000 },
  { id: 'operator',     name: 'Operator',        icon: 'Crown',      desc: 'Reach Level 4',                   test: s => s.level >= 4 },
  { id: 'sharpshooter', name: 'Sharpshooter',    icon: 'Target',     desc: '90%+ avg trust calibration',      test: s => s.avgTrust >= 90 },
];

/** Evaluate which achievements are unlocked from a stat snapshot. */
function evaluateAchievements(stats, alreadyUnlocked = {}) {
  const nowIso = new Date().toISOString();
  return ACHIEVEMENTS.map(a => {
    const prev = alreadyUnlocked[a.id];
    const unlocked = Boolean(prev) || a.test(stats);
    return {
      id: a.id, name: a.name, icon: a.icon, desc: a.desc,
      unlocked,
      unlockedAt: unlocked ? (prev?.unlockedAt || nowIso) : null,
    };
  });
}

/** Factory — a believable seeded starting profile so the demo lands with impact. */
function createGamificationProfile(seed = true) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const lifetime = seed ? 2840 : 0;
  const ledger = seed ? [
    { id: uuidv4(), action: 'task_complete_ontime', amount: 100, label: 'On-time delivery bonus', timestamp: new Date(now - 2 * 3600000).toISOString() },
    { id: uuidv4(), action: 'task_complete',        amount: 50,  label: 'Task completed',          timestamp: new Date(now - 5 * 3600000).toISOString() },
    { id: uuidv4(), action: 'streak_bonus',         amount: 25,  label: 'Daily streak bonus',      timestamp: new Date(now - 9 * 3600000).toISOString() },
    { id: uuidv4(), action: 'panic_resolved',       amount: 30,  label: 'Panic Mode cleared',      timestamp: new Date(now - 26 * 3600000).toISOString() },
    { id: uuidv4(), action: 'checkin',              amount: 5,   label: 'Progress check-in',       timestamp: new Date(now - 28 * 3600000).toISOString() },
  ] : [];

  return {
    credits: lifetime,          // current spendable balance
    lifetimeCredits: lifetime,  // never decreases — drives level
    streak: seed ? 12 : 0,
    longestStreak: seed ? 18 : 0,
    lastActiveDate: today,
    tasksCompleted: seed ? 9 : 0,
    checkins: seed ? 14 : 0,
    panicResolved: seed ? 2 : 0,
    greenHolds: seed ? 6 : 0,
    onTimeCount: seed ? 7 : 0,
    ledger,
    achievementState: {},       // { [id]: { unlockedAt } }
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Apply a credit award to a profile in place-ish (returns a new profile object).
 * Handles streak roll-over based on lastActiveDate.
 */
function applyCreditAward(profile, action, customAmount) {
  const rule = CREDIT_RULES[action] || { amount: customAmount || 0, label: 'Credits earned' };
  const amount = typeof customAmount === 'number' ? customAmount : rule.amount;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const next = { ...profile };
  next.ledger = [
    { id: uuidv4(), action, amount, label: rule.label, timestamp: now.toISOString() },
    ...(profile.ledger || []),
  ].slice(0, 40);

  next.credits = (profile.credits || 0) + amount;
  next.lifetimeCredits = (profile.lifetimeCredits || 0) + Math.max(0, amount);

  // Streak roll-over
  if (profile.lastActiveDate !== today) {
    const last = profile.lastActiveDate ? new Date(profile.lastActiveDate + 'T00:00:00') : null;
    const dayMs = 86400000;
    const gap = last ? Math.round((new Date(today + 'T00:00:00') - last) / dayMs) : 999;
    next.streak = gap === 1 ? (profile.streak || 0) + 1 : 1;
    next.longestStreak = Math.max(profile.longestStreak || 0, next.streak);
    next.lastActiveDate = today;
  }

  // Per-action counters
  if (action === 'task_complete' || action === 'task_complete_ontime') next.tasksCompleted = (profile.tasksCompleted || 0) + 1;
  if (action === 'task_complete_ontime') next.onTimeCount = (profile.onTimeCount || 0) + 1;
  if (action === 'checkin') next.checkins = (profile.checkins || 0) + 1;
  if (action === 'panic_resolved') next.panicResolved = (profile.panicResolved || 0) + 1;
  if (action === 'stay_green') next.greenHolds = (profile.greenHolds || 0) + 1;

  next.updatedAt = now.toISOString();
  return next;
}

/** Compose the full client-facing profile (derived level + achievements). */
function decorateProfile(profile, avgTrust = 92) {
  const li = levelInfo(profile.lifetimeCredits);
  const statSnapshot = {
    tasksCompleted: profile.tasksCompleted || 0,
    longestStreak: profile.longestStreak || 0,
    lifetimeCredits: profile.lifetimeCredits || 0,
    panicResolved: profile.panicResolved || 0,
    greenHolds: profile.greenHolds || 0,
    level: li.level,
    avgTrust,
  };
  const achievements = evaluateAchievements(statSnapshot, profile.achievementState || {});
  return {
    credits: profile.credits || 0,
    lifetimeCredits: profile.lifetimeCredits || 0,
    streak: profile.streak || 0,
    longestStreak: profile.longestStreak || 0,
    tasksCompleted: profile.tasksCompleted || 0,
    checkins: profile.checkins || 0,
    ...li,
    ledger: (profile.ledger || []).slice(0, 12),
    achievements,
    achievementsUnlocked: achievements.filter(a => a.unlocked).length,
    achievementsTotal: achievements.length,
  };
}

// ─── Habit factory ────────────────────────────────────────────────────────────

function createHabit(data) {
  return {
    id: uuidv4(),
    title: data.title || 'Untitled Habit',
    frequency: data.frequency || 'daily',
    streak: 0,
    history: [],
    createdAt: new Date().toISOString(),
  };
}

// ─── Drift explanation generator ─────────────────────────────────────────────

function generateDriftExplanation(cognitiveWeight, deadline, completionPercent) {
  const diffH = (new Date(deadline).getTime() - Date.now()) / 3600000;
  const days = (diffH / 24).toFixed(1);
  const weight = cognitiveWeight.toLowerCase();
  if (completionPercent === 0) return `Task not yet started. ${days} days remaining for a ${weight}-weight task. Begin immediately to stay on pace.`;
  if (completionPercent < 30) return `Only ${completionPercent}% complete with ${days} days remaining. Significant work ahead — current velocity is below target.`;
  if (completionPercent < 70) return `${completionPercent}% complete. ${days} days to deadline. Maintaining current pace should reach completion on time.`;
  return `${completionPercent}% complete. On track for deadline in ${days} days. Final stretch — keep momentum.`;
}

// ─── Store helpers ────────────────────────────────────────────────────────────

const db = {
  // Tasks
  getAllTasks: () => store.tasks,
  getTaskById: (id) => store.tasks.find(t => t.id === id),
  addTask: (task) => { store.tasks.push(task); return task; },
  updateTask: (id, updates) => {
    const idx = store.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    store.tasks[idx] = { ...store.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    return store.tasks[idx];
  },

  // CheckIns
  getAllCheckIns: () => store.checkins,
  getCheckInsByTaskId: (taskId) => store.checkins.filter(c => c.taskId === taskId),
  addCheckIn: (checkin) => { store.checkins.push(checkin); return checkin; },

  // Goals
  getAllGoals: () => store.goals,
  getGoalById: (id) => store.goals.find(g => g.id === id),
  addGoal: (goal) => { store.goals.push(goal); return goal; },
  updateGoal: (id, updates) => {
    const idx = store.goals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    store.goals[idx] = { ...store.goals[idx], ...updates };
    return store.goals[idx];
  },
  deleteGoal: (id) => {
    const idx = store.goals.findIndex(g => g.id === id);
    if (idx === -1) return false;
    store.goals.splice(idx, 1);
    return true;
  },

  // Habits
  getAllHabits: () => store.habits,
  getHabitById: (id) => store.habits.find(h => h.id === id),
  addHabit: (habit) => { store.habits.push(habit); return habit; },
  updateHabit: (id, updates) => {
    const idx = store.habits.findIndex(h => h.id === id);
    if (idx === -1) return null;
    store.habits[idx] = { ...store.habits[idx], ...updates };
    return store.habits[idx];
  },
  deleteHabit: (id) => {
    const idx = store.habits.findIndex(h => h.id === id);
    if (idx === -1) return false;
    store.habits.splice(idx, 1);
    return true;
  },

  // Settings
  getSettings: () => store.settings,
  updateSettings: (updates) => {
    store.settings = { ...store.settings, ...updates };
    return store.settings;
  },

  // Gamification (singleton in in-memory mode)
  getGamification: () => {
    if (!store.gamification) store.gamification = createGamificationProfile(true);
    return store.gamification;
  },
  setGamification: (profile) => {
    store.gamification = profile;
    return store.gamification;
  },
};

module.exports = {
  db, createTask, createSubtask, createCheckIn,
  createGoal, createHabit,
  calcRequiredHoursPerDay, derivePaceStatus,
  // Gamification engine
  createGamificationProfile, applyCreditAward, decorateProfile,
  levelInfo, evaluateAchievements, CREDIT_RULES, LEVEL_TITLES, ACHIEVEMENTS,
};
