# ⚡ Velocity — Complete Feature Reference

> A real-time AI-powered productivity engine. Every feature documented below is fully implemented and live.

---

## Core Architecture

**Frontend:** Vite + React 18 + TypeScript + Tailwind CSS 3.4 + Framer Motion 12 + Recharts  
**Backend:** Node.js + Express + MongoDB Atlas + Mongoose + Google Gemini 2.0 Flash  
**AI Model:** `gemini-2.0-flash` — vision, structured output, real-time intent parsing  
**Auth:** JWT-based, guest sessions, demo account (`demo` / `velocity2026`)

---

## 🧠 Feature 1: Brain Dump Engine

**Route:** `POST /api/braindump`

Paste anything — raw text, a wall of worry, a class syllabus — and Gemini extracts structured tasks instantly.

- Identifies task type (CODE / WRITING / DIAGRAM / OTHER)
- Assigns cognitive weight (LOW / MEDIUM / HIGH)
- Infers deadlines from natural language ("due Friday", "end of month")
- Generates subtask breakdowns with time estimates
- Writes a drift explanation for each task
- Stores to MongoDB with user scope; in-memory fallback if DB is offline

**Input:** `{ text: string }`  
**Output:** Array of fully structured `Task` objects

---

## 📸 Feature 2: Chaos Scanner — Multi-Modal Vision Input

**Route:** `POST /api/braindump` with `{ imageData: base64, mimeType: string }`

Drop a photo of anything — whiteboard, syllabus, printed schedule, WhatsApp screenshot — and AI reads every task out of it.

### Frontend (`ChaosScanner.tsx`)
- Drag-and-drop zone powered by `react-dropzone`
- 4 visual states: **idle** → **dragging** → **processing** → **done**
- **Processing state:** dropped image appears as a dimmed background with a green laser-scan line sweeping top-to-bottom (Framer Motion), scanline texture overlay, "AI scanning..." with WaveformAnimation
- **Done state:** animated `CheckCircle2` pop + "{n} tasks extracted" text, auto-resets after 2.5s
- **Error state:** red border + error message

### Dashboard integration
- Compact mode (dashboard bar): camera icon button → hidden file `<input>`, triggers scan without drag zone
- Expanded mode (landing page): full drag zone visible below the text input

### API (`scanImageForTasks`)
- `POST /braindump` with base64 image data
- Strips `data:` prefix automatically

---

## ⌘K Feature 3: Omni-Bar — Agentic Command Center

**Route:** `POST /api/agent/omni-parse`

A floating command palette triggered by **Cmd/Ctrl+K** anywhere in the app. Describe your problem in plain English and Gemini surfaces the exact tool.

### Frontend (`OmniBar.tsx`)
- Full-screen overlay with blur backdrop
- **Entry animation:** spring scale 0.92→1.0, y 16→0
- **Top accent line:** gradient transparent→green→sky→transparent
- **Input:** font-mono, caret green, placeholder "I'm never finishing the physics paper..."
- **Voice input:** Web Speech API mic button, WaveformAnimation while listening
- **Quick chips:** 5 pre-set stress phrases that trigger instant parse
- **600ms debounce** after typing; **Enter** skips debounce
- **AI response card:** displayMessage text + matched task chip (amber) + action buttons
- **Button styles by intent:**
  - `panic` → red gradient
  - `negotiate` → amber gradient
  - `triage` → amber outline
  - `check_eta` → sky outline
  - default → green outline
- **⌘K pill button** in dashboard header for discoverability

### Backend
- Fetches user's active tasks for context
- Gemini returns: `intent`, `taskId`, `confidence`, `displayMessage`, `suggestedActions`
- Intents: `panic | triage | negotiate | add_task | check_eta | ultimatum | mark_complete | info`

### Dashboard wiring
- `handleOmniAction(intent, taskId)` maps to all existing handlers
- RED task → Panic Mode; negotiate intent → NegotiateModal; triage → AI triage

---

## 📊 Feature 4: Burnout Horizon Chart

**Component:** `BurnoutChart.tsx` (Recharts)

A 14-day workload projection chart showing when you'll exceed daily capacity.

### Data model
- Generates 14 time points from today
- **Available:** fixed 8h/day
- **Required:** sum of `currentPaceHoursPerDay` for all active non-completed tasks that haven't hit their deadline
- Marks each day as `burnout: true` when required > available

### Chart (Recharts AreaChart)
- `ResponsiveContainer` 100% × 180px
- **Available** area: green stroke + green fill gradient
- **Required** area: red stroke + red fill gradient
- `ReferenceArea` for burnout zones: `rgba(239,68,68,0.06)` fill + "⚠ Burnout Zone" label
- Today reference line
- Custom glassmorphic tooltip
- Legend pills: green "Available" / red "Required"

### Auto-triage trigger
- When `required > available` today:
  - Card gets a red pulsing `boxShadow` (cycling 0 → 20px red glow → 0)
  - Banner appears: "⚡ Your workload exceeds capacity today." + **[Run Triage Now]** button → calls `handleTriage()`

### Placement
Rendered in `Dashboard.tsx` between the stats grid and SmartPickBanner.

---

## ⚡ Feature 5: Real-Time Pace Tracking with Live Sparklines

### Backend enhancements

**`checkinsController.js`** — After saving a check-in:
1. Recalculates `currentPaceHoursPerDay` from deadline + cognitive weight
2. Appends `{ value: selfReportPercent }` to task's `sparkline` array
3. Keeps only the last 20 points (`slice(-20)`)
4. Updates task: `status`, `currentPaceHoursPerDay`, `sparkline`, `completionPercent`, `updatedAt`
5. Returns updated task + trustScore

**`tasksController.js`** — On `PATCH /api/tasks/:id`:
- When `completionPercent` is updated, appends a sparkline point
- Keeps last 20 points

### Frontend enhancements

**`Sparkline.tsx`** — New `live?: boolean` prop:
- When `live=true`: larger pulse dot (r=4), faster pulse (1.2s), brighter opacity
- "LIVE" badge in top-right corner (SVG text, 8px mono, green)
- `motion.polyline` and `motion.polygon` with `layout` prop for smooth redraws

**`TaskCard.tsx`** — Debounced check-in sync:
- After slider change, 1500ms debounce → `POST /api/checkins` with new percent
- "syncing..." indicator: 1.5px green dot with opacity animation near sparkline
- Sparkline passes `live={task.status === 'RED' || task.status === 'AMBER'}`

**`Dashboard.tsx`** — Auto-recalc telemetry:
- `setInterval(60000)` recalculates all task paces
- Detects status degradation (GREEN→AMBER or AMBER→RED)
- Shows amber toast: "⚡ [Task name] velocity degraded to [status]"

---

## 🚨 Feature 6: Panic Mode — Always-Visible for Critical Tasks

### Threshold fix
Old threshold: `< 2 hours` (rarely triggered with demo tasks)  
**New threshold: `< 24 hours`** — any RED-status task or task due today triggers Panic Mode instead of legacy HotStart.

### Panic Mode button on RED cards (`TaskCard.tsx`)
- Visible on all `task.status === 'RED'` tasks without requiring a card click
- Style: `rgba(239,68,68,0.1)` background, `#f87171` color, red border
- Pulsing `AlertTriangle` icon (opacity 1→0.4→1 cycle)
- Label: "⚡ Activate Panic Mode"
- When `isHot=true`: button pulses with the card

### Enhanced loading skeleton (`PanicModePanel.tsx`)
Three sequential status lines with stagger animation:
1. "Analyzing task structure..."
2. "Generating rescue checklist..."
3. "Building boilerplate..."

Plus a progress bar (0%→100% over ~4 seconds, ease-out) so users know AI is working.

**Auto-scroll:** Checklist scrolls to top when content loads.

---

## 🏷️ Feature 7: Contextual Annotations (Pointer Labels)

**Component:** `Annotation.tsx`

Beautiful floating SVG curved-arrow pointer labels scattered across the UI. Each appears once per browser session (stored in `sessionStorage`), then dismisses.

### Component API
```tsx
<Annotation
  text="Drag to log your progress"
  direction="left"        // 'up' | 'down' | 'left' | 'right'
  sessionKey="hint_slider"
  color="#22c55e"         // optional, defaults to green
  delay={1.0}             // seconds before appearing
  className="absolute..."
/>
```

### Animation
- SVG `<path>` with Framer Motion `pathLength` 0→1 (draw-on, 0.6s)
- Arrowhead fades in at 0.65s
- Label slides in from direction
- Dismisses when user clicks within 150px, or on mount if `sessionStorage[sessionKey]` is `'true'`

### Placements
| Location | Text | Direction | Delay |
|---|---|---|---|
| BrainDumpInput mic button | "Tired of typing? Speak your tasks →" | right | 1.5s |
| BrainDumpInput camera button | "📸 Drop a photo of your syllabus — AI reads it instantly" | up | 2.0s |
| Dashboard Triage button | "Overloaded? Let AI decide what to drop" | up | 3.0s |
| Dashboard ⌘K button | "Talk to AI — press ⌘K anywhere" | down | 2.5s |
| TaskCard progress slider | "Drag to log your progress" | left | 1.0s |
| Dashboard Simulate Delay button | "Simulates 45min traffic delay → AI drafts your apology email" | up | 4.0s |

---

## 🌗 Feature 8: Smooth Theme Ripple Upgrade

**Files:** `frontend/src/index.css`, `frontend/src/ThemeContext.tsx`

### CSS keyframes
```css
@keyframes theme-ripple {
  0%   { transform: scale(0); opacity: 0.95; }
  60%  { opacity: 0.9; }
  100% { transform: scale(80); opacity: 0; }
}
/* Duration: 0.65s, cubic-bezier(0.22, 1, 0.36, 1), will-change: transform, opacity */
```

### ThemeContext changes
- Ripple div inserted synchronously at `scale(0)`, `animation: none` before DOM paint
- `requestAnimationFrame` fires animation on next frame — eliminates flash of un-animated state
- Theme switch at **180ms** (65% through the 0.65s ripple, matching the cubic-bezier peak)
- Cleanup at **700ms**

---

## 🎬 Feature 9: Demo Bypass — Cinematic Auto-Login

**File:** `frontend/src/components/EntryPoint.tsx`

When "Enter Demo Sandbox" is clicked by an unauthenticated user, a cinematic sequence runs instead of the auth modal:

1. **Full-screen overlay** appears (blur backdrop, spring animation)
2. **Mock login form** shows with animated terminal cursor
3. Username "demo" types in character by character (20ms/char)
4. Password "velocity2026" types as bullet dots
5. Status line shows "Authenticating..." with spinner
6. Real `/api/auth/login` called with demo credentials
7. On success: "✓ Authenticated — loading dashboard" with green checkmark
8. Dashboard loads automatically — under 5 seconds total, zero user action

Fallback: if login fails, opens the normal `AuthModal`.

---

## 🤖 Existing Zero-Hour Agent Suite

### Panic Scaffold (`POST /api/agent/panic-scaffold`)
- AI-generated step-by-step checklist (8-15 specific actions)
- Runnable boilerplate code / document outline
- Auto-creates public GitHub repo with README if `GITHUB_TOKEN` is set
- Cached on task object after first generation

### ETA Check + Delay Email (`POST /api/agent/check-eta`)
- Detects next calendar event (real Google Calendar or demo event)
- Simulates travel delay (default: 45 minutes)
- Generates professional apology email via Gemini
- Sends via Gmail API if credentials available; intercepts as draft otherwise
- Demo mode: always shows "Jury Pitch at 5:00 PM" as the event

### Inbox Triage (`POST /api/agent/triage-inbox`)
- Fetches unread Gmail (or uses demo fixture emails)
- Classifies each email as: reply / confirm / pay / review / schedule
- Returns actionable micro-tasks with suggested reply text
- Priority: high / medium / low

### Smart Task Routing (`POST /api/tasks/smart-route` or `/api/agent/smart-route`)
- Finds free time windows from calendar (or generates demo windows)
- Scores tasks by urgency + energy level + time-fit
- Returns `smartPick`: the optimal task for the next available window
- Powers the `SmartPickBanner` in the dashboard

### Ultimatum Engine (`POST /api/ultimatum/evaluate` + `/resolve`)
- Detects genuine two-task deadline conflicts
- Generates specific "human cost" sentences for each failing task via Gemini
- Forces a conscious choice — no silent auto-reschedule
- Resolved task marked as `failed` in status

### Negotiate (`POST /api/negotiate`)
- Drafts a professional extension request email
- Tone adapts to recipient type (professor → formal; manager → business; peer → casual)
- Uses real task progress data in the message body

---

## 🔧 Task Management Core

### Dashboard stats
- Active task count, Avg h/day, Velocity Score (72 default, drops to 58 after Fast Forward), Completed count

### Reorder
- Drag-to-reorder active task cards via `framer-motion` `Reorder.Group`

### Status system
| Status | Color | Trigger |
|---|---|---|
| GREEN | `#22c55e` | On pace |
| AMBER | `#f59e0b` | Behind, recoverable |
| RED | `#ef4444` | Critical, panic territory |
| COMPLETE | zinc | Marked done |
| failed | zinc | Ultimatum loser |

### Fast Forward demo
Instantly degrades task 1 to RED (6.2h/day), reschedules last task, triggers Panic Mode panel

### Check-ins
`POST /api/checkins` — Trust score calculation: compares self-report% vs actual subtask completion%, flags discrepancies >15% (AMBER) or >30% (RED critical)

---

## 🎨 Design System

| Token | Value |
|---|---|
| `--text-primary` | `#f8fafc` (dark) / `#0f172a` (light) |
| `--bg-surface` | `rgba(255,255,255,0.04)` |
| `--border-subtle` | `rgba(255,255,255,0.08)` |
| Green accent | `#22c55e` |
| Amber accent | `#f59e0b` |
| Red accent | `#ef4444` |
| Sky accent | `#38bdf8` |
| Body font | Inter |
| Code font | JetBrains Mono |
| Card pattern | `rounded-xl`, 3px left accent bar, `rgba(9,9,13,0.98)` bg |
| Modal pattern | spring animation, `backdropFilter: blur(12px)`, `rounded-2xl` |

---

## 🔐 Auth

- **Guest session:** `POST /api/auth/guest` — instant, no credentials
- **Demo login:** `POST /api/auth/login` with `{ username: "demo", password: "velocity2026" }`
- **Demo mode** (`VITE_DEMO_MODE=true`): auto-calls `/api/auth/guest` on mount, zero clicks
- JWT stored in React module scope (not localStorage) — refreshing the page logs out (by design for hackathon)

---

## 📦 Environment Variables

### Backend (`backend/.env`)
```
GEMINI_API_KEY=       # Google Gemini API key
MONGODB_URI=          # MongoDB Atlas connection string
JWT_SECRET=           # JWT signing secret
DEMO_MODE=true        # Enable demo auto-seed and mock data
GITHUB_TOKEN=         # Optional: auto-create GitHub repos in Panic Mode
GOOGLE_CLIENT_ID=     # Optional: real Gmail/Calendar integration
GOOGLE_CLIENT_SECRET= # Optional
```

### Frontend (`frontend/.env`)
```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_DEMO_MODE=true
```

---

## 🚀 Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

App available at `http://localhost:5173`. Backend at `http://localhost:3001`.

---

*Generated by Kiro · Velocity v2.1 · June 2026*
