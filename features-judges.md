# Velocity — What Judges Should See

> **Login:** Click "Enter Demo" on the landing page (auto guest-login) or use credentials `demo` / `velocity2026` for the persisted demo account with pre-seeded realistic data.

---

## 1. The AI Agent Brain (Gemini 2.0 Flash via Vertex AI)

### Brain Dump → Structured Tasks
Paste messy text (or drop a photo via **Chaos Scanner**) and watch Gemini extract structured tasks with deadlines, subtasks, and cognitive weights — zero manual form-filling.

**How to see it:** Dashboard → paste text into the Brain Dump bar, or click the camera icon to upload an image.

### OmniBar (Ctrl+K / ⌘K)
Natural language command palette. Say or type anything — "I'm behind on everything," "email my professor," "triage my work" — and the AI classifies intent across 8 action types, then **acts autonomously** on high confidence or shows a countdown for medium confidence.

**How to see it:** Press Ctrl+K anywhere → type a command or click a quick chip → watch the countdown → action executes and logs to Activity Log.

### Voice Loop (Speech-to-Text → AI → Cloud TTS)
Full voice-in, voice-out. Speak into the OmniBar mic (Web Speech API), AI processes it, and Google Cloud TTS (en-US-Journey-F) speaks the response back.

**How to see it:** OmniBar → click mic icon → speak → toggle the speaker icon for voice output.

---

## 2. Autonomous Agent Behavior (Acts First, Asks Later)

### Panic Mode — Zero-Hour Rescue
When a task is critical, AI autonomously generates an 8–15 step rescue checklist + runnable boilerplate + **creates a real GitHub repo** and commits the scaffold — all without user input.

**How to see it:** Click the red lightning bolt on any RED task card → watch the step tracker animate through each stage.

### Forecast Agent — Proactive Drift Alerts
Computes finish probability for every task. When probability drops below 45%, the agent **autonomously writes a drift alert** to the Activity Log with specific recovery instructions — unprompted.

**How to see it:** Navigate to Command Day → check the Forecast panel on the right (or open Activity Log to see autonomous alerts).

### Cascade Chain — Multi-Step Autonomous Sequences
When AI Rebalance detects a hard conflict (day overloaded + RED task can't fit), it auto-chains: rebalance → detect conflict → draft negotiate email — logged as a single multi-step entry with per-step undo.

**How to see it:** Command Day → click "AI Rebalance" when you have RED tasks → check Activity Log for a chain entry.

### Countdown Toast (Confirm-by-Exception)
AI announces what it's about to do and gives you a countdown to cancel. If you don't cancel, it executes. This is how Negotiate, Triage, and OmniBar all work — the AI defaults to action, not inaction.

**How to see it:** Any autonomous action (OmniBar command, Negotiate send) shows the countdown.

---

## 3. Behavioral Intelligence (No Manual Input Required)

### Behavioral Drift Detection
Infers **real** progress from behavioral signals — subtask completions, check-in staleness, Panic Mode usage, OmniBar language sentiment — and surfaces the gap between what users claim and what evidence supports.

**How to see it:** Dashboard → expand the drift badge (colored indicator) on any task card → see signal breakdown.

### Velocity Vector (/velocity-vector)
The product's namesake. Shows a direction vector combining magnitude (how much is getting done) and alignment (whether behavioral signals point toward deadlines). Tasks dragging the vector are listed with dual progress bars (reported vs. real).

**How to see it:** Click "Velocity Vector" in the sidebar → see the arrow visualization + per-task drift breakdown.

---

## 4. Adaptive Learning

### Policy Memory
Every time you cancel an autonomous action (via undo or countdown cancel), the system increments a counter. After **3 cancellations** of the same category, the agent permanently downgrades from auto-acting to suggesting — and logs that it learned.

**How to see it:** Activity Log → "Policy Memory" tab → see learned policies. Or cancel a Negotiate/Triage action 3 times and watch the learning entry appear.

### Agent Activity Log (/agent-log)
Full audit trail of every autonomous action with: reasoning, outcome, autonomy level (autonomous/assisted/countdown), rejected alternatives, and per-step undo. The "brain" is fully transparent.

**How to see it:** Sidebar → Activity Log → browse entries, expand chain entries, undo actions.

---

## 5. Google Cloud Integration (All Live)

| Technology | What It Powers |
|-----------|----------------|
| **Gemini 2.0 Flash (Vertex AI)** | Brain Dump, Chaos Scanner, Panic Mode, Negotiate, OmniBar, Rebalance, Briefing, Ultimatum |
| **Gemini Vision (multimodal)** | Chaos Scanner — image → structured tasks |
| **Google Calendar API** | Real meetings merged into Command Day and Calendar views |
| **Google Sign-In (OAuth 2.0)** | Full auth flow, unlocks Calendar access |
| **Cloud Text-to-Speech** | OmniBar voice output (en-US-Journey-F) |
| **Web Speech API** | Voice input in Brain Dump + OmniBar |
| **Firebase Hosting** | Frontend deployment |
| **Google Cloud Run** | Backend deployment |

**How to verify:** Settings → Tech Stack page shows live status badges with real API health checks.

---

## 6. Key Supporting Features

### Ultimatum Engine
Detects genuine two-task deadline conflicts. Forces a conscious choice with AI-generated failure-cost sentences for each option. The loser is marked failed — there's no "do both" escape hatch.

### Command Day (/command)
Today's full timeline as proportional focus blocks ordered by urgency, with real Google Calendar meetings as hard blocked slots and recovery buffers between deep-focus sessions.

### Gamification + Leaderboard
Pace-differential credit awards (steady work earns more than cramming). 9-tier level system, achievements, and an anonymized leaderboard with real percentile ranking.

### Velocity DNA (Insights page)
6-axis radar chart computing your productivity fingerprint (Focus, Consistency, Recovery, Throughput, Calibration, Momentum) plus a named archetype ("The Sprinter," "The Strategist," etc.).

---

## Quick Navigation Guide

| What to Test | Where |
|-------------|-------|
| AI parsing free text → tasks | Dashboard → Brain Dump bar |
| AI parsing images → tasks | Dashboard → Camera icon (Chaos Scanner) |
| Natural language commands | Ctrl+K (OmniBar) |
| Autonomous agent actions | Activity Log (sidebar) |
| Voice in + voice out | OmniBar → mic + speaker icons |
| Real calendar integration | Calendar page (requires Google Sign-In) |
| Behavioral drift analysis | Velocity Vector (sidebar) |
| Multi-step autonomous chain | Command Day → AI Rebalance |
| Policy learning from cancels | Activity Log → Policy Memory tab |
| GitHub repo creation | Panic Mode on a RED task (needs GITHUB_TOKEN) |
| Live Google tech verification | Tech Stack page (sidebar) |
