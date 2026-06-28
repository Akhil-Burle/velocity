/**
 * scripts/seed-rich.js
 * ─────────────────────────────────────────────────────────────────────────────
 * HACKATHON JUDGE SEED — "Day 200 of a real student's semester"
 *
 * Run:  node backend/scripts/seed-rich.js
 * Safe to re-run anytime — full wipe + reseed on every run.
 *
 * What a judge sees on demo login:
 *   Dashboard  : 9 active tasks (3 RED / 3 AMBER / 3 GREEN), 3 rescheduled,
 *                5 completed, burnout chart in the red, velocity score showing
 *                real struggle, Panic Mode + Negotiate buttons visible, Ultimatum
 *                trigger seeded.
 *   Agent Log  : 20+ entries spanning every feature (chains, policy, drift,
 *                omnibar, rebalance, panic, negotiate, triage, ultimatum)
 *   Insights   : 16 check-ins across 6 tasks → all 6 DNA axes populated;
 *                archetype "The Sprinter"; calibration table with 4 types
 *   Gamification: Level 7 "Vanguard", 5,200 VC, 14-day streak, achievements
 *                 correctly keyed to match ACHIEVEMENTS catalog
 *   Goals      : 4 goals with linked tasks and real progress
 *   Habits     : 5 habits, 30 days of history each, varied completion rates
 *   Policy Mem : 2 learned + 1 tracking (Agent Memory tab pre-populated)
 *   Decision Log: 1 past Ultimatum decision seeded for history
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose     = require('mongoose');
const bcrypt       = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const User         = require('../models/User');
const Task         = require('../models/Task');
const Goal         = require('../models/Goal');
const Habit        = require('../models/Habit');
const Settings     = require('../models/Settings');
const CheckIn      = require('../models/CheckIn');
const AgentLog     = require('../models/AgentLog');
const Gamification = require('../models/Gamification');
const PolicyMemory = require('../models/PolicyMemory');
const DecisionLog  = require('../models/DecisionLog');

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'velocity2026';
const DEMO_USER_ID  = 'demo_user_stable_id_v2';


// ─── Time helpers ─────────────────────────────────────────────────────────────
const now = Date.now();
const minsAgo      = (m) => new Date(now - m * 60000).toISOString();
const hoursAgo     = (h) => new Date(now - h * 3600000).toISOString();
const daysAgo      = (d) => new Date(now - d * 86400000).toISOString();
const hoursFromNow = (h) => new Date(now + h * 3600000).toISOString();
const daysFromNow  = (d) => new Date(now + d * 86400000).toISOString();

function calcPace(weight, deadline) {
  const base = { HIGH: 5, MEDIUM: 3, LOW: 1 }[weight] || 3;
  const diffDays = Math.max((new Date(deadline).getTime() - now) / 86400000, 0.1);
  return Math.round((base / diffDays) * 10) / 10;
}
function sub(title, mins, done = false) {
  return { id: uuidv4(), title, estimatedMinutes: mins, scheduledSlot: null, completed: done };
}

// Sparkline helpers
function sparkline(trend, baseVal = 55) {
  return Array.from({ length: 8 }, (_, i) => {
    const t = new Date(now - (8 - i) * 86400000 * 0.8).toISOString();
    let v;
    if (trend === 'crash')  v = Math.max(3,  Math.round(baseVal - i * (7 + Math.random() * 5)));
    else if (trend === 'up') v = Math.min(98, Math.round(baseVal + i * (6 + Math.random() * 4)));
    else if (trend === 'zigzag') v = Math.round(baseVal + (i % 2 === 0 ? 16 : -10));
    else if (trend === 'flat') v = Math.round(baseVal + (Math.random() - 0.5) * 8);
    else v = Math.round(baseVal + (Math.random() - 0.5) * 14);
    return { value: Math.max(0, Math.min(100, v)), timestamp: t };
  });
}
function sparklineStale(baseVal = 50, daysBack = 3) {
  return Array.from({ length: 5 }, (_, i) => ({
    value: Math.round(baseVal + (Math.random() - 0.5) * 7),
    timestamp: new Date(now - (daysBack + (4 - i)) * 86400000).toISOString(),
  }));
}


// ═════════════════════════════════════════════════════════════════════════════
// TASKS — 9 active + 3 rescheduled + 5 completed = 17 total
// Narrative: CS senior, capstone sprint, two internship pipelines in flight,
//            OS assignment in full crisis, ML paper overdue, TA shift owed to
//            a professor, distributed systems lab, hackathon project.
// ═════════════════════════════════════════════════════════════════════════════
function buildTasks(userId) {
  const tasks = [];
  const ids = {};

  // ── T1 · RED · CODE · 11h · PANIC eligible ────────────────────────────────
  ids.t1 = uuidv4();
  tasks.push({
    userId, id: ids.t1,
    taskName: 'OS Assignment 4 — Virtual Memory Simulator',
    deadline: hoursFromNow(11), taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('HIGH', hoursFromNow(11)), status: 'RED',
    energyLevel: 'Deep Focus', estimatedDuration: 120,
    driftExplanation: 'Not started. 11 hours until submission. Clock-replacement policy implementation still missing. Activate Panic Mode — AI will generate a complete working C scaffold.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 8, sparkline: sparkline('crash', 80), isRescheduled: false,
    rawInput: 'OS assignment 4 virtual memory simulator due tomorrow 8am',
    creditValue: 320, creditsAwarded: false,
    subtasks: [
      sub('Read assignment spec (page replacement policies)', 20, true),
      sub('Implement clock-replacement algorithm', 75, false),
      sub('Implement LRU with frame table', 90, false),
      sub('Write test harness with memory trace file', 45, false),
      sub('Run provided test cases and fix failures', 60, false),
      sub('Write report: compare policy performance', 40, false),
    ],
    panicScaffold: { checklist: [], boilerplate: '', repoUrl: '', generatedAt: '' },
    mode: 'normal', createdAt: daysAgo(3), updatedAt: hoursAgo(2),
  });

  // ── T2 · RED · WRITING · 18h · Negotiate eligible (Recruiting Team) ───────
  ids.t2 = uuidv4();
  tasks.push({
    userId, id: ids.t2,
    taskName: 'Systems Design Interview Write-up — Meta Internship',
    deadline: hoursFromNow(18), taskType: 'WRITING', cognitiveWeight: 'HIGH',
    selfOwned: false, recipientName: 'Recruiting Team',
    currentPaceHoursPerDay: calcPace('HIGH', hoursFromNow(18)), status: 'RED',
    energyLevel: 'Deep Focus', estimatedDuration: 90,
    driftExplanation: '22% complete. Submission window closes in 18h. Three system design answers still blank. Negotiate a 24h extension — the portal deadline is a soft cutoff, not auto-rejected.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 22, sparkline: sparkline('crash', 65), isRescheduled: false,
    rawInput: 'Meta internship systems design take-home due tomorrow night',
    creditValue: 280, creditsAwarded: false,
    subtasks: [
      sub('Design URL shortener (scalability focus)', 60, true),
      sub('Design distributed rate limiter', 60, false),
      sub('Design real-time collaborative doc editor', 75, false),
      sub('Proofread and format all three answers', 30, false),
    ],
    panicScaffold: { checklist: [], boilerplate: '', repoUrl: '', generatedAt: '' },
    mode: 'normal', createdAt: daysAgo(4), updatedAt: hoursAgo(3),
  });

  // ── T3 · RED · CODE · 2 days · Ultimatum pair A (trust gap demo) ──────────
  ids.t3 = uuidv4();
  tasks.push({
    userId, id: ids.t3,
    taskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
    deadline: daysFromNow(2), taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('HIGH', daysFromNow(2)), status: 'RED',
    energyLevel: 'Deep Focus', estimatedDuration: 150,
    driftExplanation: '34% complete — behind by 3 days of expected progress. AI detected a 26% trust gap: you reported 60% last check-in but subtask completion shows 34%. WebSocket server crashes under concurrent load. Fix race condition immediately.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 34, sparkline: sparkline('crash', 70), isRescheduled: false,
    rawInput: 'Capstone project real-time collaboration module due in 2 days for sprint demo',
    creditValue: 350, creditsAwarded: false,
    subtasks: [
      sub('Fix race condition in WebSocket message handler', 90, true),
      sub('Implement CRDT-based operational transforms', 120, false),
      sub('Add presence indicators (who is typing)', 45, false),
      sub('Write integration test suite (10 concurrent users)', 60, false),
      sub('Load test with k6: 50 concurrent sessions', 45, false),
      sub('Fix merge conflicts from teammate PRs', 30, false),
    ],
    panicScaffold: {
      checklist: [
        'Fix WebSocket race condition: lock message queue with mutex',
        'Implement minimal CRDT skeleton (insert + delete operations)',
        'Add presence state map (userId → cursor position)',
        'Wire up integration test harness with 10 concurrent WebSocket clients',
        'Run load test against staging environment',
        'Resolve all merge conflicts before sprint demo',
      ],
      boilerplate: '// Capstone WebSocket CRDT scaffold — generated by Panic Mode\n// Fix race condition + implement OT skeleton',
      repoUrl: 'https://github.com/demo-user/velocity-capstone-ws-rescue',
      generatedAt: hoursAgo(26),
    },
    mode: 'normal', createdAt: daysAgo(10), updatedAt: hoursAgo(1),
  });

  // ── T4 · AMBER · OTHER · 3 days · Prof. Chen / Negotiate eligible ─────────
  ids.t4 = uuidv4();
  tasks.push({
    userId, id: ids.t4,
    taskName: 'Grading Rubric + 38 Student Submissions — TA Shift',
    deadline: daysFromNow(3), taskType: 'OTHER', cognitiveWeight: 'MEDIUM',
    selfOwned: false, recipientName: 'Prof. Chen',
    currentPaceHoursPerDay: calcPace('MEDIUM', daysFromNow(3)), status: 'AMBER',
    energyLevel: 'Quick Wins', estimatedDuration: 90,
    driftExplanation: '30% complete (12/38 graded). Average 7 min per submission, 26 remaining = ~3h. At current pace you miss Prof. Chen\'s Friday 5 PM cutoff by ~4h. A Saturday noon extension request is ready to send.',
    hotStartContent: '',
    negotiatedDraft: `Dear Prof. Chen,\n\nI am writing regarding my TA grading shift for Assignment 3. I have completed 12 of 38 submissions and am making steady progress, but given my current sprint workload I anticipate completing the remaining 26 by Saturday noon rather than Friday 5 PM.\n\nWould a Saturday noon submission be acceptable? I will ensure all grades include detailed rubric-based feedback as agreed.\n\nThank you for your understanding.\n\nBest,\nAlex`,
    completionPercent: 30, sparkline: sparkline('zigzag', 55), isRescheduled: false,
    rawInput: 'TA grading 38 submissions for Prof Chen due Friday 5pm',
    creditValue: 140, creditsAwarded: false,
    subtasks: [
      sub('Grade submissions 1–12 (batch 1)', 90, true),
      sub('Grade submissions 13–25 (batch 2)', 90, false),
      sub('Grade submissions 26–38 (batch 3)', 90, false),
      sub('Post grades + feedback to Canvas', 20, false),
    ],
    mode: 'normal', createdAt: daysAgo(5), updatedAt: hoursAgo(4),
  });

  // ── T5 · AMBER · CODE · 5 days · Ultimatum pair B ────────────────────────
  ids.t5 = uuidv4();
  tasks.push({
    userId, id: ids.t5,
    taskName: 'Distributed Systems — Raft Consensus Implementation',
    deadline: daysFromNow(5), taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('HIGH', daysFromNow(5)), status: 'AMBER',
    energyLevel: 'Deep Focus', estimatedDuration: 120,
    driftExplanation: '48% complete. Log replication works. Leader election has a split-brain edge case under network partition. Need ~8h more — will make it but barely.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 48, sparkline: sparkline('flat', 58), isRescheduled: false,
    rawInput: 'Distributed systems Raft implementation lab 3 due in 5 days',
    creditValue: 260, creditsAwarded: false,
    subtasks: [
      sub('Implement leader election (RequestVote RPC)', 90, true),
      sub('Implement log replication (AppendEntries RPC)', 90, true),
      sub('Fix split-brain under network partition', 75, false),
      sub('Implement log compaction + snapshotting', 60, false),
      sub('Pass all 30 provided test cases', 45, false),
      sub('Write design doc (1 page)', 30, false),
    ],
    mode: 'normal', createdAt: daysAgo(8), updatedAt: hoursAgo(6),
  });


  // ── T6 · AMBER · WRITING · 6 days · stale sparkline / trust decay demo ────
  ids.t6 = uuidv4();
  tasks.push({
    userId, id: ids.t6,
    taskName: 'ML Research Paper — Contrastive Learning for Low-Resource NLP',
    deadline: daysFromNow(6), taskType: 'WRITING', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('HIGH', daysFromNow(6)), status: 'AMBER',
    energyLevel: 'Deep Focus', estimatedDuration: 90,
    driftExplanation: 'Self-reported 55% vs 41% actual (3/7 sections done). 14% trust gap detected — last check-in was 3 days ago. Trust Decay is actively draining displayed progress. Recalibrate: results section is incomplete, not just "in progress."',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 55, sparkline: sparklineStale(52, 3), isRescheduled: false,
    rawInput: 'ML paper on contrastive learning for NLP conference submission in 6 days',
    creditValue: 220, creditsAwarded: false,
    subtasks: [
      sub('Write abstract + introduction (1.5 pages)', 60, true),
      sub('Background / related work section (2 pages)', 90, true),
      sub('Methodology: model architecture and training', 90, true),
      sub('Experiments: baselines, ablations, error analysis', 120, false),
      sub('Results section with tables and figures', 90, false),
      sub('Discussion, limitations, conclusion', 60, false),
      sub('Format citations and camera-ready polish', 45, false),
    ],
    mode: 'amber', createdAt: daysAgo(14), updatedAt: hoursAgo(3),
  });

  // ── T7 · GREEN · CODE · 8 days ────────────────────────────────────────────
  ids.t7 = uuidv4();
  tasks.push({
    userId, id: ids.t7,
    taskName: 'Hackathon Submission — AI Study Planner (Google Gemini)',
    deadline: daysFromNow(8), taskType: 'CODE', cognitiveWeight: 'MEDIUM',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('MEDIUM', daysFromNow(8)), status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 75,
    driftExplanation: '71% complete and on track. Core Gemini integration works, UI is polished. Final stretch: demo video and submission form.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 71, sparkline: sparkline('up', 35), isRescheduled: false,
    rawInput: 'Hackathon project AI study planner submission due in 8 days',
    creditValue: 180, creditsAwarded: false,
    subtasks: [
      sub('Set up Next.js + Gemini API integration', 60, true),
      sub('Build brain dump → schedule generation', 90, true),
      sub('Implement adaptive rescheduling with Gemini', 90, true),
      sub('Polish UI and add onboarding flow', 60, true),
      sub('Record 2-minute demo video', 30, false),
      sub('Complete submission form and publish', 20, false),
    ],
    mode: 'normal', createdAt: daysAgo(12), updatedAt: hoursAgo(1),
  });

  // ── T8 · GREEN · CODE · 10 days ───────────────────────────────────────────
  ids.t8 = uuidv4();
  tasks.push({
    userId, id: ids.t8,
    taskName: 'Senior Portfolio Site — New Projects Section',
    deadline: daysFromNow(10), taskType: 'CODE', cognitiveWeight: 'LOW',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('LOW', daysFromNow(10)), status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 45,
    driftExplanation: '80% complete. Only needs the capstone project card and deployment. Will finish in 1–2 sessions.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 80, sparkline: sparkline('up', 45), isRescheduled: false,
    rawInput: 'Update portfolio website with new projects before job applications',
    creditValue: 90, creditsAwarded: false,
    subtasks: [
      sub('Add capstone project card with screenshots', 30, true),
      sub('Add Raft implementation to projects', 20, true),
      sub('Write "About" section update', 25, true),
      sub('Add Velocity hackathon project', 20, false),
      sub('Deploy to Vercel, check all links', 15, false),
    ],
    mode: 'normal', createdAt: daysAgo(20), updatedAt: daysAgo(2),
  });

  // ── T9 · GREEN · DIAGRAM · 12 days ───────────────────────────────────────
  ids.t9 = uuidv4();
  tasks.push({
    userId, id: ids.t9,
    taskName: 'Architecture Diagram — Capstone Final Report',
    deadline: daysFromNow(12), taskType: 'DIAGRAM', cognitiveWeight: 'LOW',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: calcPace('LOW', daysFromNow(12)), status: 'GREEN',
    energyLevel: 'Brain-Dead', estimatedDuration: 30,
    driftExplanation: '55% complete. Block diagram for system overview done. Sequence diagrams for WebSocket and REST flows still needed.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 55, sparkline: sparkline('flat', 50), isRescheduled: false,
    rawInput: 'Architecture diagrams for capstone final report due in 12 days',
    creditValue: 70, creditsAwarded: false,
    subtasks: [
      sub('System overview block diagram', 45, true),
      sub('WebSocket flow sequence diagram', 30, false),
      sub('REST API flow sequence diagram', 30, false),
      sub('Database schema ERD', 30, false),
    ],
    mode: 'normal', createdAt: daysAgo(7), updatedAt: daysAgo(1),
  });


  // ── T10 · RESCHEDULED — triaged away ──────────────────────────────────────
  ids.t10 = uuidv4();
  tasks.push({
    userId, id: ids.t10,
    taskName: 'Side Project: Rebuild Personal Blog with Astro',
    deadline: daysFromNow(14), taskType: 'CODE', cognitiveWeight: 'LOW',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'GREEN',
    energyLevel: 'Brain-Dead', estimatedDuration: 60,
    driftExplanation: 'Rescheduled by Triage — low priority given current critical tasks. Resume after OS assignment and Meta submission are done.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 15, sparkline: sparkline('flat', 20), isRescheduled: true,
    rawInput: 'Rebuild personal blog in Astro with MDX support',
    creditValue: 60, creditsAwarded: false,
    subtasks: [
      sub('Set up Astro project with MDX', 30, false),
      sub('Migrate existing blog posts', 60, false),
      sub('Design new theme', 90, false),
    ],
    mode: 'normal', createdAt: daysAgo(30), updatedAt: minsAgo(45),
  });

  // ── T11 · RESCHEDULED ─────────────────────────────────────────────────────
  ids.t11 = uuidv4();
  tasks.push({
    userId, id: ids.t11,
    taskName: 'Read "Designing Data-Intensive Applications" — Ch. 8–9',
    deadline: daysFromNow(21), taskType: 'OTHER', cognitiveWeight: 'MEDIUM',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 60,
    driftExplanation: 'Rescheduled by Triage. Will resume after sprint week. Chapters 8–9 cover consensus algorithms — useful context for Raft lab.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 40, sparkline: sparkline('flat', 35), isRescheduled: true,
    rawInput: 'Finish reading DDIA chapters 8 and 9 before distributed systems exam',
    creditValue: 50, creditsAwarded: false,
    subtasks: [
      sub('Read Chapter 8: Trouble with Distributed Systems', 90, true),
      sub('Read Chapter 9: Consistency and Consensus', 90, false),
      sub('Write summary notes for exam review', 45, false),
    ],
    mode: 'normal', createdAt: daysAgo(18), updatedAt: daysAgo(3),
  });

  // ── T12 · RESCHEDULED ─────────────────────────────────────────────────────
  ids.t12 = uuidv4();
  tasks.push({
    userId, id: ids.t12,
    taskName: 'Apply for 3 More Summer Internships',
    deadline: daysFromNow(18), taskType: 'OTHER', cognitiveWeight: 'MEDIUM',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 45,
    driftExplanation: 'Rescheduled. Internship pipeline is warm but not urgent this sprint week.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 20, sparkline: sparkline('flat', 25), isRescheduled: true,
    rawInput: 'Apply to more internships on Handshake and LinkedIn',
    creditValue: 80, creditsAwarded: false,
    subtasks: [
      sub('Identify 10 target companies on Handshake', 20, true),
      sub('Tailor resume bullet points for each role', 60, false),
      sub('Submit 3 applications with cover letters', 45, false),
    ],
    mode: 'normal', createdAt: daysAgo(9), updatedAt: daysAgo(2),
  });

  // ── T13 · COMPLETE ────────────────────────────────────────────────────────
  tasks.push({
    userId, id: uuidv4(),
    taskName: 'Midterm Exam Prep — Distributed Systems',
    deadline: daysAgo(1), taskType: 'OTHER', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'COMPLETE',
    driftExplanation: '100% complete. Exam went well — scored 88/100.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 100, sparkline: sparkline('up', 25), isRescheduled: false,
    rawInput: 'Study for distributed systems midterm',
    creditValue: 190, creditsAwarded: true,
    subtasks: [
      sub('Review lecture slides 1–8', 90, true),
      sub('Practice consensus protocol problems', 60, true),
      sub('Do 3 past exam papers', 120, true),
      sub('Review Lamport clocks and vector clocks', 45, true),
    ],
    mode: 'normal', createdAt: daysAgo(14), updatedAt: daysAgo(1),
  });

  // ── T14 · COMPLETE ────────────────────────────────────────────────────────
  tasks.push({
    userId, id: uuidv4(),
    taskName: 'Capstone Sprint 3 — Auth + User Management API',
    deadline: daysAgo(4), taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'COMPLETE',
    driftExplanation: '100% complete. JWT auth, Google OAuth, role-based middleware — all shipped before sprint demo.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 100, sparkline: sparkline('up', 30), isRescheduled: false,
    rawInput: 'Implement auth module for capstone project sprint 3',
    creditValue: 240, creditsAwarded: true,
    subtasks: [
      sub('JWT sign/verify middleware', 45, true),
      sub('Google OAuth 2.0 callback handler', 60, true),
      sub('Role-based access control (RBAC)', 60, true),
      sub('Password reset via email', 45, true),
      sub('Write auth integration tests', 60, true),
    ],
    mode: 'normal', createdAt: daysAgo(12), updatedAt: daysAgo(4),
  });

  // ── T15 · COMPLETE ────────────────────────────────────────────────────────
  tasks.push({
    userId, id: uuidv4(),
    taskName: 'OS Lab 3 — File System Implementation (ext2)',
    deadline: daysAgo(7), taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'COMPLETE',
    driftExplanation: '100% complete. Submitted 2 hours before deadline after Panic Mode rescued the inode implementation.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 100, sparkline: sparkline('up', 20), isRescheduled: false,
    rawInput: 'OS lab 3 file system ext2 implementation',
    creditValue: 210, creditsAwarded: true,
    subtasks: [
      sub('Implement superblock + inode table parsing', 90, true),
      sub('Read/write file content via indirect blocks', 120, true),
      sub('Implement directory traversal', 60, true),
      sub('Handle symbolic links', 45, true),
    ],
    mode: 'normal', createdAt: daysAgo(18), updatedAt: daysAgo(7),
  });

  // ── T16 · COMPLETE ────────────────────────────────────────────────────────
  tasks.push({
    userId, id: uuidv4(),
    taskName: 'HackMIT Submission — Smart Contract Auditor',
    deadline: daysAgo(11), taskType: 'CODE', cognitiveWeight: 'MEDIUM',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'COMPLETE',
    driftExplanation: '100% complete. Won Best Use of AI track. 48-hour hackathon build.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 100, sparkline: sparkline('up', 15), isRescheduled: false,
    rawInput: 'HackMIT project submission deadline',
    creditValue: 310, creditsAwarded: true,
    subtasks: [
      sub('Bootstrap Hardhat + Gemini API project', 30, true),
      sub('Build AST parser for Solidity contracts', 90, true),
      sub('Implement Gemini-based vulnerability scanner', 120, true),
      sub('Build React frontend dashboard', 90, true),
      sub('Prepare demo and pitch', 60, true),
    ],
    mode: 'normal', createdAt: daysAgo(14), updatedAt: daysAgo(11),
  });

  // ── T17 · COMPLETE (failed via Ultimatum) ─────────────────────────────────
  ids.t17failed = uuidv4();
  tasks.push({
    userId, id: ids.t17failed,
    taskName: 'Side Freelance: Shopify Storefront Component',
    deadline: daysAgo(2), taskType: 'CODE', cognitiveWeight: 'MEDIUM',
    selfOwned: false, recipientName: 'Client — Jordan Rivera',
    currentPaceHoursPerDay: 0, status: 'failed',
    driftExplanation: 'Deliberately failed via Ultimatum — OS Assignment and Meta Interview were higher priority. Client notified, contract deferred.',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 35, sparkline: sparkline('crash', 40), isRescheduled: false,
    rawInput: 'Freelance shopify storefront component for client',
    creditValue: 0, creditsAwarded: false,
    subtasks: [
      sub('Build product grid component', 90, true),
      sub('Implement cart sidebar with animations', 60, false),
      sub('Deploy to client staging environment', 30, false),
    ],
    mode: 'normal', createdAt: daysAgo(10), updatedAt: daysAgo(2),
  });

  tasks._ids = ids;
  return tasks;
}


// ═════════════════════════════════════════════════════════════════════════════
// GOALS — 4 with linked tasks and real progress
// ═════════════════════════════════════════════════════════════════════════════
function buildGoals(userId, tasks) {
  const ids = tasks._ids;
  return [
    {
      userId, id: uuidv4(),
      title: 'Graduate with Honors — CS Senior Year',
      description: 'Maintain GPA ≥ 3.7 through finals. Deliver capstone on time. Ace distributed systems.',
      linkedTaskIds: [ids.t3, ids.t5, ids.t1],
      targetDate: daysFromNow(75),
      progressPercent: 52,
      createdAt: daysAgo(90),
    },
    {
      userId, id: uuidv4(),
      title: 'Land a Top-Tier SWE Internship (Google / Meta / Stripe)',
      description: 'Submit applications, pass technical screens, ace systems design rounds. Meta take-home is the immediate gate.',
      linkedTaskIds: [ids.t2],
      targetDate: daysFromNow(45),
      progressPercent: 35,
      createdAt: daysAgo(30),
    },
    {
      userId, id: uuidv4(),
      title: 'Publish First ML Research Paper',
      description: 'Submit contrastive learning paper to ACL SRW or EMNLP Findings. Strong results section is the key blocker.',
      linkedTaskIds: [ids.t6],
      targetDate: daysFromNow(20),
      progressPercent: 41,
      createdAt: daysAgo(60),
    },
    {
      userId, id: uuidv4(),
      title: 'Win a Major Hackathon (Top 3 placement)',
      description: 'Already won HackMIT Best AI Track. Next target: Hack the North. Build a portfolio of shipped AI projects.',
      linkedTaskIds: [ids.t7],
      targetDate: daysFromNow(30),
      progressPercent: 72,
      createdAt: daysAgo(45),
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// HABITS — 5 habits, 30 days of history, varied completion rates
// ═════════════════════════════════════════════════════════════════════════════
function buildHabits(userId) {
  const today = new Date();
  const DAYS = 30;

  function makeHistory(rate, recentMissed = 0) {
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (DAYS - 1 - i));
      const isRecent = i >= DAYS - recentMissed;
      const completed = isRecent ? false : Math.random() < rate;
      return { date: d.toISOString().slice(0, 10), completed };
    });
  }

  function streak(history) {
    let s = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].completed) s++; else break;
    }
    return s;
  }

  const h1 = makeHistory(0.90, 0);  // perfect
  const h2 = makeHistory(0.80, 2);  // missed 2 days — stressed sprint week
  const h3 = makeHistory(0.65, 3);  // slipping under pressure
  const h4 = makeHistory(0.92, 0);  // rock solid
  const h5 = makeHistory(0.55, 5);  // basically abandoned this sprint week

  return [
    { userId, id: uuidv4(), title: 'LeetCode — 1 problem per day',
      frequency: 'daily', streak: streak(h1), history: h1, createdAt: daysAgo(45) },
    { userId, id: uuidv4(), title: 'Anki — 15 min CS concept review',
      frequency: 'daily', streak: streak(h2), history: h2, createdAt: daysAgo(60) },
    { userId, id: uuidv4(), title: 'Run or gym — 30 min',
      frequency: 'daily', streak: streak(h3), history: h3, createdAt: daysAgo(90) },
    { userId, id: uuidv4(), title: 'Deep work block — no phone 9–11 AM',
      frequency: 'daily', streak: streak(h4), history: h4, createdAt: daysAgo(30) },
    { userId, id: uuidv4(), title: 'Read 20 pages (technical or non-fiction)',
      frequency: 'daily', streak: streak(h5), history: h5, createdAt: daysAgo(75) },
  ];
}


// ═════════════════════════════════════════════════════════════════════════════
// CHECK-INS — 16 across 6 tasks showing trust score evolution
// ═════════════════════════════════════════════════════════════════════════════
function buildCheckIns(userId, tasks) {
  const ids = tasks._ids;
  return [
    // T3 Capstone — consistently overestimating (trust score declining 96→58)
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: daysAgo(9),
      selfReportText: 'Good progress on WebSocket server, feel about 20% done', selfReportPercent: 20, trustScore: 96 },
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: daysAgo(6),
      selfReportText: 'Fixed most bugs, maybe 40% now but race condition still hits', selfReportPercent: 40, trustScore: 88 },
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: daysAgo(3),
      selfReportText: 'Should be 50% — integration tests failing a lot though', selfReportPercent: 50, trustScore: 71 },
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: hoursAgo(6),
      selfReportText: 'I said 60% but honestly the OT implementation is a mess — probably 34% real', selfReportPercent: 60, trustScore: 58 },

    // T5 Raft — honest and accurate (trust 97→99)
    { userId, id: uuidv4(), taskId: ids.t5, timestamp: daysAgo(7),
      selfReportText: 'Leader election done, log replication 70% through', selfReportPercent: 38, trustScore: 97 },
    { userId, id: uuidv4(), taskId: ids.t5, timestamp: daysAgo(4),
      selfReportText: 'Replication works, now debugging split-brain edge case', selfReportPercent: 48, trustScore: 99 },
    { userId, id: uuidv4(), taskId: ids.t5, timestamp: hoursAgo(10),
      selfReportText: 'Split-brain fix in progress, tests passing at 48% subtask mark', selfReportPercent: 48, trustScore: 98 },

    // T6 ML Paper — stale (last check-in 3 days ago), trust gap 14%
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(12),
      selfReportText: 'Abstract done, intro half-written — about 25%', selfReportPercent: 25, trustScore: 93 },
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(8),
      selfReportText: 'Lit review and intro done, methodology outlined — 45%?', selfReportPercent: 45, trustScore: 87 },
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(5),
      selfReportText: 'Experiments running, results section started. Feeling 60%', selfReportPercent: 60, trustScore: 72 },
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(3),
      selfReportText: 'Honest: results section incomplete, more like 55%. Stopped faking it', selfReportPercent: 55, trustScore: 84 },

    // T4 Grading — accurate and consistent
    { userId, id: uuidv4(), taskId: ids.t4, timestamp: daysAgo(3),
      selfReportText: 'Graded 8 submissions, going slowly but steady', selfReportPercent: 21, trustScore: 98 },
    { userId, id: uuidv4(), taskId: ids.t4, timestamp: hoursAgo(8),
      selfReportText: 'Up to 12 graded — each takes about 7 min', selfReportPercent: 30, trustScore: 96 },

    // T1 OS — brutal honesty
    { userId, id: uuidv4(), taskId: ids.t1, timestamp: daysAgo(2),
      selfReportText: 'Only read the spec. Clock algo not started. I am not okay.', selfReportPercent: 5, trustScore: 99 },
    { userId, id: uuidv4(), taskId: ids.t1, timestamp: hoursAgo(2),
      selfReportText: 'Frame table struct done, clock pointer logic in progress. 8% maybe', selfReportPercent: 8, trustScore: 97 },

    // T2 Meta Interview — recent, honest
    { userId, id: uuidv4(), taskId: ids.t2, timestamp: hoursAgo(4),
      selfReportText: 'First answer (URL shortener) done. Sitting at 22% with 18h left. Not good.', selfReportPercent: 22, trustScore: 98 },
  ];
}


// ═════════════════════════════════════════════════════════════════════════════
// GAMIFICATION — Level 7 "Vanguard", 5,200 VC, 14-day streak
// Level formula: level N starts at 125*(N-1)^2 lifetime credits
//   Level 7 floor = 125*36 = 4,500 — so 5,200 puts us solidly in Level 7
// Achievement keys MUST match ACHIEVEMENTS catalog in dataModel.js:
//   first_blood, momentum, green_machine, clutch, streak_7, streak_30,
//   credit_1k, credit_5k, operator, sharpshooter
// ═════════════════════════════════════════════════════════════════════════════
function buildGamification(userId) {
  const ledger = [];

  // 35 historical entries spanning 30 days — realistic CS student cadence
  const ACTIONS = [
    { action: 'task_complete',  label: 'Task completed — HackMIT Auditor',    amount: 310, daysBack: 29 },
    { action: 'panic_resolved', label: 'Panic Mode cleared',                  amount: 120, daysBack: 28 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 28 },
    { action: 'day_rebalanced', label: 'Day rebalanced',                      amount: 35,  daysBack: 27 },
    { action: 'triage_run',     label: 'Triage executed',                     amount: 40,  daysBack: 26 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 25 },
    { action: 'task_complete',  label: 'Task completed — OS Lab 3 (ext2)',     amount: 210, daysBack: 24 },
    { action: 'panic_resolved', label: 'Panic Mode cleared — ext2 inode',     amount: 150, daysBack: 24 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 30,  daysBack: 23 },
    { action: 'day_rebalanced', label: 'Day rebalanced',                      amount: 30,  daysBack: 22 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 21 },
    { action: 'triage_run',     label: 'Triage executed',                     amount: 40,  daysBack: 20 },
    { action: 'task_complete',  label: 'Task completed — Auth API',           amount: 240, daysBack: 18 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 17 },
    { action: 'day_rebalanced', label: 'Day rebalanced',                      amount: 35,  daysBack: 16 },
    { action: 'task_complete',  label: 'Task completed — Midterm Prep',       amount: 190, daysBack: 14 },
    { action: 'panic_resolved', label: 'Panic Mode cleared',                  amount: 90,  daysBack: 14 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 13 },
    { action: 'triage_run',     label: 'Triage executed',                     amount: 40,  daysBack: 12 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 30,  daysBack: 11 },
    { action: 'day_rebalanced', label: 'Day rebalanced',                      amount: 30,  daysBack: 10 },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 9  },
    { action: 'panic_resolved', label: 'Panic Mode cleared',                  amount: 120, daysBack: 8  },
    { action: 'triage_run',     label: 'Triage executed',                     amount: 40,  daysBack: 7  },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 6  },
    { action: 'day_rebalanced', label: 'Day rebalanced',                      amount: 35,  daysBack: 5  },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 4  },
    { action: 'triage_run',     label: 'Triage executed',                     amount: 40,  daysBack: 3  },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 30,  daysBack: 3  },
    { action: 'day_rebalanced', label: 'Day rebalanced (autonomous)',         amount: 35,  daysBack: 2  },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 2  },
    { action: 'triage_run',     label: 'Triage executed',                     amount: 40,  daysBack: 1  },
    { action: 'panic_resolved', label: 'Panic Mode activated — OS Assignment',amount: 120, daysBack: 0  },
    { action: 'day_rebalanced', label: 'Day rebalanced (autonomous)',         amount: 35,  daysBack: 0  },
    { action: 'checkin',        label: 'Progress check-in',                   amount: 25,  daysBack: 0  },
  ];

  ACTIONS.forEach(a => {
    const jitter = Math.round((Math.random() - 0.5) * 12);
    const amount = Math.max(10, a.amount + jitter);
    const ts = new Date(now - a.daysBack * 86400000 - Math.random() * 3600000 * 4).toISOString();
    ledger.push({ id: uuidv4(), action: a.action, amount, label: a.label, timestamp: ts });
  });

  // Sort ledger newest-first (the app expects this order)
  ledger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalCredits = ledger.reduce((s, e) => s + Math.max(0, e.amount), 0);
  // Pad to exactly 5,200 if computed total is short (due to jitter)
  const TARGET = 5200;
  const pad = Math.max(0, TARGET - totalCredits);
  if (pad > 0) {
    ledger.unshift({ id: uuidv4(), action: 'streak_bonus', amount: pad,
      label: 'Streak milestone bonus', timestamp: minsAgo(5) });
  }
  const finalCredits = ledger.reduce((s, e) => s + Math.max(0, e.amount), 0);

  return {
    userId,
    credits: finalCredits,
    lifetimeCredits: finalCredits,
    streak: 14,
    longestStreak: 21,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    tasksCompleted: 5,   // completed tasks in this seed (T13–T16 + HackMIT = 5 complete)
    checkins: 16,        // matches buildCheckIns count
    panicResolved: 5,
    greenHolds: 14,
    onTimeCount: 4,
    ledger,
    // Keys MUST match ACHIEVEMENTS catalog: first_blood, momentum, green_machine,
    // clutch, streak_7, streak_30, credit_1k, credit_5k, operator, sharpshooter
    achievementState: {
      first_blood:   { unlockedAt: daysAgo(29) },
      momentum:      { unlockedAt: daysAgo(20) },
      green_machine: { unlockedAt: daysAgo(15) },
      clutch:        { unlockedAt: daysAgo(24) },
      streak_7:      { unlockedAt: daysAgo(22) },
      credit_1k:     { unlockedAt: daysAgo(18) },
      credit_5k:     null,  // not yet unlocked (< 5000 at some point... now nearly there)
      operator:      { unlockedAt: daysAgo(14) },
      // streak_30 and sharpshooter intentionally locked — gives room to grow
    },
    createdAt: daysAgo(45),
    updatedAt: minsAgo(5),
  };
}


// ═════════════════════════════════════════════════════════════════════════════
// DECISION LOG — 1 past Ultimatum resolution (Shopify freelance task lost)
// ═════════════════════════════════════════════════════════════════════════════
function buildDecisionLog(userId, tasks) {
  const ids = tasks._ids;
  return [
    {
      userId,
      type: 'ultimatum',
      winningTaskId: ids.t1,
      winningTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
      losingTaskId: ids.t17failed,
      losingTaskName: 'Side Freelance: Shopify Storefront Component',
      reasoning: 'OS Assignment is a graded course requirement with a hard academic deadline. The freelance contract can be deferred with a client conversation. Conscious choice: academic standing over freelance timeline.',
      createdAt: daysAgo(2),
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// POLICY MEMORY — 2 learned + 1 active tracking
// ═════════════════════════════════════════════════════════════════════════════
function buildPolicyMemory(userId) {
  const dA = (d) => new Date(now - d * 86400000).toISOString();
  return [
    {
      userId,
      policyCategory: 'negotiate_recruiting',
      policyLabel: 'Auto-drafting Negotiate emails to recruiting teams',
      featureKey: 'negotiate',
      status: 'learned',
      cancelCount: 3,
      threshold: 3,
      cancelEvents: [
        { logEntryId: 'seed-cancel-1', cancelledAt: dA(8), context: 'Cancelled: auto-draft negotiate to Meta Recruiting' },
        { logEntryId: 'seed-cancel-2', cancelledAt: dA(5), context: 'Cancelled: auto-draft negotiate to Stripe Recruiting' },
        { logEntryId: 'seed-cancel-3', cancelledAt: dA(2), context: 'Cancelled: auto-draft negotiate to Google Recruiting' },
      ],
      learnedAt: dA(2),
      learnedMessage: '🧠 Learned: no longer auto-sending Negotiate emails to recruiting teams based on 3 past overrides. I will flag a suggestion instead.',
      createdAt: dA(12),
      updatedAt: dA(2),
    },
    {
      userId,
      policyCategory: 'triage_code',
      policyLabel: 'Auto-triaging CODE tasks',
      featureKey: 'triage',
      status: 'learned',
      cancelCount: 3,
      threshold: 3,
      cancelEvents: [
        { logEntryId: 'seed-cancel-4', cancelledAt: dA(14), context: 'Cancelled: auto-triage "Capstone WebSocket"' },
        { logEntryId: 'seed-cancel-5', cancelledAt: dA(9),  context: 'Cancelled: auto-triage "Raft Consensus"' },
        { logEntryId: 'seed-cancel-6', cancelledAt: dA(4),  context: 'Cancelled: auto-triage "HackMIT Submission"' },
      ],
      learnedAt: dA(4),
      learnedMessage: '🧠 Learned: no longer auto-triaging CODE tasks. You consistently override this — I\'ll flag suggestions instead.',
      createdAt: dA(18),
      updatedAt: dA(4),
    },
    {
      userId,
      policyCategory: 'rebalance_general',
      policyLabel: 'Auto-rebalancing your day plan',
      featureKey: 'rebalance',
      status: 'active',
      cancelCount: 1,
      threshold: 3,
      cancelEvents: [
        { logEntryId: 'seed-cancel-7', cancelledAt: dA(6), context: 'Cancelled: autonomous day rebalance' },
      ],
      learnedAt: null,
      learnedMessage: null,
      createdAt: dA(10),
      updatedAt: dA(6),
    },
  ];
}


// ═════════════════════════════════════════════════════════════════════════════
// AGENT LOG — 20+ entries covering every feature the judges will look for
// ═════════════════════════════════════════════════════════════════════════════
function buildAgentLog(userId, tasks) {
  const ids = tasks._ids;
  const entries = [];

  // ── 1. Compositional Chain: rebalance → conflict → negotiate cascade ───────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'chain',
    title: 'Rebalanced day → detected conflict → auto-drafted extension for "Systems Design Interview"',
    reasoning: 'Rebalance resolved most conflicts but day remained overloaded by ~3.5h. Agent cascaded automatically into Negotiate.',
    outcome: '3-step chain: rebalanced 6 blocks → confirmed hard conflict → drafted negotiate email to Recruiting Team.',
    autonomy: 'autonomous', undoable: false, undone: false,
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
        title: 'Hard conflict detected — "Systems Design Write-up" can\'t fit today',
        reasoning: 'After optimal rebalancing, 2 tasks still can\'t be scheduled. Day overloaded by ~3.5h.',
        outcome: 'Hard conflict confirmed. Cascading to Negotiate for the strongest extension candidate.',
        undoable: false, undone: false,
        relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
        timestamp: minsAgo(17),
        rejectedAlternatives: [
          { action: 'Auto-triage the conflicting task', reason: 'Task is RED — deferring worsens deadline pressure, not resolves it.' },
        ],
      },
      {
        stepNumber: 3, featureKey: 'negotiate',
        title: 'Drafted 24h extension request for "Systems Design Write-up" — queued for auto-send',
        reasoning: 'Owed to Recruiting Team, 22% complete — strongest extension case among unscheduled RED tasks.',
        outcome: 'AI drafted extension request to Recruiting Team. Queued via 10-second countdown.',
        undoable: true, undone: false,
        relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
        timestamp: minsAgo(16),
        rejectedAlternatives: [
          { action: 'Request extension for OS Assignment instead', reason: 'OS Assignment is self-owned — Negotiate only works for tasks owed to others.' },
        ],
      },
    ],
    metadata: { scheduledBlocks: 6, unscheduled: 2, cascadeTarget: 'Systems Design Interview', overloadHours: 3.5 },
    rejectedAlternatives: [
      { action: 'Schedule quick-wins first', reason: 'Would waste morning peak hours on low-cognitive work.' },
      { action: 'Order RED tasks by deadline only', reason: 'Mixing energy levels fragments focus.' },
    ],
    createdAt: minsAgo(18),
  });

  // ── 2. Policy adapted — negotiate to recruiting teams ─────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'policy_adapted',
    title: '🧠 Learned: no longer auto-sending Negotiate emails to recruiting teams (3 past overrides)',
    reasoning: 'You cancelled "Auto-drafting Negotiate emails to recruiting teams" 3 times in a row. Agent updated default to suggest rather than auto-act.',
    outcome: 'Future Negotiate actions to recruiting-type recipients flagged as suggestions, not auto-sent.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: null, relatedTaskName: null,
    policyCategory: 'negotiate_recruiting',
    policyAction: 'downgrade_to_suggestion',
    policyContext: 'Auto-drafting Negotiate emails to recruiting teams',
    cancelCount: 3,
    metadata: { category: 'negotiate_recruiting', cancelCount: 3, threshold: 3 },
    createdAt: daysAgo(2),
  });

  // ── 3. Policy adapted — triage of code tasks ──────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'policy_adapted',
    title: '🧠 Learned: no longer auto-triaging CODE tasks (3 past overrides)',
    reasoning: 'You cancelled "Auto-triaging CODE tasks" 3 times. Consistently choosing to keep CODE tasks active rather than defer them.',
    outcome: 'Future triage suggestions for CODE tasks flagged for manual review, not auto-executed.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: null, relatedTaskName: null,
    policyCategory: 'triage_code',
    policyAction: 'downgrade_to_suggestion',
    policyContext: 'Auto-triaging CODE tasks',
    cancelCount: 3,
    metadata: { category: 'triage_code', cancelCount: 3, threshold: 3 },
    createdAt: daysAgo(4),
  });

  // ── 4. Drift alert: OS Assignment escalated to RED ─────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'drift_alert',
    title: 'CRITICAL drift on "OS Assignment 4" — velocity dropped to RED',
    reasoning: 'Pace engine recalculated. Required hours/day: 9.4h. At 8% progress with 11h remaining, crossed RED threshold automatically.',
    outcome: 'Status escalated to RED. Velocity degradation toast fired. Panic Mode button now active.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
    metadata: { previousStatus: 'AMBER', newStatus: 'RED', requiredHoursPerDay: 9.4 },
    rejectedAlternatives: [
      { action: 'Wait 30 more minutes before escalating', reason: 'Deadline is 11h away — every minute of delay reduces recovery options.' },
      { action: 'Show warning only, not escalate to RED', reason: 'With 8% progress and 9.4h/day required, AMBER is insufficient signal strength.' },
    ],
    createdAt: minsAgo(6),
  });


  // ── 5. Auto-rebalance on page load ─────────────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'rebalance',
    title: 'Auto-rebalanced 6 focus blocks — 3 RED tasks detected on page load',
    reasoning: 'Command Day detected 3 critical-status tasks on load. Reorganized: OS Assignment → 09:00, Meta Interview → 11:30, Capstone WebSocket → 14:00.',
    outcome: 'Front-loaded all 3 HIGH cognitive tasks into morning peak hours. Recovery buffers inserted between blocks.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
    metadata: { redCount: 3, scheduledBlocks: 6, trigger: 'page_load_slippage_detection' },
    rejectedAlternatives: [
      { action: 'Defer rebalance until user manually requests it', reason: 'With 3 RED tasks, passive detection on load is exactly the autonomous behavior that distinguishes Velocity.' },
    ],
    createdAt: minsAgo(20),
  });

  // ── 6. Panic Mode: OS Assignment scaffold generated ────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'panic',
    title: 'Panic Mode: 14-step rescue scaffold for OS Assignment 4 generated + GitHub repo committed',
    reasoning: 'Deadline in 11h, 8% progress on clock-replacement algorithm. AI generated complete working C implementation with frame table and test harness.',
    outcome: 'Rescue scaffold: 14-step checklist, complete C boilerplate with clock pointer, test harness committed to GitHub.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
    metadata: { stepCount: 14, hasRepo: true, taskType: 'CODE', repoUrl: 'https://github.com/demo-user/velocity-os-lab4-rescue' },
    rejectedAlternatives: [
      { action: 'Generate a general study outline instead', reason: 'CODE task — boilerplate + checklist is 3× more actionable than an outline for a deadline emergency.' },
      { action: 'Ask user for clarification first', reason: 'Deadline in 11h leaves no time for back-and-forth; scaffold now beats perfect scaffold later.' },
    ],
    createdAt: minsAgo(22),
  });

  // ── 7. Negotiate downgraded by policy memory ───────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'negotiate',
    title: 'Flagging: would auto-draft extension to Meta Recruiting — cancelled 3× before',
    reasoning: 'Policy memory: you cancelled auto-drafting to recruiting teams 3 times. Downgrading from auto-act to suggestion.',
    outcome: 'Suggestion surfaced in sidebar. Open Negotiate manually if you want to send.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
    metadata: { recipient: 'Recruiting Team', completionPercent: 22, policyDowngraded: true },
    createdAt: minsAgo(35),
  });

  // ── 8. Trust gap widening on Capstone ──────────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'checkin',
    title: 'Trust gap widening on Capstone WebSocket — self-report 60% vs 34% actual',
    reasoning: 'Check-in history shows self-reported completion consistently 15–26% above actual subtask completion over 4 sessions. Trust score dropped from 96 → 58.',
    outcome: 'Task mode updated to amber. Drift explanation surfaced on card. Velocity DNA Calibration axis adjusted.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t3, relatedTaskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
    metadata: { selfReported: 60, actual: 34, trustScore: 58, trustGap: 26 },
    rejectedAlternatives: [
      { action: 'Average gap over longer window before alerting', reason: '4 consecutive check-ins confirm trend — this is signal, not noise.' },
    ],
    createdAt: minsAgo(52),
  });

  // ── 9. Smart reschedule: 22 subtask slots packed ──────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'reschedule',
    title: 'Smart-packed 22 subtask slots across 5 days',
    reasoning: 'Analyzed 9 active tasks, 38 total subtasks, work window 09:00–22:00. Auto-distributed all incomplete subtasks into available slots respecting deadlines and cognitive weight.',
    outcome: '22 subtask blocks scheduled. 3 subtasks deferred beyond deadlines flagged as capacity overload.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: null, relatedTaskName: null,
    metadata: { slotsScheduled: 22, tasksProcessed: 9, workStart: '09:00', workEnd: '22:00', overloadFlagged: 3 },
    rejectedAlternatives: [
      { action: 'Pack by deadline only (ignore cognitive weight)', reason: 'Deadline-only packing causes back-to-back deep-focus sessions exceeding cognitive capacity.' },
      { action: "Schedule only today's tasks", reason: 'Multi-day view prevents future conflicts from compounding.' },
    ],
    createdAt: minsAgo(68),
  });

  // ── 10. Triage countdown — deferred DDIA reading ─────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'triage',
    title: 'Queued reschedule: "Read DDIA Chapters 8–9" → deferred 3 weeks',
    reasoning: 'Workload exceeded available time by ~4.2h. DDIA reading had lowest cognitive weight (MEDIUM) and furthest deadline (21 days).',
    outcome: 'Triage countdown shown (8 seconds). User did not cancel. Task moved to Rescheduled. 2.5h capacity freed.',
    autonomy: 'countdown', undoable: true, undone: false,
    relatedTaskId: ids.t11, relatedTaskName: 'Read "Designing Data-Intensive Applications" — Ch. 8–9',
    metadata: { overloadHours: 4.2, tasksCounted: 9, countdownSeconds: 8 },
    rejectedAlternatives: [
      { action: 'Triage internship applications instead', reason: 'Internship pipeline is critical; DDIA reading has no external consequence if deferred.' },
      { action: 'Split overload across two tasks', reason: "Partial deferral doesn't free enough capacity." },
    ],
    createdAt: minsAgo(80),
  });

  // ── 11. Rebalance post-Ultimatum resolution ───────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'rebalance',
    title: 'Rebalanced 5 focus blocks after Ultimatum resolution',
    reasoning: 'After resolving the Ultimatum (Shopify freelance failed), timeline had a 2h gap. Moved Raft lab up 90 minutes, inserted 20-min recovery buffer before Meta Interview block.',
    outcome: 'OS Assignment + Raft in morning, Meta Interview after lunch, TA grading in low-energy evening slot.',
    autonomy: 'assisted', undoable: false, undone: false,
    relatedTaskId: ids.t5, relatedTaskName: 'Distributed Systems — Raft Consensus Implementation',
    metadata: { deepCount: 3, scheduledBlocks: 5 },
    rejectedAlternatives: [
      { action: 'Leave the 2h gap as unscheduled buffer', reason: 'With 3 RED tasks, an empty gap is wasted capacity.' },
    ],
    createdAt: minsAgo(95),
  });

  // ── 12. Historical panic: ext2 file system ────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'panic',
    title: 'Panic Mode resolved OS Lab 3 (ext2) — submitted 2h before deadline',
    reasoning: 'Inode indirect block parsing was failing all tests 4 hours before deadline. AI generated complete working inode traversal code with inline comments.',
    outcome: 'Submitted on time. Task marked complete. 210 Velocity Credits awarded (on-time bonus applied).',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: null, relatedTaskName: 'OS Lab 3 — File System Implementation (ext2)',
    metadata: { stepCount: 11, hasRepo: true, taskType: 'CODE', outcomeOnTime: true },
    createdAt: daysAgo(7),
  });

  // ── 13. Morning briefing ──────────────────────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'rebalance',
    title: 'Morning briefing generated — 6.8h required today, recommended 8:30 AM start',
    reasoning: 'Pre-brief engine analyzed active tasks. 3 RED tasks require 9h+ combined. After cognitive-load ordering, effective focused day = 6.8h with recovery buffers.',
    outcome: "Today's recommended order: OS Assignment → Meta Interview → Capstone sprint → TA grading (evening).",
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: null, relatedTaskName: null,
    metadata: { requiredHours: 6.8, recommendedStart: '08:30', criticalTaskCount: 3 },
    rejectedAlternatives: [
      { action: 'Start with TA grading (quick win) first', reason: 'TA grading is MEDIUM weight — OS Assignment (RED, 9.4h/day) must come first.' },
    ],
    createdAt: hoursAgo(3),
  });

  // ── 14. Ultimatum triggered ───────────────────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'triage',
    title: 'Ultimatum triggered — OS Assignment and Shopify Freelance cannot both finish',
    reasoning: 'Triage detected OS Assignment (9.4h/day) + Shopify Freelance (6.0h/day) = 15.4h required in the next 18h window. Physically impossible.',
    outcome: 'User chose OS Assignment over Shopify Freelance. Freelance task marked failed. Client notified via Negotiate.',
    autonomy: 'assisted', undoable: false, undone: false,
    relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
    metadata: { taskAName: 'OS Assignment 4', taskBName: 'Shopify Freelance', combinedHours: 15.4, availableHours: 18 },
    createdAt: hoursAgo(2),
  });


  // ── 15. Capstone drift escalation ────────────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'drift_alert',
    title: 'Capstone WebSocket velocity degraded AMBER → RED — 4-session trust trend',
    reasoning: '4 consecutive check-ins show self-reported progress outpacing actual subtask completion. Trust score 96 → 58 over 9 days.',
    outcome: 'Status escalated to RED. Drift explanation updated: "Trust gap 26%. AI recommends Panic Mode scaffold or 2-day extension."',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t3, relatedTaskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
    metadata: { previousStatus: 'AMBER', newStatus: 'RED', trendDays: 9, trustScore: 58 },
    rejectedAlternatives: [
      { action: 'Downgrade to AMBER warning only', reason: 'Trust score 58 with 4-session negative trend — RED accurately represents the actual risk.' },
    ],
    createdAt: hoursAgo(5),
  });

  // ── 16. Omni-Bar: create task from natural language ───────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'omnibar',
    title: 'Omni-Bar created task: "Email professor about lab extension"',
    reasoning: 'You said: "I need to email my professor about the lab deadline" → AI classified intent as create_task (high confidence, 10s countdown). Task created directly.',
    outcome: 'Task "Email professor about lab extension" added to your board. Deadline: in 7 days.',
    autonomy: 'countdown', undoable: false, undone: false,
    relatedTaskId: null, relatedTaskName: 'Email professor about lab extension',
    metadata: {
      utterance: 'I need to email my professor about the lab deadline',
      intent: 'create_task', confidence: 'high', origin: 'omnibar',
      params: { taskName: 'Email professor about lab extension', category: 'OTHER' },
    },
    createdAt: minsAgo(15),
  });

  // ── 17. Omni-Bar: triggered triage ────────────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'omnibar',
    title: 'Omni-Bar triggered Triage — "I\'m drowning in deadlines"',
    reasoning: 'You said: "I\'m drowning in deadlines, can\'t keep up" → AI classified intent as run_triage (high confidence, 10s countdown). Triage ran automatically.',
    outcome: 'Triage deferred "Read DDIA Ch. 8–9" (lowest weight, furthest deadline) freeing 2.5h. 3 tasks rescheduled.',
    autonomy: 'countdown', undoable: true, undone: false,
    relatedTaskId: ids.t11, relatedTaskName: 'Read "Designing Data-Intensive Applications" — Ch. 8–9',
    metadata: {
      utterance: "I'm drowning in deadlines, can't keep up",
      intent: 'run_triage', confidence: 'high', origin: 'omnibar', tasksTriaged: 3,
    },
    createdAt: minsAgo(30),
  });

  // ── 18. Behavioral drift: Capstone 26% gap ────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'behavioral_drift',
    title: 'Detected a 26% gap between reported and real progress on "Capstone: Real-time Collaboration"',
    reasoning: 'Self-reported: 60% · Behavioral estimate: 34%. Signals: Subtasks 1/6 complete (17%); Panic Mode triggered 1d ago (indicates past overestimation); last check-in behind expected pace line.',
    outcome: "Flagged for attention — reported number doesn't match behavioral evidence. Consider re-evaluating reported progress.",
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t3, relatedTaskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
    metadata: { gap: -26, inferredReal: 34, selfReported: 60, confidence: 'high',
      signals: { subtask: 17, staleness: -8, panic: -15, language: 0 } },
    createdAt: minsAgo(40),
  });

  // ── 19. Behavioral drift: ML Paper stale ─────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'behavioral_drift',
    title: 'Detected a 14% gap between reported and real progress on "ML Research Paper"',
    reasoning: 'Self-reported: 55% · Behavioral estimate: 41%. Signals: Subtasks 3/7 complete (43%); last check-in 3 days ago, behind expected pace line. Trust Decay actively draining.',
    outcome: 'Flagged — no check-in in 3 days while reporting 55%. Trust Decay displaying adjusted progress bar.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t6, relatedTaskName: 'ML Research Paper — Contrastive Learning for Low-Resource NLP',
    metadata: { gap: -14, inferredReal: 41, selfReported: 55, confidence: 'medium',
      signals: { subtask: 43, staleness: -12, panic: 0, language: 0 } },
    createdAt: hoursAgo(4),
  });

  // ── 20. Velocity Vector: drift detected ──────────────────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'behavioral_drift',
    title: 'Velocity Vector: "Drift Detected" — 2 tasks dragging trajectory off-course',
    reasoning: 'Portfolio magnitude: 62%. Alignment: 41% (below 50% threshold). Worst offenders: Capstone (26% drift) and ML Paper (14% drift). Both pulling vector off deadline-aligned trajectory.',
    outcome: 'Vector direction: mixed → poor. High reported activity but real behavioral signals show misalignment.',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t3, relatedTaskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
    metadata: {
      magnitude: 62, direction: 'mixed', alignment: 41,
      worstOffenders: [
        { taskName: 'Capstone: Real-time Collaboration Module (WebSocket)', driftGap: 26 },
        { taskName: 'ML Research Paper — Contrastive Learning for Low-Resource NLP', driftGap: 14 },
      ],
    },
    createdAt: minsAgo(25),
  });

  // ── 21. Negotiate draft for Prof. Chen (TA grading) ───────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'negotiate',
    title: 'Drafted Saturday extension request for TA grading shift to Prof. Chen',
    reasoning: 'Task 30% complete with Friday 5PM deadline. At 7min/submission pace, 26 remaining = 3h. Current day\'s capacity is already at 6.8h. Saturday noon is achievable.',
    outcome: 'Extension email drafted and cached on task. Negotiate button ready to send via 10s countdown.',
    autonomy: 'assisted', undoable: true, undone: false,
    relatedTaskId: ids.t4, relatedTaskName: 'Grading Rubric + 38 Student Submissions — TA Shift',
    metadata: { recipient: 'Prof. Chen', recipientType: 'professor', completionPercent: 30, extensionRequested: '48h' },
    rejectedAlternatives: [
      { action: 'Draft email requesting 1 week extension', reason: '1 week is excessive for 26 remaining submissions — Saturday noon is more defensible.' },
    ],
    createdAt: hoursAgo(1),
  });

  // ── 22. Smart Task Routing — surface best next task ───────────────────────
  entries.push({
    id: uuidv4(), userId,
    featureKey: 'reschedule',
    title: 'Smart Task Routing surfaced "OS Assignment 4" as best next task',
    reasoning: 'Next free window: 09:00–11:00 (2h Deep Focus slot). OS Assignment is RED + HIGH cognitive weight + deadline in 11h — highest urgency × energy-level fit score.',
    outcome: 'SmartPickBanner updated. Routing score 94/100 vs next candidate (Meta Interview: 78/100).',
    autonomy: 'autonomous', undoable: false, undone: false,
    relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
    metadata: { windowStart: '09:00', windowEnd: '11:00', score: 94, runnerUp: 'Meta Interview', runnerUpScore: 78 },
    createdAt: minsAgo(10),
  });

  return entries;
}


// ═════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═════════════════════════════════════════════════════════════════════════════
async function seedRichDemoAccount() {
  console.log('\n  ⚡ Velocity — Rich Judge Seed v3');
  console.log('  ─────────────────────────────────────────────');

  // ── Ensure user exists ─────────────────────────────────────────────────────
  let user = await User.findOne({ username: DEMO_USERNAME });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    user = await User.create({ username: DEMO_USERNAME, passwordHash, userId: DEMO_USER_ID });
    console.log('  ✅ Demo user created');
  } else {
    console.log('  ✅ Demo user exists');
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  await Settings.findOneAndUpdate(
    { userId: DEMO_USER_ID },
    { $set: {
        userId: DEMO_USER_ID,
        preferredWorkStart: '09:00',
        preferredWorkEnd: '22:00',
        accountabilityEmail: '',
        dailyBriefingEnabled: true,
        dailyBriefingTime: '08:30',
        theme: 'dark',
        accentColor: '#22c55e',
        calendarSyncEnabled: true,
        notificationsEnabled: true,
        autoTriageEnabled: true,
    }},
    { upsert: true, new: true }
  );
  console.log('  ✅ Settings: work hours 09:00–22:00, autoTriage on, dark theme');

  // ── WIPE existing demo data ────────────────────────────────────────────────
  const [tDel, gDel, hDel, cDel, lDel, gamDel, polDel, decDel] = await Promise.all([
    Task.deleteMany({ userId: DEMO_USER_ID }),
    Goal.deleteMany({ userId: DEMO_USER_ID }),
    Habit.deleteMany({ userId: DEMO_USER_ID }),
    CheckIn.deleteMany({ userId: DEMO_USER_ID }),
    AgentLog.deleteMany({ userId: DEMO_USER_ID }),
    Gamification.deleteMany({ userId: DEMO_USER_ID }),
    PolicyMemory.deleteMany({ userId: DEMO_USER_ID }),
    DecisionLog.deleteMany({ userId: DEMO_USER_ID }),
  ]);
  console.log(`  🗑  Wiped: ${tDel.deletedCount} tasks, ${gDel.deletedCount} goals, ${hDel.deletedCount} habits, ${cDel.deletedCount} check-ins, ${lDel.deletedCount} agent log, ${gamDel.deletedCount} gamification, ${polDel.deletedCount} policy memory, ${decDel.deletedCount} decision log`);

  // ── Build ──────────────────────────────────────────────────────────────────
  const tasks      = buildTasks(DEMO_USER_ID);
  const goals      = buildGoals(DEMO_USER_ID, tasks);
  const habits     = buildHabits(DEMO_USER_ID);
  const checkins   = buildCheckIns(DEMO_USER_ID, tasks);
  const agentLog   = buildAgentLog(DEMO_USER_ID, tasks);
  const gam        = buildGamification(DEMO_USER_ID);
  const policies   = buildPolicyMemory(DEMO_USER_ID);
  const decisions  = buildDecisionLog(DEMO_USER_ID, tasks);

  // ── Insert ─────────────────────────────────────────────────────────────────
  await Task.insertMany(tasks);
  await Goal.insertMany(goals);
  await Habit.insertMany(habits);
  await CheckIn.insertMany(checkins);
  await AgentLog.insertMany(agentLog);
  await PolicyMemory.insertMany(policies);
  await Gamification.create(gam);
  await DecisionLog.insertMany(decisions);

  // ── Summary ────────────────────────────────────────────────────────────────
  const active      = tasks.filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
  const rescheduled = tasks.filter(t => t.isRescheduled);
  const completed   = tasks.filter(t => t.status === 'COMPLETE');
  const failed      = tasks.filter(t => t.status === 'failed');
  const red         = active.filter(t => t.status === 'RED');
  const amber       = active.filter(t => t.status === 'AMBER');
  const green       = active.filter(t => t.status === 'GREEN');

  const finalCredits = gam.ledger.reduce((s, e) => s + Math.max(0, e.amount), 0);
  // Compute level: level N when 125*(N-1)^2 <= credits
  let level = 1;
  while (125 * level * level <= finalCredits) level++;

  console.log('\n  ✅ Rich seed v3 complete!\n');
  console.log(`  Tasks:       ${tasks.length} total`);
  console.log(`    Active:    ${active.length} (${red.length} RED 🔴  ${amber.length} AMBER 🟡  ${green.length} GREEN 🟢)`);
  console.log(`    Rescheduled: ${rescheduled.length}`);
  console.log(`    Completed: ${completed.length}`);
  console.log(`    Failed:    ${failed.length} (via Ultimatum)`);
  console.log(`  Goals:       ${goals.length}`);
  console.log(`  Habits:      ${habits.length} (30 days of history each)`);
  console.log(`  Check-ins:   ${checkins.length}`);
  console.log(`  Agent Log:   ${agentLog.length} entries`);
  console.log(`  Policy Mem:  ${policies.length} entries (2 learned + 1 active)`);
  console.log(`  Decision Log: ${decisions.length} Ultimatum resolution`);
  console.log(`  Credits:     ${finalCredits} VC · Level ${level} · ${gam.streak}-day streak`);
  console.log('\n  🎯 Feature demo guarantees:');
  console.log('     Panic Mode:   T1 (OS Assignment) deadline = 11h → RED → Panic button active');
  console.log('     Negotiate:    T2 (Meta, Recruiting Team) + T4 (TA, Prof. Chen) ready to send');
  console.log('     Ultimatum:    T1 + T2 = 15h/day in 18h window + T17 failed task in history');
  console.log('     Trust Score:  T3 (Capstone) 4 check-ins, trust 96→58, gap 26% visible');
  console.log('     Trust Decay:  T6 (ML Paper) stale 3 days → Trust Decay bar draining');
  console.log('     Triage:       3 rescheduled tasks show triage history');
  console.log('     Command Day:  6 blocks, 3 RED → autonomous rebalance fires on load');
  console.log('     DNA Radar:    16 check-ins across 5 task types → all 6 axes populated');
  console.log('     Agent Memory: 2 learned behaviors pre-populated in Agent Memory tab');
  console.log('     Achievements: 7 unlocked, keys match ACHIEVEMENTS catalog correctly');
  console.log(`     Leaderboard:  ${finalCredits} VC → meaningful rank position`);
  console.log('\n  🔑 Login: demo / velocity2026\n');
}


// ═════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════════
if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri === 'your_mongodb_uri_here') {
    console.error('\n  ❌ MONGODB_URI not set in backend/.env\n');
    process.exit(1);
  }

  // DNS fix — avoids ECONNREFUSED on Windows/VPN with loopback DNS
  const dns = require('dns');
  try {
    const servers = dns.getServers();
    const onlyLoopback = !servers.length ||
      servers.every(s => s === '127.0.0.1' || s === '::1' || s.startsWith('127.'));
    if (onlyLoopback) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      console.log('  ℹ️  DNS patched to 8.8.8.8 / 1.1.1.1 (loopback-only detected)');
    }
  } catch (_) { /* ignore */ }

  mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000,
    family: 4,
  })
    .then(() => {
      console.log('  ✅ MongoDB connected');
      return seedRichDemoAccount();
    })
    .then(() => { mongoose.disconnect(); process.exit(0); })
    .catch(err => {
      console.error('\n  ❌ Seed failed:', err.message);
      console.error('\n  Troubleshooting:');
      console.error('    1. Check MONGODB_URI in backend/.env is correct');
      console.error('    2. Add your current IP to Atlas Network Access:');
      console.error('       https://cloud.mongodb.com → Security → Network Access → Add IP');
      console.error('    3. Or add 0.0.0.0/0 to allow all IPs (fine for hackathon demo)\n');
      process.exit(1);
    });
}

module.exports = { seedRichDemoAccount, DEMO_USER_ID, DEMO_USERNAME, DEMO_PASSWORD };
