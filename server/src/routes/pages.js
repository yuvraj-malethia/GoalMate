/** /api/pages — journal entries, notes and saved reviews. */
import { Router } from 'express';
import { z } from 'zod';
import { HttpError, parse } from '../lib/http.js';
import { dateString, tagList } from '../lib/schemas.js';
import * as pages from '../services/pages.js';

export const pagesRouter = Router();

const kind = z.enum(['journal', 'note', 'review']);
const content = z.array(z.unknown()).max(5000); // the editor's blocks
const mood = z.number().int().min(1).max(5);

/** GET /api/pages?kind=&q=&goalId=&from=&to=&limit= */
pagesRouter.get('/', async (req, res) => {
  const filters = parse(
    z.object({
      kind: kind.optional(),
      q: z.string().max(100).optional(),
      goalId: z.string().optional(),
      from: dateString.optional(),
      to: dateString.optional(),
      limit: z.coerce.number().int().min(1).max(500).default(300),
    }),
    req.query,
  );
  res.json(await pages.listPages(req.userId, filters));
});

/** The journal entry for a day, created if it doesn't exist yet. */
pagesRouter.post('/daily', async (req, res) => {
  const body = parse(z.object({ date: dateString, title: z.string().max(200).optional() }), req.body);
  const { page, created } = await pages.getOrCreateDailyPage(req.userId, body.date, body.title);
  res.status(created ? 201 : 200).json(page);
});

pagesRouter.get('/:id', async (req, res) => {
  const page = await pages.getPage(req.userId, req.params.id);
  if (!page) throw new HttpError(404, 'Page not found.');
  res.json(page);
});

pagesRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({
      kind: kind.default('journal'),
      title: z.string().max(200).default(''),
      icon: z.string().max(40).nullable().default(null),
      content: content.default([]),
      entryDate: dateString.nullable().default(null),
      mood: mood.nullable().default(null),
      tags: tagList(12).default([]),
      goalId: z.string().nullable().default(null),
      taskId: z.string().nullable().default(null),
    }),
    req.body,
  );
  res.status(201).json(await pages.createPage(req.userId, body));
});

pagesRouter.patch('/:id', async (req, res) => {
  const changes = parse(
    z.object({
      title: z.string().max(200).optional(),
      icon: z.string().max(40).nullable().optional(),
      content: content.optional(),
      entryDate: dateString.nullable().optional(),
      mood: mood.nullable().optional(),
      tags: tagList(12).optional(),
      pinned: z.boolean().optional(),
      goalId: z.string().nullable().optional(),
      taskId: z.string().nullable().optional(),
    }),
    req.body,
  );
  res.json(await pages.updatePage(req.userId, req.params.id, changes));
});

pagesRouter.delete('/:id', async (req, res) => {
  await pages.trashPage(req.userId, req.params.id);
  res.json({ ok: true });
});

pagesRouter.post('/:id/restore', async (req, res) => {
  await pages.restorePage(req.userId, req.params.id);
  res.json({ ok: true });
});

pagesRouter.delete('/:id/permanent', async (req, res) => {
  await pages.deletePageForever(req.userId, req.params.id);
  res.json({ ok: true });
});
