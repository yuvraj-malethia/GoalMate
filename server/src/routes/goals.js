/** /api/goals */
import { Router } from 'express';
import { z } from 'zod';
import { isDate, localDate } from '../lib/dates.js';
import { HttpError, parse } from '../lib/http.js';
import { dateString, goalColor, newGoal, priority, tagList } from '../lib/schemas.js';
import * as goals from '../services/goals.js';

export const goalsRouter = Router();

/** The client sends its own "today" so overdue counts match the user's time zone. */
const todayOf = (req) => (isDate(req.query.today) ? req.query.today : localDate());

const ids = z.object({ ids: z.array(z.string()).max(500) });

/** GET /api/goals?status=active|completed|archived|all&today= */
goalsRouter.get('/', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['active', 'completed', 'archived', 'all']).default('all') }), req.query);
  res.json(await goals.goalSummaries(req.userId, todayOf(req), { status: status === 'all' ? undefined : status }));
});

goalsRouter.post('/', async (req, res) => {
  const body = parse(newGoal, req.body);
  res.status(201).json(await goals.createGoal(req.userId, body, todayOf(req)));
});

goalsRouter.post('/reorder', async (req, res) => {
  await goals.reorderGoals(req.userId, parse(ids, req.body).ids);
  res.json({ ok: true });
});

goalsRouter.get('/:id', async (req, res) => {
  const goal = await goals.getGoalDetail(req.userId, req.params.id, todayOf(req));
  if (!goal) throw new HttpError(404, 'Goal not found.');
  res.json(goal);
});

goalsRouter.patch('/:id', async (req, res) => {
  const changes = parse(
    z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(4000).optional(),
      priority: priority.optional(),
      color: goalColor.optional(),
      tags: tagList(8).optional(),
      startDate: dateString.nullable().optional(),
      targetDate: dateString.nullable().optional(),
      status: z.enum(['active', 'completed', 'archived']).optional(),
    }),
    req.body,
  );
  res.json(await goals.updateGoal(req.userId, req.params.id, changes, todayOf(req)));
});

/** Soft delete: moves the goal to the Trash. */
goalsRouter.delete('/:id', async (req, res) => {
  await goals.trashGoal(req.userId, req.params.id);
  res.json({ ok: true });
});

goalsRouter.post('/:id/restore', async (req, res) => {
  await goals.restoreGoal(req.userId, req.params.id);
  res.json({ ok: true });
});

goalsRouter.delete('/:id/permanent', async (req, res) => {
  await goals.deleteGoalForever(req.userId, req.params.id);
  res.json({ ok: true });
});
