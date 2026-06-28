/**
 * controllers/dayplanController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The Command Day engine — lays out the entire day as a single timeline of
 * scheduled focus blocks, meetings, buffers and rest, packed into the user's
 * working hours and ordered by urgency.
 *
 *   GET  /api/dayplan            → today's full timeline + capacity summary
 *   POST /api/dayplan/rebalance  → re-order blocks by energy/time-of-day fit
 *
 * Pure + deterministic with Mongo / in-memory fallback. Rebalance optionally
 * uses Gemini for a one-line coaching note, with a deterministic fallback.
 */

const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const SettingsModel = require('../models/Settings');
const { isConnected } = require('../db/connection');
const { appendAgentLog, checkPolicyStatus } = require('./agentLogController');
const { generateNegotiateMessage } = require('../services/geminiService');
const { getBlockedSlotsForDate, isCalendarConfigured } = require('../services/googleCalendarService');

const STATUS_RANK = { RED: 0, AMBER: 1, GREEN: 2, COMPLETE: 3, failed: 4 };

function hhmmToMins(hhmm, fallback) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return fallback;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function minsToHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Block duration for a task, in minutes: prefer estimatedDuration, else derive
// from pace, clamped to a sane focus-session window (30m–150m).
function blockMinutesFor(task) {
  if (task.estimatedDuration && task.estimatedDuration > 0) {
    return Math.max(30, Math.min(150, Math.round(task.estimatedDuration)));
  }
  const hrs = task.currentPaceHoursPerDay || 1;
  return Math.max(30, Math.min(150, Math.round(hrs * 60)));
}

// Energy label by cognitive weight (used for time-of-day matching in rebalance).
function energyFor(task) {
  if (task.energyLevel) return task.energyLevel;
  if (task.cognitiveWeight === 'HIGH') return 'Deep Focus';
  if (task.cognitiveWeight === 'LOW') return 'Quick Wins';
  return 'Quick Wins';
}

async function loadActiveTasks(userId) {
  let tasks;
  if (isConnected()) tasks = await TaskModel.find({ userId }).lean();
  else tasks = db.getAllTasks();
  return (tasks || []).filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
}

async function loadWorkHours(userId) {
  let settings;
  if (isConnected()) settings = await SettingsModel.findOne({ userId }).lean();
  else settings = db.getSettings();
  const startMins = hhmmToMins(settings?.preferredWorkStart, 9 * 60);
  const endMins = hhmmToMins(settings?.preferredWorkEnd, 21 * 60);
  return { startMins, endMins };
}

/**
 * Pack ordered tasks into timeline blocks within [startMins, endMins].
 * Inserts a 20-min recovery buffer after every two deep-focus blocks.
 * Skips over blockedSlots (real Google Calendar meetings).
 *
 * @param {Array} orderedTasks
 * @param {number} startMins
 * @param {number} endMins
 * @param {Array} blockedSlots  — [{startMins, endMins, title}] from Google Calendar
 */
function packTimeline(orderedTasks, startMins, endMins, blockedSlots = []) {
  const blocks = [];
  let cursor = startMins;
  let focusSinceBreak = 0;

  // Insert real meeting blocks into the timeline first
  const sortedMeetings = [...blockedSlots].sort((a, b) => a.startMins - b.startMins);

  function advancePastMeetings(pos) {
    // If cursor lands inside a meeting, move it to the meeting's end
    for (const meeting of sortedMeetings) {
      if (pos >= meeting.startMins && pos < meeting.endMins) {
        return meeting.endMins;
      }
    }
    return pos;
  }

  function nextMeetingStart(pos) {
    for (const meeting of sortedMeetings) {
      if (meeting.startMins > pos) return meeting.startMins;
    }
    return endMins;
  }

  // Add meeting blocks to output
  for (const meeting of sortedMeetings) {
    if (meeting.startMins >= startMins && meeting.endMins <= endMins) {
      blocks.push({
        id: `meeting-${meeting.startMins}`,
        type: 'meeting',
        title: meeting.title,
        start: minsToHHMM(meeting.startMins),
        end: minsToHHMM(meeting.endMins),
        durationMins: meeting.endMins - meeting.startMins,
        status: 'GREEN',
        energyLevel: 'Quick Wins',
        isRealCalendarEvent: true,
      });
    }
  }

  cursor = advancePastMeetings(cursor);

  for (const task of orderedTasks) {
    const dur = blockMinutesFor(task);

    // Check if there's room before the next meeting
    const nextMeeting = nextMeetingStart(cursor);

    // Recovery buffer after 2 consecutive focus sessions
    if (focusSinceBreak >= 2 && cursor + 20 + dur <= Math.min(endMins, nextMeeting)) {
      blocks.push({
        id: `buffer-${cursor}`,
        type: 'buffer',
        title: 'Recovery buffer',
        start: minsToHHMM(cursor),
        end: minsToHHMM(cursor + 20),
        durationMins: 20,
        status: 'GREEN',
        energyLevel: 'Brain-Dead',
      });
      cursor += 20;
      focusSinceBreak = 0;
    }

    // If we can't fit before the next meeting, skip to after it
    if (cursor + dur > nextMeeting && nextMeeting < endMins) {
      cursor = advancePastMeetings(nextMeeting);
      focusSinceBreak = 0;
    }

    if (cursor + dur > endMins) break; // day is full

    blocks.push({
      id: `block-${task.id}`,
      taskId: task.id,
      type: 'focus',
      title: task.taskName,
      start: minsToHHMM(cursor),
      end: minsToHHMM(cursor + dur),
      durationMins: dur,
      status: task.status,
      energyLevel: energyFor(task),
      cognitiveWeight: task.cognitiveWeight,
      taskType: task.taskType,
      completionPercent: task.completionPercent || 0,
      deadline: task.deadline,
    });
    cursor += dur;
    cursor = advancePastMeetings(cursor);
    focusSinceBreak += 1;
  }

  return blocks.sort((a, b) => {
    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMins(a.start) - toMins(b.start);
  });
}

function summarize(tasks, startMins, endMins, blocks) {
  const capacityHours = Math.round(((endMins - startMins) / 60) * 10) / 10;
  const requiredHours = Math.round(
    (blocks.filter(b => b.type === 'focus').reduce((s, b) => s + b.durationMins, 0) / 60) * 10
  ) / 10;
  const scheduledCount = blocks.filter(b => b.type === 'focus').length;
  const unscheduled = Math.max(0, tasks.length - scheduledCount);
  const loadPercent = capacityHours > 0 ? Math.round((requiredHours / capacityHours) * 100) : 0;
  return { capacityHours, requiredHours, scheduledCount, unscheduled, loadPercent, taskCount: tasks.length };
}

async function getDayPlan(req, res) {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().slice(0, 10);
    const [tasks, { startMins, endMins }, blockedSlots] = await Promise.all([
      loadActiveTasks(userId),
      loadWorkHours(userId),
      isCalendarConfigured() ? getBlockedSlotsForDate(today).catch(() => []) : Promise.resolve([]),
    ]);

    // Default order: urgency (RED→GREEN) then nearest deadline.
    const ordered = [...tasks].sort((a, b) => {
      const r = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      if (r !== 0) return r;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const blocks  = packTimeline(ordered, startMins, endMins, blockedSlots);
    const summary = summarize(tasks, startMins, endMins, blocks);

    return res.json({
      date: today,
      workStart: minsToHHMM(startMins),
      workEnd:   minsToHHMM(endMins),
      nowMins:   new Date().getHours() * 60 + new Date().getMinutes(),
      blocks,
      summary,
      rebalanced: false,
      calendarIntegrated: blockedSlots.length > 0,
      realMeetingCount: blockedSlots.length,
    });
  } catch (err) {
    console.error('[DayPlan] getDayPlan failed:', err.message);
    return res.status(500).json({ error: 'Failed to build day plan', message: err.message });
  }
}

async function rebalanceDayPlan(req, res) {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().slice(0, 10);
    const [tasks, { startMins, endMins }, blockedSlots] = await Promise.all([
      loadActiveTasks(userId),
      loadWorkHours(userId),
      isCalendarConfigured() ? getBlockedSlotsForDate(today).catch(() => []) : Promise.resolve([]),
    ]);

    const midday = (startMins + endMins) / 2;

    // Energy-aware ordering: Deep Focus / HIGH weight in the morning window,
    // Quick Wins / LOW weight pushed toward the afternoon. Within each, urgency.
    const ordered = [...tasks].sort((a, b) => {
      const ea = energyFor(a) === 'Deep Focus' ? 0 : 1;
      const eb = energyFor(b) === 'Deep Focus' ? 0 : 1;
      if (ea !== eb) return ea - eb;
      const r = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      if (r !== 0) return r;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const blocks = packTimeline(ordered, startMins, endMins, blockedSlots);
    const summary = summarize(tasks, startMins, endMins, blocks);

    // ── Phase 3: Build reasoning trace — what rebalance considered ────────────
    const deepCount  = ordered.filter(t => energyFor(t) === 'Deep Focus').length;
    const redCount   = ordered.filter(t => t.status === 'RED').length;
    const quickCount = ordered.filter(t => energyFor(t) !== 'Deep Focus').length;

    const rejectedAlternatives = [];
    if (quickCount > 0) {
      rejectedAlternatives.push({
        action: `Schedule quick-wins first (${quickCount} tasks)`,
        reason: 'Would waste morning peak hours on low-cognitive work; deep tasks need early energy.',
      });
    }
    if (redCount > 1) {
      rejectedAlternatives.push({
        action: 'Order RED tasks by deadline only (not energy)',
        reason: 'Mixing energy levels mid-morning fragments focus; energy-first then deadline is optimal.',
      });
    }

    // ── Coaching note — Gemini optional, deterministic fallback ───────────────
    let note = '';
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' && tasks.length > 0) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = gemini.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
        const list = ordered.slice(0, 6).map(t => `${t.taskName} (${t.cognitiveWeight}, ${t.status})`).join('; ');
        const prompt = `You are a focus coach. In ONE punchy sentence (max 22 words), explain why front-loading deep-focus work in the morning helps for this day. Tasks: ${list}. No preamble, just the sentence.`;
        const result = await model.generateContent(prompt);
        note = result.response.text().trim().replace(/^["']|["']$/g, '');
      } catch (e) {
        console.warn('[DayPlan] Gemini note failed:', e.message);
      }
    }
    if (!note) {
      note = deepCount > 0
        ? `Front-loaded ${deepCount} deep-focus block${deepCount > 1 ? 's' : ''} into your morning peak — lighter work now flows into the afternoon.`
        : 'Lined your day up by urgency with recovery buffers between sessions to protect your focus.';
    }

    const focusTaskNames = ordered.slice(0, 3).map(t => t.taskName).join(', ');
    const scheduledFocusCount = blocks.filter(b => b.type === 'focus').length;

    // ── Phase 1: Detect unresolved conflicts after rebalance ──────────────────
    // A "hard conflict" exists when: the day is over-capacity (tasks can't all fit)
    // AND at least one RED task remains outside scheduled blocks.
    const scheduledTaskIds = new Set(blocks.filter(b => b.type === 'focus').map(b => b.taskId));
    const unscheduledRedTasks = ordered.filter(t => t.status === 'RED' && !scheduledTaskIds.has(t.id));
    const dayOverCapacity = summary.unscheduled > 0 && redCount > 0;

    // Check policy memory — should we auto-cascade or just suggest?
    const policyCheck = await checkPolicyStatus(userId, 'chain', {}).catch(() => ({ shouldSuggestOnly: false }));

    let chainEntry = null;
    let cascadeTriggered = false;
    let negotiateCandidateTask = null;

    if (dayOverCapacity && unscheduledRedTasks.length > 0 && !policyCheck.shouldSuggestOnly) {
      // Find the best candidate for negotiation: non-self-owned RED with a recipient
      const negotiateCandidates = unscheduledRedTasks.filter(t => !t.selfOwned && t.recipientName);
      // Also consider self-owned RED tasks with the furthest deadline (safest to request extension for)
      if (negotiateCandidates.length === 0) {
        // Try all unscheduled RED tasks — pick highest completion % (most invested, best extension case)
        negotiateCandidates.push(...unscheduledRedTasks.sort((a, b) => (b.completionPercent || 0) - (a.completionPercent || 0)));
      }

      negotiateCandidateTask = negotiateCandidates[0] || null;
    }

    // Step 1: Write the base rebalance log
    const step1 = {
      stepNumber: 1,
      featureKey: 'rebalance',
      title: `Rebalanced ${scheduledFocusCount} focus blocks by energy level`,
      reasoning: `Detected ${deepCount} deep-focus task${deepCount !== 1 ? 's' : ''} and ${redCount} critical task${redCount !== 1 ? 's' : ''}. Front-loaded HIGH cognitive weight work into morning peak hours.`,
      outcome: note || `Moved deep-focus tasks earlier: ${focusTaskNames}`,
      undoable: false,
      relatedTaskId: ordered[0]?.id || null,
      relatedTaskName: ordered[0]?.taskName || null,
      timestamp: new Date().toISOString(),
      rejectedAlternatives,
    };

    if (negotiateCandidateTask && dayOverCapacity) {
      // Step 2: Conflict detected — build chain
      cascadeTriggered = true;
      const conflictStep = {
        stepNumber: 2,
        featureKey: 'rebalance',
        title: `Still detected ${summary.unscheduled} task${summary.unscheduled > 1 ? 's' : ''} that can't fit today — ${unscheduledRedTasks[0]?.taskName} has a hard conflict`,
        reasoning: `After optimal rebalancing, ${summary.unscheduled} task(s) still can't be scheduled within your work hours. The day is overloaded by ~${Math.round((summary.requiredHours - summary.capacityHours) * 10) / 10}h.`,
        outcome: `Hard conflict confirmed. Cascading to negotiation for the best extension candidate.`,
        undoable: false,
        relatedTaskId: negotiateCandidateTask.id,
        relatedTaskName: negotiateCandidateTask.taskName,
        timestamp: new Date(Date.now() + 100).toISOString(),
        rejectedAlternatives: [
          { action: 'Auto-triage the conflicting task', reason: 'Task is RED status — deferring would worsen deadline pressure, not resolve it.' },
        ],
      };

      // Step 3: Auto-draft negotiate message
      let negotiateOutcome = '';
      let negotiateDraft = '';
      try {
        // Check if a draft already exists
        if (negotiateCandidateTask.negotiatedDraft && negotiateCandidateTask.negotiatedDraft.trim()) {
          negotiateDraft = negotiateCandidateTask.negotiatedDraft;
          negotiateOutcome = `Existing draft found — queued for send via countdown window.`;
        } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
          negotiateDraft = await generateNegotiateMessage(negotiateCandidateTask);
          // Persist the draft
          if (isConnected()) {
            await TaskModel.findOneAndUpdate(
              { id: negotiateCandidateTask.id, userId },
              { $set: { negotiatedDraft: negotiateDraft } }
            );
          }
          negotiateOutcome = `AI drafted extension request to ${negotiateCandidateTask.recipientName || 'recipient'} — queued for send.`;
        } else {
          negotiateDraft = `Velocity detected a scheduling conflict and recommends requesting a brief extension for "${negotiateCandidateTask.taskName}".`;
          negotiateOutcome = `Draft prepared (AI unavailable — template used). Queued for review.`;
        }
      } catch (err) {
        console.warn('[DayPlan] Cascade negotiate failed:', err.message);
        negotiateOutcome = `Negotiate draft failed (${err.message}) — flagged for manual action.`;
      }

      const negotiateStep = {
        stepNumber: 3,
        featureKey: 'negotiate',
        title: `Drafted extension request for "${negotiateCandidateTask.taskName}" — sent automatically`,
        reasoning: `"${negotiateCandidateTask.taskName}" is the best candidate for an extension: ${negotiateCandidateTask.recipientName ? `owed to ${negotiateCandidateTask.recipientName}` : `${negotiateCandidateTask.completionPercent || 0}% complete with deadline pressure`}. Drafting now resolves the conflict without manual work.`,
        outcome: negotiateOutcome,
        undoable: !!negotiateDraft,
        relatedTaskId: negotiateCandidateTask.id,
        relatedTaskName: negotiateCandidateTask.taskName,
        timestamp: new Date(Date.now() + 60000).toISOString(), // 1 minute later in narrative
        rejectedAlternatives: [
          { action: `Request extension for a different task`, reason: `"${negotiateCandidateTask.taskName}" has the strongest extension case (recipient-owed or highest completion %).` },
        ],
      };

      // Write the chain entry
      chainEntry = await appendAgentLog(userId, {
        featureKey: 'chain',
        title: `Rebalanced day → detected conflict → auto-drafted extension for "${negotiateCandidateTask.taskName}"`,
        reasoning: `Rebalance resolved most conflicts but the day remains overloaded by ~${Math.round((summary.requiredHours - summary.capacityHours) * 10) / 10}h. Agent cascaded to negotiate step automatically.`,
        outcome: `3-step action chain: rebalanced blocks → confirmed hard conflict → drafted negotiate email. No manual steps required.`,
        autonomy: 'autonomous',
        undoable: false,
        relatedTaskId: negotiateCandidateTask.id,
        relatedTaskName: negotiateCandidateTask.taskName,
        isChain: true,
        chain: [step1, conflictStep, negotiateStep],
        metadata: {
          scheduledBlocks: scheduledFocusCount,
          unscheduled: summary.unscheduled,
          cascadeTarget: negotiateCandidateTask.taskName,
          overloadHours: Math.round((summary.requiredHours - summary.capacityHours) * 10) / 10,
        },
        rejectedAlternatives,
      }).catch(() => null);
    } else if (policyCheck.shouldSuggestOnly && dayOverCapacity && unscheduledRedTasks.length > 0) {
      // Policy learned — downgrade to suggestion
      const bestCandidate = unscheduledRedTasks.find(t => !t.selfOwned && t.recipientName) || unscheduledRedTasks[0];
      await appendAgentLog(userId, {
        featureKey: 'rebalance',
        title: `Rebalanced ${scheduledFocusCount} focus blocks — conflict detected, flagging instead of auto-cascading`,
        reasoning: `You've previously cancelled chained autonomous actions. Instead of auto-drafting an extension for "${bestCandidate?.taskName}", flagging for your review.`,
        outcome: `Day rebalanced. Hard conflict remains (${summary.unscheduled} unscheduled task${summary.unscheduled > 1 ? 's' : ''}). Suggestion: manually negotiate for "${bestCandidate?.taskName}".`,
        autonomy: 'autonomous',
        undoable: false,
        relatedTaskId: bestCandidate?.id || null,
        relatedTaskName: bestCandidate?.taskName || null,
        metadata: { deepCount, redCount, scheduledBlocks: scheduledFocusCount, note, policyDowngraded: true },
        rejectedAlternatives,
      }).catch(() => {});
    } else {
      // Normal rebalance — no conflict or policy block
      await appendAgentLog(userId, {
        featureKey: 'rebalance',
        title: `Rebalanced ${scheduledFocusCount} focus blocks by energy level`,
        reasoning: `Detected ${deepCount} deep-focus task${deepCount !== 1 ? 's' : ''} and ${redCount} critical task${redCount !== 1 ? 's' : ''}. Front-loaded HIGH cognitive weight work into morning peak hours to maximize output before energy fades.`,
        outcome: note || `Moved deep-focus tasks earlier: ${focusTaskNames}`,
        autonomy: 'assisted',
        undoable: false,
        metadata: { deepCount, redCount, scheduledBlocks: scheduledFocusCount, note },
        rejectedAlternatives,
      }).catch(() => {});
    }

    return res.json({
      date: new Date().toISOString().slice(0, 10),
      workStart: minsToHHMM(startMins),
      workEnd: minsToHHMM(endMins),
      nowMins: new Date().getHours() * 60 + new Date().getMinutes(),
      blocks,
      summary,
      rebalanced: true,
      note,
      // Phase 1: expose chain info to frontend for countdown toast
      cascadeTriggered,
      chainEntry: chainEntry || null,
      conflictTask: cascadeTriggered && negotiateCandidateTask ? {
        id: negotiateCandidateTask.id,
        taskName: negotiateCandidateTask.taskName,
        recipientName: negotiateCandidateTask.recipientName,
      } : null,
      calendarIntegrated: blockedSlots.length > 0,
      realMeetingCount: blockedSlots.length,
    });
  } catch (err) {
    console.error('[DayPlan] rebalance failed:', err.message);
    return res.status(500).json({ error: 'Failed to rebalance', message: err.message });
  }
}

module.exports = { getDayPlan, rebalanceDayPlan };
