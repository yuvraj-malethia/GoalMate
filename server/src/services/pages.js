/**
 * Pages: journal entries, notes pages (including the notes attached to a
 * task) and saved weekly reviews. The editor document is stored as JSONB;
 * its plain text is stored next to it for search, excerpts and AI context.
 */
import { insertRows, pool, query, queryOne, containsPattern } from '../db/pool.js';
import { blocksToText, markdownToBlocks, wordCount } from '../lib/blocks.js';
import { HttpError } from '../lib/http.js';
import { logActivity } from './activity.js';
import { findGoal } from './goals.js';
import { toPage, toPageSummary } from './mappers.js';
import { pageRow } from './rows.js';
import { getTask, stepsOf } from './tasks.js';

/** Everything a page list needs (no content), with the linked goal and task if they aren't in the Trash. */
const SUMMARY_COLUMNS = `
  p.id, p.kind, p.title, p.icon, p.plain_text, p.word_count, p.entry_date, p.mood, p.tags,
  p.goal_id, p.task_id, p.pinned, p.created_at, p.updated_at, p.deleted_at,
  g.title AS goal_title, g.color AS goal_color, tk.title AS task_title`;
const JOINS = `
  LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
  LEFT JOIN tasks tk ON tk.id = p.task_id AND tk.deleted_at IS NULL`;

export async function getPage(userId, pageId) {
  const row = await queryOne(
    `SELECT ${SUMMARY_COLUMNS}, p.content FROM pages p ${JOINS}
     WHERE p.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`,
    [pageId, userId],
  );
  return row ? toPage(row) : null;
}

/** The stored plain text of a page (what the AI reads). */
export async function pageText(pageId) {
  const row = await queryOne('SELECT plain_text FROM pages WHERE id = $1', [pageId]);
  return row?.plain_text ?? '';
}

/** Page summaries: pinned first, then newest entry date. */
export async function listPages(userId, f) {
  const params = [userId];
  const param = (value) => `$${params.push(value)}`;
  const where = ['p.user_id = $1', 'p.deleted_at IS NULL'];
  if (f.kind) where.push(`p.kind = ${param(f.kind)}`);
  if (f.goalId) where.push(`p.goal_id = ${param(f.goalId)}`);
  if (f.from) where.push(`p.entry_date >= ${param(f.from)}`);
  if (f.to) where.push(`p.entry_date <= ${param(f.to)}`);
  if (f.q) {
    const pattern = param(containsPattern(f.q));
    where.push(`(p.title ILIKE ${pattern} OR p.plain_text ILIKE ${pattern})`);
  }
  const rows = await query(
    `SELECT ${SUMMARY_COLUMNS} FROM pages p ${JOINS}
     WHERE ${where.join(' AND ')}
     ORDER BY p.pinned DESC, COALESCE(p.entry_date, p.created_at::date) DESC, p.created_at DESC
     LIMIT ${param(f.limit)}`,
    params,
  );
  return rows.map(toPageSummary);
}

export async function trashedPages(userId) {
  const rows = await query(
    `SELECT ${SUMMARY_COLUMNS} FROM pages p ${JOINS}
     WHERE p.user_id = $1 AND p.deleted_at IS NOT NULL ORDER BY p.deleted_at DESC`,
    [userId],
  );
  return rows.map(toPageSummary);
}

/** Insert a page and return its id. */
export async function insertPage(userId, input, db = pool) {
  const row = pageRow(userId, input);
  await insertRows('pages', [row], db);
  return row.id;
}

/** Check that a goal/task the client wants to link to belongs to this user. */
async function checkLinks(userId, { goalId, taskId }) {
  if (goalId && !(await findGoal(userId, goalId))) throw new HttpError(404, 'Goal not found.');
  if (taskId && !(await getTask(userId, taskId))) throw new HttpError(404, 'Task not found.');
}

export async function createPage(userId, input) {
  await checkLinks(userId, input);
  const id = await insertPage(userId, input);
  await logActivity(userId, 'page.created', id, input.title ? `Wrote “${input.title}”` : 'Started a new page');
  return getPage(userId, id);
}

/** The journal entry for a calendar day, created if it doesn't exist yet. */
export async function getOrCreateDailyPage(userId, date, title) {
  const existing = await queryOne(
    `SELECT id FROM pages
     WHERE user_id = $1 AND kind = 'journal' AND entry_date = $2 AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1`,
    [userId, date],
  );
  if (existing) return { page: await getPage(userId, existing.id), created: false };
  const id = await insertPage(userId, { kind: 'journal', title: title ?? '', entryDate: date, icon: 'notebook-pen' });
  await logActivity(userId, 'page.created', id, 'Started a journal entry');
  return { page: await getPage(userId, id), created: true };
}

/** The notes page of a task, created (with a starter outline) if it doesn't exist yet. */
export async function getOrCreateTaskPage(userId, taskId) {
  const task = await getTask(userId, taskId);
  if (!task) throw new HttpError(404, 'Task not found.');
  if (task.pageId) return { page: await getPage(userId, task.pageId), created: false };

  const steps = await stepsOf(task.id);
  const outline = [
    task.description ? `> ${task.description}` : '',
    '## Notes',
    ...(steps.length ? ['## Steps', ...steps.map((s) => `[${s.completed_at ? 'x' : ' '}] ${s.title}`)] : []),
    '## What I learned',
  ].join('\n');

  const id = await insertPage(userId, {
    kind: 'note',
    title: task.title,
    icon: 'file-text',
    content: [...markdownToBlocks(outline), { type: 'paragraph' }],
    goalId: task.goalId,
    taskId: task.id,
  });
  await logActivity(userId, 'page.created', id, `Started notes for “${task.title}”`);
  return { page: await getPage(userId, id), created: true };
}

/** API field → column, for the fields PATCH /api/pages/:id can change directly. */
const EDITABLE = {
  title: 'title',
  icon: 'icon',
  entryDate: 'entry_date',
  mood: 'mood',
  tags: 'tags',
  pinned: 'pinned',
  goalId: 'goal_id',
  taskId: 'task_id',
};

export async function updatePage(userId, pageId, changes) {
  const page = await getPage(userId, pageId);
  if (!page) throw new HttpError(404, 'Page not found.');
  await checkLinks(userId, changes);
  if (changes.taskId) {
    const taken = await queryOne('SELECT 1 FROM pages WHERE task_id = $1 AND id <> $2 AND deleted_at IS NULL', [
      changes.taskId,
      page.id,
    ]);
    if (taken) throw new HttpError(409, 'That task already has a notes page.');
  }

  const params = [];
  const sets = [];
  const set = (column, value) => sets.push(`${column} = $${params.push(value)}`);
  for (const [field, column] of Object.entries(EDITABLE)) {
    if (changes[field] !== undefined) set(column, changes[field]);
  }
  if (changes.content !== undefined) {
    const text = blocksToText(changes.content);
    set('content', JSON.stringify(changes.content));
    set('plain_text', text);
    set('word_count', wordCount(text));
  }
  if (sets.length) {
    await query(`UPDATE pages SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.push(page.id)}`, params);
  }
  return getPage(userId, page.id);
}

export async function trashPage(userId, pageId) {
  const row = await queryOne(
    'UPDATE pages SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
    [pageId, userId],
  );
  if (!row) throw new HttpError(404, 'Page not found.');
}

export async function restorePage(userId, pageId) {
  const row = await queryOne('SELECT task_id FROM pages WHERE id = $1 AND user_id = $2', [pageId, userId]);
  if (!row) throw new HttpError(404, 'Page not found.');
  // If the task got a new notes page in the meantime, restore this one unlinked (a task has one notes page).
  const conflict =
    row.task_id &&
    (await queryOne('SELECT 1 FROM pages WHERE task_id = $1 AND deleted_at IS NULL AND id <> $2', [row.task_id, pageId]));
  await query(`UPDATE pages SET deleted_at = NULL${conflict ? ', task_id = NULL' : ''} WHERE id = $1`, [pageId]);
}

/** Delete for good (only from the Trash), with its AI chat. */
export async function deletePageForever(userId, pageId) {
  const deleted = await queryOne('DELETE FROM pages WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING id', [
    pageId,
    userId,
  ]);
  if (deleted) await query('DELETE FROM messages WHERE user_id = $1 AND thread = $2', [userId, `page:${pageId}`]);
}
