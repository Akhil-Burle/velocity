/**
 * controllers/briefingController.js
 * POST /api/briefing/generate — scoped to req.userId
 */

const { db } = require('../utils/dataModel');
const TaskModel = require('../models/Task');
const HabitModel = require('../models/Habit');
const { isConnected } = require('../db/connection');

async function generateBriefing(req, res) {
  const userId = req.userId;

  let tasks, habits;
  if (isConnected()) {
    [tasks, habits] = await Promise.all([
      TaskModel.find({ userId }).lean(),
      HabitModel.find({ userId }).lean(),
    ]);
  } else {
    tasks = db.getAllTasks();
    habits = db.getAllHabits();
  }

  const activeTasks   = tasks.filter(t => !t.isRescheduled && t.status !== 'COMPLETE' && t.status !== 'failed');
  const failedTasks   = tasks.filter(t => t.status === 'failed');
  const criticalTasks = activeTasks.filter(t => t.status === 'RED');
  const today = new Date().toISOString().slice(0, 10);
  const todayHabits = habits.filter(h => !h.history.find(e => e.date === today && e.completed));

  let briefing = '';

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const prompt = `Write a motivating 2-3 sentence morning productivity briefing for a student/developer.\n\nContext:\n- Active tasks: ${activeTasks.length}\n- Critical tasks needing attention: ${criticalTasks.map(t => `"${t.taskName}"`).join(', ') || 'none'}\n- Habits not yet completed today: ${todayHabits.map(h => h.title).join(', ') || 'all done'}\n- Recently failed tasks (deliberate choice): ${failedTasks.length > 0 ? failedTasks.map(t => `"${t.taskName}"`).join(', ') : 'none'}\n- Day: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n\nBe specific, actionable, and honest. If there are recently failed tasks, acknowledge the tradeoff was made — don't pretend everything is fine. Keep it under 65 words. Return ONLY the briefing text.`;
      const result = await model.generateContent(prompt);
      briefing = result.response.text().trim();
    } catch (e) {
      console.warn('[Briefing] Gemini failed, using fallback:', e.message);
    }
  }

  if (!briefing) {
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const failedNote = failedTasks.length > 0
      ? ` You deliberately let "${failedTasks[failedTasks.length - 1].taskName}" go — own that call and move forward.`
      : '';
    briefing = criticalTasks.length > 0
      ? `Good morning. Today is ${dayName} — you have ${criticalTasks.length} critical task${criticalTasks.length > 1 ? 's' : ''} requiring immediate focus, starting with "${criticalTasks[0].taskName}".${failedNote} ${todayHabits.length > 0 ? `Don't forget your ${todayHabits[0].title} habit. ` : ''}Keep your velocity high.`
      : `Good morning. Today is ${dayName} — your ${activeTasks.length} active task${activeTasks.length !== 1 ? 's' : ''} ${activeTasks.length > 0 ? 'are on track.' : 'are all clear.'}${failedNote} ${todayHabits.length > 0 ? `Remember to complete your ${todayHabits.length} habit${todayHabits.length > 1 ? 's' : ''} today. ` : ''}Maintain momentum.`;
  }

  return res.json({ briefing, generatedAt: new Date().toISOString() });
}

module.exports = { generateBriefing };
