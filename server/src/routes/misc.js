/** /api/search, /api/trash and /api/data (export and import). */
import { Router } from 'express';
import { z } from 'zod';
import { localDate } from '../lib/dates.js';
import { parse } from '../lib/http.js';
import { exportData, importData } from '../services/data.js';
import { search } from '../services/search.js';
import { emptyTrash, getTrash } from '../services/trash.js';

export const miscRouter = Router();

miscRouter.get('/search', async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(1).max(100) }), req.query);
  res.json(await search(req.userId, q));
});

miscRouter.get('/trash', async (req, res) => {
  res.json(await getTrash(req.userId));
});

miscRouter.delete('/trash', async (req, res) => {
  await emptyTrash(req.userId);
  res.json({ ok: true });
});

miscRouter.get('/data/export', async (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="goalmate-export-${localDate()}.json"`);
  res.json(await exportData(req.userId));
});

/** Body: a GoalMate export, or the JSON exported by the original (v1) app. */
miscRouter.post('/data/import', async (req, res) => {
  res.json(await importData(req.userId, req.body));
});
