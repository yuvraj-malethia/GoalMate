/** /api/ai — every AI feature. The logic lives in services/ai.js; this file is HTTP only. */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { aiStatus, streamText } from '../ai/gemini.js';
import { chatSystem } from '../ai/prompts.js';
import { parse } from '../lib/http.js';
import { dateString, tzOffset } from '../lib/schemas.js';
import * as ai from '../services/ai.js';

export const aiRouter = Router();

aiRouter.get('/status', (_req, res) => res.json(aiStatus()));

// Protects the (free-tier) API key from runaway clients: 20 AI requests per minute per user.
aiRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    keyGenerator: (req) => req.userId,
    message: { error: 'Too many AI requests. Give it a minute.', code: 'rate_limited' },
  }),
);

aiRouter.post('/roadmap', async (req, res) => {
  const body = parse(
    z.object({
      goal: z.string().trim().min(3, 'Describe the goal in a few words.').max(500),
      level: z.enum(['beginner', 'intermediate', 'advanced']),
      weeks: z.number().int().min(1).max(16),
      hoursPerWeek: z.number().min(1).max(40),
      startDate: dateString,
      context: z.string().max(800).optional(),
    }),
    req.body,
  );
  res.json(await ai.generateRoadmap(body));
});

aiRouter.post('/breakdown', async (req, res) => {
  const { taskId } = parse(z.object({ taskId: z.string() }), req.body);
  res.json(await ai.suggestSteps(req.userId, taskId));
});

/* ---------- coach chat ---------- */

const thread = z.string().regex(/^(task|page|goal):[\w-]+$/, 'Unknown chat thread');

aiRouter.get('/threads/:thread', async (req, res) => {
  res.json(await ai.listThread(req.userId, parse(thread, req.params.thread)));
});

aiRouter.delete('/threads/:thread', async (req, res) => {
  await ai.clearThread(req.userId, parse(thread, req.params.thread));
  res.json({ ok: true });
});

/** Send one Server-Sent Event. */
const sendEvent = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/**
 * POST /api/ai/chat — the answer is streamed as Server-Sent Events:
 *   delta {text}      a piece of the answer
 *   error {message}   the answer was cut off
 *   done  {messages}  the saved question and answer
 */
aiRouter.post('/chat', async (req, res) => {
  const body = parse(z.object({ thread, message: z.string().trim().min(1).max(4000) }), req.body);
  const context = await ai.threadContext(req.userId, body.thread);
  const history = await ai.chatHistory(req.userId, body.thread);
  const stream = streamText({ system: chatSystem(context), history, prompt: body.message, temperature: 0.7 });

  // Wait for the first piece before starting the stream, so setup problems
  // (no key, quota used up) still come back as a normal JSON error.
  const first = await stream.next();

  let closed = false;
  res.on('close', () => (closed = true));
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies from buffering the stream
  });

  let answer = '';
  let failed = null;
  if (!first.done) {
    answer += first.value;
    sendEvent(res, 'delta', { text: first.value });
  }
  try {
    for await (const piece of stream) {
      if (closed) break;
      answer += piece;
      sendEvent(res, 'delta', { text: piece });
    }
  } catch (e) {
    failed = e?.message || 'The answer was cut off.';
  }

  // Save the exchange even if the browser left, so the answer is there next time.
  const messages = answer.trim() ? await ai.saveExchange(req.userId, body.thread, body.message, answer.trim()) : [];
  if (!closed) {
    if (failed) sendEvent(res, 'error', { message: failed });
    sendEvent(res, 'done', { messages });
    res.end();
  }
});

/* ---------- planning and reflection ---------- */

aiRouter.post('/plan-day', async (req, res) => {
  const { date } = parse(z.object({ date: dateString }), req.body);
  res.json(await ai.planDay(req.userId, date));
});

aiRouter.post('/weekly-review', async (req, res) => {
  const body = parse(z.object({ today: dateString, tzOffset: tzOffset.default(0) }), req.body);
  res.json(await ai.weeklyReview(req.userId, body.today, body.tzOffset));
});

aiRouter.post('/write', async (req, res) => {
  const body = parse(
    z.object({
      pageId: z.string(),
      action: z.enum(['continue', 'summarize', 'prompts', 'improve', 'actions']),
      selection: z.string().max(4000).optional(),
    }),
    req.body,
  );
  res.json(await ai.writingHelp(req.userId, body));
});
