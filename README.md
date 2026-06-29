# ⚡ Velocity — AI Productivity Agent

**An AI that acts before you miss the deadline, not after.**

Velocity doesn't send reminders. It monitors your task load in real time, infers where you're actually behind (not just where you *say* you are), and takes autonomous corrective action with a cancel window — or fires silently when the situation is critical enough not to ask.

🔗 **Live demo:** [https://velocity-500511.web.app](https://velocity-500511.web.app)

> **Zero setup for judges:** Click **"Enter Demo Sandbox"** on the landing page — it types credentials on-screen and drops you straight into a pre-seeded dashboard. No signup, no form, no wait.  
> Persistent seeded account: `demo` / `velocity2026`

---

## The Problem

Most productivity tools fail at the critical moment: *right before* a deadline is missed. They're passive ledgers — they record what you planned, not what's actually happening. By the time a missed deadline is obvious, it's too late for anything except damage control.

The hackathon brief asks for a tool that "proactively helps users complete tasks before deadlines are missed, going beyond passive reminders." Velocity's answer is to remove the human from the loop for low-stakes interventions, and give them back control — with full audit trail — for the consequential ones.

---

## Why This Is Agentic, Not Just AI-Assisted

Most submissions that claim "agentic" mean: user types a command → AI returns a suggestion → user clicks "apply." That's a smart assistant. An agent does things.

Velocity earns the label through three specific mechanisms:

**1. Actions without prompts.** The Forecast Agent and Behavioral Drift engine run on a polling loop. When a task's finish probability drops below 45%, the system writes a specific recovery action to the Activity Log — no user input triggered it, no button was clicked. The `autonomy` field on that log entry is literally `"autonomous"`.

**2. Memory that changes future behavior.** Cancel the same autonomous action 3 times and the system writes a `policy_adapted` log entry: *"Learned: no longer auto-sending Negotiate emails to professors based on 3 past overrides."* Future OmniBar parses for that category get downgraded from `high` to `medium` confidence — the agent acts differently based on history.

**3. Multi-step chains that sequence themselves.** When AI Rebalance detects a hard conflict (tasks won't fit in the day), it automatically sequences: rebalance → detect conflict → draft extension email — without pausing to ask. Logged as a single chain entry with per-step undo and `rejectedAlternatives` reasoning ("Why not auto-triage? Task is RED — deferring it worsens pressure").

**The receipts:** Every autonomous action is persisted in the Agent Activity Log (`/agent-log`) with `reasoning`, `outcome`, `autonomy` level, `rejectedAlternatives`, and undo support. Judges can verify the claims by opening the log, not by taking my word for it.

<!-- screenshot: Agent Activity Log showing entries with autonomy badges ("autonomous", "countdown", "assisted"), reasoning text, and a chain entry expanded to show individual steps -->

---

## Curated Feature Walkthrough

### 1. Forecast Agent + Behavioral Drift Detection
**Autonomy level:** `autonomous` — fires without any user trigger.

The Forecast Agent runs a 4-factor finish probability model on every active task: drift from the expected pace line × velocity adequacy × consistency score × deadline pressure amplifier. When probability falls below 45% *and* no alert has been written in the past 2 hours, the agent writes a drift alert to the Activity Log with a specific recovery instruction — unprompted.

Simultaneously, Behavioral Drift infers "real" progress from 4 signals it collects passively: subtask completion ratio (55% weight), staleness vs. the expected pace line (30%), Panic Mode usage as a negative tell (15%), and OmniBar language sentiment extracted by Gemini. When self-reported progress diverges from behavioral evidence by more than 25%, it logs that gap too.

**Why it matters for the brief:** This is what "beyond passive reminders" looks like mechanically — the system detects a problem, calculates a specific fix, and records an action, all without being invoked.

<!-- screenshot: Activity Log showing a drift_alert entry with autonomy="autonomous", probability %, and the specific recovery instruction text (e.g., "Velocity is 2.1%/day but needs 5.3%/day. Double today's session length.") — emphasize that no user interaction triggered it -->

---

### 2. Policy Memory — The Agent Learns From Your Overrides
**Autonomy level:** `autonomous` — behavioral change fires on the 3rd cancel.

Every time a user cancels or undoes an autonomous action, Velocity increments a counter per `(user, action-category)` pair. Categories are granular: `negotiate_professor`, `negotiate_recruiting`, `triage_code`, `rebalance_general`. After 3 cancellations, the agent:
- Flips its internal `status` to `'learned'`
- Writes a `policy_adapted` log entry explaining what it learned in plain English
- Permanently downgrades future OmniBar high-confidence classifications for that category to medium — so the system suggests instead of auto-acts

This is durable, per-user, stored in MongoDB alongside the cancel event history.

**Why it matters:** This is the mechanism that makes the difference between "smart on first use" and "calibrated to this user." No competing submission will have a policy adaptation trail that a judge can read in the Activity Log.

<!-- screenshot: Activity Log showing a policy_adapted entry (featureKey="policy_adapted") with the learned message "🧠 Learned: no longer auto-sending Negotiate emails to professors based on 3 past overrides" and the cancelCount field visible -->

---

### 3. Cascade Chain — Multi-Step Autonomous Sequence
**Autonomy level:** `autonomous` — chain fires from a single "Rebalance" click.

When AI Rebalance detects that today's tasks won't fit in available hours even after optimal ordering:
1. Reorders focus blocks by cognitive weight and time-of-day energy fit (deep focus in the morning)
2. Detects which task causes the conflict
3. Automatically drafts a Negotiate extension email for the best candidate — without asking

This is logged as a single chain entry in the Activity Log with `isChain: true`, per-step undo, and a `rejectedAlternatives` field at each step documenting what the AI considered and why it chose differently. The chain logic also checks Policy Memory before executing — if the user has previously cancelled chained actions 3 times, it degrades to a suggestion.

**Why it matters:** Multi-step autonomous sequencing with reasoning traces is the clearest proof of agentic depth. Most AI tools require one prompt per action. This takes one click and does three things.

<!-- screenshot: Activity Log showing a chain entry expanded to reveal 3 steps (rebalance → conflict detect → negotiate draft), each with its own reasoning field and an undo button; the isChain badge visible at the top of the card -->

---

### 4. Panic Mode — Zero-Hour Rescue with GitHub
**Autonomy level:** `assisted` → `autonomous` when GitHub token is configured.

On any RED-status task (projected to miss deadline), one click triggers:
1. Gemini generates an 8–15 step task-specific rescue checklist
2. Generates runnable boilerplate (working code stubs for CODE tasks, structured outlines for WRITING/DIAGRAM)
3. Creates a public GitHub repo using the GitHub API, commits the checklist + boilerplate as a README, and returns the live URL

All three happen in one action. The boilerplate is cached on the task object — hitting Panic Mode twice returns the same scaffold instantly.

**Why it matters for the brief:** "Complete tasks before deadlines are missed" is the literal brief. Panic Mode is the most direct answer — it generates a scaffold you can start executing immediately, then creates a repo you can show a reviewer. The GitHub step is verifiable by opening the URL.

<!-- screenshot: Panic Mode panel on a RED task showing: animated step tracker (Analyzing → Generating checklist → Building boilerplate), the completed checklist rendered, and a "View GitHub Repo →" link with the real URL -->

---

### 5. Velocity Vector
**Innovation signal:** no standard productivity tool has this metric.

Instead of asking "how behind are you?", Velocity Vector answers "where are you going?" It computes two aggregate numbers across all active tasks:

- **Magnitude** — actual velocity rate vs. required rate, normalized 0–100 (>80 = moving faster than needed; <40 = critically slow)
- **Alignment** — weighted finish probability minus average behavioral drift gap (are you moving *toward* your deadlines, not just moving?)

Combined into a direction vector (good / mixed / poor) with a worst-offenders list: the 3 tasks dragging your trajectory most, ranked by `(driftGap × 0.6) + (100 − probability) × 0.4`.

**Why it matters:** Productivity isn't a number, it's a direction. A judge who checks this page immediately sees whether the pre-seeded tasks are on a collision course or not — and the worst-offender list tells them exactly where the damage is.

<!-- screenshot: Velocity Vector page showing the direction arrow visualization, magnitude and alignment scores, and the worst-offender list with per-task drift gap and finish probability percentages -->

---

### 6. OmniBar — Natural Language Agent Interface with Voice Loop
**Google tech:** Gemini 2.0 Flash (intent classification) + Google Cloud TTS (voice output) + Web Speech API (voice input)

Press **Ctrl+K** anywhere in the app. Type or speak a command like *"I'm never finishing the physics paper"* or *"defer the least important thing"* — Gemini classifies the intent across 8 action types (`panic_mode`, `run_triage`, `negotiate`, `rebalance`, `create_task`, `smart_routing`, `query`, `unclear`) with a confidence level.

On **high confidence**, the system shows a 3-second countdown toast ("Acting in 3…") and executes the action unless cancelled. The full execution chain (triage, negotiate, panic scaffold, schedule repack) fires through the same controller logic as the direct UI buttons — it's not a separate "chatbot" path.

On **medium confidence** (or when Policy Memory has downgraded the intent), it shows a suggestion card instead. If a Google Cloud TTS key is configured, the AI response is synthesized via `en-US-Journey-F` and spoken back.

**Why it matters for Google tech scoring:** This single feature routes through Vertex AI (intent parsing), Google Cloud TTS (audio synthesis), and Web Speech API (mic input) in a single interaction loop — all three in one demo action.

<!-- screenshot: OmniBar overlay open mid-interaction showing: typed command, matched task chip in amber, action button with intent-appropriate style (red for panic, amber for negotiate), and the countdown toast overlay showing "Acting in 3..." with cancel button -->

---

## Google Technologies Used

| Technology | What It Does in Velocity |
|---|---|
| **Gemini 2.0 Flash — Vertex AI** | Brain Dump task extraction, Chaos Scanner vision, OmniBar intent classification, Panic Mode rescue scaffold, Negotiate email drafting, AI Rebalance coaching note, Morning Briefing, Ultimatum cost sentences, Insights summary, Behavioral Drift language signal |
| **Gemini Vision (multimodal)** | Chaos Scanner: extracts structured tasks directly from whiteboard or syllabus photos |
| **Google Calendar API (OAuth2)** | Real calendar events merge into Command Day timeline as hard-blocked meeting slots; Rebalance routes around them |
| **Google Cloud Text-to-Speech** | OmniBar voice output — AI responses synthesized as MP3 using `en-US-Journey-F`, streamed back as base64 audio |
| **Google OAuth 2.0** | Full sign-in flow with `calendar.readonly` scope |
| **Firebase Hosting** | Frontend deployment with SPA rewrite rules |
| **Google Cloud Run** | Backend containerized deployment (Node 20, Dockerfile included) |
| **GCP Secret Manager** | Production secrets management (JWT, MongoDB URI, API keys, OAuth tokens) |

> Verify live: Settings → **Tech Stack** page shows real-time API health badges pulled from `/api/health`, which reports `aiBackend: "vertex_ai"` and `mongoConnected: true`.

---

## Architecture

| Layer | Stack |
|---|---|
| **Frontend** | React 18 + TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | Node.js + Express, MongoDB Atlas + Mongoose, JWT auth |
| **AI** | Gemini 2.0 Flash via Vertex AI (prod) / Gemini Developer API (dev) — unified `@google/genai` SDK |
| **Hosting** | Firebase Hosting (frontend) + Google Cloud Run (backend) |
| **External APIs** | Google Calendar API, Google Cloud TTS, GitHub API (Panic Mode repo creation) |

The `geminiService.js` auto-detects backend: if `GOOGLE_CLOUD_PROJECT` is set it uses Vertex AI; otherwise falls back to the Developer API. Production fails fast if Vertex isn't configured.

---

## Judge Demo Path

**Time budget: ~4 minutes. Every step below proves a scoring criterion.**

1. Open [https://velocity-500511.web.app](https://velocity-500511.web.app) and click **"Enter Demo Sandbox"** — watch the cinematic login sequence. You land on a pre-seeded dashboard with realistic tasks in GREEN / AMBER / RED status.

2. **See autonomous action (Agentic Depth):** Click **"Activity Log"** in the sidebar → browse entries. Look for entries tagged `autonomous` in the badge — these fired with no user trigger. Expand any chain entry to see per-step reasoning and undo controls.

3. **Trigger the Forecast Agent:** Navigate to **"Command Day"** and check the Forecast panel on the right side. Any task showing `critical` risk level has already generated an autonomous drift alert — visible in the Activity Log.

4. **Watch Policy Memory (Agentic Depth):** Click the **"Policy Memory"** tab in the Activity Log. If the seeded account has any `policy_adapted` entries, open one to see the learned behavior and the cancel history that triggered it.

5. **Run the OmniBar (Google Tech):** Press **Ctrl+K** → type *"I'm never finishing this"* or click a quick chip → watch intent classify → countdown appears → action executes → new entry appears in Activity Log. Click the mic icon and speak instead to trigger the full voice loop (TTS response will play back if configured).

6. **Activate Panic Mode (Problem Solving):** Find any RED-status task card → click **"⚡ Activate Panic Mode"** → watch the step tracker animate through scaffold generation → review the checklist and boilerplate. If a GitHub repo URL appears, click it to verify the commit exists on GitHub.

7. **Check the Velocity Vector (Innovation):** Click **"Velocity Vector"** in the sidebar → see magnitude, alignment direction, and the worst-offender task list explaining exactly what's dragging your trajectory.

8. **Verify Google tech stack:** Settings → **Tech Stack** page → all live status badges pull from the real health endpoint.

---

## Also Includes

Manual task creation, subtask management, check-in trust scoring, Smart Reschedule (subtask slot-packing), Calendar view with Google Calendar merge, Morning Briefing, Tomorrow Pre-Brief, Weekly Report, Velocity DNA radar chart (6-axis productivity fingerprint), Goals, Habits, Reminders, Gamification (pace-differential credits, 9-tier levels, leaderboard), Ultimatum Engine (forced priority choice with AI-written failure costs), and a guided first-run tour.

---

## Scope Note

Built solo in one week. The core agentic loop — forecast, drift detection, policy memory, cascade chains — is production-quality and handles edge cases (stale data, sparse signals, missing credentials). Features like Habits and the Leaderboard are demo-depth and would need additional hardening for real-world use. The pace engine math is deterministic, fully unit-tested, and shared across every controller.
