/**
 * The AI features. Each one follows the same three steps:
 *   1. gather the user's own data from the database,
 *   2. build a prompt (ai/prompts.js) and ask Gemini (ai/gemini.js),
 *   3. clean up the answer before it reaches the browser (clamp dates,
 *      drop empty items, keep only task ids that really exist).
 */
import { GOAL_COLORS } from '../../../shared/types.js';
import { AiError, generateJson, generateText } from '../ai/gemini.js';
import * as prompts from '../ai/prompts.js';
import { query, queryOne } from '../db/pool.js';
import { addDays, daysBetween, localDate, weekdayName } from '../lib/dates.js';
import { HttpError } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { findGoal } from './goals.js';
import { toMessage } from './mappers.js';
import { getPage, pageText } from './pages.js';
import { getTask, stepsOf } from './tasks.js';

const MOODS = ['', 'rough', 'low', 'okay', 'good', 'great'];
const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
/** "- Title" → "Title": models sometimes number or bullet their list items. */
const stripBullet = (s) =>
  String(s)
    .trim()
    .replace(/^[-*\d.)\s]+/, '');

/* ------------------------------------------------------------------ */
/* Roadmap: a goal → dated tasks with steps (a draft; nothing is saved) */
/* ------------------------------------------------------------------ */

export async function generateRoadmap(input) {
  const { system, prompt } = prompts.roadmapPrompt({ ...input, startWeekday: weekdayName(input.startDate) });
  const raw = await generateJson({ system, prompt, schema: prompts.roadmapSchema, temperature: 0.6, tier: 'smart' });

  const lastDay = input.weeks * 7 - 1;
  const tasks = (raw.tasks ?? [])
    .filter((t) => typeof t?.title === 'string' && t.title.trim())
    .slice(0, 60)
    .map((t) => ({
      title: t.title
        .trim()
        .replace(/^(week|day)\s*\d+\s*[:\-–]\s*/i, '')
        .slice(0, 120),
      description: String(t.description ?? '')
        .trim()
        .slice(0, 600),
      dueDate: addDays(input.startDate, Math.min(lastDay, Math.max(0, Math.round(Number(t.dayOffset) || 0)))),
      difficulty: ['easy', 'medium', 'hard'].includes(t.difficulty) ? t.difficulty : 'medium',
      estimateMinutes: Math.min(480, Math.max(10, Math.round(Number(t.estimateMinutes) || 60))),
      subtasks: (t.subtasks ?? [])
        .map(stripBullet)
        .filter(Boolean)
        .slice(0, 5)
        .map((s) => s.slice(0, 120)),
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!tasks.length) throw new AiError('bad_response', 'Gemini returned a plan without tasks. Try again.');

  return {
    title: (raw.title || input.goal).trim().slice(0, 80),
    description: String(raw.description ?? '')
      .trim()
      .slice(0, 400),
    tags: (raw.tags ?? [])
      .map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-'))
      .filter(Boolean)
      .slice(0, 3),
    color: GOAL_COLORS.includes(raw.color) ? raw.color : 'blue',
    tasks,
  };
}

/* ------------------------------------------------------------------ */
/* Break a task into steps                                             */
/* ------------------------------------------------------------------ */

export async function suggestSteps(userId, taskId) {
  const task = await getTask(userId, taskId);
  if (!task) throw new HttpError(404, 'Task not found.');
  const existing = (await stepsOf(task.id)).map((s) => s.title);
  const { system, prompt } = prompts.breakdownPrompt({
    goal: task.goal?.title,
    task: task.title,
    description: task.description,
    existing,
  });
  const out = await generateJson({ system, prompt, schema: prompts.breakdownSchema });
  return {
    steps: (out.steps ?? []).map(stripBullet).filter(Boolean).slice(0, 6),
    tip: String(out.tip ?? '').trim(),
  };
}

/* ------------------------------------------------------------------ */
/* Coach chat. thread = "task:<id>", "page:<id>" or "goal:<id>"        */
/* ------------------------------------------------------------------ */

/** What the conversation is about, as text for the system prompt. Also checks the user owns it. */
export async function threadContext(userId, thread) {
  const [type, id] = thread.split(':');
  const lines = [`Today: ${localDate()}`];

  if (type === 'task') {
    const task = await getTask(userId, id);
    if (!task) throw new HttpError(404, 'Task not found.');
    const goal = task.goalId ? await findGoal(userId, task.goalId) : null;
    const steps = await stepsOf(task.id);
    const notes = task.pageId ? await pageText(task.pageId) : '';
    lines.push(
      goal
        ? `Goal: ${goal.title}${goal.description ? ` — ${goal.description}` : ''}${goal.target_date ? ` (target ${goal.target_date})` : ''}`
        : 'Goal: none (Inbox task)',
      `Task: ${task.title}${task.completedAt ? ' [done]' : ''}`,
      task.description && `Task details: ${task.description}`,
      task.dueDate && `Due: ${task.dueDate}`,
      task.difficulty && `Difficulty: ${task.difficulty}`,
      steps.length && `Steps:\n${steps.map((s) => `${s.completed_at ? '[x]' : '[ ]'} ${s.title}`).join('\n')}`,
      notes && `The person's notes on this task:\n${clip(notes, 3000)}`,
    );
  } else if (type === 'page') {
    const page = await getPage(userId, id);
    if (!page) throw new HttpError(404, 'Page not found.');
    const text = await pageText(page.id);
    lines.push(
      `This is a ${page.kind === 'journal' ? 'journal entry' : 'notes page'} titled "${page.title || 'Untitled'}"${page.entryDate ? ` dated ${page.entryDate}` : ''}.`,
      page.mood && `Mood recorded: ${MOODS[page.mood]}`,
      page.goal && `Linked goal: ${page.goal.title}`,
      page.task && `Linked task: ${page.task.title}`,
      `Content:\n${clip(text, 6000) || '(empty so far)'}`,
      'Act as a thoughtful reflection partner: ask good questions, notice patterns, and help turn thoughts into next steps.',
    );
  } else {
    const goal = await findGoal(userId, id);
    if (!goal) throw new HttpError(404, 'Goal not found.');
    const tasks = await query(
      `SELECT title, due_date, completed_at FROM tasks
       WHERE goal_id = $1 AND parent_id IS NULL AND deleted_at IS NULL
       ORDER BY due_date NULLS LAST, position LIMIT 60`,
      [id],
    );
    lines.push(
      `Goal: ${goal.title}${goal.description ? ` — ${goal.description}` : ''}`,
      goal.target_date && `Target date: ${goal.target_date}`,
      `Tasks:\n${tasks.map((t) => `${t.completed_at ? '[x]' : '[ ]'} ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n')}`,
    );
  }
  return lines.filter(Boolean).join('\n');
}

export async function listThread(userId, thread) {
  const rows = await query('SELECT * FROM messages WHERE user_id = $1 AND thread = $2 ORDER BY created_at, id', [userId, thread]);
  return rows.map(toMessage);
}

export async function clearThread(userId, thread) {
  await query('DELETE FROM messages WHERE user_id = $1 AND thread = $2', [userId, thread]);
}

/** The last 20 messages, oldest first, in Gemini's history format. */
export async function chatHistory(userId, thread) {
  const rows = await query(
    'SELECT role, content FROM messages WHERE user_id = $1 AND thread = $2 ORDER BY created_at DESC, id DESC LIMIT 20',
    [userId, thread],
  );
  return rows.reverse().map((m) => ({ role: m.role, text: m.content }));
}

/** Store a question and its answer (the answer 1 ms later, so they always sort in order). */
export async function saveExchange(userId, thread, question, answer) {
  const rows = await query(
    `INSERT INTO messages (id, user_id, thread, role, content, created_at) VALUES
       ($1, $3, $4, 'user', $5, now()),
       ($2, $3, $4, 'model', $6, now() + interval '1 millisecond')
     RETURNING *`,
    [newId(), newId(), userId, thread, question, answer],
  );
  return rows.map(toMessage).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* ------------------------------------------------------------------ */
/* Plan my day: pick 3 tasks to focus on                               */
/* ------------------------------------------------------------------ */

export async function planDay(userId, date) {
  // Open tasks due within 3 days (or overdue), plus undated high-priority ones.
  const rows = await query(
    `SELECT t.id, t.title, t.due_date, t.priority, t.difficulty, t.estimate_minutes,
            g.title AS goal, g.color AS goal_color
     FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id
     WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.parent_id IS NULL AND t.completed_at IS NULL
       AND (g.id IS NULL OR (g.deleted_at IS NULL AND g.status = 'active'))
       AND (t.due_date <= $2 OR (t.due_date IS NULL AND t.priority = 'high'))
     ORDER BY t.due_date NULLS LAST LIMIT 40`,
    [userId, addDays(date, 3)],
  );
  if (!rows.length) {
    return {
      summary: 'Nothing is due in the next few days. A good day to get ahead on a goal or plan the next stretch.',
      focus: [],
    };
  }

  const list = rows.map((r) => {
    const late = r.due_date && r.due_date < date ? ` (overdue ${daysBetween(r.due_date, date)}d)` : '';
    return `${r.id} | ${r.title} | ${r.goal ?? 'Inbox'} | ${r.due_date ?? 'no date'}${late} | ${r.priority} | ${r.difficulty ?? '-'} | ${r.estimate_minutes ?? '-'}`;
  });
  const mood = await queryOne(
    `SELECT mood FROM pages
     WHERE user_id = $1 AND kind = 'journal' AND entry_date = $2 AND deleted_at IS NULL AND mood IS NOT NULL`,
    [userId, date],
  );
  const moodText = mood ? `Their journal mood today: ${MOODS[mood.mood]}.` : '';

  const { system, prompt } = prompts.dayPlanPrompt(date, weekdayName(date), list.join('\n'), moodText);
  const out = await generateJson({ system, prompt, schema: prompts.dayPlanSchema, temperature: 0.4 });

  // Keep only real, distinct task ids from the list we sent.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const picked = new Set();
  const focus = [];
  for (const f of out.focus ?? []) {
    const r = byId.get(f?.taskId);
    if (!r || picked.has(r.id) || focus.length === 5) continue;
    picked.add(r.id);
    focus.push({
      taskId: r.id,
      reason: String(f.reason ?? '').trim(),
      title: r.title,
      dueDate: r.due_date,
      goal: r.goal ? { title: r.goal, color: r.goal_color } : null,
    });
  }
  return { summary: String(out.summary ?? '').trim(), focus };
}

/* ------------------------------------------------------------------ */
/* Weekly review of the last 7 days                                    */
/* ------------------------------------------------------------------ */

export async function weeklyReview(userId, today, tzOffset) {
  const start = addDays(today, -6);
  const [done, slipped, goals, entries] = await Promise.all([
    query(
      `SELECT (t.completed_at + make_interval(mins => $2))::date AS day, t.title, g.title AS goal
       FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id
       WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.parent_id IS NULL
         AND (t.completed_at + make_interval(mins => $2))::date BETWEEN $3 AND $4
       ORDER BY t.completed_at`,
      [userId, tzOffset, start, today],
    ),
    // Only days that are over count as slipped; today's tasks can still be done.
    query(
      `SELECT t.title, t.due_date, g.title AS goal
       FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id
       WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.parent_id IS NULL AND t.completed_at IS NULL
         AND (g.id IS NULL OR g.deleted_at IS NULL) AND t.due_date BETWEEN $2 AND $3
       ORDER BY t.due_date LIMIT 25`,
      [userId, start, addDays(today, -1)],
    ),
    query(
      `SELECT g.title, COUNT(t.id) AS total, COUNT(t.completed_at) AS done
       FROM goals g LEFT JOIN tasks t ON t.goal_id = g.id AND t.parent_id IS NULL AND t.deleted_at IS NULL
       WHERE g.user_id = $1 AND g.deleted_at IS NULL AND g.status = 'active'
       GROUP BY g.id ORDER BY g.position`,
      [userId],
    ),
    query(
      `SELECT entry_date, title, mood, plain_text FROM pages
       WHERE user_id = $1 AND deleted_at IS NULL AND kind = 'journal' AND entry_date BETWEEN $2 AND $3
       ORDER BY entry_date`,
      [userId, start, today],
    ),
  ]);

  if (!done.length && !entries.length && !slipped.length) {
    return {
      headline: 'A quiet week — not enough activity to review',
      summary:
        'No tasks were completed and no journal entries were written in the last seven days, so there is nothing solid to analyse yet.',
      wins: [],
      blockers: [],
      patterns: [],
      nextWeek: [
        'Pick one active goal and schedule two short sessions for it this week.',
        'Write a two-line journal entry at the end of each day.',
        'Use Plan my day on the Today page to choose a starting point.',
      ],
    };
  }

  const bullets = (items, line) => items.map(line).join('\n') || '- none';
  const data = [
    `Period: ${start} to ${today}`,
    `Completed tasks (${done.length}):\n${bullets(done, (d) => `- ${weekdayName(d.day).slice(0, 3)} ${d.day}: ${d.title}${d.goal ? ` [${d.goal}]` : ''}`)}`,
    `Due earlier this week and still not done (${slipped.length}):\n${bullets(slipped, (s) => `- ${s.due_date}: ${s.title}${s.goal ? ` [${s.goal}]` : ''}`)}`,
    `Active goals:\n${bullets(goals, (g) => `- ${g.title}: ${g.done}/${g.total} tasks done`)}`,
    `Journal entries (${entries.length}):\n${bullets(
      entries,
      (e) =>
        `- ${e.entry_date}${e.mood ? ` (mood: ${MOODS[e.mood]})` : ''}: ${e.title ? e.title + ' — ' : ''}${clip(e.plain_text.replace(/\s+/g, ' '), 500)}`,
    )}`,
  ].join('\n\n');

  const { system, prompt } = prompts.weeklyReviewPrompt(data);
  const out = await generateJson({ system, prompt, schema: prompts.weeklyReviewSchema, temperature: 0.5, tier: 'smart' });
  const list = (v) =>
    Array.isArray(v)
      ? v
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
  return {
    headline: String(out.headline ?? 'Your week').trim(),
    summary: String(out.summary ?? '').trim(),
    wins: list(out.wins),
    blockers: list(out.blockers),
    patterns: list(out.patterns),
    nextWeek: list(out.nextWeek),
  };
}

/* ------------------------------------------------------------------ */
/* Writing help inside a page                                          */
/* ------------------------------------------------------------------ */

export async function writingHelp(userId, { pageId, action, selection }) {
  const page = await getPage(userId, pageId);
  if (!page) throw new HttpError(404, 'Page not found.');
  if (action === 'improve' && !selection?.trim()) throw new HttpError(400, 'Select some text to improve first.');
  const text = await pageText(page.id);
  if (!text.trim() && action !== 'prompts' && action !== 'continue') {
    throw new HttpError(400, 'Write something on the page first.');
  }
  const { system, prompt } = prompts.writePrompt(action, page.title, clip(text, 8000), selection);
  const markdown = await generateText({ system, prompt, temperature: action === 'continue' ? 0.8 : 0.5 });
  return { markdown };
}
