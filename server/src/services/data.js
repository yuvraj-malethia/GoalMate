/**
 * Export everything as JSON, and import either a GoalMate export or the JSON
 * exported by the original (v1) version of this app. Imported items always get
 * fresh ids, so importing the same file twice never overwrites anything.
 */
import { GOAL_COLORS } from '../../../shared/types.js';
import { insertRows, query, transaction } from '../db/pool.js';
import { markdownToBlocks } from '../lib/blocks.js';
import { addDays, isDate } from '../lib/dates.js';
import { HttpError, parse } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { newGoal } from '../lib/schemas.js';
import { insertGoalWithTasks } from './goals.js';
import { pageRow, taskRow } from './rows.js';

export async function exportData(userId) {
  const [goals, tasks, pages] = await Promise.all([
    query('SELECT * FROM goals WHERE user_id = $1 AND deleted_at IS NULL ORDER BY position', [userId]),
    query(
      `SELECT t.* FROM tasks t
       WHERE t.user_id = $1 AND t.deleted_at IS NULL
         AND (t.goal_id IS NULL OR EXISTS (SELECT 1 FROM goals g WHERE g.id = t.goal_id AND g.deleted_at IS NULL))
       ORDER BY t.created_at`,
      [userId],
    ),
    query('SELECT * FROM pages WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at', [userId]),
  ]);
  const withoutUser = (rows) => rows.map(({ user_id: _userId, ...rest }) => rest);
  return {
    app: 'goalmate',
    version: 2,
    exportedAt: new Date().toISOString(),
    goals: withoutUser(goals),
    tasks: withoutUser(tasks),
    pages: withoutUser(pages),
  };
}

/* ---------- helpers for untrusted file contents ---------- */

/** `value` if it is one of `allowed`, else `fallback`. */
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const dateOrNull = (value) => (isDate(value) ? value : null);
const timestampOrNull = (value) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
const intInRange = (value, min, max) => (Number.isInteger(value) && value >= min && value <= max ? value : null);
const text = (value, max, fallback = '') => (value == null ? fallback : String(value).slice(0, max));
/** Arrays are stored as JSON text in exports from the SQLite version and as real arrays since. */
function list(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
const tags = (value, max) =>
  list(value)
    .map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-').slice(0, 30))
    .filter(Boolean)
    .slice(0, max);

export async function importData(userId, body) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'That file is not valid JSON.');
  return transaction((tx) =>
    body.app === 'goalmate' && Number(body.version) === 2 ? importExport(userId, body, tx) : importV1(userId, body, tx),
  );
}

/** A GoalMate export. Old ids are mapped to new ones so tasks and pages stay linked. */
async function importExport(userId, body, tx) {
  const now = new Date().toISOString();
  const goalIds = new Map();
  const taskIds = new Map();

  const goals = list(body.goals).map((g) => {
    const id = newId();
    goalIds.set(String(g.id), id);
    return {
      id,
      user_id: userId,
      title: text(g.title, 200, 'Untitled goal'),
      description: text(g.description, 4000),
      priority: oneOf(g.priority, ['high', 'medium', 'low', 'none'], 'medium'),
      status: oneOf(g.status, ['active', 'completed', 'archived'], 'active'),
      color: oneOf(g.color, GOAL_COLORS, 'blue'),
      tags: tags(g.tags, 8),
      start_date: dateOrNull(g.start_date),
      target_date: dateOrNull(g.target_date),
      ai_generated: !!g.ai_generated,
      position: Number(g.position) || 0,
      created_at: timestampOrNull(g.created_at) ?? now,
      updated_at: now,
      completed_at: timestampOrNull(g.completed_at),
    };
  });
  await insertRows('goals', goals, tx);

  // Parents before steps, so a step can point at its parent's new id.
  const sorted = [...list(body.tasks)].sort((a, b) => Number(!!a.parent_id) - Number(!!b.parent_id));
  const tasks = [];
  for (const t of sorted) {
    const parentId = t.parent_id ? taskIds.get(String(t.parent_id)) : null;
    if (t.parent_id && !parentId) continue; // orphaned step
    const row = taskRow(userId, {
      goalId: t.goal_id ? (goalIds.get(String(t.goal_id)) ?? null) : null,
      parentId,
      title: text(t.title, 200, 'Untitled'),
      description: text(t.description, 4000),
      dueDate: dateOrNull(t.due_date),
      priority: oneOf(t.priority, ['high', 'medium', 'low', 'none'], 'none'),
      difficulty: oneOf(t.difficulty, ['easy', 'medium', 'hard'], null),
      estimateMinutes: intInRange(t.estimate_minutes, 1, 1440),
      position: Number(t.position) || 0,
      completedAt: timestampOrNull(t.completed_at),
      createdAt: timestampOrNull(t.created_at) ?? now,
      updatedAt: now,
    });
    taskIds.set(String(t.id), row.id);
    tasks.push(row);
  }
  await insertRows('tasks', tasks, tx);

  const pages = list(body.pages).map((p) =>
    pageRow(userId, {
      kind: oneOf(p.kind, ['journal', 'note', 'review'], 'journal'),
      title: text(p.title, 200),
      icon: p.icon ? text(p.icon, 40) : null,
      content: list(p.content),
      entryDate: dateOrNull(p.entry_date),
      mood: intInRange(p.mood, 1, 5),
      tags: tags(p.tags, 12),
      goalId: p.goal_id ? (goalIds.get(String(p.goal_id)) ?? null) : null,
      taskId: p.task_id ? (taskIds.get(String(p.task_id)) ?? null) : null,
      pinned: !!p.pinned,
      createdAt: timestampOrNull(p.created_at) ?? now,
    }),
  );
  await insertRows('pages', pages, tx);
  return { goals: goals.length, pages: pages.length };
}

/**
 * The original app's export: { goals: [{ title, tasks: [{ day, subtasks }] }], journal: [{ text, mood }] }.
 * Task "day N" becomes a due date N-1 days after the goal was created.
 */
async function importV1(userId, body, tx) {
  const legacyGoals = Array.isArray(body.goals) ? body.goals : [];
  const legacyJournal = Array.isArray(body.journal) ? body.journal : [];
  if (!legacyGoals.length && !legacyJournal.length) {
    throw new HttpError(400, 'No goals or journal entries found in this file.');
  }

  let goals = 0;
  for (const g of legacyGoals) {
    if (!g || typeof g.title !== 'string' || g.deleted) continue;
    const created = timestampOrNull(g.createdAt) ?? new Date().toISOString();
    const start = created.slice(0, 10);
    const draft = parse(newGoal, {
      title: g.title.slice(0, 200),
      description: text(g.description, 4000),
      priority: oneOf(String(g.priority).toLowerCase(), ['high', 'medium', 'low'], 'medium'),
      tags: tags(g.tags, 8),
      startDate: dateOrNull(start),
      tasks: (Array.isArray(g.tasks) ? g.tasks : [])
        .filter((t) => t && typeof t.title === 'string' && t.title.trim())
        .slice(0, 80)
        .map((t) => ({
          title: t.title.slice(0, 200),
          description: text(t.description, 4000),
          dueDate: isDate(start) && Number(t.day) > 0 ? addDays(start, Number(t.day) - 1) : null,
          difficulty: oneOf(String(t.difficulty).toLowerCase(), ['easy', 'medium', 'hard'], null),
          completed: !!t.completed,
          subtasks: (Array.isArray(t.subtasks) ? t.subtasks : [])
            .map((s) => (typeof s === 'string' ? s : { title: String(s?.title ?? ''), completed: !!s?.completed }))
            .slice(0, 20),
        })),
    });
    await insertGoalWithTasks(userId, draft, tx, created);
    goals++;
  }

  const pages = legacyJournal
    .filter((j) => j && !j.deleted)
    .map((j) => {
      const created = timestampOrNull(j.createdAt) ?? new Date().toISOString();
      const mood = Number(j.mood);
      return pageRow(userId, {
        kind: 'journal',
        title: text(j.title, 200),
        content: markdownToBlocks(String(j.text ?? '')),
        entryDate: created.slice(0, 10),
        mood: mood >= 1 && mood <= 5 ? Math.round(mood) : null,
        tags: tags(j.tags, 12),
        createdAt: created,
      });
    });
  await insertRows('pages', pages, tx);
  return { goals, pages: pages.length };
}
