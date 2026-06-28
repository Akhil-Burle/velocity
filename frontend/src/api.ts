/**
 * src/api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend API client for the Velocity backend.
 * All API calls go through this module.
 *
 * JWT is injected from AuthContext via setApiToken() which is called once
 * after login/guest. All subsequent requests include Authorization: Bearer <token>.
 *
 * Backend runs at http://localhost:3001
 */

import { Task, Goal, Habit, Settings, Reminder, InsightsReport, CalendarEvent,
  VelocityProfile, LeaderboardResult, DayPlan, VelocityDNA, PrebriefReport,
  WeeklyReport, CompletionAward } from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001/api';

// ─── Token management ─────────────────────────────────────────────────────────
// The token is kept in module scope so api.ts never needs a React import.
// Call setApiToken() right after receiving a token from the auth endpoints.

let _apiToken: string | null = null;

export function setApiToken(token: string | null) {
  _apiToken = token;
}

// ─── Generic fetch helper ─────────────────────────────────────────────────────

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (_apiToken) {
    headers['Authorization'] = `Bearer ${_apiToken}`;
  }

  const res = await fetch(url, {
    headers,
    ...options,
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.message || body.error || errMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

// ─── Auth endpoints (public — no token needed) ────────────────────────────────

/** POST /api/auth/guest — start a guest session, returns { token, userId, mode } */
export async function guestLogin(): Promise<{ token: string; userId: string; mode: 'guest' }> {
  return request<{ token: string; userId: string; mode: 'guest' }>('/auth/guest', {
    method: 'POST',
  });
}

/** POST /api/auth/login — demo login, returns { token, userId, mode } */
export async function loginWithCredentials(
  username: string,
  password: string
): Promise<{ token: string; userId: string; mode: 'demo' }> {
  return request<{ token: string; userId: string; mode: 'demo' }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ─── Existing API functions ────────────────────────────────────────────────────

/** POST /api/braindump — Parse brain dump text and return extracted tasks. */
export async function submitBrainDump(text: string): Promise<Task[]> {
  return request<Task[]>('/braindump', {
    method: 'POST',
    body: JSON.stringify({
      text,
      // Send local timezone offset so backend resolves "9pm today" correctly
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    }),
  });
}

/** POST /api/tasks — manually create a task (no AI). Returns the new task with pace metrics. */
export async function createTaskManual(data: {
  taskName: string;
  deadline: string;
  taskType?: string;
  cognitiveWeight?: string;
  selfOwned?: boolean;
  recipientName?: string;
  completionPercent?: number;
  energyLevel?: string;
  estimatedDuration?: number;
  driftExplanation?: string;
  subtasks?: { title: string; estimatedMinutes: number }[];
}): Promise<Task> {
  return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) });
}

/** GET /api/tasks — Fetch all stored tasks. */
export async function fetchTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

/** PATCH /api/tasks/:id — Update any task field(s). */
export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** POST /api/tasks/:id/complete — mark complete, returns pace-differential credit award. */
export async function completeTask(id: string): Promise<{ task: Task; creditAward: CompletionAward }> {
  return request(`/tasks/${id}/complete`, { method: 'POST' });
}

/** PATCH /api/tasks/:id/subtasks/:subtaskId — toggle completed, or update title/mins. Returns updated subtask + full updated task. */
export async function updateSubtask(
  taskId: string,
  subtaskId: string,
  completed: boolean,
): Promise<{ subtask: { id: string; completed: boolean }; task: Task }> {
  return request(`/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

/** PATCH /api/tasks/:id/subtasks/:subtaskId — update title and/or estimatedMinutes */
export async function editSubtask(
  taskId: string,
  subtaskId: string,
  updates: { title?: string; estimatedMinutes?: number },
): Promise<{ subtask: { id: string; title: string; estimatedMinutes: number }; task: Task }> {
  return request(`/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** POST /api/tasks/:id/subtasks — add a new subtask */
export async function addSubtask(
  taskId: string,
  title: string,
  estimatedMinutes?: number,
): Promise<{ subtask: { id: string; title: string; estimatedMinutes: number; completed: boolean }; task: Task }> {
  return request(`/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title, estimatedMinutes }),
  });
}

/** DELETE /api/tasks/:id/subtasks/:subtaskId — remove a subtask */
export async function deleteSubtask(
  taskId: string,
  subtaskId: string,
): Promise<{ task: Task }> {
  return request(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });
}

/** POST /api/checkins — Submit a check-in for a task. */
export async function submitCheckIn(
  taskId: string,
  selfReportText: string,
  selfReportPercent: number
): Promise<{ task: Task; trustScore: number; mode: string }> {
  return request('/checkins', {
    method: 'POST',
    body: JSON.stringify({ taskId, selfReportText, selfReportPercent }),
  });
}

/** POST /api/hotstart — Generate a hot-start scaffold for a task. */
export async function getHotStart(taskId: string): Promise<{ scaffold: string; warning?: string }> {
  return request('/hotstart', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

/** POST /api/triage — Run AI triage across all active self-owned tasks. */
export async function runTriage(): Promise<{
  triaged: boolean;
  reason: string;
  triagedTask: Task | null;
}> {
  return request('/triage', { method: 'POST' });
}/** POST /api/negotiate — Draft an extension request message for a task. */
export async function getNegotiateDraft(taskId: string): Promise<{ message: string; warning?: string }> {
  return request('/negotiate', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

/** GET /api/health — Check if backend is running. */
export async function checkHealth(): Promise<{
  status: string;
  geminiConfigured: boolean;
  mongoConnected: boolean;
  aiBackend?: string;
  aiBackendLabel?: string;
  aiModel?: string;
  vertexProject?: string | null;
  vertexLocation?: string | null;
}> {
  return request('/health');
}

// ─── Goals & Habits ───────────────────────────────────────────────────────────

export async function fetchGoals(): Promise<Goal[]> {
  return request<Goal[]>('/goals');
}

export async function createGoal(data: { title: string; description: string; targetDate?: string }): Promise<Goal> {
  return request<Goal>('/goals', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteGoal(id: string): Promise<{ success: boolean }> {
  return request(`/goals/${id}`, { method: 'DELETE' });
}

export async function fetchHabits(): Promise<Habit[]> {
  return request<Habit[]>('/habits');
}

export async function createHabit(data: { title: string; frequency: 'daily' | 'weekly' }): Promise<Habit> {
  return request<Habit>('/habits', { method: 'POST', body: JSON.stringify(data) });
}

export async function habitCheckIn(id: string, completed: boolean): Promise<Habit> {
  return request<Habit>(`/habits/${id}/checkin`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

export async function deleteHabit(id: string): Promise<{ success: boolean }> {
  return request(`/habits/${id}`, { method: 'DELETE' });
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  return request<CalendarEvent[]>('/calendar');
}

export async function runReschedule(): Promise<{
  success: boolean;
  rescheduled: number;
  events: CalendarEvent[];
  message: string;
}> {
  return request('/reschedule', { method: 'POST' });
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export async function generateInsights(): Promise<InsightsReport> {
  return request<InsightsReport>('/insights/generate', { method: 'POST' });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  return request<Settings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ─── Briefing & Reminders ─────────────────────────────────────────────────────

export async function generateBriefing(): Promise<{ briefing: string; generatedAt: string }> {
  return request('/briefing/generate', { method: 'POST' });
}

export async function fetchActiveReminders(): Promise<Reminder[]> {
  return request<Reminder[]>('/reminders/active');
}

/** POST /api/ultimatum/evaluate — detect genuine two-task conflict, return cost lines. */
export async function evaluateUltimatum(): Promise<
  | { triggered: false }
  | { triggered: true; taskA: Task; taskB: Task }
> {
  return request('/ultimatum/evaluate', { method: 'POST' });
}

/** POST /api/ultimatum/resolve — mark loser as failed, log the decision. */
export async function resolveUltimatum(
  winningTaskId: string,
  losingTaskId: string
): Promise<{
  success: boolean;
  losingTask: Task;
  winningTask: Task;
  reasoning: string;
  confirmation: string;
}> {
  return request('/ultimatum/resolve', {
    method: 'POST',
    body: JSON.stringify({ winningTaskId, losingTaskId }),
  });
}

// ─── Zero-Hour Agent Suite ─────────────────────────────────────────────────────

export interface PanicScaffoldResult {
  cached: boolean;
  checklist: string[];
  boilerplate: string;
  repoUrl?: string;
}

/** POST /api/agent/panic-scaffold — generate checklist + boilerplate for a task. */
export async function runPanicScaffold(taskId: string): Promise<PanicScaffoldResult> {
  return request<PanicScaffoldResult>('/agent/panic-scaffold', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

/** POST /api/braindump — send image (base64) for AI task extraction. */
export async function scanImageForTasks(imageData: string, mimeType: string): Promise<Task[]> {
  return request<Task[]>('/braindump', {
    method: 'POST',
    body: JSON.stringify({ imageData, mimeType }),
  });
}

// ─── Feature Block 2: OmniBar ────────────────────────────────────────────────

// Legacy shape kept for backward compatibility
export interface OmniParseResult {
  intent: 'panic' | 'triage' | 'negotiate' | 'add_task' | 'ultimatum' | 'mark_complete' | 'info';
  taskId: string | null;
  confidence: number;
  displayMessage: string;
  suggestedActions: Array<{ label: string; action: string }>;
}

// New structured classification result (Phase 1)
export interface OmniClassifyResult {
  intent: 'create_task' | 'run_triage' | 'panic_mode' | 'smart_routing' | 'negotiate' | 'rebalance' | 'query' | 'unclear';
  confidence: 'high' | 'medium' | 'low';
  params: Record<string, string | number | boolean | null>;
  explanation: string;
  taskId: string | null;
  _policyDowngraded?: boolean;
  _policyLabel?: string;
}

export interface OmniExecuteResult {
  success: boolean;
  intent: string;
  result: Record<string, unknown>;
  logEntryId: string | null;
}

/** POST /api/agent/omni-parse — classify intent (new structured output). */
export async function classifyOmniIntent(utterance: string): Promise<OmniClassifyResult> {
  return request<OmniClassifyResult>('/agent/omni-parse', {
    method: 'POST',
    body: JSON.stringify({ utterance }),
  });
}

/** POST /api/agent/omni-parse — parse natural language intent for OmniBar (legacy). */
export async function parseOmniIntent(utterance: string): Promise<OmniParseResult> {
  return request<OmniParseResult>('/agent/omni-parse', {
    method: 'POST',
    body: JSON.stringify({ utterance }),
  });
}

/** POST /api/agent/omni-execute — execute a classified intent (called after countdown). */
export async function executeOmniIntent(
  intent: string,
  utterance: string,
  taskId: string | null,
  params: Record<string, unknown>,
  confidence: string,
): Promise<OmniExecuteResult> {
  return request<OmniExecuteResult>('/agent/omni-execute', {
    method: 'POST',
    body: JSON.stringify({ intent, utterance, taskId, params, confidence }),
  });
}

/** POST /api/agent/tts — synthesize speech via Google Cloud TTS. */
export async function synthesizeSpeech(text: string): Promise<{ audioBase64: string | null; fallback: boolean }> {
  return request('/agent/tts', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ─── Gamification: Velocity Credits ──────────────────────────────────────────

/** GET /api/gamification/profile — decorated credits profile (level, achievements). */
export async function fetchVelocityProfile(): Promise<VelocityProfile> {
  return request<VelocityProfile>('/gamification/profile');
}

/** POST /api/gamification/award — award credits for an action; returns updated profile. */
export async function awardCredits(action: string, amount?: number): Promise<VelocityProfile> {
  return request<VelocityProfile>('/gamification/award', {
    method: 'POST',
    body: JSON.stringify({ action, amount }),
  });
}

/** GET /api/gamification/leaderboard — anonymized cohort ranking + percentile. */
export async function fetchLeaderboard(): Promise<LeaderboardResult> {
  return request<LeaderboardResult>('/gamification/leaderboard');
}

// ─── Command Day ─────────────────────────────────────────────────────────────

/** GET /api/dayplan — today's full timeline + capacity summary. */
export async function fetchDayPlan(): Promise<DayPlan> {
  return request<DayPlan>('/dayplan');
}

/** POST /api/dayplan/rebalance — energy-aware re-ordering of the day. */
export async function rebalanceDayPlan(): Promise<DayPlan> {
  return request<DayPlan>('/dayplan/rebalance', { method: 'POST' });
}

// ─── Velocity DNA + Tomorrow Pre-Brief ───────────────────────────────────────

/** GET /api/insights/dna — productivity fingerprint (radar axes + archetype). */
export async function fetchVelocityDNA(): Promise<VelocityDNA> {
  return request<VelocityDNA>('/insights/dna');
}

/** GET /api/insights/prebrief — tomorrow's planning pre-brief. */
export async function fetchPrebrief(): Promise<PrebriefReport> {
  return request<PrebriefReport>('/insights/prebrief');
}

/** GET /api/insights/weekly — real weekly velocity report metrics. */
export async function fetchWeeklyReport(): Promise<WeeklyReport> {
  return request<WeeklyReport>('/insights/weekly');
}

// ─── Agent Activity Log ───────────────────────────────────────────────────────

import type { AgentLogEntry, PolicyMemoryEntry } from './types';

/** GET /api/agent-log — list all agent log entries for the current user (newest first). */
export async function fetchAgentLog(limit = 50): Promise<{ entries: AgentLogEntry[]; total: number }> {
  return request<{ entries: AgentLogEntry[]; total: number }>(`/agent-log?limit=${limit}`);
}

/** POST /api/agent-log — write a new entry (used by frontend-triggered actions). */
export async function createAgentLogEntry(entry: Omit<AgentLogEntry, 'id' | 'createdAt' | 'undone'>): Promise<AgentLogEntry> {
  return request<AgentLogEntry>('/agent-log', { method: 'POST', body: JSON.stringify(entry) });
}

/** POST /api/agent-log/:id/undo — mark an entry undone. */
export async function undoAgentLogEntry(id: string): Promise<{ success: boolean; entry: AgentLogEntry }> {
  return request(`/agent-log/${id}/undo`, { method: 'POST' });
}

/** POST /api/agent-log/:id/undo-step — undo a single step in a chain entry. */
export async function undoChainStep(id: string, stepNumber: number): Promise<{ success: boolean; entry: AgentLogEntry }> {
  return request(`/agent-log/${id}/undo-step`, { method: 'POST', body: JSON.stringify({ stepNumber }) });
}

/** GET /api/agent-log/policy-memory — list all learned policies for the current user. */
export async function fetchPolicyMemory(): Promise<{ policies: PolicyMemoryEntry[]; total: number }> {
  return request<{ policies: PolicyMemoryEntry[]; total: number }>('/agent-log/policy-memory');
}

/** POST /api/agent-log/policy-cancel — record a user cancel for policy learning. */
export async function recordPolicyCancel(logEntryId: string, featureKey: string, metadata?: Record<string, unknown>): Promise<{ success: boolean; policy: PolicyMemoryEntry | null }> {
  return request('/agent-log/policy-cancel', {
    method: 'POST',
    body: JSON.stringify({ logEntryId, featureKey, metadata }),
  });
}

// ─── Results / Impact view ─────────────────────────────────────────────────

export interface ResultsData {
  tasksCompleted: number;
  onTimeDeliveries: number;
  onTimeRate: number;
  activeTasks: number;
  autonomousSaves: number;
  assistedActions: number;
  totalAgentActions: number;
  hoursSaved: number;
  rebalances: number;
  triages: number;
  panicRescues: number;
  negotiateDrafts: number;
  driftAlerts: number;
  checkIns: number;
  recentActions: Array<{
    title: string;
    featureKey: string;
    autonomy: string;
    createdAt: string;
  }>;
}

/** GET /api/insights/results — impact evidence from agent log + task history. */
export async function fetchResults(): Promise<ResultsData> {
  return request<ResultsData>('/insights/results');
}

// ─── Velocity Forecast Agent ──────────────────────────────────────────────────

export interface TaskForecast {
  taskId: string;
  taskName: string;
  probability: number;      // 0–100
  trend: 'improving' | 'declining' | 'stable';
  riskLevel: 'safe' | 'watch' | 'critical';
  recovery: string | null;
  trustDecay: number;       // % to drain from displayed progress (stale data)
  daysToDeadline: number;
  drift: number;
  velocityRate: number;
  requiredRate: number;
  consistency: number;
}

export interface ForecastResult {
  portfolioHealth: number;  // 0–100 weighted average finish probability
  forecasts: TaskForecast[];
  autonomousActions: Array<{
    taskId: string;
    taskName: string;
    probability: number;
    recovery: string;
    logEntryId: string;
  }>;
  generatedAt: string;
}

/** POST /api/agent/forecast — run the proactive pace forecast agent. */
export async function runForecast(): Promise<ForecastResult> {
  return request<ForecastResult>('/agent/forecast', { method: 'POST' });
}

// ─── Behavioral Drift Score — Phase 1 ────────────────────────────────────────

export interface DriftSignal {
  subtask: number | null;  // subtask ratio inferred progress, or null
  staleness: number;        // ≤ 0 adjustment from pace staleness
  panic: number;            // ≤ 0 adjustment from Panic Mode usage
  language: number;         // ±small from OmniBar language signal
}

export interface DriftScore {
  taskId: string;
  taskName: string;
  inferredReal: number;   // 0–100 — our behavioral estimate of real progress
  selfReported: number;   // 0–100 — what the user last reported
  gap: number;            // inferredReal - selfReported (negative = user overreporting)
  confidence: 'high' | 'medium' | 'low' | 'sparse';
  signals: DriftSignal;
  explanation: string[];
}

export interface VelocityVector {
  magnitude: number;       // 0–100 how much is getting done
  direction: 'good' | 'mixed' | 'poor'; // trajectory toward or away from deadlines
  alignment: number;       // 0–100 how aligned real progress is with deadline requirements
  worstOffenders: Array<{
    taskId: string;
    taskName: string;
    driftGap: number;
    probability: number;
    status: string;
    velocityRate: number;
    requiredRate: number;
  }>;
}

export interface DriftBatchResult {
  driftScores: DriftScore[];
  velocityVector: VelocityVector;
  generatedAt: string;
}

/** POST /api/agent/drift-score — compute drift for one task */
export async function computeDriftScore(taskId: string): Promise<DriftScore> {
  return request<DriftScore>('/agent/drift-score', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

/** POST /api/agent/drift-score-batch — compute drift for all active tasks + velocity vector */
export async function computeDriftScoreBatch(): Promise<DriftBatchResult> {
  return request<DriftBatchResult>('/agent/drift-score-batch', { method: 'POST' });
}

/** POST /api/agent/drift-signal — extract progress sentiment delta from an utterance */
export async function extractDriftSignal(taskId: string | null, utterance: string): Promise<{ delta: number | null }> {
  return request('/agent/drift-signal', {
    method: 'POST',
    body: JSON.stringify({ taskId, utterance }),
  });
}
