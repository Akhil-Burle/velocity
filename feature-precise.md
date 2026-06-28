# Velocity — Features

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide React — Node.js/Express, MongoDB Atlas + Mongoose, JWT + bcrypt, Google Gemini AI (Vertex AI / Developer API), Google Calendar API (OAuth2), Google Cloud TTS, GitHub API (@octokit/rest), Firebase Hosting frontend, Google Cloud Run backend

---

**Guest Login** — Issues a 24-hour JWT for a disposable session with no credentials required.

**Demo Login** — Username/password login against MongoDB with bcrypt-hashed credentials (demo / velocity2026).

**Google Sign-In** — Full OAuth2 flow requesting calendar.readonly scope, creates or finds a user by Google ID.

**Brain Dump (Text)** — Paste any free-form text and Gemini extracts up to 5 structured tasks with deadlines, subtasks, and cognitive weights.

**Chaos Scanner (Image)** — Upload a whiteboard or syllabus photo and Gemini Vision reads up to 10 tasks out of it.

**Task Management** — Full CRUD for tasks with live pace metrics (GREEN/AMBER/RED), sparkline history, and auto-overdue detection.

**Subtask Management** — Add, complete, rename, or delete subtasks; task completion percent auto-derives from subtask ratio.

**Pace Engine** — Core algorithm computing required pace, drift, consistency score, velocity rate, and on-time probability for every task.

**Check-In (Trust Score)** — User self-reports progress; system compares against actual subtask completion and scores self-reporting accuracy (0–100).

**Hot-Start** — Gemini generates a starter scaffold (boilerplate/outline/diagram structure) for any task to eliminate activation friction.

**Negotiate** — Drafts a professional deadline extension email tailored to the recipient type using actual task progress as context.

**Triage** — Detects workload overload and automatically defers the safest task (lowest weight + furthest deadline).

**Reschedule / Slot Packer** — Packs all subtasks into available working hours and writes scheduled slot timestamps back to each subtask.

**Calendar View** — Merges internal slot-packed events with live Google Calendar meetings into a single week-view calendar.

**Command Day** — Builds today's full timeline as focus blocks ordered by urgency, with meeting blocks and recovery buffers.

**AI Rebalance** — Re-orders daily focus blocks by cognitive weight and time-of-day energy fit with a Gemini-generated coaching note.

**Panic Mode** — Generates an 8–15 step rescue checklist, runnable boilerplate, and optionally creates a GitHub repo with the scaffold committed.

**Ultimatum Engine** — Detects genuine two-task deadline conflicts and forces a conscious priority choice with AI-written failure cost sentences.

**OmniBar** — Natural language command bar that classifies intent (8 types), respects Policy Memory, and auto-executes or suggests based on confidence.

**Voice Input / TTS** — OmniBar accepts mic input via Web Speech API and speaks responses back via Google Cloud TTS (en-US-Journey-F).

**Behavioral Drift Detection** — Infers real progress from subtask data, staleness, panic usage, and OmniBar language without asking the user.

**Forecast Agent** — Computes finish probability, risk level, and a specific recovery action for every task, with autonomous drift alerts.

**Velocity Vector** — Aggregate productivity direction score (magnitude, direction, alignment) with worst-offender task list.

**Reminders** — Auto-generates up to 10 time-sensitive reminders from task deadlines, stale check-ins, and habit schedules.

**Goals** — Create high-level goals, link tasks to them, and track progress automatically from linked task completions.

**Habits** — Daily/weekly habit tracking with streak calculation recomputed on every check-in.

**Settings** — Per-user work hours, briefing schedule, theme, accent color, and notification/sync toggles stored in MongoDB.

**Morning Briefing** — On-demand Gemini summary calling out critical tasks, incomplete habits, and deliberate trade-offs.

**Velocity DNA** — 6-axis radar chart (Focus, Consistency, Recovery, Throughput, Calibration, Momentum) with productivity archetype label.

**Tomorrow Pre-Brief** — Evening planning card with required hours, recommended start time, and a Gemini coaching note for the next day.

**Weekly Report** — 7-day credits, tasks completed, on-time rate, daily credit chart, hours logged, and streak.

**Insights / Estimation Calibration** — AI productivity summary with planned vs. actual hour breakdown per task type and cognitive weight.

**Gamification (Velocity Credits)** — Pace-differential credit awards for task completions with a 9-tier level system and achievement badges.

**Leaderboard** — Deterministic anonymized cohort of 15 users showing rank, total users, and percentile for the current credit total.

**Agent Activity Log** — Central log of every autonomous action with reasoning, outcome, autonomy level, and per-step undo support.

**Policy Memory** — Tracks canceled autonomous actions; after 3 cancellations of the same type, the agent permanently switches to suggestion mode.

**Cascade Chain** — When rebalance hits a hard conflict, the agent auto-sequences triage → negotiate → log as a single multi-step chain entry.

**Auto-Seed** — On first login, seeds a demo account with 5 pace-realistic tasks complete with sparkline histories.

**Health Endpoint** — Reports MongoDB status, active AI backend (Vertex vs. Developer API), model name, and server version.
