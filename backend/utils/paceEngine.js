/**
 * utils/paceEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The real pace-tracking + credit-scoring engine. Pure, deterministic functions
 * shared by every controller so the math is identical everywhere.
 *
 *   computeTaskCredits(task)             → credit value assigned at creation
 *   computePaceMetrics(task, now)        → expected vs actual, velocity, projection, status
 *   computeCompletionAward(task, when)   → differential credits earned on completion
 *
 * Pace philosophy:
 *   expected(t) is a straight line from 0% at createdAt to 100% at deadline.
 *   actual is the user's logged completion over time (timestamped check-ins).
 *   drift = actual − expected. Velocity is the regression slope of check-ins.
 *   Status is honest: GREEN on/ahead, AMBER behind-but-projected-to-finish,
 *   RED projected to miss the deadline.
 */

const DAY = 86400000;

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }
function round5(n) { return Math.round(n / 5) * 5; }

// ─── Credit value at creation ─────────────────────────────────────────────────

const WEIGHT_BASE_CREDITS = { HIGH: 150, MEDIUM: 90, LOW: 50 };

/**
 * Assign a credit value to a task when it's created. Higher cognitive weight,
 * tighter deadlines, and richer subtask breakdowns are worth more.
 */
function computeTaskCredits(task) {
  const base = WEIGHT_BASE_CREDITS[task.cognitiveWeight] || 90;
  const days = Math.max((new Date(task.deadline).getTime() - Date.now()) / DAY, 0.1);
  const urgencyMult = days < 1 ? 1.5 : days < 3 ? 1.3 : days < 7 ? 1.15 : 1.0;
  const typeMult = task.taskType === 'CODE' ? 1.1 : task.taskType === 'WRITING' ? 1.05 : 1.0;
  const subtaskBonus = 1 + Math.min((task.subtasks?.length || 0) * 0.02, 0.2);
  return Math.max(25, round5(base * urgencyMult * typeMult * subtaskBonus));
}

// ─── Velocity (regression slope of timestamped check-ins, %/day) ──────────────

function velocityRate(points) {
  const pts = (points || [])
    .filter(p => p && p.timestamp)
    .map(p => ({ t: new Date(p.timestamp).getTime(), v: p.value }))
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
  return (n * sxy - sx * sy) / denom; // %/day
}

/** Steadiness of pace: low variance between consecutive check-in rates = high. */
function computeConsistency(points) {
  const pts = (points || [])
    .filter(p => p && p.timestamp)
    .map(p => ({ t: new Date(p.timestamp).getTime(), v: p.value }))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 3) return 70; // not enough signal yet — neutral

  const rates = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].t - pts[i - 1].t) / DAY;
    if (dt > 0.001) rates.push((pts[i].v - pts[i - 1].v) / dt);
  }
  if (rates.length < 2) return 70;

  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const std = Math.sqrt(variance);
  const cv = Math.abs(mean) > 0.01 ? std / Math.abs(mean) : std;
  return Math.round(clamp(100 - cv * 35));
}

// ─── Core pace metrics ────────────────────────────────────────────────────────

/**
 * Compute the full pace picture for a task at time `now`.
 * Returns expected %, actual %, drift, velocity (%/day), projected finish,
 * required hours/day to recover, status, and consistency.
 */
function computePaceMetrics(task, now = Date.now()) {
  const createdAt = new Date(task.createdAt || now).getTime();
  const deadline = new Date(task.deadline).getTime();
  const actual = clamp(task.completionPercent || 0);

  const total = Math.max(deadline - createdAt, DAY * 0.1);
  const elapsed = Math.max(0, Math.min(now - createdAt, total));
  const expected = clamp((elapsed / total) * 100);
  const drift = Math.round(actual - expected);

  const daysToDeadline = (deadline - now) / DAY;
  const elapsedDays = Math.max((now - createdAt) / DAY, 0.05);

  // Velocity — prefer regression of check-ins, fall back to average so far
  let rate = velocityRate(task.sparkline);
  if (rate === null) rate = actual > 0 ? actual / elapsedDays : 0;
  rate = Math.round(rate * 10) / 10;

  const remaining = 100 - actual;
  const projectedDaysToFinish = rate > 0.1 ? remaining / rate : Infinity;
  const projectedFinishMs = isFinite(projectedDaysToFinish) ? now + projectedDaysToFinish * DAY : null;
  const willFinishOnTime = projectedFinishMs !== null ? projectedFinishMs <= deadline : false;

  // Required hours/day to finish the REMAINING work by the deadline
  const baseHours = { HIGH: 5, MEDIUM: 3, LOW: 1 }[task.cognitiveWeight] || 3;
  const requiredHoursPerDay = daysToDeadline > 0.05
    ? Math.round(((remaining / 100) * baseHours / Math.max(daysToDeadline, 0.1)) * 10) / 10
    : Math.round(((remaining / 100) * baseHours) * 10) / 10;

  // Required %/day to stay on track from here
  const requiredRate = daysToDeadline > 0.05
    ? Math.round((remaining / Math.max(daysToDeadline, 0.1)) * 10) / 10
    : remaining;

  let status;
  if (actual >= 100) status = 'COMPLETE';
  else if (drift >= -3) status = 'GREEN';            // on pace or ahead
  else if (willFinishOnTime && daysToDeadline > 0) status = 'AMBER'; // behind but recoverable
  else status = 'RED';                                // projected to miss

  const consistency = computeConsistency(task.sparkline);

  return {
    expected: Math.round(expected),
    actual: Math.round(actual),
    drift,
    velocityRate: rate,                 // %/day the user is actually moving
    requiredRate,                       // %/day needed from now to finish on time
    requiredHoursPerDay,
    daysToDeadline: Math.round(daysToDeadline * 10) / 10,
    projectedFinish: projectedFinishMs ? new Date(projectedFinishMs).toISOString() : null,
    willFinishOnTime,
    onPace: drift >= -3,
    status,
    consistency,
  };
}

// ─── Differential completion award ────────────────────────────────────────────

/**
 * Compute the credits earned for completing a task. Full value requires an
 * on-time, steady-pace finish. Cramming or finishing late reduces the award.
 */
function computeCompletionAward(task, completedAt = Date.now()) {
  const base = task.creditValue || computeTaskCredits(task);
  const deadline = new Date(task.deadline).getTime();
  const createdAt = new Date(task.createdAt || completedAt).getTime();
  const onTime = completedAt <= deadline;

  const metrics = computePaceMetrics({ ...task, completionPercent: 100 }, completedAt);
  const consistency = metrics.consistency;

  let multiplier = 1.0;
  const reasons = [];

  if (onTime) {
    reasons.push('On time');
  } else {
    multiplier *= 0.4;
    reasons.push('Late −60%');
  }

  // Steady pace earns up to full; erratic/crammed earns ~75%
  const consFactor = 0.75 + (consistency / 100) * 0.35; // 0.75 → 1.10
  multiplier *= consFactor;
  reasons.push(`${consistency}% steady pace`);

  // Early-finish bonus
  if (onTime) {
    const slack = (deadline - completedAt) / DAY;
    const lifespan = Math.max((deadline - createdAt) / DAY, 0.1);
    if (slack / lifespan > 0.25) { multiplier *= 1.12; reasons.push('Finished early +12%'); }
  }

  const credits = Math.max(5, round5(base * multiplier));
  return {
    base,
    credits,
    multiplier: Math.round(multiplier * 100) / 100,
    consistency,
    onTime,
    reason: reasons.join(' · '),
  };
}

// ─── Finish Probability ───────────────────────────────────────────────────────

/**
 * Compute a 0–100 finish probability for a task.
 *
 * Models four independent risk factors and combines them multiplicatively:
 *
 *   pDrift      — how far ahead/behind the expected line you are
 *   pVelocity   — whether your actual pace can cover the remaining distance
 *   pConsistency — how steady (not erratic) your pace has been
 *   pDeadline   — runway pressure (near-deadline amplifies all risks)
 *
 * A task on the ideal line with a steady pace and 5 days left → ~95%.
 * A task 25% behind with no velocity and 1 day left → ~8%.
 */
function computeFinishProbability(task, now = Date.now()) {
  const actual = clamp(task.completionPercent || 0);
  if (actual >= 100) return 100;

  const metrics = computePaceMetrics(task, now);

  // ── Factor 1: Drift (how far off the ideal line) ─────────────────────────
  // drift = actual − expected. 0 = perfect. Negative = behind.
  // Map drift to a probability: +20 drift → 1.0, 0 → 0.85, -25 → 0.25
  const pDrift = clamp(0.85 + metrics.drift * 0.006, 0.1, 1.0);

  // ── Factor 2: Velocity adequacy ───────────────────────────────────────────
  // Does your actual velocity cover the required rate?
  // If velocityRate >= requiredRate → good. If 0 velocity → very bad.
  const vRatio = metrics.requiredRate > 0
    ? Math.min(metrics.velocityRate / metrics.requiredRate, 1.2)
    : metrics.velocityRate > 0 ? 1.0 : 0;
  // Map: ratio 1.0+ → 0.95, ratio 0.5 → 0.6, ratio 0 → 0.1
  const pVelocity = clamp(0.1 + vRatio * 0.85, 0.1, 0.95);

  // ── Factor 3: Consistency (steady pace vs erratic/cramming) ──────────────
  // consistency 0–100. Map linearly: 100 → 0.98, 50 → 0.75, 0 → 0.52
  const pConsistency = 0.52 + (metrics.consistency / 100) * 0.46;

  // ── Factor 4: Deadline pressure amplifier ────────────────────────────────
  // When the deadline is very close, any risk is amplified.
  // daysToDeadline 0 → amplifier 0.35 (brutal), 1 → 0.65, 3+ → 1.0 (neutral)
  const d = Math.max(0, metrics.daysToDeadline);
  const pDeadline = d >= 3 ? 1.0 : 0.35 + (d / 3) * 0.65;

  // Combine: multiplicative so any single bad factor drags the whole score
  const raw = pDrift * pVelocity * pConsistency * pDeadline;

  // Scale to 0–100 and floor at 2 (never show 0% while task is alive)
  return Math.max(2, Math.min(99, Math.round(raw * 100)));
}

module.exports = {
  computeTaskCredits,
  computePaceMetrics,
  computeCompletionAward,
  computeFinishProbability,
  velocityRate,
  computeConsistency,
};
