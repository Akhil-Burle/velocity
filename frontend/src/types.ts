export type PaceStatus = 'GREEN' | 'AMBER' | 'RED' | 'COMPLETE' | 'failed';
export type CognitiveWeight = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskType = 'CODE' | 'WRITING' | 'DIAGRAM' | 'OTHER';
export type EnergyLevel = 'Deep Focus' | 'Quick Wins' | 'Brain-Dead' | '';

export interface SparklinePoint {
  value: number;
  timestamp?: string; // ISO — when this check-in was logged
}

export interface PaceMetrics {
  expected: number;          // where you should be (%)
  actual: number;            // where you are (%)
  drift: number;             // actual − expected
  velocityRate: number;      // %/day you're actually moving
  requiredRate: number;      // %/day needed from now to finish on time
  requiredHoursPerDay: number;
  daysToDeadline: number;
  projectedFinish: string | null;
  willFinishOnTime: boolean;
  onPace: boolean;
  status: PaceStatus;
  consistency: number;       // 0–100 steadiness of pace
}

export interface CompletionAward {
  base: number;
  credits: number;
  multiplier: number;
  consistency: number;
  onTime: boolean;
  reason: string;
  alreadyAwarded?: boolean;
}

export interface Task {
  id: string;
  taskName: string;
  deadline: string; // ISO string
  taskType: TaskType;
  cognitiveWeight: CognitiveWeight;
  selfOwned: boolean;
  recipientName: string | null;
  currentPaceHoursPerDay: number;
  status: PaceStatus;
  driftExplanation: string;
  hotStartContent: string;
  negotiatedDraft: string;
  completionPercent: number; // 0–100
  course?: string;
  isRescheduled?: boolean;
  sparkline: SparklinePoint[];
  failureCost?: string; // populated by /api/ultimatum/evaluate
  // Zero-Hour fields
  panicScaffold?: {
    checklist: string[];
    boilerplate: string;
    repoUrl?: string;
    generatedAt?: string;
  };
  energyLevel?: EnergyLevel;
  estimatedDuration?: number; // minutes
  // Credit economy + pace tracking
  creditValue?: number;
  creditsAwarded?: boolean;
  paceMetrics?: PaceMetrics;
}

// ── Goals & Habits ────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  title: string;
  description: string;
  linkedTaskIds: string[];
  createdAt: string;
  targetDate?: string;
  progressPercent?: number;
}

export interface HabitHistory {
  date: string;
  completed: boolean;
}

export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  history: HabitHistory[];
  createdAt: string;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  preferredWorkStart: string;   // "09:00"
  preferredWorkEnd: string;     // "21:00"
  accountabilityEmail: string;
  dailyBriefingEnabled: boolean;
  dailyBriefingTime: string;    // "08:00"
  theme: 'dark' | 'light' | 'system';
  accentColor: string;          // always #22c55e for now
  calendarSyncEnabled: boolean;
  notificationsEnabled: boolean;
  autoTriageEnabled: boolean;
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export type ReminderType = 'deadline' | 'checkin' | 'habit' | 'briefing';

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  body: string;
  urgency: 'low' | 'medium' | 'high';
  relatedId?: string;
  createdAt: string;
}

// ── Insights ─────────────────────────────────────────────────────────────────

export interface CalibrationRow {
  taskType: string;
  estimated: number;
  actual: number;
  accuracy: string;
  recommendation: string;
}

export interface InsightsReport {
  summary: string;
  recommendations: string[];
  calibration: CalibrationRow[];
  stats: {
    tasksCompleted: number;
    avgVelocityScore: number;
    onTimeRate: string;
    totalHoursLogged: number;
  };
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  taskId: string;
  taskName: string;
  subtaskId?: string;    // for mark-complete + reschedule
  subtaskTitle: string;
  date: string;          // "YYYY-MM-DD"
  startTime: string;     // "HH:MM"
  endTime: string;       // "HH:MM"
  status: PaceStatus;
  taskType: TaskType;
  estimatedMinutes?: number;
  completed?: boolean;   // tracked in frontend state
}

// ── Gamification — Velocity Credits ───────────────────────────────────────────

export interface CreditLedgerEntry {
  id: string;
  action: string;
  amount: number;
  label: string;
  timestamp: string;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;          // lucide icon name, mapped on the frontend
  desc: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface VelocityProfile {
  credits: number;
  lifetimeCredits: number;
  streak: number;
  longestStreak: number;
  tasksCompleted: number;
  checkins: number;
  level: number;
  title: string;
  levelFloor: number;
  levelCeil: number;
  progressPercent: number;
  creditsToNext: number;
  ledger: CreditLedgerEntry[];
  achievements: Achievement[];
  achievementsUnlocked: number;
  achievementsTotal: number;
  awarded?: CreditLedgerEntry; // present on award responses
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  credits: number;
  you: boolean;
}

export interface LeaderboardResult {
  rank: number;
  total: number;
  percentile: number;
  leaderboard: LeaderboardEntry[];
  you: { rank: number; credits: number; level: number; title: string; progressPercent: number };
}

// ── Command Day ───────────────────────────────────────────────────────────────

export type DayBlockType = 'focus' | 'buffer' | 'meeting' | 'break';

export interface DayBlock {
  id: string;
  taskId?: string;
  type: DayBlockType;
  title: string;
  start: string;         // "HH:MM"
  end: string;           // "HH:MM"
  durationMins: number;
  status: PaceStatus;
  energyLevel?: EnergyLevel;
  cognitiveWeight?: CognitiveWeight;
  taskType?: TaskType;
  completionPercent?: number;
  deadline?: string;
}

export interface DayPlanSummary {
  capacityHours: number;
  requiredHours: number;
  scheduledCount: number;
  unscheduled: number;
  loadPercent: number;
  taskCount: number;
}

export interface DayPlan {
  date: string;
  workStart: string;
  workEnd: string;
  nowMins: number;
  blocks: DayBlock[];
  summary: DayPlanSummary;
  rebalanced: boolean;
  note?: string;
  // Phase 1: cascade
  cascadeTriggered?: boolean;
  chainEntry?: import('./types').AgentLogEntry | null;
  conflictTask?: { id: string; taskName: string; recipientName: string | null } | null;
}

// ── Velocity DNA + Pre-Brief ───────────────────────────────────────────────────

export interface DNAAxis {
  axis: string;
  value: number;
}

export interface VelocityDNA {
  axes: DNAAxis[];
  overall: number;
  archetype: string;
  archetypeBlurb: string;
  peakHours: string;
  strongestType: string;
  weakestType: string;
  sampleSize: { tasks: number; checkins: number };
}

export interface PrebriefBlock {
  taskName: string;
  status: PaceStatus;
  hours: number;
  deadline: string;
  cognitiveWeight: CognitiveWeight;
}

export interface PrebriefReport {
  date: string;
  taskCount: number;
  requiredHours: number;
  firstDeadline: string | null;
  recommendedStart: string;
  confidence: number;
  briefing: string;
  blocks: PrebriefBlock[];
}

// ── Weekly Report ───────────────────────────────────────────────────────────

export interface WeeklyReport {
  weekLabel: string;
  creditsThisWeek: number;
  tasksCompleted: number;
  onTimeRate: number;
  avgConsistency: number;
  onPaceCount: number;
  activeCount: number;
  hoursLogged: number;
  dailyCredits: { label: string; value: number }[];
  topTask: { taskName: string; creditValue: number } | null;
  currentStreak: number;
}

// ── Agent Activity Log ────────────────────────────────────────────────────────

export type AgentAutonomy = 'autonomous' | 'assisted' | 'countdown';

export interface RejectedAlternative {
  action: string;
  reason: string;
}

export interface ChainStep {
  stepNumber: number;
  featureKey: string;
  title: string;
  reasoning: string;
  outcome: string;
  undoable: boolean;
  undone: boolean;
  relatedTaskId: string | null;
  relatedTaskName: string | null;
  timestamp: string;
  rejectedAlternatives?: RejectedAlternative[];
}

export interface AgentLogEntry {
  id: string;
  featureKey: string;
  title: string;
  reasoning: string;
  outcome: string;
  autonomy: AgentAutonomy;
  undoable: boolean;
  undone: boolean;
  relatedTaskId: string | null;
  relatedTaskName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  // Phase 1: chain
  chain?: ChainStep[];
  isChain?: boolean;
  // Phase 2: policy memory
  policyCategory?: string | null;
  policyAction?: string | null;
  policyContext?: string | null;
  cancelCount?: number | null;
  // Phase 3: reasoning trace
  rejectedAlternatives?: RejectedAlternative[];
}

export interface PolicyMemoryEntry {
  userId: string;
  policyCategory: string;
  policyLabel: string;
  featureKey: string;
  status: 'active' | 'learned';
  cancelCount: number;
  threshold: number;
  learnedAt: string | null;
  learnedMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
