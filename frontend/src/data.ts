import { Task, PaceStatus, CognitiveWeight } from './types';

// ─── Telemetry Math Helpers ──────────────────────────────────────────────────

/** Base focus hours for each cognitive weight tier. */
const WEIGHT_BASE_HOURS: Record<CognitiveWeight, number> = {
  HIGH: 5,
  MEDIUM: 3,
  LOW: 1,
};

/** Fractional days remaining from now until an ISO deadline string. */
export function daysRemaining(isoDeadline: string): number {
  const deadline = new Date(isoDeadline).getTime();
  const now = Date.now();
  const diff = (deadline - now) / (1000 * 60 * 60 * 24);
  return Math.max(diff, 0.1); // floor at 6 minutes to avoid ÷0
}

/** Required focus hours/day given a cognitive weight and ISO deadline. */
export function calcRequiredHoursPerDay(
  weight: CognitiveWeight,
  isoDeadline: string
): number {
  const base = WEIGHT_BASE_HOURS[weight];
  const days = daysRemaining(isoDeadline);
  return Math.round((base / days) * 10) / 10;
}

/** Derive pace status from required hours/day. */
export function derivePaceStatus(hoursPerDay: number): PaceStatus {
  if (hoursPerDay < 2) return 'GREEN';
  if (hoursPerDay <= 4) return 'AMBER';
  return 'RED';
}

// ─── Pace Engine (frontend mirror of backend utils/paceEngine.js) ─────────────

import { PaceMetrics, SparklinePoint } from './types';

const DAY = 86400000;
const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/** Linear-regression slope of timestamped check-ins, in %/day. */
export function velocityRate(points: SparklinePoint[]): number | null {
  const pts = (points || [])
    .filter(p => p && p.timestamp)
    .map(p => ({ t: new Date(p.timestamp as string).getTime(), v: p.value }))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const x0 = pts[0].t;
  const xs = pts.map(p => (p.t - x0) / DAY);
  const ys = pts.map(p => p.v);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  return (n * sxy - sx * sy) / denom;
}

export function computeConsistency(points: SparklinePoint[]): number {
  const pts = (points || [])
    .filter(p => p && p.timestamp)
    .map(p => ({ t: new Date(p.timestamp as string).getTime(), v: p.value }))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 3) return 70;
  const rates: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].t - pts[i - 1].t) / DAY;
    if (dt > 0.001) rates.push((pts[i].v - pts[i - 1].v) / dt);
  }
  if (rates.length < 2) return 70;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const std = Math.sqrt(variance);
  const cv = Math.abs(mean) > 0.01 ? std / Math.abs(mean) : std;
  return Math.round(Math.max(0, Math.min(100, 100 - cv * 35)));
}

/** Full pace picture for a task — mirrors the backend engine exactly. */
export function computePaceMetrics(task: Task, now: number = Date.now()): PaceMetrics {
  const createdAt = new Date(task.createdAt || now).getTime();
  const deadline = new Date(task.deadline).getTime();
  const actual = clampPct(task.completionPercent || 0);
  const total = Math.max(deadline - createdAt, DAY * 0.1);
  const elapsed = Math.max(0, Math.min(now - createdAt, total));
  const expected = clampPct((elapsed / total) * 100);
  const drift = Math.round(actual - expected);
  const daysToDeadline = (deadline - now) / DAY;
  const elapsedDays = Math.max((now - createdAt) / DAY, 0.05);

  let rate = velocityRate(task.sparkline);
  if (rate === null) rate = actual > 0 ? actual / elapsedDays : 0;
  rate = Math.round(rate * 10) / 10;

  const remaining = 100 - actual;
  const projectedDays = rate > 0.1 ? remaining / rate : Infinity;
  const projectedFinishMs = isFinite(projectedDays) ? now + projectedDays * DAY : null;
  const willFinishOnTime = projectedFinishMs !== null ? projectedFinishMs <= deadline : false;

  const baseHours = ({ HIGH: 5, MEDIUM: 3, LOW: 1 } as Record<string, number>)[task.cognitiveWeight] || 3;
  const requiredHoursPerDay = daysToDeadline > 0.05
    ? Math.round(((remaining / 100) * baseHours / Math.max(daysToDeadline, 0.1)) * 10) / 10
    : Math.round(((remaining / 100) * baseHours) * 10) / 10;
  const requiredRate = daysToDeadline > 0.05
    ? Math.round((remaining / Math.max(daysToDeadline, 0.1)) * 10) / 10
    : remaining;

  let status: PaceStatus;
  if (actual >= 100) status = 'COMPLETE';
  else if (drift >= -3) status = 'GREEN';
  else if (willFinishOnTime && daysToDeadline > 0) status = 'AMBER';
  else status = 'RED';

  return {
    expected: Math.round(expected),
    actual: Math.round(actual),
    drift,
    velocityRate: rate,
    requiredRate,
    requiredHoursPerDay,
    daysToDeadline: Math.round(daysToDeadline * 10) / 10,
    projectedFinish: projectedFinishMs ? new Date(projectedFinishMs).toISOString() : null,
    willFinishOnTime,
    onPace: drift >= -3,
    status,
    consistency: computeConsistency(task.sparkline),
  };
}

// ─── Hot-Start Code Templates ────────────────────────────────────────────────

export const REACT_LAB_SCAFFOLD = `// HOT-START Scaffold — React Frontend Lab
// Generated by Velocity AI · ${new Date().toLocaleDateString()}

import React, { useState, useEffect } from 'react';

interface LabComponentProps {
  title: string;
  onComplete: (data: unknown) => void;
}

const LabComponent: React.FC<LabComponentProps> = ({
  title,
  onComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/lab-data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Lab fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = () => {
    if (data) onComplete(data);
  };

  if (isLoading) {
    return <div className="loader">Initializing...</div>;
  }

  return (
    <div className="lab-container">
      <h1>{title}</h1>
      <main>
        {/* TODO: Implement lab UI */}
      </main>
      <button onClick={handleSubmit}>
        Submit Lab
      </button>
    </div>
  );
};

export default LabComponent;`;

const DBMS_SCAFFOLD = `-- HOT-START Scaffold — DBMS Query Optimization
-- Generated by Velocity AI

-- Step 1: Analyze slow query
EXPLAIN ANALYZE
  SELECT u.id, u.name, COUNT(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE u.created_at > NOW() - INTERVAL '30 days'
  GROUP BY u.id
  ORDER BY order_count DESC;

-- Step 2: Add missing composite index
CREATE INDEX CONCURRENTLY idx_orders_user_created
  ON orders (user_id, created_at DESC);

-- Step 3: Rewrite with CTE for readability
WITH recent_users AS (
  SELECT id, name
  FROM users
  WHERE created_at > NOW() - INTERVAL '30 days'
),
order_counts AS (
  SELECT user_id, COUNT(*) AS cnt
  FROM orders
  GROUP BY user_id
)
SELECT ru.id, ru.name, COALESCE(oc.cnt, 0) AS order_count
FROM recent_users ru
LEFT JOIN order_counts oc ON oc.user_id = ru.id
ORDER BY order_count DESC;`;

const RESEARCH_SCAFFOLD = `# HOT-START Scaffold — Research Paper Draft
## Generated by Velocity AI

### I. Introduction (Target: 300 words)
- Hook: [Opening statistic or provocative question]
- Context: Briefly establish the domain
- Gap statement: "However, limited research addresses..."
- Thesis: [Your central argument]
- Roadmap: "This paper first..., then..., finally..."

### II. Literature Review (Target: 600 words)
**Cluster A — Foundational Work**
- [ ] Smith & Jones (2019) — seminal framework
- [ ] Chen et al. (2021) — empirical validation

**Cluster B — Recent Developments**
- [ ] Park (2023) — challenges existing assumptions

### III. Methodology (Target: 400 words)
- Research design: [Qualitative / Quantitative / Mixed]
- Data collection: [Describe instruments]
- Analysis approach: [Thematic / Statistical]

### IV. Results & Discussion
- Finding 1: [Claim] (supports / contradicts H1)
- Finding 2: [Claim]
- Limitations: [Address threats to validity]

### V. Conclusion
- Restate thesis in light of findings
- Practical implications
- Future research directions

---
**References** (APA 7th)
> Add sources here as you find them`;

// ─── Initial Task Dataset ────────────────────────────────────────────────────

const now = new Date();
const daysFromNow = (d: number) =>
  new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    taskName: 'React Frontend Lab',
    deadline: daysFromNow(4.2),
    taskType: 'CODE',
    cognitiveWeight: 'HIGH',
    selfOwned: false,
    recipientName: 'Prof. Henderson',
    currentPaceHoursPerDay: calcRequiredHoursPerDay('HIGH', daysFromNow(4.2)),
    status: derivePaceStatus(calcRequiredHoursPerDay('HIGH', daysFromNow(4.2))),
    driftExplanation:
      'You have logged only 1.2h total against a 5h base estimate. At your current rate you will reach the deadline 2.1 days late. Primary blockers: component architecture not started, API integration pending.',
    hotStartContent: REACT_LAB_SCAFFOLD,
    negotiatedDraft: `Dear Prof. Henderson,\n\nI hope this message finds you well. I am writing to respectfully request a 48-hour extension on the React Frontend Lab, originally due this Friday at 5PM.\n\nDue to an unexpected convergence of high-priority deadlines this week — including the DBMS assignment and the Research Paper draft — my available cognitive bandwidth has been significantly constrained.\n\nI have completed approximately 40% of the lab and have a clear plan to finish the remaining work. A brief extension would allow me to deliver a submission that reflects the quality this course deserves.\n\nI greatly appreciate your consideration.\n\nBest regards,\nAlex`,
    completionPercent: 40,
    course: 'CS 489',
    sparkline: [{ value: 60 }, { value: 72 }, { value: 65 }, { value: 80 }, { value: 75 }, { value: 88 }, { value: 92 }],
  },
  {
    id: 'task-2',
    taskName: 'DBMS Query Optimization',
    deadline: daysFromNow(2.8),
    taskType: 'CODE',
    cognitiveWeight: 'HIGH',
    selfOwned: false,
    recipientName: 'Prof. Nakamura',
    currentPaceHoursPerDay: calcRequiredHoursPerDay('HIGH', daysFromNow(2.8)),
    status: derivePaceStatus(calcRequiredHoursPerDay('HIGH', daysFromNow(2.8))),
    driftExplanation:
      'Deadline is 2.8 days away but only the schema design phase is complete. Query optimization and indexing strategy still require ~3.5h of focused work. Estimate was 40% too optimistic.',
    hotStartContent: DBMS_SCAFFOLD,
    negotiatedDraft: `Dear Prof. Nakamura,\n\nI wanted to flag that my progress on the DBMS Query Optimization assignment is behind schedule due to unexpected complexity in the indexing strategy section.\n\nI am requesting a 24-hour extension to ensure the analysis is thorough and correct. I have the schema design complete and am actively working through the execution plan analysis.\n\nThank you for understanding.\n\nBest,\nAlex`,
    completionPercent: 25,
    course: 'CS 451',
    sparkline: [{ value: 80 }, { value: 70 }, { value: 60 }, { value: 55 }, { value: 50 }, { value: 48 }, { value: 42 }],
  },
  {
    id: 'task-3',
    taskName: 'Linear Algebra Problem Set',
    deadline: daysFromNow(1.5),
    taskType: 'OTHER',
    cognitiveWeight: 'MEDIUM',
    selfOwned: false,
    recipientName: 'Prof. Chen',
    currentPaceHoursPerDay: calcRequiredHoursPerDay('MEDIUM', daysFromNow(1.5)),
    status: derivePaceStatus(calcRequiredHoursPerDay('MEDIUM', daysFromNow(1.5))),
    driftExplanation:
      'Only 1.5 days remain for a MEDIUM-weight task requiring 3h base effort. Problems 4–6 (eigenvalue decomposition) are unsolved. Required pace has exceeded the comfortable threshold.',
    hotStartContent: `# Linear Algebra Problem Set — Starter Notes\n\n## Problem 4: Eigenvalue Decomposition\nGiven matrix A, find eigenvalues λ such that det(A - λI) = 0\n\nStep 1: Compute characteristic polynomial\nStep 2: Factor to find roots (eigenvalues)\nStep 3: Substitute each λ to solve (A - λI)v = 0\n\n## Problem 5: Orthogonal Diagonalization\n- Check if A is symmetric: A = Aᵀ\n- Find eigenvectors, apply Gram-Schmidt if needed\n- Form P (columns = normalized eigenvectors)\n\n## Problem 6: SVD\nA = UΣVᵀ\n- U = eigenvectors of AAᵀ\n- V = eigenvectors of AᵀA\n- Σ = diagonal matrix of singular values`,
    negotiatedDraft: `Dear Prof. Chen,\n\nI am writing to request a short extension on the Linear Algebra Problem Set. I am currently working through the eigenvalue decomposition problems but need an additional 24 hours to ensure accuracy.\n\nThank you,\nAlex`,
    completionPercent: 50,
    course: 'MATH 310',
    sparkline: [{ value: 55 }, { value: 60 }, { value: 58 }, { value: 52 }, { value: 49 }, { value: 46 }, { value: 44 }],
  },
  {
    id: 'task-4',
    taskName: 'Research Paper Draft',
    deadline: daysFromNow(3.5),
    taskType: 'WRITING',
    cognitiveWeight: 'HIGH',
    selfOwned: false,
    recipientName: 'Prof. Williams',
    currentPaceHoursPerDay: calcRequiredHoursPerDay('HIGH', daysFromNow(3.5)),
    status: derivePaceStatus(calcRequiredHoursPerDay('HIGH', daysFromNow(3.5))),
    driftExplanation:
      'Literature review is 60% complete but the methodology and results sections have not been started. At current velocity you will run 1.8 days over deadline. Boilerplate outline generated to unblock section starts.',
    hotStartContent: RESEARCH_SCAFFOLD,
    negotiatedDraft: `Dear Prof. Williams,\n\nI am making solid progress on the Research Paper Draft but would benefit greatly from a 48-hour extension to ensure the methodology section meets the rigor this course demands.\n\nThe literature review is substantially complete. A short extension will allow me to properly develop the analysis section rather than rush it.\n\nI appreciate your flexibility.\n\nSincerely,\nAlex`,
    completionPercent: 30,
    course: 'ENG 302',
    sparkline: [{ value: 90 }, { value: 75 }, { value: 60 }, { value: 50 }, { value: 40 }, { value: 35 }, { value: 30 }],
  },
  {
    id: 'task-5',
    taskName: 'Network Protocols Review',
    deadline: daysFromNow(7),
    taskType: 'OTHER',
    cognitiveWeight: 'LOW',
    selfOwned: true,
    recipientName: null,
    currentPaceHoursPerDay: calcRequiredHoursPerDay('LOW', daysFromNow(7)),
    status: derivePaceStatus(calcRequiredHoursPerDay('LOW', daysFromNow(7))),
    driftExplanation: 'On track. 7 days remaining for a LOW-weight task means well below 2h/day required.',
    hotStartContent: `# Network Protocols Review Notes\n\n## TCP/IP Layer Review\n- Application: HTTP, DNS, SMTP\n- Transport: TCP (reliable), UDP (fast)\n- Network: IP routing, ICMP\n- Link: Ethernet, ARP\n\n## Key Concepts to Study\n- [ ] Three-way handshake\n- [ ] Congestion control (Tahoe, Reno, CUBIC)\n- [ ] TLS 1.3 handshake flow\n- [ ] BGP path selection attributes`,
    negotiatedDraft: '',
    completionPercent: 70,
    course: 'CS 460',
    sparkline: [{ value: 50 }, { value: 58 }, { value: 65 }, { value: 70 }, { value: 76 }, { value: 82 }, { value: 88 }],
  },
  {
    id: 'task-6',
    taskName: 'Weekend Outline',
    deadline: daysFromNow(5),
    taskType: 'WRITING',
    cognitiveWeight: 'LOW',
    selfOwned: true,
    recipientName: null,
    currentPaceHoursPerDay: calcRequiredHoursPerDay('LOW', daysFromNow(5)),
    status: derivePaceStatus(calcRequiredHoursPerDay('LOW', daysFromNow(5))),
    driftExplanation: 'Low priority, self-owned item. Safe candidate for rescheduling if velocity drops on higher-priority tasks.',
    hotStartContent: `# Weekend Outline — Starter\n\n## Saturday\n- Morning: [ ] Review notes for upcoming exams\n- Afternoon: [ ] Work on pending assignments\n- Evening: [ ] Rest / recharge\n\n## Sunday\n- Morning: [ ] Catch-up on rescheduled tasks\n- Afternoon: [ ] Plan next week with Velocity\n- Evening: [ ] Prepare materials for Monday`,
    negotiatedDraft: '',
    completionPercent: 85,
    course: 'CS 489',
    sparkline: [{ value: 70 }, { value: 72 }, { value: 74 }, { value: 76 }, { value: 80 }, { value: 84 }, { value: 90 }],
  },
];

// ─── Velocity Report Data ─────────────────────────────────────────────────────

export const VELOCITY_REPORT = {
  summary:
    'DBMS estimates were 40% too optimistic — actual time-per-problem averaged 2.3× projected. React tasks outperformed estimates by 18% with consistent early commits. Adjusting Cognitive Weighting for next week: Database tasks escalated to High-2× buffer; Frontend tasks allocated Lean-0.8× multiplier.',
  stats: [
    { label: 'Tasks Completed', value: '4/6', color: '#22c55e' },
    { label: 'Avg Hours/Day', value: '5.2h', color: '#f59e0b' },
    { label: 'Velocity Score', value: '72', color: '#f59e0b' },
    { label: 'Estimate Accuracy', value: '61%', color: '#ef4444' },
  ],
};
