/**
 * services/geminiService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All Gemini AI interactions — routed through Google Cloud Vertex AI when
 * GOOGLE_CLOUD_PROJECT is set, falling back to the Gemini Developer API
 * (GEMINI_API_KEY) otherwise.
 *
 * Vertex AI path:  @google-cloud/vertexai  — enterprise AI on Google Cloud
 * Fallback path:   @google/generative-ai   — direct Gemini Developer API
 *
 * This file is the single AI entry point for Velocity. Every feature that
 * calls Gemini goes through getModel() here.
 */

// ── Vertex AI client (lazy-initialized) ──────────────────────────────────────
let _vertexModel = null;
let _devModel    = null;
let _usingVertex = false;

function getModel() {
  // Prefer Vertex AI when Google Cloud project is configured
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
  const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  if (gcpProject && gcpProject !== 'your_gcp_project_id_here') {
    if (!_vertexModel) {
      const { VertexAI } = require('@google-cloud/vertexai');
      const vertexai = new VertexAI({ project: gcpProject, location: gcpLocation });
      _vertexModel = vertexai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { maxOutputTokens: 8192 },
      });
      _usingVertex = true;
      console.log(`[GeminiService] Using Vertex AI — project: ${gcpProject}, location: ${gcpLocation}`);
    }
    return { model: _vertexModel, isVertex: true };
  }

  // Fallback: direct Gemini Developer API
  if (!_devModel) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('No AI backend configured: set GOOGLE_CLOUD_PROJECT (Vertex AI) or GEMINI_API_KEY');
    }
    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    _devModel = gemini.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    console.log('[GeminiService] Using Gemini Developer API — gemini-3.1-flash-lite');
  }
  return { model: _devModel, isVertex: false };
}

/**
 * Unified generateContent — works with both Vertex AI and Developer API.
 * Both SDKs expose the same generateContent() shape, but Vertex AI returns
 * result.response.text() via a different path on streaming. We always use
 * non-streaming here so the shape is identical.
 */
async function generate(promptOrParts) {
  const { model, isVertex } = getModel();
  try {
    const result = await model.generateContent(promptOrParts);
    return result.response.text().trim();
  } catch (err) {
    // If Vertex AI fails (auth, model not found, quota), try falling back to Developer API
    if (isVertex && process.env.GEMINI_API_KEY) {
      console.warn('[GeminiService] Vertex AI failed, falling back to Developer API:', err.message);
      _vertexModel = null; // reset so next call retries Vertex fresh
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const fallback = gemini.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const result = await fallback.generateContent(promptOrParts);
      return result.response.text().trim();
    }
    throw err;
  }
}

/**
 * Which backend is active? Used by the health endpoint and Tech Stack page.
 */
function getAIBackendInfo() {
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
  if (gcpProject && gcpProject !== 'your_gcp_project_id_here') {
    return {
      backend: 'vertex_ai',
      label: 'Vertex AI (Google Cloud)',
      model: 'gemini-2.5-flash',
      project: gcpProject,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    };
  }
  return {
    backend: 'gemini_developer',
    label: 'Gemini Developer API',
    model: 'gemini-3.1-flash-lite',
    project: null,
    location: null,
  };
}

// ─── Helper: parse JSON safely from Gemini response ──────────────────────────

function extractJSON(text) {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  const arrStart = cleaned.indexOf('[');
  const arrEnd   = cleaned.lastIndexOf(']');
  const objStart = cleaned.indexOf('{');
  const objEnd   = cleaned.lastIndexOf('}');
  if (arrStart !== -1 && arrStart < objStart) {
    cleaned = cleaned.slice(arrStart, arrEnd + 1);
  } else if (objStart !== -1) {
    cleaned = cleaned.slice(objStart, objEnd + 1);
  }
  return JSON.parse(cleaned);
}

// ─── 1. Brain Dump Extraction ─────────────────────────────────────────────────

async function extractTasksFromBrainDump(text, tzOffsetMinutes = 0) {
  // Build a "local now" string so Gemini resolves times in the user's timezone
  const nowUtc = new Date();
  const localNow = new Date(nowUtc.getTime() - tzOffsetMinutes * 60000);
  const localNowStr = localNow.toISOString().replace('Z', '') + (tzOffsetMinutes <= 0 ? `+${String(Math.abs(Math.floor(tzOffsetMinutes/60))).padStart(2,'0')}:${String(Math.abs(tzOffsetMinutes%60)).padStart(2,'0')}` : `-${String(Math.floor(Math.abs(tzOffsetMinutes)/60)).padStart(2,'0')}:${String(Math.abs(tzOffsetMinutes)%60).padStart(2,'0')}`);

  const prompt = `Extract concrete tasks from this brain dump text. Today's local date and time for the user is: ${localNowStr}

For each task, determine:
- title: clear, actionable task name (string)
- taskType: "code" | "document" | "diagram" | "other"
- cognitiveWeight: "low" | "medium" | "high"
- recipient: null or person's name (e.g., "Professor Smith", "Manager John", null for self-owned)
- deadline: ISO datetime string resolved in the user's LOCAL timezone shown above.
  IMPORTANT RULES for deadline:
  * "by 9pm today" → today's date at 21:00 local time → convert to UTC ISO string
  * "tomorrow" with no time → tomorrow at 23:59 local time
  * "Friday" → the coming Friday at 23:59 local time
  * "end of week" → Sunday at 23:59 local time
  * If deadline is explicitly stated (any time or date mentioned) → set deadlineExplicit to true
  * If NO deadline is mentioned at all → set deadline to null and deadlineExplicit to false
  * NEVER guess or assume a deadline if the user didn't mention one
- deadlineExplicit: true if the user explicitly mentioned a date/time, false if you are guessing or there was none
- subtasks: array of 2-5 objects with { title: string, estimatedMinutes: number }
- driftExplanation: a brief sentence explaining the task's urgency or status

Brain dump text:
"${text}"

Return ONLY a valid JSON array with 1-5 tasks. No markdown, no explanation, no code fences. Just the raw JSON array.`;

  const responseText = await generate(prompt);
  try {
    const tasks = extractJSON(responseText);
    if (!Array.isArray(tasks)) throw new Error('Gemini returned non-array response');
    // Normalise: tasks with no explicit deadline get deadline=null and deadlineExplicit=false
    return tasks.slice(0, 5).map(t => ({
      ...t,
      deadline: t.deadline || null,
      deadlineExplicit: t.deadlineExplicit !== false, // default true if Gemini didn't set it
    }));
  } catch (err) {
    console.error('[Gemini] Failed to parse brain dump response:', responseText);
    throw new Error(`Failed to parse Gemini response: ${err.message}`);
  }
}

// ─── 2. Hot-Start Scaffold Generation ────────────────────────────────────────

async function generateHotStartScaffold(task) {
  const taskTypeLower = (task.taskType || 'other').toLowerCase();
  const isCode    = taskTypeLower === 'code';
  const isDiagram = taskTypeLower === 'diagram';

  let contentType;
  if (isCode)    contentType = 'starter code/boilerplate with comments';
  else if (isDiagram) contentType = 'entity list and diagram structure outline';
  else           contentType = 'structured outline with placeholder sections';

  const prompt = `You are generating a starter template to break activation friction for a student/developer.

Task: "${task.taskName}"
Task Type: ${task.taskType}
Cognitive Weight: ${task.cognitiveWeight}
${task.subtasks?.length > 0 ? `Subtasks: ${task.subtasks.map(s => s.title).join(', ')}` : ''}

Generate ${contentType}.
Requirements:
- Keep it concise but complete enough to start immediately
- Include comments explaining next steps
- Make it directly actionable
- Format: plain text, no markdown fences

${isCode ? 'For code: include realistic file structure, imports, and starter implementation with TODO comments.' : ''}
${isDiagram ? 'For diagram: list entities, relationships, and suggested diagram type.' : ''}
${!isCode && !isDiagram ? 'For document/outline: include section headers, word count targets, and bullet placeholders.' : ''}`;

  return generate(prompt);
}

// ─── 3. Negotiate Message Generation ─────────────────────────────────────────

async function generateNegotiateMessage(task) {
  const recipient = task.recipientName || 'Unknown';
  let toneHint;
  if (/prof|professor|dr\.|instructor/i.test(recipient)) {
    toneHint = 'formal academic tone, respectful and specific about academic context';
  } else if (/manager|boss|lead|director|cto|ceo/i.test(recipient)) {
    toneHint = 'professional business tone, focused on deliverables and timeline';
  } else {
    toneHint = 'friendly but professional tone, casual yet respectful';
  }

  const completionInfo = task.completionPercent !== undefined ? `Current completion: ${task.completionPercent}%.` : '';
  const subtaskInfo = task.subtasks?.length > 0
    ? `Completed subtasks: ${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length}.` : '';

  const prompt = `Draft a professional but honest message requesting an extension or explaining deadline pressure.

Recipient: ${recipient}
Task: ${task.taskName}
${completionInfo}
${subtaskInfo}
Tone: ${toneHint}

Requirements:
- Be specific about progress and what is needed
- Keep it 3-4 sentences max
- Do NOT include subject line or "Dear" greeting (just the body)
- Be honest but diplomatic
- End with a clear ask (e.g., "I'd appreciate a 48-hour extension")

Return ONLY the message body text. No subject line, no signature.`;

  const messageBody = await generate(prompt);
  const greeting = recipient ? `Dear ${recipient},\n\n` : '';
  return `${greeting}${messageBody}\n\nBest regards,\nAlex`;
}

// ─── 4. Ultimatum Cost-Line Generation ───────────────────────────────────────

async function generateUltimatumCosts(taskA, taskB, allGoals = []) {
  function goalFor(task) {
    return allGoals.find(g => g.linkedTaskIds && g.linkedTaskIds.includes(task.id));
  }
  function taskContext(task) {
    const goal = goalFor(task);
    const deadlineDate = new Date(task.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const daysLeft = Math.max(0, (new Date(task.deadline).getTime() - Date.now()) / 86400000).toFixed(1);
    return [
      `Task: "${task.taskName}"`,
      `Deadline: ${deadlineDate} (${daysLeft} days away)`,
      `Cognitive weight: ${task.cognitiveWeight}`,
      task.selfOwned ? `Owner: self-owned personal task` : `Owed to: ${task.recipientName}`,
      goal ? `Linked to goal: "${goal.title}"` : `Not linked to any goal`,
    ].join('\n');
  }

  const prompt = `You are writing the cost lines for a deliberate task-failure decision screen. The user cannot complete both tasks.

For each task, write exactly ONE sentence (max 18 words) describing the specific real-world consequence of letting THAT task fail. Be concrete and honest.

TASK A:
${taskContext(taskA)}

TASK B:
${taskContext(taskB)}

Return ONLY valid JSON in this exact shape, no markdown:
{ "costA": "...", "costB": "..." }`;

  try {
    const text = await generate(prompt);
    const parsed = JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/gi, ''));
    if (!parsed.costA || !parsed.costB) throw new Error('Missing cost fields');
    return { costA: parsed.costA, costB: parsed.costB };
  } catch (err) {
    console.warn('[Gemini] Ultimatum cost generation failed, using fallback:', err.message);
    function fallbackCost(task) {
      const goal = goalFor(task);
      const daysLeft = Math.max(0, (new Date(task.deadline).getTime() - Date.now()) / 86400000).toFixed(1);
      if (!task.selfOwned && task.recipientName) return `This is owed to ${task.recipientName} — missing it damages a real relationship, not just a score.`;
      if (goal) return `This task is linked to your "${goal.title}" goal — failing it sets that goal back directly.`;
      return `A ${task.cognitiveWeight.toLowerCase()}-weight task with ${daysLeft} days left — once missed, it cannot be quietly recovered.`;
    }
    return { costA: fallbackCost(taskA), costB: fallbackCost(taskB) };
  }
}

// ─── 5. Panic-Mode Scaffold ───────────────────────────────────────────────────

async function generatePanicScaffold(task) {
  const taskTypeLower = (task.taskType || 'other').toLowerCase();
  const isCode    = taskTypeLower === 'code';
  const isDiagram = taskTypeLower === 'diagram';

  const boilerplateInstruction = isCode
    ? 'A complete, runnable code boilerplate (realistic imports, file structure, TODO stubs) — ready to copy in under 60 seconds.'
    : isDiagram
    ? 'A structured diagram outline: list all entities, relationships, and recommended diagram type.'
    : 'A slide-by-slide or section-by-section outline with word-count targets and key bullet points.';

  const prompt = `You are a Zero-Hour AI assistant. A student/developer is in panic mode — deadline is imminent.

Task: "${task.taskName}"
Type: ${task.taskType}
Cognitive Weight: ${task.cognitiveWeight}
Deadline: ${new Date(task.deadline).toLocaleString()}
Subtasks: ${(task.subtasks || []).map(s => s.title).join(', ') || 'none specified'}

Produce a comprehensive rescue scaffold in strict JSON format (no markdown fences).
The JSON must have exactly two keys:
1. "checklist": array of 8-15 strings, each a clear actionable step SPECIFIC to this task.
2. "boilerplate": ${boilerplateInstruction}

Return ONLY the raw JSON object. No markdown, no explanation.`;

  try {
    const text = await generate(prompt);
    const parsed = JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/gi, ''));
    if (!Array.isArray(parsed.checklist) || typeof parsed.boilerplate !== 'string') throw new Error('Unexpected shape');
    return { checklist: parsed.checklist, boilerplate: parsed.boilerplate };
  } catch (err) {
    console.warn('[Gemini] Panic scaffold parse failed:', err.message);
    const steps = (task.subtasks || []).map((s, i) => `✓ Step ${i + 1}: ${s.title} (~${s.estimatedMinutes} min)`);
    if (!steps.length) steps.push('✓ Read task requirements carefully', '✓ Break into smallest possible sub-steps', '✓ Start with the easiest sub-task first', '✓ Draft rough version before polishing');
    const boilerplate = isCode
      ? `// ${task.taskName}\n// Zero-Hour scaffold\n\n${(task.subtasks || []).map(s => `// TODO: ${s.title}`).join('\n')}\n\nfunction main() {\n  // Start here\n}\n\nmain();`
      : `# ${task.taskName}\n\n${(task.subtasks || []).map((s, i) => `## Section ${i + 1}: ${s.title}\n- Key point 1\n- Key point 2`).join('\n\n')}`;
    return { checklist: steps, boilerplate };
  }
}

// ─── 6. Image Vision — Chaos Scanner ─────────────────────────────────────────

async function extractTasksFromImage(base64ImageData, mimeType) {
  const { model, isVertex } = getModel();

  const prompt = `You are extracting tasks from an image (whiteboard, syllabus, screenshot, printed schedule).
Extract every visible deadline, assignment, class, or to-do item.
Return the same JSON array format as a brain dump extraction.
Be aggressive — if it looks like a task, include it.
Infer deadlines from context clues like "Week 3", "Friday" using today's date: ${new Date().toISOString()}.

For each task:
- title: clear, actionable task name
- taskType: "code" | "document" | "diagram" | "other"
- cognitiveWeight: "low" | "medium" | "high"
- recipient: null or person's name
- deadline: ISO datetime string (if unclear: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()})
- subtasks: array of 2-4 objects with { title: string, estimatedMinutes: number }
- driftExplanation: brief urgency/status explanation

Return ONLY a valid JSON array. No markdown, no explanation.`;

  let result;
  if (isVertex) {
    // Vertex AI: filePart uses inlineData
    result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64ImageData } },
        ],
      }],
    });
  } else {
    // Developer API
    result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64ImageData } },
    ]);
  }

  const responseText = result.response.text().trim();
  try {
    const tasks = extractJSON(responseText);
    if (!Array.isArray(tasks)) throw new Error('Gemini returned non-array response');
    return tasks.slice(0, 10);
  } catch (err) {
    console.error('[Gemini] Failed to parse image extraction response:', responseText);
    throw new Error(`Failed to parse Gemini vision response: ${err.message}`);
  }
}

// ─── 7. OmniBar Intent Classifier (Phase 1 structured-output router) ──────────
//
// Returns a structured classification with:
//   intent      — one of the 8 canonical intents
//   confidence  — "high" | "medium" | "low"
//   params      — extracted parameters (taskName, deadline, category, taskId, etc.)
//   explanation — plain-English sentence spoken to the user / shown in countdown
//   taskId      — id of the most relevant matching task, or null
//
// Intent taxonomy (matches Phase 2 routing logic):
//   create_task   — user describes something they need to do
//   run_triage    — overwhelmed / wants task prioritization
//   panic_mode    — near-deadline crisis
//   smart_routing — "what should I work on" / "what's next"
//   negotiate     — needs more time / extension for a task owed to someone
//   rebalance     — schedule conflict / too much today / day overloaded
//   query         — question about current state (no action needed)
//   unclear       — genuinely ambiguous

async function parseOmniBarIntent(utterance, activeTasks) {
  const taskSummary = activeTasks.slice(0, 12).map(t => ({
    id: t.id,
    name: t.taskName,
    deadline: t.deadline,
    status: t.status,
    hoursPerDay: t.currentPaceHoursPerDay,
    recipient: t.recipientName || null,
    selfOwned: t.selfOwned,
    pct: t.completionPercent,
  }));

  const nowISO = new Date().toISOString();

  const prompt = `You are the intent classifier for a productivity AI. Classify the user's free-text input into exactly ONE intent.

User said: "${utterance}"
Current time: ${nowISO}
Active tasks (${taskSummary.length}): ${JSON.stringify(taskSummary)}

INTENT TAXONOMY (pick exactly one):
- "create_task"   — user describes something they need to do (new task)
- "run_triage"    — user is overwhelmed, wants prioritization, has too much, behind on things
- "panic_mode"    — user signals a near-deadline crisis on a specific task (hours away, "due tonight", etc.)
- "smart_routing" — user asks what to work on, what's most important, where to start
- "negotiate"     — user mentions needing an extension, more time, for a task owed to someone
- "rebalance"     — user mentions schedule conflict, too much today, day is broken, can't fit it all
- "query"         — user asks a question about current state (no action) e.g. "how many tasks left"
- "unclear"       — genuinely ambiguous, can't determine intent

CONFIDENCE:
- "high"   — very clear, unambiguous signal
- "medium" — likely correct but some ambiguity
- "low"    — possible but uncertain

PARAMS: extract what you can (empty object {} if nothing relevant):
- create_task: { taskName, category (CODE/WRITING/OTHER), deadline (ISO if mentioned) }
- panic_mode: { taskId (if task matches), taskName }
- negotiate: { taskId (if matches a task with recipient), taskName, recipient }
- smart_routing: {}
- run_triage: {}
- rebalance: {}
- query: { question }

EXPLANATION: one short plain-English sentence describing what you will do. 
Use first-person action voice, e.g.:
  "Creating a task to email your professor."
  "Running Triage to surface the most urgent work."
  "Starting Panic Mode for OS Assignment — deadline in 11 hours."
  "Rebalancing your day — too much loaded today."
  "Showing your top priority task right now."
NOT: "I think you might want to..." — be decisive and action-oriented.

For "unclear" or "query", explanation should describe the situation, not an action.

IMPORTANT: Match task IDs from the active tasks list above when the user references a task by name, recipient, or context.

Return ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "intent": "...",
  "confidence": "high"|"medium"|"low",
  "params": {},
  "explanation": "...",
  "taskId": "..." or null
}`;

  try {
    const text = await generate(prompt);
    const parsed = JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim());

    // Validate shape
    const VALID_INTENTS = ['create_task', 'run_triage', 'panic_mode', 'smart_routing', 'negotiate', 'rebalance', 'query', 'unclear'];
    const VALID_CONF = ['high', 'medium', 'low'];

    if (!VALID_INTENTS.includes(parsed.intent)) parsed.intent = 'unclear';
    if (!VALID_CONF.includes(parsed.confidence)) parsed.confidence = 'medium';
    if (!parsed.explanation) parsed.explanation = 'Got it — processing your request.';
    if (!parsed.params || typeof parsed.params !== 'object') parsed.params = {};
    if (typeof parsed.taskId !== 'string') parsed.taskId = null;

    return parsed;
  } catch (err) {
    console.warn('[Gemini] OmniBar intent classify failed:', err.message);
    // Fallback: check for obvious keywords
    const lower = utterance.toLowerCase();
    let intent = 'unclear';
    let confidence = 'low';
    let explanation = 'Not sure what you need — here are some options.';

    if (/behind|overwhelmed|too much|drowning|pile/i.test(lower)) { intent = 'run_triage'; confidence = 'medium'; explanation = 'Sounds like things are piling up — running Triage to surface what matters most.'; }
    else if (/panic|due tonight|due today|hours? left|crisis/i.test(lower)) { intent = 'panic_mode'; confidence = 'medium'; explanation = 'Activating Panic Mode — generating a rescue scaffold now.'; }
    else if (/email|professor|extension|more time|delay/i.test(lower)) { intent = 'negotiate'; confidence = 'medium'; explanation = 'Drafting an extension request.'; }
    else if (/schedule|today|conflict|rebalance|too much today/i.test(lower)) { intent = 'rebalance'; confidence = 'medium'; explanation = 'Rebalancing your day to reduce the overload.'; }
    else if (/what should|what.s next|where do i start|top priority/i.test(lower)) { intent = 'smart_routing'; confidence = 'medium'; explanation = 'Finding your top priority task right now.'; }

    return { intent, confidence, params: {}, explanation, taskId: null };
  }
}

/**
 * Legacy wrapper — kept for any callers that still use the old OmniParseResult shape.
 * Translates the new structured classification to the old format.
 * New code should call parseOmniBarIntent directly and use the structured result.
 */
async function parseOmniBarIntentLegacy(utterance, activeTasks) {
  const result = await parseOmniBarIntent(utterance, activeTasks);

  // Map new intents → old intent codes
  const intentMap = {
    create_task: 'add_task',
    run_triage: 'triage',
    panic_mode: 'panic',
    smart_routing: 'triage',
    negotiate: 'negotiate',
    rebalance: 'triage',
    query: 'info',
    unclear: 'info',
  };

  // Context-aware suggested actions based on classified intent
  const contextActions = {
    create_task:   [{ label: 'Create Task', action: 'create_task' }, { label: 'Run Triage', action: 'triage' }],
    run_triage:    [{ label: 'Run Triage', action: 'triage' }, { label: 'Rebalance Day', action: 'rebalance' }],
    panic_mode:    [{ label: 'Panic Mode', action: 'panic' }, { label: 'Run Triage', action: 'triage' }],
    smart_routing: [{ label: 'Smart Route', action: 'smart_routing' }, { label: 'Run Triage', action: 'triage' }],
    negotiate:     [{ label: 'Request Extension', action: 'negotiate' }, { label: 'Run Triage', action: 'triage' }],
    rebalance:     [{ label: 'Rebalance Day', action: 'rebalance' }, { label: 'Run Triage', action: 'triage' }],
    query:         [{ label: 'Run Triage', action: 'triage' }, { label: 'Panic Mode', action: 'panic' }],
    unclear:       [{ label: 'Run Triage', action: 'triage' }, { label: 'Panic Mode', action: 'panic' }],
  };

  return {
    intent: intentMap[result.intent] || 'info',
    taskId: result.taskId,
    confidence: result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.6 : 0.3,
    displayMessage: result.explanation,
    suggestedActions: contextActions[result.intent] || contextActions.unclear,
  };
}

module.exports = {
  extractTasksFromBrainDump,
  extractTasksFromImage,
  generateHotStartScaffold,
  generateNegotiateMessage,
  generateUltimatumCosts,
  generatePanicScaffold,
  parseOmniBarIntent,
  parseOmniBarIntentLegacy,
  getAIBackendInfo,
  generate, // exported for direct use by behavioral drift signal
};
