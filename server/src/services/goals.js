/** Goals: listing with progress, creating with tasks, editing, ordering and the Trash. */
import { insertRows, pool, query, queryOne, transaction } from '../db/pool.js';
import { HttpError } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { logActivity } from './activity.js';
import { toGoalSummary, toTask } from './mappers.js';
import { taskRow } from './rows.js';
import { TASK_COLUMNS } from './tasks.js';

/**
 * Every goal with its progress numbers. Two LATERAL subqueries run once per goal:
 *  - c:  task counts (top-level tasks only; steps don't count) — $2 is "today" for overdue
 *  - nt: the next open task, earliest due date first
 */
const SUMMARY_SQL = `
  SELECT g.*, c.task_count, c.done_count, c.overdue_count,
         nt.id AS next_id, nt.title AS next_title, nt.due_date AS next_due_date
  FROM goals g
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS task_count,
           COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL) AS done_count,
           COUNT(*) FILTER (WHERE t.completed_at IS NULL AND t.due_date < $2) AS overdue_count
    FROM tasks t
    WHERE t.goal_id = g.id AND t.parent_id IS NULL AND t.deleted_at IS NULL
  ) c
  LEFT JOIN LATERAL (
    SELECT n.id, n.title, n.due_date
    FROM tasks n
    WHERE n.goal_id = g.id AND n.parent_id IS NULL AND n.deleted_at IS NULL AND n.completed_at IS NULL
    ORDER BY n.due_date NULLS LAST, n.position
    LIMIT 1
  ) nt ON true`;

/** Goal summaries, live ones by default or those in the Trash. Optional filters: id, status. */
export async function goalSummaries(userId, today, { id, status, inTrash = false } = {}) {
  const params = [userId, today];
  const where = ['g.user_id = $1', inTrash ? 'g.deleted_at IS NOT NULL' : 'g.deleted_at IS NULL'];
  if (id) where.push(`g.id = $${params.push(id)}`);
  if (status) where.push(`g.status = $${params.push(status)}`);
  const order = inTrash ? 'g.deleted_at DESC' : 'g.position, g.created_at DESC';
  const rows = await query(`${SUMMARY_SQL} WHERE ${where.join(' AND ')} ORDER BY ${order}`, params);
  return rows.map(toGoalSummary);
}

export async function getGoalSummary(userId, goalId, today) {
  const [goal] = await goalSummaries(userId, today, { id: goalId });
  return goal ?? null;
}

/** A goal with all its tasks and steps (a flat list; steps carry parentId). */
export async function getGoalDetail(userId, goalId, today) {
  const goal = await getGoalSummary(userId, goalId, today);
  if (!goal) return null;
  const rows = await query(
    `SELECT ${TASK_COLUMNS} FROM tasks t
     WHERE t.goal_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.due_date NULLS LAST, t.position, t.created_at`,
    [goal.id],
  );
  return { ...goal, tasks: rows.map(toTask) };
}

/** The raw goal row if this user owns it (whether or not it is in the Trash). */
export function findGoal(userId, goalId) {
  return queryOne('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [goalId, userId]);
}

/**
 * Insert a goal with its tasks and their steps: one INSERT for the goal and
 * one for all the tasks. Also used by imports. Returns the new goal id.
 */
export async function insertGoalWithTasks(userId, g, db = pool, createdAt = new Date().toISOString()) {
  const goalId = newId();
  await db.query(
    `INSERT INTO goals (id, user_id, title, description, priority, color, tags, start_date, target_date,
                        ai_generated, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             (SELECT COALESCE(MIN(position), 0) - 1 FROM goals WHERE user_id = $2), -- new goals go on top
             $11, $11)`,
    [goalId, userId, g.title, g.description, g.priority, g.color, g.tags, g.startDate, g.targetDate, g.aiGenerated, createdAt],
  );

  const rows = [];
  g.tasks.forEach((t, i) => {
    const task = taskRow(userId, {
      goalId,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      priority: t.priority,
      difficulty: t.difficulty,
      estimateMinutes: t.estimateMinutes,
      position: i,
      completedAt: t.completed ? createdAt : null,
      createdAt,
    });
    rows.push(task);
    t.subtasks.forEach((s, j) => {
      const title = (typeof s === 'string' ? s : s.title).trim().slice(0, 200);
      const done = typeof s !== 'string' && s.completed;
      if (title)
        rows.push(
          taskRow(userId, { goalId, parentId: task.id, title, position: j, completedAt: done ? createdAt : null, createdAt }),
        );
    });
  });
  await insertRows('tasks', rows, db);
  return goalId;
}

export async function createGoal(userId, input, today) {
  const goalId = await transaction(async (tx) => {
    const id = await insertGoalWithTasks(userId, input, tx);
    await logActivity(userId, 'goal.created', id, `Created goal “${input.title}”`, tx);
    return id;
  });
  return getGoalSummary(userId, goalId, today);
}

/** API field → column, for the fields PATCH /api/goals/:id can change. */
const EDITABLE = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  color: 'color',
  tags: 'tags',
  startDate: 'start_date',
  targetDate: 'target_date',
  status: 'status',
};

export async function updateGoal(userId, goalId, changes, today) {
  const goal = await findGoal(userId, goalId);
  if (!goal || goal.deleted_at) throw new HttpError(404, 'Goal not found.');

  const params = [];
  const sets = [];
  for (const [field, column] of Object.entries(EDITABLE)) {
    if (changes[field] !== undefined) sets.push(`${column} = $${params.push(changes[field])}`);
  }
  const statusChanged = changes.status && changes.status !== goal.status;
  if (statusChanged) sets.push(changes.status === 'completed' ? 'completed_at = now()' : 'completed_at = NULL');

  if (sets.length) {
    await query(`UPDATE goals SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.push(goal.id)}`, params);
  }
  if (statusChanged && changes.status === 'completed') {
    await logActivity(userId, 'goal.completed', goal.id, `Completed goal “${goal.title}”`);
  }
  return getGoalSummary(userId, goal.id, today);
}

/** Save a drag-and-drop order: each id's position becomes its index in the list. */
export async function reorderGoals(userId, ids) {
  await query(
    `UPDATE goals g SET position = x.ord - 1
     FROM unnest($1::text[]) WITH ORDINALITY AS x(id, ord)
     WHERE g.id = x.id AND g.user_id = $2`,
    [ids, userId],
  );
}

/** Move to the Trash. Its tasks stay attached and come back with it. */
export async function trashGoal(userId, goalId) {
  const row = await queryOne('UPDATE goals SET deleted_at = now() WHERE id = $1 AND user_id = $2 RETURNING id', [goalId, userId]);
  if (!row) throw new HttpError(404, 'Goal not found.');
}

export async function restoreGoal(userId, goalId) {
  const row = await queryOne('UPDATE goals SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id', [goalId, userId]);
  if (!row) throw new HttpError(404, 'Goal not found.');
}

/** Delete for good (only from the Trash). ON DELETE CASCADE removes its tasks. */
export async function deleteGoalForever(userId, goalId) {
  await query('DELETE FROM goals WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL', [goalId, userId]);
}
