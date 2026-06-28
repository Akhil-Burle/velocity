/**
 * scripts/seed-rich.js
 * ─────────────────────────────────────────────────────────────────────────────
 * HACKATHON JUDGE SEED — "Day 200 of a real student's semester"
 *
 * This replaces the demo account's data with a fully-loaded, actively chaotic
 * snapshot of a senior CS student's day. The judge opens the app and sees:
 *
 *   Dashboard:
 *     - 9 active tasks: 3 RED (panic-eligible), 3 AMBER, 3 GREEN
 *     - 3 rescheduled (shows triage happened), 4 completed (shows history)
 *     - Burnout horizon chart is visually red/amber — capacity overloaded
 *     - Live velocity score in the 40s (struggling but fighting back)
 *     - 1 task owed to a professor (Negotiate button visible)
 *     - 1 task with < 12h deadline (Panic Mode button active)
 *     - Triage triggers Ultimatum (2 tasks genuinely can't both finish)
 *
 *   Agent Log:
 *     - 12 entries from "today" covering every feature
 *     - 4 AUTONOMOUS, 6 ASSISTED, 2 COUNTDOWN entries
 *
 *   Insights / DNA:
 *     - 14 check-ins across 6 different tasks → radar chart fully populated
 *     - Archetype: "The Sprinter" (strong Focus + Throughput)
 *     - Calibration table has 4 task types with real data
 *
 *   Gamification:
 *     - Level 7, 3,840 credits, 11-day streak
 *     - Rich 30-day ledger for velocity trend sparkline
 *     - Several achievements unlocked
 *
 *   Goals:
 *     - 4 goals with linked tasks and real progress
 *
 *   Habits:
 *     - 5 habits, 30 days of history each, varied completion rates
 *
 * RESET COMMAND:
 *   node backend/scripts/seed-rich.js
 *
 * The script WIPES all existing demo data before inserting, so it is safe
 * to re-run any number of times to get a fresh state.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
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

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'velocity2026';
const DEMO_USER_ID  = 'demo_user_stable_id_v2';

// ─── Time helpers ─────────────────────────────────────────────────────────────
const now = Date.now();
const minsAgo  = (m) => new Date(now - m * 60000).toISOString();
const hoursAgo = (h) => new Date(now - h * 3600000).toISOString();
const daysAgo  = (d) => new Date(now - d * 86400000).toISOString();
const hoursFromNow = (h) => new Date(now + h * 3600000).toISOString();
const daysFromNow  = (d) => new Date(now + d * 86400000).toISOString();

function calcPace(weight, deadline) {
  const base = { HIGH: 5, MEDIUM: 3, LOW: 1 }[weight] || 3;
  const diffDays = Math.max((new Date(deadline).getTime() - now) / 86400000, 0.1);
  return Math.round((base / diffDays) * 10) / 10;
}
function paceStatus(h) {
  if (h < 2) return 'GREEN';
  if (h <= 4) return 'AMBER';
  return 'RED';
}
function sub(title, mins, done = false) {
  return { id: uuidv4(), title, estimatedMinutes: mins, scheduledSlot: null, completed: done };
}
function sparkline(trend, baseVal = 55) {
  return Array.from({ length: 7 }, (_, i) => {
    if (trend === 'crash')  return { value: Math.max(5,  Math.round(baseVal - i * (8 + Math.random() * 6))) };
    if (trend === 'up')     return { value: Math.min(98, Math.round(baseVal + i * (7 + Math.random() * 4))) };
    if (trend === 'spike')  return { value: i === 4 ? baseVal + 30 : Math.round(baseVal + (Math.random() - 0.5) * 12) };
    if (trend === 'flat')   return { value: Math.round(baseVal + (Math.random() - 0.5) * 8) };
    if (trend === 'zigzag') return { value: Math.round(baseVal + (i % 2 === 0 ? 18 : -12)) };
    return { value: Math.round(baseVal + (Math.random() - 0.5) * 16) };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// TASKS — 9 active + 3 rescheduled + 4 completed = 16 total
// Narrative: CS senior, capstone project due in 2 weeks, two hackathon
//            submissions, an OS assignment in crisis, a job interview prep,
//            a TA grading shift owed to Prof. Chen, plus ongoing research.
// ═════════════════════════════════════════════════════════════════════════════
function buildTasks(userId) {
  const tasks = [];
  const ids = {};

  // ── T1 · RED · CODE · 11h · PANIC eligible ────────────────────────────────
  ids.t1 = uuidv4();
  const t1dl = hoursFromNow(11);
  tasks.push({
    userId, id: ids.t1,
    taskName: 'OS Assignment 4 — Virtual Memory Simulator',
    deadline: t1dl, taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 9.4, status: 'RED',
    energyLevel: 'Deep Focus', estimatedDuration: 120,
    driftExplanation: 'Not started. 11 hours until submission. Clock-replacement policy implementation still missing. Activate Panic Mode — AI will generate complete working scaffold.',
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

  // ── T2 · RED · WRITING · 18h · Negotiate eligible ─────────────────────────
  ids.t2 = uuidv4();
  const t2dl = hoursFromNow(18);
  tasks.push({
    userId, id: ids.t2,
    taskName: 'Systems Design Interview Write-up — Meta Internship',
    deadline: t2dl, taskType: 'WRITING', cognitiveWeight: 'HIGH',
    selfOwned: false, recipientName: 'Recruiting Team',
    currentPaceHoursPerDay: 6.1, status: 'RED',
    energyLevel: 'Deep Focus', estimatedDuration: 90,
    driftExplanation: '22% complete. Submission window closes in 18h. Three system design answers still blank. Negotiate for a 24h extension — deadline is a soft portal cutoff, not auto-rejected.',
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

  // ── T3 · RED · CODE · 2 days · Ultimatum pair A ───────────────────────────
  ids.t3 = uuidv4();
  const t3dl = daysFromNow(2);
  tasks.push({
    userId, id: ids.t3,
    taskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
    deadline: t3dl, taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 5.8, status: 'RED',
    energyLevel: 'Deep Focus', estimatedDuration: 150,
    driftExplanation: '34% complete — behind by 3 days of expected progress. WebSocket server crashes under concurrent connections. Sprint needed: fix race condition, implement operational transforms, write integration tests.',
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
    panicScaffold: { checklist: [], boilerplate: '', repoUrl: '', generatedAt: '' },
    mode: 'normal', createdAt: daysAgo(10), updatedAt: hoursAgo(1),
  });

  // ── T4 · AMBER · WRITING · 3 days · Prof Chen / Negotiate ────────────────
  ids.t4 = uuidv4();
  const t4dl = daysFromNow(3);
  tasks.push({
    userId, id: ids.t4,
    taskName: 'Grading Rubric + 38 Student Submissions — TA Shift',
    deadline: t4dl, taskType: 'OTHER', cognitiveWeight: 'MEDIUM',
    selfOwned: false, recipientName: 'Prof. Chen',
    currentPaceHoursPerDay: 3.7, status: 'AMBER',
    energyLevel: 'Quick Wins', estimatedDuration: 90,
    driftExplanation: '30% complete (12/38 graded). Average 7 min per submission, 26 remaining = 3h of work. At current pace, will miss Prof. Chen\'s Friday 5 PM cutoff by ~4 hours. Request a Saturday extension.',
    hotStartContent: '', negotiatedDraft: `Dear Prof. Chen,\n\nI am writing regarding my TA grading shift for Assignment 3. I have completed 12 of 38 submissions and am making steady progress, but given my current workload I anticipate completing the remaining 26 by Saturday noon rather than Friday 5 PM.\n\nWould a Saturday noon submission be acceptable? I will ensure all grades include detailed rubric-based feedback as agreed.\n\nThank you for your flexibility.\n\nBest,\nAlex`,
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
  const t5dl = daysFromNow(5);
  tasks.push({
    userId, id: ids.t5,
    taskName: 'Distributed Systems — Raft Consensus Implementation',
    deadline: t5dl, taskType: 'CODE', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 3.9, status: 'AMBER',
    energyLevel: 'Deep Focus', estimatedDuration: 120,
    driftExplanation: '48% complete. Log replication works. Leader election has a split-brain edge case failing under network partition simulation. Need ~8h more at current pace — will make it but barely.',
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

  // ── T6 · AMBER · WRITING · 6 days · trust score demo ─────────────────────
  ids.t6 = uuidv4();
  const t6dl = daysFromNow(6);
  tasks.push({
    userId, id: ids.t6,
    taskName: 'ML Research Paper — Contrastive Learning for Low-Resource NLP',
    deadline: t6dl, taskType: 'WRITING', cognitiveWeight: 'HIGH',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 2.8, status: 'AMBER',
    energyLevel: 'Deep Focus', estimatedDuration: 90,
    driftExplanation: 'Self-reported 55% vs 41% actual (3/7 sections done). 14% trust gap detected — you\'re overestimating progress. Recalibrate: results section is incomplete, not just "in progress."',
    hotStartContent: '', negotiatedDraft: '',
    completionPercent: 55, sparkline: sparkline('flat', 52), isRescheduled: false,
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
  const t7dl = daysFromNow(8);
  tasks.push({
    userId, id: ids.t7,
    taskName: 'Hackathon Submission — AI Study Planner (Google Gemini)',
    deadline: t7dl, taskType: 'CODE', cognitiveWeight: 'MEDIUM',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 1.4, status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 75,
    driftExplanation: '71% complete. On track. Core Gemini integration works, UI is polished. Final stretch: demo video and submission form.',
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

  // ── T8 · GREEN · OTHER · 10 days ──────────────────────────────────────────
  ids.t8 = uuidv4();
  const t8dl = daysFromNow(10);
  tasks.push({
    userId, id: ids.t8,
    taskName: 'Senior Portfolio Site — New Projects Section',
    deadline: t8dl, taskType: 'CODE', cognitiveWeight: 'LOW',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0.8, status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 45,
    driftExplanation: '80% complete. Only needs the capstone project card and deployment. Will finish in 1-2 sessions.',
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
  const t9dl = daysFromNow(12);
  tasks.push({
    userId, id: ids.t9,
    taskName: 'Architecture Diagram — Capstone Final Report',
    deadline: t9dl, taskType: 'DIAGRAM', cognitiveWeight: 'LOW',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0.4, status: 'GREEN',
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
  tasks.push({
    userId, id: uuidv4(),
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
  tasks.push({
    userId, id: uuidv4(),
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
  tasks.push({
    userId, id: uuidv4(),
    taskName: 'Apply for 3 More Summer Internships',
    deadline: daysFromNow(18), taskType: 'OTHER', cognitiveWeight: 'MEDIUM',
    selfOwned: true, recipientName: null,
    currentPaceHoursPerDay: 0, status: 'GREEN',
    energyLevel: 'Quick Wins', estimatedDuration: 45,
    driftExplanation: 'Rescheduled. Internship pipeline is warm but not urgent this week.',
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
    driftExplanation: '100% complete. Submitted 2 hours before deadline after Panic Mode saved the inode implementation.',
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

  // Store reference IDs for linking goals, check-ins, agent log
  tasks._ids = ids;
  return tasks;
}

// ═════════════════════════════════════════════════════════════════════════════
// GOALS
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
      description: 'Submit contrastive learning paper to ACL SRW or EMNLP Findings. Need strong results section.',
      linkedTaskIds: [ids.t6],
      targetDate: daysFromNow(20),
      progressPercent: 41,
      createdAt: daysAgo(60),
    },
    {
      userId, id: uuidv4(),
      title: 'Win a Major Hackathon (Top 3 placement)',
      description: 'Already won HackMIT Best AI Track. Next target: Hack the North. Portfolio of shipped projects.',
      linkedTaskIds: [ids.t7],
      targetDate: daysFromNow(30),
      progressPercent: 68,
      createdAt: daysAgo(45),
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// HABITS — 5 habits, 30 days of history
// ═════════════════════════════════════════════════════════════════════════════
function buildHabits(userId) {
  const today = new Date();
  const DAYS = 30;

  function makeHistory(rate, recentMissed = 0) {
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (DAYS - 1 - i));
      // Recent missed days simulate a stressful week
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

  const h1 = makeHistory(0.90, 0); // perfect lately
  const h2 = makeHistory(0.80, 2); // missed 2 days — stressed week
  const h3 = makeHistory(0.65, 3); // slipping under pressure
  const h4 = makeHistory(0.92, 0); // rock solid
  const h5 = makeHistory(0.55, 5); // basically abandoned this week

  return [
    {
      userId, id: uuidv4(),
      title: 'LeetCode problem — 1 per day',
      frequency: 'daily', streak: streak(h1), history: h1,
      createdAt: daysAgo(45),
    },
    {
      userId, id: uuidv4(),
      title: 'Anki deck — 15 min review (CS concepts)',
      frequency: 'daily', streak: streak(h2), history: h2,
      createdAt: daysAgo(60),
    },
    {
      userId, id: uuidv4(),
      title: 'Run or gym — 30 min',
      frequency: 'daily', streak: streak(h3), history: h3,
      createdAt: daysAgo(90),
    },
    {
      userId, id: uuidv4(),
      title: 'Deep work block — no phone 9–11 AM',
      frequency: 'daily', streak: streak(h4), history: h4,
      createdAt: daysAgo(30),
    },
    {
      userId, id: uuidv4(),
      title: 'Read 20 pages (technical or non-fiction)',
      frequency: 'daily', streak: streak(h5), history: h5,
      createdAt: daysAgo(75),
    },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// CHECK-INS — 14 across 6 tasks showing various trust scores and drift patterns
// ═════════════════════════════════════════════════════════════════════════════
function buildCheckIns(userId, tasks) {
  const ids = tasks._ids;

  return [
    // T3 Capstone — consistently overestimating (trust gap grows)
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: daysAgo(9),
      selfReportText: 'Good progress on WebSocket server, feel about 20% done',
      selfReportPercent: 20, trustScore: 96 },
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: daysAgo(6),
      selfReportText: 'Fixed most bugs, maybe 40% now but race condition still hits',
      selfReportPercent: 40, trustScore: 88 },
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: daysAgo(3),
      selfReportText: 'Should be 50% — integration tests failing a lot though',
      selfReportPercent: 50, trustScore: 71 },
    { userId, id: uuidv4(), taskId: ids.t3, timestamp: hoursAgo(6),
      selfReportText: 'I think 60% done but honestly the OT implementation is a mess',
      selfReportPercent: 60, trustScore: 58 },

    // T5 Raft — honest and accurate
    { userId, id: uuidv4(), taskId: ids.t5, timestamp: daysAgo(7),
      selfReportText: 'Leader election done, log replication 70% through',
      selfReportPercent: 38, trustScore: 97 },
    { userId, id: uuidv4(), taskId: ids.t5, timestamp: daysAgo(4),
      selfReportText: 'Replication works, now debugging split-brain',
      selfReportPercent: 48, trustScore: 99 },

    // T6 ML Paper — optimistic but recent recalibration
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(12),
      selfReportText: 'Abstract done, intro half-written — about 25% I think',
      selfReportPercent: 25, trustScore: 93 },
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(8),
      selfReportText: 'Literature review and intro done, methodology outlined — 45%?',
      selfReportPercent: 45, trustScore: 87 },
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: daysAgo(4),
      selfReportText: 'Experiments running, results section started. Feeling 60%',
      selfReportPercent: 60, trustScore: 72 },
    { userId, id: uuidv4(), taskId: ids.t6, timestamp: hoursAgo(5),
      selfReportText: 'Honest: results section incomplete, more like 55%. Need to stop faking it',
      selfReportPercent: 55, trustScore: 84 },

    // T4 Grading — accurate and consistent
    { userId, id: uuidv4(), taskId: ids.t4, timestamp: daysAgo(3),
      selfReportText: 'Graded 8 submissions, going slowly but steady',
      selfReportPercent: 21, trustScore: 98 },
    { userId, id: uuidv4(), taskId: ids.t4, timestamp: hoursAgo(8),
      selfReportText: 'Up to 12 graded — each takes about 7 min',
      selfReportPercent: 30, trustScore: 96 },

    // T1 OS — brutal honesty
    { userId, id: uuidv4(), taskId: ids.t1, timestamp: daysAgo(2),
      selfReportText: 'Only read the spec. Clock algo not started. I am not okay.',
      selfReportPercent: 5, trustScore: 99 },
    { userId, id: uuidv4(), taskId: ids.t1, timestamp: hoursAgo(2),
      selfReportText: 'Frame table struct done, clock pointer logic in progress. 8% maybe',
      selfReportPercent: 8, trustScore: 97 },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// GAMIFICATION — Level 7, 3,840 credits, 11-day streak, rich ledger
// ═════════════════════════════════════════════════════════════════════════════
function buildGamification(userId) {
  const ledger = [];

  // 30 days of activity: tasks completed, check-ins, triage runs, panic resolves
  const ACTIONS = [
    { action: 'task_complete',   label: 'Task completed',         base: 180 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'triage_run',      label: 'Triage executed',        base:  40 },
    { action: 'panic_resolved',  label: 'Panic Mode resolved',    base: 120 },
    { action: 'day_rebalanced',  label: 'Day rebalanced',         base:  30 },
    { action: 'task_complete',   label: 'Task completed (bonus)', base: 240 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'task_complete',   label: 'Task completed',         base: 210 },
    { action: 'triage_run',      label: 'Triage executed',        base:  40 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  30 },
    { action: 'panic_resolved',  label: 'Panic Mode resolved',    base:  90 },
    { action: 'task_complete',   label: 'Task completed',         base: 310 }, // HackMIT
    { action: 'day_rebalanced',  label: 'Day rebalanced',         base:  30 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'task_complete',   label: 'Task completed',         base: 190 }, // midterm
    { action: 'triage_run',      label: 'Triage executed',        base:  40 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'task_complete',   label: 'Task completed',         base: 240 }, // auth module
    { action: 'panic_resolved',  label: 'Panic Mode resolved',    base: 150 }, // ext2 lab
    { action: 'task_complete',   label: 'Task completed',         base: 210 }, // ext2 lab
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'day_rebalanced',  label: 'Day rebalanced',         base:  35 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'triage_run',      label: 'Triage executed',        base:  40 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'panic_resolved',  label: 'Panic Mode resolved',    base: 120 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  30 },
    { action: 'triage_run',      label: 'Triage executed',        base:  40 },
    { action: 'checkin',         label: 'Check-in submitted',     base:  25 },
    { action: 'day_rebalanced',  label: 'Day rebalanced',         base:  30 },
  ];

  let cumulative = 0;
  ACTIONS.forEach((a, i) => {
    const daysBack = Math.floor((ACTIONS.length - i) * 0.9);
    const jitter = Math.round((Math.random() - 0.5) * 20);
    const amount = Math.max(10, a.base + jitter);
    cumulative += amount;
    ledger.push({
      id: uuidv4(),
      action: a.action,
      amount,
      label: a.label,
      timestamp: daysAgo(daysBack),
    });
  });

  // Add a few entries from today to show active session
  [
    { action: 'checkin', label: 'Check-in submitted', amount: 25 },
    { action: 'triage_run', label: 'Triage executed', amount: 40 },
    { action: 'day_rebalanced', label: 'Day rebalanced (autonomous)', amount: 35 },
    { action: 'panic_resolved', label: 'Panic Mode activated', amount: 120 },
  ].forEach((a, i) => {
    cumulative += a.amount;
    ledger.unshift({
      id: uuidv4(),
      action: a.action,
      amount: a.amount,
      label: a.label,
      timestamp: minsAgo(15 + i * 12),
    });
  });

  const totalCredits = cumulative;

  return {
    userId,
    credits: totalCredits,
    lifetimeCredits: totalCredits,
    streak: 11,
    longestStreak: 18,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    tasksCompleted: 4,     // completed tasks in this seed
    checkins: 14,          // matches buildCheckIns count
    panicResolved: 4,
    greenHolds: 12,
    onTimeCount: 3,
    ledger,
    achievementState: {
      first_task: true,
      five_tasks: false,
      ten_tasks: false,
      first_checkin: true,
      streak_3: true,
      streak_7: true,
      streak_14: false,
      first_panic: true,
      first_triage: true,
      calibration_master: false,
    },
    createdAt: daysAgo(45),
    updatedAt: minsAgo(15),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// AGENT LOG — Phase 1 chains, Phase 2 policy entries, Phase 3 reasoning traces
// ═════════════════════════════════════════════════════════════════════════════
function buildAgentLog(userId, tasks) {
  const ids = tasks._ids;
  const { buildAgentLogPhase } = require('./seed-agent-log-data');
  const phaseEntries = buildAgentLogPhase(userId, ids, minsAgo, hoursAgo, daysAgo);

  const coreEntries = [
    // 1. Drift alert on OS assignment (Phase 3: reasoning trace)
    {
      id: uuidv4(), userId,
      featureKey: 'drift_alert',
      title: 'CRITICAL drift on "OS Assignment 4" — velocity dropped to RED',
      reasoning: 'Pace engine recalculated. Required hours/day: 9.4h. At 0% progress in past 2 hours, crossed RED threshold automatically. Deadline is 11h away.',
      outcome: 'Status escalated to RED. Velocity degradation toast fired. Panic Mode button now active.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
      metadata: { previousStatus: 'AMBER', newStatus: 'RED', requiredHoursPerDay: 9.4 },
      rejectedAlternatives: [
        { action: 'Wait 30 more minutes before escalating', reason: 'Deadline is 11h away — every minute of delay reduces recovery options.' },
        { action: 'Show warning only, not escalate to RED', reason: 'With 0% progress and 9.4h/day required, AMBER is insufficient signal strength.' },
      ],
      createdAt: minsAgo(6),
    },
    // 2. Auto-rebalance on page load
    {
      id: uuidv4(), userId,
      featureKey: 'rebalance',
      title: 'Auto-rebalanced 6 focus blocks — 3 RED tasks detected on page load',
      reasoning: 'Command Day detected 3 critical-status tasks on load. Reorganized: OS Assignment → 09:00, Meta Interview → 11:30, Capstone WebSocket → 14:00.',
      outcome: 'Front-loaded all 3 HIGH cognitive tasks into morning peak hours. Recovery buffers inserted.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
      metadata: { redCount: 3, scheduledBlocks: 6, trigger: 'page_load_slippage_detection' },
      rejectedAlternatives: [
        { action: 'Defer rebalance until user manually requests it', reason: 'With 3 RED tasks, passive detection on load is exactly the autonomous behavior that distinguishes Velocity.' },
      ],
      createdAt: minsAgo(18),
    },
    // 3. Panic Mode on OS assignment
    {
      id: uuidv4(), userId,
      featureKey: 'panic',
      title: 'Panic Mode: 14-step rescue scaffold for OS Assignment 4 generated + GitHub repo committed',
      reasoning: 'Deadline in 11h, 0% meaningful progress on clock-replacement algorithm. AI generated complete working C implementation.',
      outcome: 'Rescue scaffold: 14-step checklist, complete C boilerplate with frame table, clock pointer, test harness.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
      metadata: { stepCount: 14, hasRepo: true, taskType: 'CODE', repoUrl: 'https://github.com/demo-user/velocity-os-lab4-rescue' },
      rejectedAlternatives: [
        { action: 'Generate a general study outline instead', reason: 'CODE task — boilerplate + checklist is 3x more actionable than an outline for a deadline emergency.' },
        { action: 'Ask user for clarification first', reason: 'Deadline in 11h leaves no time for back-and-forth; scaffold now beats perfect scaffold later.' },
      ],
      createdAt: minsAgo(22),
    },
    // 4. Negotiate downgraded by policy memory
    {
      id: uuidv4(), userId,
      featureKey: 'negotiate',
      title: "Flagging: would normally auto-draft extension request to Meta Recruiting — cancelled 3× before",
      reasoning: 'Policy memory: cancelled auto-drafting to recruiting teams 3 times. Downgrading to suggestion.',
      outcome: 'Suggestion surfaced (not auto-sent). Open Negotiate manually if you want to send.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t2, relatedTaskName: 'Systems Design Interview Write-up — Meta Internship',
      metadata: { recipient: 'Recruiting Team', completionPercent: 22, policyDowngraded: true },
      createdAt: minsAgo(35),
    },
    // 5. Trust score alert
    {
      id: uuidv4(), userId,
      featureKey: 'checkin',
      title: 'Trust gap widening on Capstone WebSocket — self-report 60% vs 34% actual',
      reasoning: 'Check-in history shows self-reported completion consistently 15–26% above actual subtask completion over 4 sessions. Trust score dropped from 96 → 58.',
      outcome: 'Task mode updated to amber. Drift explanation surfaced on card. Velocity DNA calibration axis adjusted.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t3, relatedTaskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
      metadata: { selfReported: 60, actual: 34, trustScore: 58, trustGap: 26 },
      rejectedAlternatives: [
        { action: 'Average gap over longer window before alerting', reason: '4 consecutive check-ins confirm trend — this is signal, not noise.' },
      ],
      createdAt: minsAgo(52),
    },
    // 6. Smart reschedule
    {
      id: uuidv4(), userId,
      featureKey: 'reschedule',
      title: 'Smart-packed 22 subtask slots across 5 days',
      reasoning: 'Analyzed 9 active tasks, 38 total subtasks, work window 09:00–22:00. Auto-distributed all incomplete subtasks into available slots respecting deadlines and cognitive weight.',
      outcome: '22 subtask blocks scheduled across calendar. 3 subtasks deferred beyond deadlines flagged as overload.',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: null, relatedTaskName: null,
      metadata: { slotsScheduled: 22, tasksProcessed: 9, workStart: '09:00', workEnd: '22:00', overloadFlagged: 3 },
      rejectedAlternatives: [
        { action: 'Pack by deadline only (ignore cognitive weight)', reason: 'Deadline-only packing causes back-to-back deep-focus sessions exceeding cognitive capacity.' },
        { action: "Schedule only today's tasks", reason: 'Multi-day view prevents future conflicts from compounding.' },
      ],
      createdAt: minsAgo(68),
    },
    // 7. Triage countdown
    {
      id: uuidv4(), userId,
      featureKey: 'triage',
      title: 'Queued reschedule: "Read DDIA Chapters 8–9" → deferred 3 weeks',
      reasoning: 'Workload exceeded available time by ~4.2h. DDIA reading had lowest cognitive weight (MEDIUM) and furthest deadline (21 days).',
      outcome: 'Triage countdown shown (8 seconds). User did not cancel. Task moved to Rescheduled. 2.5h of capacity freed.',
      autonomy: 'countdown', undoable: true,
      relatedTaskId: null, relatedTaskName: 'Read "Designing Data-Intensive Applications" — Ch. 8–9',
      metadata: { overloadHours: 4.2, tasksCounted: 9, countdownSeconds: 8 },
      rejectedAlternatives: [
        { action: 'Triage internship applications instead', reason: 'Internship pipeline is critical; DDIA reading has no external consequence if deferred.' },
        { action: 'Split overload across two tasks', reason: "Partial deferral doesn't free enough capacity — a clean single deferral is more actionable." },
      ],
      createdAt: minsAgo(80),
    },
    // 8. Rebalance post-ultimatum
    {
      id: uuidv4(), userId,
      featureKey: 'rebalance',
      title: 'Rebalanced 5 focus blocks after Ultimatum resolution',
      reasoning: 'After resolving Ultimatum, timeline had 2h gap. Moved Raft lab up 90 minutes, inserted 20-min recovery buffer before Meta Interview block.',
      outcome: 'OS + Raft in morning, Meta Interview after lunch, TA grading in low-energy evening slot.',
      autonomy: 'assisted', undoable: false,
      relatedTaskId: ids.t5, relatedTaskName: 'Distributed Systems — Raft Consensus Implementation',
      metadata: { deepCount: 3, scheduledBlocks: 5 },
      rejectedAlternatives: [
        { action: 'Leave the 2h gap as unscheduled buffer', reason: 'With 3 RED tasks, an empty gap is wasted capacity — packing it is net positive.' },
      ],
      createdAt: minsAgo(95),
    },
    // 9. Historical panic (ext2 lab)
    {
      id: uuidv4(), userId,
      featureKey: 'panic',
      title: 'Panic Mode resolved OS Lab 3 (ext2) — submitted 2h before deadline',
      reasoning: 'Inode indirect block parsing was failing all tests 4 hours before deadline. AI generated complete working inode traversal code with inline comments.',
      outcome: 'Submitted on time. Task marked complete. 210 Velocity Credits awarded (on-time bonus applied).',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: null, relatedTaskName: 'OS Lab 3 — File System Implementation (ext2)',
      metadata: { stepCount: 11, hasRepo: true, taskType: 'CODE', outcomeOnTime: true },
      createdAt: daysAgo(7),
    },
    // 10. Morning briefing
    {
      id: uuidv4(), userId,
      featureKey: 'rebalance',
      title: 'Morning briefing generated — 6.8h required today, recommended 8:30 AM start',
      reasoning: 'Pre-brief engine analyzed active tasks. 3 RED tasks require 9h+ combined. After cognitive-load ordering, effective focused day = 6.8h with buffers.',
      outcome: "Briefing delivered. Today's recommended order: OS Assignment → Meta Interview → Capstone sprint → TA grading (evening).",
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: null, relatedTaskName: null,
      metadata: { requiredHours: 6.8, recommendedStart: '08:30', criticalTaskCount: 3 },
      rejectedAlternatives: [
        { action: 'Start with TA grading (quick win) first', reason: 'TA grading is MEDIUM weight — OS Assignment (RED, 9.4h/day) must come first.' },
      ],
      createdAt: hoursAgo(3),
    },
    // 11. Ultimatum triggered
    {
      id: uuidv4(), userId,
      featureKey: 'triage',
      title: 'Ultimatum triggered — OS Assignment and Meta Interview cannot both finish',
      reasoning: 'Triage detected OS Assignment (9.4h/day) + Meta Interview (6.1h/day) = 15.5h required in the next 18h window. Physically impossible.',
      outcome: 'User chose to negotiate Meta extension rather than abandon either task. Negotiate modal pre-loaded.',
      autonomy: 'assisted', undoable: false,
      relatedTaskId: ids.t1, relatedTaskName: 'OS Assignment 4 — Virtual Memory Simulator',
      metadata: { taskAName: 'OS Assignment 4', taskBName: 'Meta Interview', combinedHours: 15.5, availableHours: 18 },
      createdAt: hoursAgo(1),
    },
    // 12. Capstone drift escalation
    {
      id: uuidv4(), userId,
      featureKey: 'drift_alert',
      title: 'Capstone WebSocket velocity degraded AMBER → RED — 3-day trend analysis',
      reasoning: '3 consecutive check-ins show self-reported progress outpacing actual subtask completion. Declining trend over 4 data points.',
      outcome: 'Status escalated to RED. Drift explanation: "Trust gap widened to 26%. AI recommends Panic Mode scaffold or 2-day extension."',
      autonomy: 'autonomous', undoable: false,
      relatedTaskId: ids.t3, relatedTaskName: 'Capstone: Real-time Collaboration Module (WebSocket)',
      metadata: { previousStatus: 'AMBER', newStatus: 'RED', trendDays: 3, trustScore: 58 },
      rejectedAlternatives: [
        { action: 'Downgrade to AMBER warning only', reason: 'Trust score 58 with 3-day negative trend — RED is the accurate representation of risk.' },
      ],
      createdAt: hoursAgo(5),
    },
    // 13. Omni-Bar: created task via natural language
    {
      id: uuidv4(), userId,
      featureKey: 'omnibar',
      title: 'Omni-Bar created task: "Email professor about lab extension"',
      reasoning: 'You said: "I need to email my professor about the lab deadline" → AI classified as create_task (high confidence). Task created directly without navigating to a form.',
      outcome: 'Task "Email professor about lab extension" added to your board. Deadline: in 7 days.',
      autonomy: 'countdown', undoable: false,
      relatedTaskId: null, relatedTaskName: 'Email professor about lab extension',
      metadata: {
        utterance: 'I need to email my professor about the lab deadline',
        intent: 'create_task',
        confidence: 'high',
        origin: 'omnibar',
        params: { taskName: 'Email professor about lab extension', category: 'OTHER' },
      },
      createdAt: minsAgo(15),
    },
    // 14. Omni-Bar: ran Triage after "I'm drowning in deadlines"
    {
      id: uuidv4(), userId,
      featureKey: 'omnibar',
      title: 'Omni-Bar triggered Triage — "I\'m drowning in deadlines"',
      reasoning: 'You said: "I\'m drowning in deadlines, can\'t keep up" → AI classified as run_triage (high confidence, 10s countdown). Triage ran automatically via Omni-Bar.',
      outcome: 'Triage deferred "Read DDIA Chapters 8–9" (lowest weight, furthest deadline) to free 2.5h capacity. 4 tasks rescheduled in total.',
      autonomy: 'countdown', undoable: true,
      relatedTaskId: null, relatedTaskName: 'Read "Designing Data-Intensive Applications" — Ch. 8–9',
      metadata: {
        utterance: "I'm drowning in deadlines, can't keep up",
        intent: 'run_triage',
        confidence: 'high',
        origin: 'omnibar',
        tasksTriaged: 4,
      },
      createdAt: minsAgo(30),
    },
  ];

  return [...phaseEntries, ...coreEntries];
}

// ═════════════════════════════════════════════════════════════════════════════
// POLICY MEMORY — 3 entries: 2 learned + 1 active-tracking (Phase 2)
// ═════════════════════════════════════════════════════════════════════════════
function buildPolicyMemory(userId) {
  const dA = (d) => new Date(Date.now() - d * 86400000).toISOString();
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
        { logEntryId: 'seed-cancel-1', cancelledAt: dA(8), context: 'Cancelled negotiate action' },
        { logEntryId: 'seed-cancel-2', cancelledAt: dA(5), context: 'Cancelled negotiate action' },
        { logEntryId: 'seed-cancel-3', cancelledAt: dA(2), context: 'Cancelled negotiate action' },
      ],
      learnedAt: dA(2),
      learnedMessage: '🧠 Learned: no longer auto-sending Negotiate emails to recruiting teams based on 3 past overrides.',
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
        { logEntryId: 'seed-cancel-4', cancelledAt: dA(14), context: 'Cancelled triage action' },
        { logEntryId: 'seed-cancel-5', cancelledAt: dA(9), context: 'Cancelled triage action' },
        { logEntryId: 'seed-cancel-6', cancelledAt: dA(4), context: 'Cancelled triage action' },
      ],
      learnedAt: dA(4),
      learnedMessage: '🧠 Learned: no longer auto-triaging CODE tasks based on 3 past overrides.',
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
        { logEntryId: 'seed-cancel-7', cancelledAt: dA(6), context: 'Cancelled rebalance action' },
      ],
      learnedAt: null,
      learnedMessage: null,
      createdAt: dA(10),
      updatedAt: dA(6),
    },
  ];
}

// MAIN SEED FUNCTION
// ═════════════════════════════════════════════════════════════════════════════
async function seedRichDemoAccount() {
  console.log('\n  ⚡ Velocity — Rich Judge Seed v2');
  console.log('  ─────────────────────────────────────────────');

  // ── Ensure user exists ─────────────────────────────────────────────────────
  let user = await User.findOne({ username: DEMO_USERNAME });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    user = await User.create({ username: DEMO_USERNAME, passwordHash, userId: DEMO_USER_ID });
    console.log(`  ✅ Demo user created`);
  } else {
    console.log(`  ✅ Demo user exists`);
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  await Settings.findOneAndUpdate(
    { userId: DEMO_USER_ID },
    { $setOnInsert: {
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
    { upsert: true }
  );
  console.log('  ✅ Settings initialized (work hours 09:00–22:00)');

  // ── WIPE existing demo data (full reset) ───────────────────────────────────
  const [tDel, gDel, hDel, cDel, lDel, gamDel, polDel] = await Promise.all([
    Task.deleteMany({ userId: DEMO_USER_ID }),
    Goal.deleteMany({ userId: DEMO_USER_ID }),
    Habit.deleteMany({ userId: DEMO_USER_ID }),
    CheckIn.deleteMany({ userId: DEMO_USER_ID }),
    AgentLog.deleteMany({ userId: DEMO_USER_ID }),
    Gamification.deleteMany({ userId: DEMO_USER_ID }),
    PolicyMemory.deleteMany({ userId: DEMO_USER_ID }),
  ]);
  console.log(`  🗑  Wiped: ${tDel.deletedCount} tasks, ${gDel.deletedCount} goals, ${hDel.deletedCount} habits, ${cDel.deletedCount} check-ins, ${lDel.deletedCount} agent log entries, ${gamDel.deletedCount} gamification docs, ${polDel.deletedCount} policy memory docs`);

  // ── Build and insert ───────────────────────────────────────────────────────
  const tasks    = buildTasks(DEMO_USER_ID);
  const goals    = buildGoals(DEMO_USER_ID, tasks);
  const habits   = buildHabits(DEMO_USER_ID);
  const checkins = buildCheckIns(DEMO_USER_ID, tasks);
  const agentLog = buildAgentLog(DEMO_USER_ID, tasks);
  const gam      = buildGamification(DEMO_USER_ID);
  const policies = buildPolicyMemory(DEMO_USER_ID);

  await Task.insertMany(tasks);
  await Goal.insertMany(goals);
  await Habit.insertMany(habits);
  await CheckIn.insertMany(checkins);
  await AgentLog.insertMany(agentLog);
  await PolicyMemory.insertMany(policies);
  await Gamification.create(gam);

  const active      = tasks.filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
  const rescheduled = tasks.filter(t => t.isRescheduled);
  const completed   = tasks.filter(t => t.status === 'COMPLETE');
  const red         = active.filter(t => t.status === 'RED');
  const amber       = active.filter(t => t.status === 'AMBER');
  const green       = active.filter(t => t.status === 'GREEN');

  console.log('\n  ✅ Rich seed complete!\n');
  console.log(`  Tasks:       ${tasks.length} total`);
  console.log(`    Active:    ${active.length} (${red.length} RED 🔴  ${amber.length} AMBER 🟡  ${green.length} GREEN 🟢)`);
  console.log(`    Rescheduled: ${rescheduled.length}`);
  console.log(`    Completed: ${completed.length}`);
  console.log(`  Goals:       ${goals.length}`);
  console.log(`  Habits:      ${habits.length} (30 days of history each)`);
  console.log(`  Check-ins:   ${checkins.length} (trust gaps visible on T3, T6)`);
  console.log(`  Agent Log:   ${agentLog.length} entries (incl. action chains + policy_adapted entries)`);
  console.log(`  Policy Mem:  ${policies.length} entries (2 learned behaviors + 1 active tracking)`);
  console.log(`  Credits:     ${gam.credits} VC · Level 7 · ${gam.streak}-day streak`);
  console.log('\n  🎯 Feature demo guarantees:');
  console.log('     Panic Mode:  T1 (OS Assignment) deadline = 11h → RED → Panic button active');
  console.log('     Negotiate:   T2 (Meta Interview) + T4 (TA Grading) have recipientName set');
  console.log('     Ultimatum:   T1 + T2 combined = 15.5h/day, impossible in 18h window');
  console.log('     Trust Score: T3 (Capstone) has 4 check-ins, trust gap = 26%, score = 58');
  console.log('     Triage:      3 rescheduled tasks show triage history');
  console.log('     Command Day: 6 blocks to schedule, 3 RED → auto-rebalance fires on load');
  console.log('     DNA Radar:   14 check-ins across 4 task types → all 6 axes populated');
  console.log('     Leaderboard: 3,840 credits → grader sees real rank position');
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

  // Apply the same DNS fix as connection.js — fixes ECONNREFUSED on Windows/VPN
  // where Node.js dns.resolveSrv gets a loopback DNS server (127.0.0.1:53) and
  // refuses the connection instead of falling through to the OS resolver.
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
    serverSelectionTimeoutMS: 15000,   // more generous than the 5s default
    connectTimeoutMS:         15000,
    socketTimeoutMS:          30000,
    family: 4,                         // force IPv4 — avoids IPv6 ECONNREFUSED on Windows
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
