/**
 * Tasks and their steps (subtasks, one level deep).
 * A task with goal_id NULL lives in the Inbox.
 */
import { insertRows, pool, query, queryOne, containsPattern, transaction } from '../db/pool.js';
import { HttpError } from '../lib/http.js';
import { logActivity } from './activity.js';
import { toTask, toTaskWithGoal } from './mappers.js';
import { taskRow } from './rows.js';

/** Task columns plus the small counters the UI shows on every task row. */
export const TASK_COLUMNS = `
  t.*,
  (SELECT p.id FROM pages p WHERE p.task_id = t.id AND p.deleted_at IS NULL) AS page_id,
  (SELECT COUNT(*) FROM messages m WHERE m.user_id = t.user_id AND m.thread = 'task:' || t.id) AS message_count,
  (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.deleted_at IS NULL) AS subtask_count,
  (SELECT COUNT(s.completed_at) FROM tasks s WHERE s.parent_id = t.id AND s.deleted_at IS NULL) AS subtask_done`;

const SELECT_WITH_GOAL = `
  SELECT ${TASK_COLUMNS}, g.title AS goal_title, g.color AS goal_color
  FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id`;

/** A task (not in the Trash) with its goal's title and colour, or null. */
export async function getTask(userId, taskId) {
  const row = await queryOne(`${SELECT_WITH_GOAL} WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL`, [taskId, userId]);
  return row ? toTaskWithGoal(row) : null;
}

/** A task plus its steps. */
export async function getTaskDetail(userId, taskId) {
  const task = await getTask(userId, taskId);
  if (!task) return null;
  const rows = await query(
    `SELECT ${TASK_COLUMNS} FROM tasks t WHERE t.parent_id = $1 AND t.deleted_at IS NULL ORDER BY t.position, t.created_at`,
    [task.id],
  );
  return { ...task, subtasks: rows.map((r) => ({ ...toTask(r), goal: task.goal })) };
}

/** Titles and state of a task's steps, in order (for notes pages and AI context). */
export function stepsOf(taskId) {
  return query('SELECT title, completed_at FROM tasks WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY position', [taskId]);
}

/**
 * Top-level tasks with their goal, for the Today, Calendar, Inbox and goal views.
 * The date filters are combined with OR: due between from/to, OR overdue, OR completed since.
 */
export async function listTasks(userId, f) {
  const params = [userId];
  const param = (value) => `$${params.push(value)}`; // adds a parameter, returns its placeholder

  const where = ['t.user_id = $1', 't.deleted_at IS NULL', 't.parent_id IS NULL', '(g.id IS NULL OR g.deleted_at IS NULL)'];
  if (f.goalId) where.push(`t.goal_id = ${param(f.goalId)}`);
  if (f.inbox) where.push('t.goal_id IS NULL');
  if (f.q) where.push(`t.title ILIKE ${param(containsPattern(f.q))}`);

  const anyOf = [];
  if (f.from || f.to) {
    const range = ['t.due_date IS NOT NULL'];
    if (f.from) range.push(`t.due_date >= ${param(f.from)}`);
    if (f.to) range.push(`t.due_date <= ${param(f.to)}`);
    anyOf.push(`(${range.join(' AND ')})`);
  }
  if (f.overdueBefore) anyOf.push(`(t.completed_at IS NULL AND t.due_date < ${param(f.overdueBefore)})`);
  if (f.completedOn) anyOf.push(`t.completed_at >= ${param(f.completedOn)}`);
  if (anyOf.length) where.push(`(${anyOf.join(' OR ')})`);

  if (f.status === 'open') where.push('t.completed_at IS NULL');
  if (f.status === 'done') where.push('t.completed_at IS NOT NULL');

  const rows = await query(
    `${SELECT_WITH_GOAL}
     WHERE ${where.join(' AND ')}
     ORDER BY t.due_date NULLS LAST,
              CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
              t.position
     LIMIT ${param(f.limit)}`,
    params,
  );
  return rows.map(toTaskWithGoal);
}

/** Create a task (or a step, when parentId is set). Returns the new id. */
export async function createTask(userId, input, db = pool) {
  let goalId = input.goalId ?? null;
  const parentId = input.parentId ?? null;
  if (parentId) {
    const parent = await getTask(userId, parentId);
    if (!parent) throw new HttpError(404, 'Parent task not found.');
    if (parent.parentId) throw new HttpError(400, 'Steps cannot have their own steps.');
    goalId = parent.goalId; // a step always belongs to its parent's goal
  } else if (goalId && !(await queryOne('SELECT 1 FROM goals WHERE id = $1 AND user_id = $2', [goalId, userId]))) {
    throw new HttpError(404, 'Goal not found.');
  }

  // New tasks go to the end of their list.
  const { next } = await queryOne(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks
     WHERE user_id = $1 AND goal_id IS NOT DISTINCT FROM $2 AND parent_id IS NOT DISTINCT FROM $3`,
    [userId, goalId, parentId],
    db,
  );
  const row = taskRow(userId, { ...input, goalId, parentId, position: next });
  await insertRows('tasks', [row], db);

  // A new open step means the parent task isn't finished any more.
  if (parentId) await db.query('UPDATE tasks SET completed_at = NULL WHERE id = $1', [parentId]);
  return row.id;
}

/** Add several steps at once (used by "Break down with AI"). */
export async function addSteps(userId, parentId, titles) {
  if (!(await getTask(userId, parentId))) throw new HttpError(404, 'Task not found.');
  await transaction(async (tx) => {
    for (const title of titles) await createTask(userId, { parentId, title }, tx);
  });
  return getTask(userId, parentId);
}

/** API field → column, for the fields PATCH /api/tasks/:id can change directly. */
const EDITABLE = {
  title: 'title',
  description: 'description',
  dueDate: 'due_date',
  priority: 'priority',
  difficulty: 'difficulty',
  estimateMinutes: 'estimate_minutes',
  goalId: 'goal_id',
};

/**
 * Update a task. Completion has rules:
 *  - finishing a task also finishes its open steps, and is logged in the activity feed;
 *  - re-opening a task removes that log entry; re-opening a step re-opens its parent.
 */
export async function updateTask(userId, taskId, changes) {
  const task = await getTask(userId, taskId);
  if (!task) throw new HttpError(404, 'Task not found.');
  if (changes.goalId && !(await queryOne('SELECT 1 FROM goals WHERE id = $1 AND user_id = $2', [changes.goalId, userId]))) {
    throw new HttpError(404, 'Goal not found.');
  }

  await transaction(async (tx) => {
    const params = [];
    const sets = [];
    for (const [field, column] of Object.entries(EDITABLE)) {
      if (changes[field] !== undefined) sets.push(`${column} = $${params.push(changes[field])}`);
    }

    if (changes.completed !== undefined && changes.completed !== !!task.completedAt) {
      if (changes.completed) {
        sets.push('completed_at = now()');
        await tx.query('UPDATE tasks SET completed_at = now() WHERE parent_id = $1 AND completed_at IS NULL', [task.id]);
        if (!task.parentId) await logActivity(userId, 'task.completed', task.id, `Completed “${task.title}”`, tx);
      } else {
        sets.push('completed_at = NULL');
        await tx.query("DELETE FROM activity WHERE user_id = $1 AND type = 'task.completed' AND entity_id = $2", [
          userId,
          task.id,
        ]);
        if (task.parentId) await tx.query('UPDATE tasks SET completed_at = NULL WHERE id = $1', [task.parentId]);
      }
    }

    // Moving a task to another goal moves its steps too.
    if (changes.goalId !== undefined && !task.parentId) {
      await tx.query('UPDATE tasks SET goal_id = $1 WHERE parent_id = $2', [changes.goalId, task.id]);
    }

    if (sets.length) {
      await tx.query(`UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.push(task.id)}`, params);
    }
  });
  return getTask(userId, task.id);
}

/** Save a drag-and-drop order: each id's position becomes its index in the list. */
export async function reorderTasks(userId, ids) {
  await query(
    `UPDATE tasks t SET position = x.ord - 1
     FROM unnest($1::text[]) WITH ORDINALITY AS x(id, ord)
     WHERE t.id = x.id AND t.user_id = $2`,
    [ids, userId],
  );
}

/** Soft delete (the client offers Undo, which restores it). */
export async function deleteTask(userId, taskId) {
  const row = await queryOne(
    'UPDATE tasks SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
    [taskId, userId],
  );
  if (!row) throw new HttpError(404, 'Task not found.');
}

export async function restoreTask(userId, taskId) {
  await query('UPDATE tasks SET deleted_at = NULL WHERE id = $1 AND user_id = $2', [taskId, userId]);
  return getTask(userId, taskId);
}
