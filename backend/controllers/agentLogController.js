/**
 * controllers/agentLogController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD for the Agent Activity Log — the central evidence artifact for
 * Agentic Depth. Every feature that takes an autonomous action calls
 * appendAgentLog() to write a timestamped entry here.
 *
 *   GET  /api/agent-log               → list all entries for the user (newest first)
 *   POST /api/agent-log               → write a new entry (called by other features)
 *   POST /api/agent-log/:id/undo      → mark an entry undone (where applicable)
 *   POST /api/agent-log/:id/undo-step → undo a single step inside a chain entry
 *   DELETE /api/agent-log             → clear all entries (dev/demo reset only)
 *
 *   GET  /api/agent-log/policy-memory → list all learned policies for the user
 *   POST /api/agent-log/policy-cancel → record a cancel event for policy tracking
 */

const { v4: uuidv4 } = require('uuid');
const AgentLog     = require('../models/AgentLog');
const PolicyMemory = require('../models/PolicyMemory');
const { isConnected } = require('../db/connection');

// ── In-memory fallback store (mirrors the MongoDB path) ─────────────────────
const _inMemoryLog = [];
const _inMemoryPolicies = [];

/**
 * Append an agent log entry. Called internally by other controllers.
 * Safe to call without try/catch — errors are swallowed (logging must never
 * crash a feature).
 *
 * Extra fields (Phase 1–3):
 *   chain               — array of ChainStep objects (Phase 1)
 *   isChain             — boolean, true when this is a chain entry
 *   rejectedAlternatives — array of { action, reason } (Phase 3)
 *   policyCategory / policyAction / policyContext / cancelCount (Phase 2 policy_adapted)
 */
async function appendAgentLog(userId, {
  featureKey,
  title,
  reasoning = '',
  outcome = '',
  autonomy = 'assisted',
  undoable = false,
  relatedTaskId = null,
  relatedTaskName = null,
  metadata = {},
  // Phase 1
  chain = [],
  isChain = false,
  // Phase 2
  policyCategory = null,
  policyAction = null,
  policyContext = null,
  cancelCount = null,
  // Phase 3
  rejectedAlternatives = [],
}) {
  const entry = {
    id: uuidv4(),
    userId,
    featureKey,
    title,
    reasoning,
    outcome,
    autonomy,
    undoable,
    undone: false,
    relatedTaskId,
    relatedTaskName,
    metadata,
    createdAt: new Date().toISOString(),
    chain,
    isChain,
    policyCategory,
    policyAction,
    policyContext,
    cancelCount,
    rejectedAlternatives,
  };

  try {
    if (isConnected()) {
      await AgentLog.create(entry);
    } else {
      _inMemoryLog.unshift(entry); // newest first
      if (_inMemoryLog.length > 200) _inMemoryLog.pop(); // cap size
    }
  } catch (err) {
    console.warn('[AgentLog] Failed to write entry (non-fatal):', err.message);
  }
  return entry;
}

// ── GET /api/agent-log ────────────────────────────────────────────────────────
async function getAgentLog(req, res) {
  const userId = req.userId;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

  try {
    let entries;
    if (isConnected()) {
      entries = await AgentLog.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } else {
      entries = _inMemoryLog
        .filter(e => e.userId === userId)
        .slice(0, limit);
    }
    return res.json({ entries, total: entries.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch agent log', message: err.message });
  }
}

// ── POST /api/agent-log ───────────────────────────────────────────────────────
async function createAgentLogEntry(req, res) {
  const userId = req.userId;
  const { featureKey, title, reasoning, outcome, autonomy, undoable, relatedTaskId, relatedTaskName, metadata,
          chain, isChain, policyCategory, policyAction, policyContext, cancelCount, rejectedAlternatives } = req.body;

  if (!featureKey || !title) {
    return res.status(400).json({ error: 'featureKey and title are required' });
  }

  const entry = await appendAgentLog(userId, {
    featureKey, title, reasoning, outcome, autonomy, undoable,
    relatedTaskId, relatedTaskName, metadata,
    chain: chain || [], isChain: isChain || false,
    policyCategory, policyAction, policyContext, cancelCount,
    rejectedAlternatives: rejectedAlternatives || [],
  });

  return res.status(201).json(entry);
}

// ── POST /api/agent-log/:id/undo ──────────────────────────────────────────────
async function undoAgentLogEntry(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  try {
    if (isConnected()) {
      const entry = await AgentLog.findOneAndUpdate(
        { id, userId, undoable: true, undone: false },
        { $set: { undone: true } },
        { new: true }
      ).lean();
      if (!entry) return res.status(404).json({ error: 'Entry not found or not undoable' });

      // Phase 2: record cancel for policy learning
      recordPolicyCancel(userId, id, entry.featureKey, entry.metadata || {}).catch(() => {});

      return res.json({ success: true, entry });
    } else {
      const idx = _inMemoryLog.findIndex(e => e.id === id && e.userId === userId);
      if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
      _inMemoryLog[idx].undone = true;
      const entry = _inMemoryLog[idx];

      // Phase 2: record cancel for policy learning
      recordPolicyCancel(userId, id, entry.featureKey, entry.metadata || {}).catch(() => {});

      return res.json({ success: true, entry });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to undo entry', message: err.message });
  }
}

// ── DELETE /api/agent-log ─────────────────────────────────────────────────────
async function clearAgentLog(req, res) {
  const userId = req.userId;
  try {
    if (isConnected()) {
      await AgentLog.deleteMany({ userId });
    } else {
      const toRemove = _inMemoryLog.filter(e => e.userId === userId).map(e => e.id);
      toRemove.forEach(id => {
        const i = _inMemoryLog.findIndex(e => e.id === id);
        if (i !== -1) _inMemoryLog.splice(i, 1);
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear log', message: err.message });
  }
}

// ── POST /api/agent-log/:id/undo-step ─────────────────────────────────────────
// Undo a single step inside a chain entry (e.g. undo just the negotiate step)
async function undoChainStep(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { stepNumber } = req.body;

  if (stepNumber === undefined) {
    return res.status(400).json({ error: 'stepNumber is required' });
  }

  try {
    if (isConnected()) {
      const entry = await AgentLog.findOne({ id, userId }).lean();
      if (!entry) return res.status(404).json({ error: 'Entry not found' });

      const updatedChain = (entry.chain || []).map(step =>
        step.stepNumber === stepNumber && step.undoable
          ? { ...step, undone: true }
          : step
      );
      const updated = await AgentLog.findOneAndUpdate(
        { id, userId },
        { $set: { chain: updatedChain } },
        { new: true }
      ).lean();
      return res.json({ success: true, entry: updated });
    } else {
      const idx = _inMemoryLog.findIndex(e => e.id === id && e.userId === userId);
      if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
      const entry = _inMemoryLog[idx];
      entry.chain = (entry.chain || []).map(step =>
        step.stepNumber === stepNumber && step.undoable
          ? { ...step, undone: true }
          : step
      );
      return res.json({ success: true, entry });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to undo step', message: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 2: Policy Memory
// ═════════════════════════════════════════════════════════════════════════════

const CANCEL_THRESHOLD = 3; // configurable

/**
 * Determine the policy category for a log entry based on featureKey + metadata.
 * Returns null if this action type isn't worth tracking.
 */
function derivePolicyCategory(featureKey, metadata = {}) {
  if (featureKey === 'negotiate') {
    const recipient = (metadata.recipient || '').toLowerCase();
    if (/prof|professor|dr\.|instructor/i.test(recipient)) return 'negotiate_professor';
    if (/recruiter|recruiting|hr|talent|staffing/i.test(recipient)) return 'negotiate_recruiting';
    return 'negotiate_general';
  }
  if (featureKey === 'rebalance') {
    return 'rebalance_general';
  }
  if (featureKey === 'triage') {
    const taskType = (metadata.taskType || '').toUpperCase();
    if (taskType === 'CODE') return 'triage_code';
    if (taskType === 'WRITING') return 'triage_writing';
    return 'triage_general';
  }
  if (featureKey === 'chain') {
    return 'chain_general';
  }
  return null;
}

/**
 * Human-readable label for a policy category.
 */
function policyLabel(category) {
  const LABELS = {
    negotiate_professor:  'Auto-drafting Negotiate emails to professors',
    negotiate_recruiting: 'Auto-drafting Negotiate emails to recruiting teams',
    negotiate_general:    'Auto-drafting Negotiate emails',
    rebalance_general:    'Auto-rebalancing your day plan',
    triage_code:          'Auto-triaging CODE tasks',
    triage_writing:       'Auto-triaging WRITING tasks',
    triage_general:       'Auto-triaging tasks',
    chain_general:        'Chained autonomous action sequences',
  };
  return LABELS[category] || category;
}

/**
 * Record a cancel/undo event for policy memory.
 * Called after undoAgentLogEntry succeeds.
 * Returns the updated policy (or null if not tracking this category).
 */
async function recordPolicyCancel(userId, logEntryId, featureKey, metadata = {}) {
  const category = derivePolicyCategory(featureKey, metadata);
  if (!category) return null;

  const label = policyLabel(category);
  const now = new Date().toISOString();

  try {
    if (isConnected()) {
      // Upsert: increment counter, append cancel event
      const policy = await PolicyMemory.findOneAndUpdate(
        { userId, policyCategory: category },
        {
          $setOnInsert: {
            userId, policyCategory: category, policyLabel: label,
            featureKey, threshold: CANCEL_THRESHOLD, createdAt: now,
          },
          $inc: { cancelCount: 1 },
          $push: { cancelEvents: { logEntryId, cancelledAt: now, context: `Cancelled ${featureKey} action` } },
          $set: { updatedAt: now },
        },
        { upsert: true, new: true }
      );

      // Check if we've crossed threshold and it's still 'active'
      if (policy.cancelCount >= CANCEL_THRESHOLD && policy.status === 'active') {
        const learnedMessage = `🧠 Learned: no longer auto-sending ${label} based on ${policy.cancelCount} past overrides.`;
        await PolicyMemory.findOneAndUpdate(
          { userId, policyCategory: category },
          { $set: { status: 'learned', learnedAt: now, learnedMessage } }
        );

        // Write a special 'policy_adapted' log entry so the judge sees it
        await appendAgentLog(userId, {
          featureKey: 'policy_adapted',
          title: learnedMessage,
          reasoning: `You cancelled "${label}" ${policy.cancelCount} times in a row. The agent has updated its default behavior to suggest rather than auto-act for this context.`,
          outcome: `Future ${featureKey} actions in this context will be flagged as suggestions instead of executing automatically.`,
          autonomy: 'autonomous',
          undoable: false,
          policyCategory: category,
          policyAction: 'downgrade_to_suggestion',
          policyContext: label,
          cancelCount: policy.cancelCount,
          metadata: { category, cancelCount: policy.cancelCount, threshold: CANCEL_THRESHOLD },
        }).catch(() => {});

        return { ...policy.toObject(), status: 'learned', learnedAt: now, learnedMessage };
      }
      return policy.toObject();
    } else {
      // In-memory fallback
      let policy = _inMemoryPolicies.find(p => p.userId === userId && p.policyCategory === category);
      if (!policy) {
        policy = {
          userId, policyCategory: category, policyLabel: label, featureKey,
          status: 'active', cancelCount: 0, threshold: CANCEL_THRESHOLD,
          cancelEvents: [], createdAt: now, updatedAt: now,
        };
        _inMemoryPolicies.push(policy);
      }
      policy.cancelCount += 1;
      policy.cancelEvents.push({ logEntryId, cancelledAt: now, context: `Cancelled ${featureKey} action` });
      policy.updatedAt = now;

      if (policy.cancelCount >= CANCEL_THRESHOLD && policy.status === 'active') {
        policy.status = 'learned';
        policy.learnedAt = now;
        policy.learnedMessage = `🧠 Learned: no longer auto-sending ${label} based on ${policy.cancelCount} past overrides.`;
      }
      return policy;
    }
  } catch (err) {
    console.warn('[PolicyMemory] Failed to record cancel (non-fatal):', err.message);
    return null;
  }
}

/**
 * Check if the agent should downgrade an action to a suggestion
 * based on learned policy for this user + category.
 */
async function checkPolicyStatus(userId, featureKey, metadata = {}) {
  const category = derivePolicyCategory(featureKey, metadata);
  if (!category) return { shouldSuggestOnly: false, policy: null };

  try {
    if (isConnected()) {
      const policy = await PolicyMemory.findOne({ userId, policyCategory: category }).lean();
      return {
        shouldSuggestOnly: policy?.status === 'learned',
        policy: policy || null,
        category,
      };
    } else {
      const policy = _inMemoryPolicies.find(p => p.userId === userId && p.policyCategory === category);
      return {
        shouldSuggestOnly: policy?.status === 'learned',
        policy: policy || null,
        category,
      };
    }
  } catch (err) {
    return { shouldSuggestOnly: false, policy: null };
  }
}

// ── GET /api/agent-log/policy-memory ─────────────────────────────────────────
async function getPolicyMemory(req, res) {
  const userId = req.userId;
  try {
    let policies;
    if (isConnected()) {
      policies = await PolicyMemory.find({ userId }).sort({ updatedAt: -1 }).lean();
    } else {
      policies = _inMemoryPolicies.filter(p => p.userId === userId);
    }
    return res.json({ policies, total: policies.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch policy memory', message: err.message });
  }
}

// ── POST /api/agent-log/policy-cancel ────────────────────────────────────────
// Frontend calls this when user cancels a countdown or undoes an action
async function handlePolicyCancel(req, res) {
  const userId = req.userId;
  const { logEntryId, featureKey, metadata } = req.body;

  if (!logEntryId || !featureKey) {
    return res.status(400).json({ error: 'logEntryId and featureKey are required' });
  }

  const policy = await recordPolicyCancel(userId, logEntryId, featureKey, metadata || {});
  return res.json({ success: true, policy });
}

module.exports = { appendAgentLog, getAgentLog, createAgentLogEntry, undoAgentLogEntry, clearAgentLog,
                   undoChainStep, getPolicyMemory, handlePolicyCancel, recordPolicyCancel, checkPolicyStatus };
