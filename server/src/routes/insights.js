/** /api/insights — the numbers and charts on the Insights page. */
import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/http.js';
import { dateString } from '../lib/schemas.js';
import { getInsights } from '../services/insights.js';

export const insightsRouter = Router();

/** GET /api/insights?today=YYYY-MM-DD&tzOffset=330 */
insightsRouter.get('/', async (req, res) => {
  const { today, tzOffset } = parse(
    z.object({ today: dateString, tzOffset: z.coerce.number().int().min(-840).max(840).default(0) }),
    req.query,
  );
  res.json(await getInsights(req.userId, today, tzOffset));
});
