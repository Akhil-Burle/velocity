/**
 * seed-agent-log-data.js
 * Phase 1–3 seeded agent log entries and Phase 2 policy memory
 * Imported by seed-rich.js
 */
const { v4: uuidv4 } = require('uuid');

// Re-using the same time helpers from seed-rich via params
function buildAgentLogPhase(userId, ids, minsAgo, hoursAgo, daysAgo) {
  return [
    // ── PHASE 1: Action Chain (cascade) ──────────────────────────────────────
    {
      id: uuidv4(), userId,
      featureKey: 'chain',
      title: 'Rebalanced day → detected conflict → auto-drafted extension for "Systems Design Interview"',
      reasoning: 'Rebalance resolved most conflicts but day remained overloaded by ~3.5h. Agent cascaded automatically.',
      outcome: '3-step chain: rebalanced blocks → confirmed hard conflict → drafted negotiate email.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
      isChain: true,
      chain: [
        {
          stepNumber: 1, featureKey: 'rebalance',
          title: 'Rebalanced 6 focus blocks — front-loaded 3 HIGH cognitive tasks into morning',
          reasoning: 'Detected 3 deep-focus tasks and 3 RED critical tasks. Sorted by energy-first, then urgency.',
          outcome: 'OS Assignment → 09:00, Meta Interview → 11:30, Capstone WebSocket → 14:00.',
          undoable: false, undone: false,
          relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
          timestamp: minsAgo(18),
          rejectedAlternatives: [
            { action: 'Schedule quick-wins first (3 tasks)', reason: 'Would waste morning peak hours on low-cognitive work.' },
            { action: 'Order RED tasks by deadline only', reason: 'Mixing energy levels mid-morning fragments focus.' },
          ],
        },
        {
          stepNumber: 2, featureKey: 'rebalance',
          title: 'Still detected 2 tasks that can\'t fit today — hard conflict on "Systems Design Write-up"',
          reasoning: 'After optimal rebalancing, 2 tasks still can\'t be scheduled. Day overloaded by ~3.5h.',
          outcome: 'Hard conflict confirmed. Cascading to negotiation for the best extension candidate.',
          undoable: false, undone: false,
          relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
          timestamp: minsAgo(17),
          rejectedAlternatives: [
            { action: 'Auto-triage the conflicting task', reason: 'Task is RED — deferring worsens deadline pressure, not resolves it.' },
          ],
        },
        {
          stepNumber: 3, featureKey: 'negotiate',
          title: 'Drafted extension request for "Systems Design Write-up" — queued for auto-send',
          reasoning: 'Owed to Recruiting Team, 22% complete — strongest extension case among unscheduled RED tasks.',
          outcome: 'AI drafted 24h extension request to Recruiting Team — queued via 10-second countdown.',
          undoable: true, undone: false,
          relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
          timestamp: minsAgo(16),
          rejectedAlternatives: [
            { action: 'Request extension for OS Assignment instead', reason: 'OS Assignment is self-owned — negotiate only works for tasks owed to others.' },
          ],
        },
      ],
      metadata: { scheduledBlocks: 6, unscheduled: 2, cascadeTarget: 'Systems Design Interview Write-up', overloadHours: 3.5 },
      rejectedAlternatives: [
        { action: 'Schedule quick-wins first', reason: 'Would waste morning peak hours on low-cognitive work.' },
        { action: 'Order RED tasks by deadline only', reason: 'Mixing energy levels fragments focus.' },
      ],
      createdAt: minsAgo(18),
    },
    // ── PHASE 2: Policy adapted — negotiate to recruiting teams ──────────────
    {
      id: uuidv4(), userId,
      featureKey: 'policy_adapted',
      title: '🧠 Learned: no longer auto-sending Negotiate emails to recruiting teams based on 3 past overrides.',
      reasoning: 'You cancelled "Auto-drafting Negotiate emails to recruiting teams" 3 times in a row. Agent updated default to suggest rather than auto-act.',
      outcome: 'Future negotiate actions to recruiting-type recipients flagged as suggestions, not auto-sent.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: null, relatedTaskName: null,
      policyCategory: 'negotiate_recruiting',
      policyAction: 'downgrade_to_suggestion',
      policyContext: 'Auto-drafting Negotiate emails to recruiting teams',
      cancelCount: 3,
      metadata: { category: 'negotiate_recruiting', cancelCount: 3, threshold: 3 },
      createdAt: daysAgo(2),
    },
    // ── PHASE 2: Policy adapted — triage of code tasks ────────────────────────
    {
      id: uuidv4(), userId,
      featureKey: 'policy_adapted',
      title: '🧠 Learned: no longer auto-triaging CODE tasks based on 3 past overrides.',
      reasoning: 'You cancelled "Auto-triaging CODE tasks" 3 times. Consistently choosing to keep CODE tasks active.',
      outcome: 'Future triage suggestions for CODE tasks flagged for manual review rather than auto-executed.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: null, relatedTaskName: null,
      policyCategory: 'triage_code',
      policyAction: 'downgrade_to_suggestion',
      policyContext: 'Auto-triaging CODE tasks',
      cancelCount: 3,
      metadata: { category: 'triage_code', cancelCount: 3, threshold: 3 },
      createdAt: daysAgo(4),
    },
  ];
}

module.exports = { buildAgentLogPhase };
