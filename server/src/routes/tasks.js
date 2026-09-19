/** /api/tasks */
import { Router } from 'express';
import { z } from 'zod';
import { HttpError, parse } from '../lib/http.js';
import { dateString, difficulty, priority } from '../lib/schemas.js';
import { getOrCreateTaskPage } from '../services/pages.js';
import * as tasks from '../services/tasks.js';

export const tasksRouter = Router();

/**
 * GET /api/tasks?from=&to=&overdueBefore=&completedOn=&status=open|done|all&goalId=&inbox=1&q=&limit=
 * Top-level tasks with their goal, for Today, Calendar, Upcoming and the Inbox.
 */
tasksRouter.get('/', async (req, res) => {
  const filters = parse(
    z.object({
      from: dateString.optional(),
      to: dateString.optional(),
      overdueBefore: dateString.optional(),
      completedOn: z.iso.datetime().optional(), // "completed since" this moment
      status: z.enum(['open', 'done', 'all']).default('all'),
      goalId: z.string().optional(),
      inbox: z.enum(['1', 'true']).optional(), // only tasks without a goal
      q: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(1000).default(500),
    }),
    req.query,
  );
  res.json(await tasks.listTasks(req.userId, filters));
});

tasksRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({
      goalId: z.string().nullable().default(null),
      parentId: z.string().nullable().default(null),
      title: z.string().trim().min(1, 'Task title is empty.').max(200),
      description: z.string().max(4000).default(''),
      dueDate: dateString.nullable().default(null),
      priority: priority.default('none'),
      difficulty: difficulty.nullable().default(null),
      estimateMinutes: z.number().int().min(1).max(1440).nullable().default(null),
    }),
    req.body,
  );
  const id = await tasks.createTask(req.userId, body);
  res.status(201).json(await tasks.getTask(req.userId, id));
});

tasksRouter.post('/reorder', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.string()).max(500) }), req.body);
  await tasks.reorderTasks(req.userId, ids);
  res.json({ ok: true });
});

/** A task with its steps. */
tasksRouter.get('/:id', async (req, res) => {
  const task = await tasks.getTaskDetail(req.userId, req.params.id);
  if (!task) throw new HttpError(404, 'Task not found.');
  res.json(task);
});

/** Add several steps at once (used by "Break down with AI"). */
tasksRouter.post('/:id/subtasks', async (req, res) => {
  const { titles } = parse(z.object({ titles: z.array(z.string().trim().min(1).max(200)).min(1).max(20) }), req.body);
  res.status(201).json(await tasks.addSteps(req.userId, req.params.id, titles));
});

tasksRouter.patch('/:id', async (req, res) => {
  const changes = parse(
    z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(4000).optional(),
      dueDate: dateString.nullable().optional(),
      priority: priority.optional(),
      difficulty: difficulty.nullable().optional(),
      estimateMinutes: z.number().int().min(1).max(1440).nullable().optional(),
      completed: z.boolean().optional(),
      goalId: z.string().nullable().optional(),
    }),
    req.body,
  );
  res.json(await tasks.updateTask(req.userId, req.params.id, changes));
});

/** Soft delete; the client offers Undo, which calls /restore. */
tasksRouter.delete('/:id', async (req, res) => {
  await tasks.deleteTask(req.userId, req.params.id);
  res.json({ ok: true });
});

tasksRouter.post('/:id/restore', async (req, res) => {
  res.json(await tasks.restoreTask(req.userId, req.params.id));
});

/** The task's notes page, created on first use. */
tasksRouter.post('/:id/page', async (req, res) => {
  const { page, created } = await getOrCreateTaskPage(req.userId, req.params.id);
  res.status(created ? 201 : 200).json(page);
});
