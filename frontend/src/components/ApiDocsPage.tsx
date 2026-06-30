/**
 * ApiDocsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live API reference — all endpoints pulled from actual backend route/controller
 * files. Collapsed by default (judge-scannable), expand-on-click for full detail.
 * Matches the app's dark theme exactly — same CSS vars, same motion patterns,
 * same surface/border colors as TechStackPage and Dashboard.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, ChevronDown, ChevronRight, Search, X,
  Lock, Globe, Zap, Brain, RefreshCw, CheckCircle2,
  Activity, Shield, Calendar, Target, Settings,
  BarChart2, Layers,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { checkHealth } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  auth: 'public' | 'jwt';
  params?: Param[];
  responseShape?: string;
  agentic?: boolean; // highlight endpoints that prove agentic depth
}

interface EndpointGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  endpoints: Endpoint[];
}

// ─── Method badge colors ──────────────────────────────────────────────────────

const METHOD_COLOR: Record<HttpMethod, { bg: string; text: string }> = {
  GET:    { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' },
  POST:   { bg: 'rgba(59,130,246,0.13)', text: '#60a5fa' },
  PATCH:  { bg: 'rgba(245,158,11,0.13)', text: '#fbbf24' },
  PUT:    { bg: 'rgba(168,85,247,0.13)', text: '#c084fc' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',  text: '#f87171' },
};

// ─── Endpoint Data (sourced from actual route/controller files) ───────────────

const GROUPS: EndpointGroup[] = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    id: 'auth',
    label: 'Auth',
    icon: <Shield size={13} />,
    color: '#fbbc04',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/guest',
        summary: 'Start a guest session — no credentials required. Returns a JWT valid for the demo user.',
        auth: 'public',
        responseShape: `{ token: string, userId: string, mode: "guest" }`,
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        summary: 'Demo login with username/password (demo / velocity2026). Returns a Velocity JWT.',
        auth: 'public',
        params: [
          { name: 'username', type: 'string', required: true, description: 'Demo username' },
          { name: 'password', type: 'string', required: true, description: 'Demo password' },
        ],
        responseShape: `{ token: string, userId: string, mode: "demo" }`,
      },
      {
        method: 'GET',
        path: '/api/auth/google',
        summary: 'Initiate Google OAuth 2.0 consent flow. Redirects to Google Sign-In.',
        auth: 'public',
      },
      {
        method: 'GET',
        path: '/api/auth/google/callback',
        summary: 'OAuth callback — receives Google authorization code, issues a Velocity JWT, redirects to /dashboard.',
        auth: 'public',
      },
      {
        method: 'GET',
        path: '/api/auth/google/status',
        summary: 'Check whether Google OAuth is configured on this backend instance.',
        auth: 'public',
        responseShape: `{ configured: boolean }`,
      },
      {
        method: 'GET',
        path: '/api/health',
        summary: 'Backend health + live AI/DB status. Used by the Tech Stack page to show live indicators.',
        auth: 'public',
        agentic: false,
        responseShape: `{
  status: "ok",
  service: "velocity-backend",
  version: "2.1.0",
  timestamp: ISO,
  mongoConnected: boolean,
  geminiConfigured: boolean,
  aiBackend: "vertex_ai" | "gemini_developer",
  aiBackendLabel: string,
  aiModel: string,
  vertexProject: string,
  vertexLocation: string
}`,
      },
    ],
  },

  // ── Tasks & Subtasks ───────────────────────────────────────────────────────
  {
    id: 'tasks',
    label: 'Tasks & Subtasks',
    icon: <CheckCircle2 size={13} />,
    color: '#22c55e',
    endpoints: [
      {
        method: 'GET',
        path: '/api/tasks',
        summary: 'Fetch all tasks for the authenticated user.',
        auth: 'jwt',
        responseShape: `Task[]  // see Task shape below`,
      },
      {
        method: 'POST',
        path: '/api/tasks',
        summary: 'Manually create a task (no AI). Returns the new task with computed pace metrics.',
        auth: 'jwt',
        params: [
          { name: 'taskName', type: 'string', required: true, description: 'Task title' },
          { name: 'deadline', type: 'string (ISO)', required: true, description: 'Deadline date' },
          { name: 'taskType', type: 'CODE | WRITING | DIAGRAM | OTHER', required: false, description: 'Categorises boilerplate type for Panic Mode' },
          { name: 'cognitiveWeight', type: 'LOW | MEDIUM | HIGH', required: false, description: 'Used by Day Plan energy routing' },
          { name: 'selfOwned', type: 'boolean', required: false, description: 'false = has a recipient, enables Negotiate' },
          { name: 'recipientName', type: 'string', required: false, description: 'Required when selfOwned is false' },
          { name: 'completionPercent', type: 'number (0–100)', required: false, description: 'Initial progress' },
          { name: 'energyLevel', type: 'Deep Focus | Quick Wins | Brain-Dead', required: false, description: 'Time-of-day routing hint' },
          { name: 'estimatedDuration', type: 'number (minutes)', required: false, description: 'Used to size Day Plan blocks' },
        ],
      },
      {
        method: 'PATCH',
        path: '/api/tasks/:id',
        summary: 'Update any task field. Status (GREEN/AMBER/RED) is recomputed from pace on each check-in.',
        auth: 'jwt',
      },
      {
        method: 'POST',
        path: '/api/tasks/:id/complete',
        summary: 'Mark a task complete. Awards Velocity Credits based on on-time delivery and pace differential.',
        auth: 'jwt',
        responseShape: `{ task: Task, creditAward: { credits: number, reason: string, onTime: boolean } }`,
      },
      {
        method: 'POST',
        path: '/api/tasks/:id/subtasks',
        summary: 'Add a subtask to a task.',
        auth: 'jwt',
        params: [
          { name: 'title', type: 'string', required: true, description: 'Subtask title' },
          { name: 'estimatedMinutes', type: 'number', required: false, description: 'Time estimate — used by Reschedule engine' },
        ],
        responseShape: `{ subtask: { id, title, estimatedMinutes, completed }, task: Task }`,
      },
      {
        method: 'PATCH',
        path: '/api/tasks/:id/subtasks/:subtaskId',
        summary: 'Toggle completed, or update title/estimatedMinutes.',
        auth: 'jwt',
      },
      {
        method: 'DELETE',
        path: '/api/tasks/:id/subtasks/:subtaskId',
        summary: 'Remove a subtask.',
        auth: 'jwt',
      },
    ],
  },

  // ── Pace Engine & Forecast ─────────────────────────────────────────────────
  {
    id: 'pace',
    label: 'Pace Engine & Forecast',
    icon: <BarChart2 size={13} />,
    color: '#4285f4',
    endpoints: [
      {
        method: 'POST',
        path: '/api/checkins',
        summary: 'Submit a progress check-in for a task. Updates the pace sparkline, recomputes finish probability, and sets status (GREEN/AMBER/RED).',
        auth: 'jwt',
        params: [
          { name: 'taskId', type: 'string', required: true, description: 'Target task ID' },
          { name: 'selfReportPercent', type: 'number (0–100)', required: true, description: 'User-reported completion percentage' },
          { name: 'selfReportText', type: 'string', required: false, description: 'Optional freetext note' },
        ],
        responseShape: `{
  task: { ...taskFields, status: "GREEN" | "AMBER" | "RED" },
  trustScore: number,   // 100 - gap*2  (how far self-report differs from expected)
  mode: "normal" | "amber" | "critical"
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/forecast',
        summary: 'Run the proactive Forecast Agent across all active tasks. Computes finish probabilities and — autonomously — writes drift_alert entries to the Agent Log for any task below 45%.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{
  portfolioHealth: number,         // weighted avg across all tasks (RED tasks = 3×)
  forecasts: [{
    taskId, taskName,
    probability: number,           // 0–100 finish probability
    trend: "improving" | "declining" | "stable",
    riskLevel: "safe" | "watch" | "critical",
    recovery: string | null,       // specific next action to take right now
    trustDecay: number,            // % to drain from stale displayed progress
    daysToDeadline, drift,
    velocityRate, requiredRate,
    consistency: number            // 0–100 pace consistency score
  }],
  autonomousActions: [{            // entries written to Agent Log WITHOUT user trigger
    taskId, taskName, probability, recovery, logEntryId
  }],
  generatedAt: ISO
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/drift-score',
        summary: 'Compute behavioral drift score for one task — compares self-reported progress against inferred real progress from subtask completion, OmniBar language signals, and pace staleness.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'taskId', type: 'string', required: true, description: 'Target task ID' },
        ],
        responseShape: `{
  taskId, taskName,
  inferredReal: number,    // 0–100 behavioral estimate
  selfReported: number,    // what user last reported
  gap: number,             // inferredReal - selfReported
  confidence: "high" | "medium" | "low" | "sparse",
  signals: { subtask, staleness, panic, language },
  explanation: string[]
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/drift-score-batch',
        summary: 'Compute drift for all active tasks and synthesize the Velocity Vector — a momentum indicator showing overall progress direction.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{
  driftScores: DriftScore[],
  velocityVector: {
    magnitude: number,           // 0–100 overall throughput
    direction: "good" | "mixed" | "poor",
    alignment: number,           // 0–100 real vs required pace alignment
    worstOffenders: [{ taskId, taskName, driftGap, probability, status }]
  },
  generatedAt: ISO
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/drift-signal',
        summary: 'Extract a progress sentiment delta from a natural-language utterance (used by OmniBar to passively update drift scores).',
        auth: 'jwt',
        params: [
          { name: 'utterance', type: 'string', required: true, description: 'Natural language input (e.g. "barely started the report")' },
          { name: 'taskId', type: 'string | null', required: false, description: 'Task to apply signal to' },
        ],
        responseShape: `{ delta: number | null }`,
      },
    ],
  },

  // ── Agent Actions ──────────────────────────────────────────────────────────
  {
    id: 'agent',
    label: 'Agent Actions',
    icon: <Brain size={13} />,
    color: '#a78bfa',
    endpoints: [
      {
        method: 'POST',
        path: '/api/braindump',
        summary: 'Parse freeform text or an image (Chaos Scanner) via Gemini — extracts structured tasks with deadlines, types, and subtasks. Returns array of created Task objects.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'text', type: 'string', required: false, description: 'Freeform dump — "finish ML assignment by Thursday, email prof by noon, debug auth"' },
          { name: 'imageData', type: 'string (base64)', required: false, description: 'Photo of whiteboard/syllabus — Gemini Vision extracts tasks' },
          { name: 'mimeType', type: 'string', required: false, description: 'e.g. "image/jpeg"' },
          { name: 'tzOffsetMinutes', type: 'number', required: false, description: 'Local timezone offset for relative deadline resolution' },
        ],
        responseShape: `Task[]  // 201 — each task has: id, taskName, deadline, taskType,
        // cognitiveWeight, subtasks[], status: "GREEN", sparkline: []`,
      },
      {
        method: 'POST',
        path: '/api/triage',
        summary: 'Auto-triage: when workload exceeds available hours, defer the lowest-weight, furthest-deadline task. Writes an Agent Log entry with reasoning and rejected alternatives.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{
  triaged: boolean,
  reason: string,             // "Overloaded by ~3h. 'Task X' (LOW weight) deferred."
  triagedTask: Task | null    // full task object if something was deferred
}

// Agent Log entry also written:
// featureKey: "triage", autonomy: "assisted"
// reasoning: "Workload exceeded available time by ~Nh..."
// outcome: "Task rescheduled. N tasks remain active."`,
      },
      {
        method: 'POST',
        path: '/api/negotiate',
        summary: 'Draft a professional extension-request email via Gemini for any task with a named recipient. Persists the draft to the task. Falls back to a template if AI is unavailable.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'taskId', type: 'string', required: true, description: 'Must be a non-self-owned task with a recipientName' },
        ],
        responseShape: `{
  message: string,     // Gemini-drafted or template email
  warning?: string     // present only when fallback template was used
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/panic-scaffold',
        summary: 'Zero-Hour Panic Mode: generate a step-by-step rescue checklist + runnable boilerplate for an imminent-deadline task. If GITHUB_TOKEN is configured, autonomously creates a public GitHub repo and commits the scaffold.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'taskId', type: 'string', required: true, description: 'Task to rescue — typically RED status' },
        ],
        responseShape: `{
  cached: boolean,            // true if scaffold was already generated
  checklist: string[],        // AI-generated step-by-step rescue plan
  boilerplate: string,        // runnable code or structured outline
  repoUrl: string | null      // GitHub repo URL if auto-created
}

// Agent Log entry: featureKey: "panic", autonomy: "autonomous" (if repo created)
// "Panic Mode activated — N-step rescue generated. GitHub repo created: <url>"`,
      },
      {
        method: 'POST',
        path: '/api/hotstart',
        summary: 'Generate a context-specific "hot start" scaffold for any task — first-line code, outline, or diagram structure to eliminate blank-page friction.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'taskId', type: 'string', required: true, description: 'Target task' },
        ],
        responseShape: `{ scaffold: string, warning?: string }`,
      },
      {
        method: 'POST',
        path: '/api/reschedule',
        summary: 'Repack all subtasks into available work slots. Writes an Agent Log entry with autonomy: "autonomous".',
        auth: 'jwt',
        agentic: true,
        responseShape: `{
  success: boolean,
  rescheduled: number,
  events: [{ taskId, subtaskId, date, startTime }],
  message: string
}`,
      },
    ],
  },

  // ── OmniBar / Intent ───────────────────────────────────────────────────────
  {
    id: 'omnibar',
    label: 'OmniBar / Intent',
    icon: <Zap size={13} />,
    color: '#22c55e',
    endpoints: [
      {
        method: 'POST',
        path: '/api/agent/omni-parse',
        summary: 'Classify natural language (text or voice) into a structured intent. Checks Policy Memory — if user has previously cancelled this action type 3+ times, downgrades confidence to prevent auto-execution.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'utterance', type: 'string', required: true, description: 'Natural language command, e.g. "panic mode on my ML assignment"' },
        ],
        responseShape: `{
  intent: "create_task" | "run_triage" | "panic_mode" | "smart_routing"
         | "negotiate" | "rebalance" | "query" | "unclear",
  confidence: "high" | "medium" | "low",
  params: { taskName?, deadline?, category? },
  explanation: string,
  taskId: string | null,
  _policyDowngraded?: boolean,    // true if Policy Memory overrode confidence
  _policyLabel?: string           // human-readable reason for downgrade
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/omni-execute',
        summary: 'Execute a previously classified intent (called after the countdown completes or on high confidence). Delegates to the relevant agent action and writes an Activity Log entry.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'intent', type: 'string', required: true, description: 'From omni-parse result' },
          { name: 'utterance', type: 'string', required: true, description: 'Original user utterance' },
          { name: 'taskId', type: 'string | null', required: false, description: 'From omni-parse result' },
          { name: 'params', type: 'object', required: false, description: 'From omni-parse result' },
          { name: 'confidence', type: 'high | medium | low', required: false, description: 'From omni-parse result' },
        ],
        responseShape: `{
  success: boolean,
  intent: string,
  result: actionResult,    // varies by intent (Task, triage result, scaffold, etc.)
  logEntryId: string | null
}`,
      },
      {
        method: 'POST',
        path: '/api/agent/tts',
        summary: 'Synthesize a text response to speech via Google Cloud TTS (en-US-Journey-F WaveNet). Completes the voice loop: Web Speech API in → Cloud TTS out.',
        auth: 'jwt',
        params: [
          { name: 'text', type: 'string', required: true, description: 'Text to speak' },
        ],
        responseShape: `{ audioBase64: string | null, fallback: boolean }`,
      },
      {
        method: 'GET',
        path: '/api/agent/tts/status',
        summary: 'Check whether Cloud TTS is configured on this backend.',
        auth: 'public',
        responseShape: `{ configured: boolean }`,
      },
    ],
  },

  // ── Agent Log & Policy Memory ──────────────────────────────────────────────
  {
    id: 'agent-log',
    label: 'Agent Log & Policy Memory',
    icon: <Activity size={13} />,
    color: '#34a853',
    endpoints: [
      {
        method: 'GET',
        path: '/api/agent-log',
        summary: 'List all agent activity entries (newest first). Every autonomous action — triage, negotiate, panic, chain, drift_alert, policy_adapted — is recorded here.',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'limit', type: 'number (query)', required: false, description: 'Max entries to return (default 50, max 100)' },
        ],
        responseShape: `{
  entries: [{
    id, featureKey, title, reasoning, outcome,
    autonomy: "autonomous" | "assisted" | "countdown",
    undoable, undone,
    relatedTaskId, relatedTaskName,
    createdAt,
    isChain: boolean,                          // true = multi-step cascade
    chain: [{                                  // steps in a cascade
      stepNumber, featureKey, title, reasoning, outcome,
      undoable, relatedTaskId, timestamp,
      rejectedAlternatives: [{ action, reason }]
    }],
    rejectedAlternatives: [{ action, reason }], // why agent chose THIS path
    policyCategory,      // e.g. "negotiate_recruiting"
    policyAction,        // "downgrade_to_suggestion" when policy_adapted
    cancelCount
  }],
  total: number
}`,
      },
      {
        method: 'POST',
        path: '/api/agent-log/:id/undo',
        summary: 'Undo an agent action (where undoable: true). Also records a Policy Cancel event — after 3 cancels of the same action type, Policy Memory kicks in.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{ success: boolean, entry: AgentLogEntry }`,
      },
      {
        method: 'POST',
        path: '/api/agent-log/:id/undo-step',
        summary: 'Undo a single step inside a chain entry (e.g. undo the negotiate step without undoing the rebalance that triggered it).',
        auth: 'jwt',
        agentic: true,
        params: [
          { name: 'stepNumber', type: 'number', required: true, description: 'Step index to undo (1-based)' },
        ],
        responseShape: `{ success: boolean, entry: AgentLogEntry }`,
      },
      {
        method: 'GET',
        path: '/api/agent-log/policy-memory',
        summary: 'List all learned behavioral policies for this user. A policy moves from "active" to "learned" after 3 cancels — after which the agent suggests instead of auto-acts.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{
  policies: [{
    policyCategory,        // e.g. "negotiate_professor"
    policyLabel,           // "Auto-drafting Negotiate emails to professors"
    featureKey,
    status: "active" | "learned",
    cancelCount, threshold,
    learnedAt, learnedMessage,
    cancelEvents: [{ logEntryId, cancelledAt, context }]
  }],
  total: number
}`,
      },
      {
        method: 'POST',
        path: '/api/agent-log/policy-cancel',
        summary: 'Record a cancel event for policy learning. Called by the frontend when a user dismisses a countdown or explicitly cancels an agent action.',
        auth: 'jwt',
        params: [
          { name: 'logEntryId', type: 'string', required: true, description: 'The log entry being cancelled' },
          { name: 'featureKey', type: 'string', required: true, description: 'e.g. "negotiate"' },
          { name: 'metadata', type: 'object', required: false, description: 'Context for category derivation (e.g. { recipient })' },
        ],
        responseShape: `{ success: boolean, policy: PolicyMemory | null }`,
      },
      {
        method: 'DELETE',
        path: '/api/agent-log',
        summary: 'Clear all agent log entries for the user. Dev/demo reset only.',
        auth: 'jwt',
        responseShape: `{ success: boolean }`,
      },
    ],
  },

  // ── Calendar & Scheduling ──────────────────────────────────────────────────
  {
    id: 'calendar',
    label: 'Calendar & Scheduling',
    icon: <Calendar size={13} />,
    color: '#34a853',
    endpoints: [
      {
        method: 'GET',
        path: '/api/calendar',
        summary: 'Fetch today\'s events from the user\'s connected Google Calendar. Returns blocked slots used by Command Day to avoid scheduling focus blocks during meetings.',
        auth: 'jwt',
        responseShape: `CalendarEvent[]  // { id, title, start, end, allDay }`,
      },
      {
        method: 'GET',
        path: '/api/dayplan',
        summary: 'Build today\'s full timeline — focus blocks, recovery buffers, and real calendar meetings — packed into configured work hours. Sorted chronologically.',
        auth: 'jwt',
        responseShape: `{
  date, workStart, workEnd, nowMins,
  blocks: [{
    id, type: "focus" | "buffer" | "meeting",
    title, start, end, durationMins, status,
    energyLevel, taskId?, cognitiveWeight?,
    completionPercent?, isRealCalendarEvent?
  }],
  summary: {
    capacityHours, requiredHours, scheduledCount,
    unscheduled, loadPercent, taskCount
  },
  calendarIntegrated: boolean,
  realMeetingCount: number
}`,
      },
      {
        method: 'POST',
        path: '/api/dayplan/rebalance',
        summary: 'Energy-aware reorder: front-loads Deep Focus (HIGH cognitive weight) tasks into morning peak hours, Quick Wins to afternoon. If the day is over-capacity, auto-cascades to Negotiate and writes a 3-step chain to the Agent Log.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{
  ...DayPlan,
  rebalanced: true,
  note: string,                   // Gemini coaching note or deterministic fallback
  cascadeTriggered: boolean,      // true = agent auto-drafted a negotiate email too
  chainEntry: {                   // Agent Log entry for the full 3-step chain
    isChain: true,
    chain: [rebalanceStep, conflictStep, negotiateStep],
    autonomy: "autonomous",
    rejectedAlternatives: [{ action, reason }]
  } | null,
  conflictTask: { id, taskName, recipientName } | null
}`,
      },
    ],
  },

  // ── Goals & Habits ─────────────────────────────────────────────────────────
  {
    id: 'goals',
    label: 'Goals & Habits',
    icon: <Target size={13} />,
    color: '#f59e0b',
    endpoints: [
      { method: 'GET', path: '/api/goals', summary: 'Fetch all goals for the user.', auth: 'jwt' },
      {
        method: 'POST',
        path: '/api/goals',
        summary: 'Create a goal with optional task links and target date.',
        auth: 'jwt',
        params: [
          { name: 'title', type: 'string', required: true, description: 'Goal title' },
          { name: 'description', type: 'string', required: false, description: 'Detail' },
          { name: 'targetDate', type: 'string (ISO)', required: false, description: 'Target completion date' },
        ],
      },
      { method: 'DELETE', path: '/api/goals/:id', summary: 'Delete a goal.', auth: 'jwt' },
      { method: 'GET', path: '/api/habits', summary: 'Fetch all habits for the user.', auth: 'jwt' },
      {
        method: 'POST',
        path: '/api/habits',
        summary: 'Create a habit with daily or weekly frequency.',
        auth: 'jwt',
        params: [
          { name: 'title', type: 'string', required: true, description: 'Habit title' },
          { name: 'frequency', type: 'daily | weekly', required: true, description: 'Check-in cadence' },
        ],
      },
      {
        method: 'PATCH',
        path: '/api/habits/:id/checkin',
        summary: 'Check in on a habit. Updates streak and history.',
        auth: 'jwt',
        params: [
          { name: 'completed', type: 'boolean', required: true, description: 'Whether the habit was completed today' },
        ],
      },
      { method: 'DELETE', path: '/api/habits/:id', summary: 'Delete a habit.', auth: 'jwt' },
    ],
  },

  // ── Insights & Analytics ───────────────────────────────────────────────────
  {
    id: 'insights',
    label: 'Insights & Analytics',
    icon: <BarChart2 size={13} />,
    color: '#38bdf8',
    endpoints: [
      {
        method: 'POST',
        path: '/api/insights/generate',
        summary: 'Generate a full insights report: Velocity DNA radar, pace analysis, habit streaks, and weekly performance. Powered by Gemini.',
        auth: 'jwt',
      },
      {
        method: 'GET',
        path: '/api/insights/dna',
        summary: 'Fetch the Velocity DNA productivity fingerprint — radar chart axes (focus depth, consistency, deadline adherence, adaptability, recovery) and inferred archetype.',
        auth: 'jwt',
      },
      {
        method: 'GET',
        path: '/api/insights/prebrief',
        summary: 'Tomorrow\'s planning pre-brief: top priorities, energy recommendations, and conflict warnings for the next day.',
        auth: 'jwt',
      },
      {
        method: 'GET',
        path: '/api/insights/weekly',
        summary: 'Weekly velocity report: tasks completed, on-time rate, credit earnings, agent action summary.',
        auth: 'jwt',
      },
      {
        method: 'GET',
        path: '/api/insights/results',
        summary: 'Impact evidence view: total agent actions, autonomous saves, hours estimated saved, panic rescues, negotiate drafts, drift alerts.',
        auth: 'jwt',
        responseShape: `{
  tasksCompleted, onTimeDeliveries, onTimeRate,
  autonomousSaves, assistedActions, totalAgentActions,
  hoursSaved, rebalances, triages, panicRescues,
  negotiateDrafts, driftAlerts, checkIns,
  recentActions: [{ title, featureKey, autonomy, createdAt }]
}`,
      },
    ],
  },

  // ── Ultimatum ──────────────────────────────────────────────────────────────
  {
    id: 'ultimatum',
    label: 'Ultimatum & Conflict Resolution',
    icon: <Zap size={13} />,
    color: '#ef4444',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ultimatum/evaluate',
        summary: 'Detect a genuine two-task conflict — two self-owned tasks that cannot both finish before the earlier of their deadlines. Uses Gemini to generate specific, data-driven cost lines for each.',
        auth: 'jwt',
        agentic: true,
        responseShape: `{ triggered: false }
// or
{
  triggered: true,
  taskA: { ...Task, failureCost: string },  // AI-generated consequence line
  taskB: { ...Task, failureCost: string }
}`,
      },
      {
        method: 'POST',
        path: '/api/ultimatum/resolve',
        summary: 'Resolve a conflict: mark the losing task as rescheduled, log the decision. Creates a DecisionLog entry for audit.',
        auth: 'jwt',
        params: [
          { name: 'winningTaskId', type: 'string', required: true, description: 'Task the user chooses to protect' },
          { name: 'losingTaskId', type: 'string', required: true, description: 'Task to defer' },
        ],
        responseShape: `{
  success: boolean,
  winningTask: Task,
  losingTask: Task,    // isRescheduled: true
  reasoning: string,
  confirmation: string
}`,
      },
    ],
  },

  // ── Settings & Gamification ────────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings & Gamification',
    icon: <Settings size={13} />,
    color: '#94a3b8',
    endpoints: [
      { method: 'GET', path: '/api/settings', summary: 'Fetch user settings (work hours, theme, notifications).', auth: 'jwt' },
      {
        method: 'PATCH',
        path: '/api/settings',
        summary: 'Update settings. preferredWorkStart/End affect Day Plan capacity calculations.',
        auth: 'jwt',
      },
      {
        method: 'POST',
        path: '/api/briefing/generate',
        summary: 'Generate a daily briefing narrative via Gemini — what to focus on, what\'s at risk, what to defer.',
        auth: 'jwt',
        responseShape: `{ briefing: string, generatedAt: ISO }`,
      },
      {
        method: 'GET',
        path: '/api/reminders/active',
        summary: 'Fetch active reminders (deadline warnings, habit nudges, briefing prompts) — polled every 60s by the notification bell.',
        auth: 'jwt',
      },
      {
        method: 'GET',
        path: '/api/gamification/profile',
        summary: 'Fetch the user\'s Velocity Credits profile: level, total credits, achievement badges.',
        auth: 'jwt',
      },
      {
        method: 'POST',
        path: '/api/gamification/award',
        summary: 'Award credits for a specific action. Credits scale with on-time delivery and pace-differential accuracy.',
        auth: 'jwt',
      },
      {
        method: 'GET',
        path: '/api/gamification/leaderboard',
        summary: 'Anonymized cohort ranking + user percentile.',
        auth: 'jwt',
      },
    ],
  },
];

// ─── Stats ────────────────────────────────────────────────────────────────────

const TOTAL_ENDPOINTS = GROUPS.reduce((s, g) => s + g.endpoints.length, 0);
const TOTAL_GROUPS = GROUPS.length;

// ─── Sub-components ───────────────────────────────────────────────────────────

const MethodBadge: React.FC<{ method: HttpMethod }> = ({ method }) => {
  const { bg, text } = METHOD_COLOR[method];
  return (
    <span
      className="inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: bg, color: text, minWidth: 42, textAlign: 'center' }}
    >
      {method}
    </span>
  );
};

const AuthBadge: React.FC<{ auth: 'public' | 'jwt' }> = ({ auth }) => {
  if (auth === 'public') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
        style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
        <Globe size={8} /> public
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
      style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.18)' }}>
      <Lock size={8} /> JWT
    </span>
  );
};

const AgentBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
    style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.22)' }}>
    <Brain size={8} /> agentic
  </span>
);

const EndpointRow: React.FC<{
  ep: Endpoint;
  surfaceBg: string;
  surfaceBorder: string;
  divider: string;
  isDark: boolean;
  isLast: boolean;
}> = ({ ep, surfaceBg, surfaceBorder, divider, isDark, isLast }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = ep.params || ep.responseShape;

  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${divider}` }}>
      <button
        onClick={() => hasDetail && setOpen(v => !v)}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        <MethodBadge method={ep.method} />
        <span className="font-mono text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
          {ep.path}
        </span>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <AuthBadge auth={ep.auth} />
          {ep.agentic && <AgentBadge />}
        </div>
        {hasDetail && (
          <span style={{ color: 'var(--text-faint)' }}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 space-y-3"
              style={{ borderTop: `1px solid ${divider}` }}>
              <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {ep.summary}
              </p>

              {ep.params && ep.params.length > 0 && (
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                    Parameters
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${divider}` }}>
                    {ep.params.map((p, i) => (
                      <div key={p.name}
                        className="flex items-start gap-3 px-3 py-2"
                        style={{ borderBottom: i < ep.params!.length - 1 ? `1px solid ${divider}` : 'none',
                                 background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                        <code className="text-[10px] font-mono shrink-0" style={{ color: '#60a5fa' }}>{p.name}</code>
                        <span className="text-[9px] font-mono shrink-0 px-1 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}>{p.type}</span>
                        <span className="text-[9px] font-mono shrink-0"
                          style={{ color: p.required ? '#f87171' : '#22c55e' }}>
                          {p.required ? 'required' : 'optional'}
                        </span>
                        <span className="text-[10px] font-mono flex-1" style={{ color: 'var(--text-muted)' }}>
                          {p.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ep.responseShape && (
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                    Response Shape
                  </p>
                  <pre
                    className="text-[10px] font-mono leading-relaxed p-3 rounded-xl overflow-x-auto"
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${divider}`,
                      color: isDark ? '#86efac' : '#16a34a',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {ep.responseShape}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Group Card ────────────────────────────────────────────────────────────────

const GroupCard: React.FC<{
  group: EndpointGroup;
  surfaceBg: string;
  surfaceBorder: string;
  divider: string;
  isDark: boolean;
  defaultOpen?: boolean;
  searchQuery: string;
}> = ({ group, surfaceBg, surfaceBorder, divider, isDark, defaultOpen = false, searchQuery }) => {
  const [open, setOpen] = useState(defaultOpen);

  const filteredEndpoints = searchQuery
    ? group.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : group.endpoints;

  // If searching and this group has no matches, hide it
  if (searchQuery && filteredEndpoints.length === 0) return null;

  // If searching, auto-expand groups with matches
  const isOpen = searchQuery ? true : open;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}
    >
      {/* Group header */}
      <button
        onClick={() => !searchQuery && setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3"
        style={{ cursor: searchQuery ? 'default' : 'pointer' }}
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${group.color}14`, color: group.color, border: `1px solid ${group.color}28` }}>
          {group.icon}
        </div>
        <span className="text-xs font-semibold flex-1 text-left" style={{ color: 'var(--text-primary)' }}>
          {group.label}
        </span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
          style={{ background: `${group.color}10`, color: group.color, border: `1px solid ${group.color}20` }}>
          {filteredEndpoints.length} endpoint{filteredEndpoints.length !== 1 ? 's' : ''}
        </span>
        {!searchQuery && (
          <span style={{ color: 'var(--text-faint)' }}>
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: `1px solid ${divider}` }}>
              {filteredEndpoints.map((ep, i) => (
                <EndpointRow
                  key={`${ep.method}-${ep.path}`}
                  ep={ep}
                  surfaceBg={surfaceBg}
                  surfaceBorder={surfaceBorder}
                  divider={divider}
                  isDark={isDark}
                  isLast={i === filteredEndpoints.length - 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

interface HealthInfo {
  mongoConnected: boolean;
  aiBackend: string;
  aiModel: string;
  vertexProject: string | null;
  version: string;
}

const ApiDocsPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkHealth()
      .then(d => setHealth(d as unknown as HealthInfo))
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, []);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const matchCount = searchQuery
    ? GROUPS.reduce((s, g) => s + g.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase())
      ).length, 0)
    : null;

  return (
    <div className="px-4 sm:px-6 py-6 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <span className="flex items-center gap-2 mb-2">
          <Code2 size={13} style={{ color: '#60a5fa' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
            API Reference
          </span>
        </span>
        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Velocity API
        </h1>
        <p className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          The backend powering every autonomous action in Velocity — task management,
          the agent's decision loop, and all Google service integrations.
        </p>
      </div>

      {/* ── Stats strip (always visible) ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5 rounded-2xl overflow-hidden"
        style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x"
          style={{ borderColor: divider }}>
          {[
            { label: 'Endpoints', value: `${TOTAL_ENDPOINTS}`, color: '#60a5fa' },
            { label: 'Route Groups', value: `${TOTAL_GROUPS}`, color: '#a78bfa' },
            { label: 'Auth Model', value: 'JWT Bearer', color: '#fbbf24' },
            {
              label: 'AI Backend',
              value: healthLoading
                ? '…'
                : health
                  ? (health.aiBackend === 'vertex_ai' ? 'Vertex AI' : 'Gemini API')
                  : 'Gemini 3.1 Flash Lite',
              color: '#4285f4',
              live: !!health,
            },
          ].map(({ label, value, color, live }, i) => (
            <div key={label} className="px-4 py-3 flex flex-col gap-0.5"
              style={{ borderRight: i < 3 ? `1px solid ${divider}` : 'none' }}>
              <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                {label}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold font-mono" style={{ color }}>{value}</span>
                {live && (
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#22c55e' }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
              </div>
              {label === 'AI Backend' && health && (
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  {health.aiModel || 'gemini-3.1-flash-lite'}
                </span>
              )}
              {label === 'AI Backend' && health?.vertexProject && (
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  {health.vertexProject}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Live health indicator row */}
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap"
          style={{ borderTop: `1px solid ${divider}` }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              MongoDB
            </span>
            {healthLoading ? (
              <motion.div className="w-3 h-3 rounded-full border border-current opacity-40"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }} />
            ) : (
              <span className="text-[9px] font-mono font-bold"
                style={{ color: health?.mongoConnected ? '#22c55e' : '#f87171' }}>
                {health?.mongoConnected ? '● connected' : '○ disconnected'}
              </span>
            )}
          </div>
          <span style={{ color: divider }}>·</span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
            Backend: velocity-backend-477604227517.us-central1.run.app
          </span>
          {health && (
            <>
              <span style={{ color: divider }}>·</span>
              <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: '#22c55e' }}>
                <CheckCircle2 size={8} /> v{health.version || '2.1.0'} live
              </span>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div className="mb-5 relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
        <input
          ref={searchRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search ${TOTAL_ENDPOINTS} endpoints…`}
          className="w-full pl-8 pr-8 py-2.5 rounded-xl text-[11px] font-mono"
          style={{
            background: surfaceBg,
            border: `1px solid ${searchQuery ? 'rgba(96,165,250,0.4)' : surfaceBorder}`,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-faint)' }}
          >
            <X size={12} />
          </button>
        )}
        {searchQuery && matchCount !== null && (
          <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[9px] font-mono"
            style={{ color: 'var(--text-faint)' }}>
            {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────────── */}
      {!searchQuery && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Legend</span>
          {(['GET', 'POST', 'PATCH', 'DELETE'] as HttpMethod[]).map(m => (
            <span key={m} className="flex items-center gap-1">
              <MethodBadge method={m} />
            </span>
          ))}
          <span style={{ color: divider }}>·</span>
          <AuthBadge auth="jwt" />
          <AuthBadge auth="public" />
          <span style={{ color: divider }}>·</span>
          <AgentBadge />
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>= writes to Agent Log</span>
        </div>
      )}

      {/* ── Groups ────────────────────────────────────────────────────────────── */}
      {GROUPS.map((group, i) => (
        <GroupCard
          key={group.id}
          group={group}
          surfaceBg={surfaceBg}
          surfaceBorder={surfaceBorder}
          divider={divider}
          isDark={isDark}
          defaultOpen={i === 0}
          searchQuery={searchQuery}
        />
      ))}

      {/* ── Auth note ─────────────────────────────────────────────────────────── */}
      {!searchQuery && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-4 px-4 py-3 rounded-xl"
          style={{ background: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}
        >
          <div className="flex items-start gap-2.5">
            <Lock size={11} className="mt-0.5 shrink-0" style={{ color: '#fbbf24' }} />
            <div>
              <p className="text-[10px] font-mono font-semibold mb-0.5" style={{ color: '#fbbf24' }}>
                JWT Authentication
              </p>
              <p className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                All protected endpoints require <code style={{ color: '#fbbf24' }}>Authorization: Bearer &lt;token&gt;</code>.
                Obtain a token via <code style={{ color: '#60a5fa' }}>POST /api/auth/guest</code> (no credentials) or{' '}
                <code style={{ color: '#60a5fa' }}>POST /api/auth/login</code> (demo / velocity2026).
                Google OAuth returns a Velocity JWT on the redirect callback.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-5 px-4 py-3 rounded-xl text-center"
        style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${divider}` }}
      >
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
          Velocity API · Node.js 20 + Express · MongoDB Atlas · Vertex AI (Gemini 3.1 Flash Lite) · {TOTAL_ENDPOINTS} endpoints across {TOTAL_GROUPS} groups
        </span>
      </motion.div>
    </div>
  );
};

export default ApiDocsPage;
