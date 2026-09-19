/** /api/auth — sign up, sign in, demo, sign out, profile, password, delete account. */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { endSession, requireAuth, startSession } from '../lib/auth.js';
import { parse } from '../lib/http.js';
import { tzOffset } from '../lib/schemas.js';
import * as users from '../services/users.js';

export const authRouter = Router();

// Slows down password guessing and demo-account spam: 30 attempts per 15 minutes per IP.
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));
const password = z.string().min(8, 'Password must be at least 8 characters.').max(200);

authRouter.post('/signup', limiter, async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1, 'Enter your name.').max(80), email, password }), req.body);
  const user = await users.createUser(body);
  startSession(res, user.id);
  res.status(201).json(user);
});

authRouter.post('/login', limiter, async (req, res) => {
  const body = parse(z.object({ email, password: z.string().min(1, 'Enter your password.') }), req.body);
  const user = await users.login(body.email, body.password);
  startSession(res, user.id);
  res.json(user);
});

authRouter.post('/demo', limiter, async (req, res) => {
  const body = parse(z.object({ tzOffset: tzOffset.default(0) }), req.body ?? {});
  const user = await users.createDemoUser(body.tzOffset);
  startSession(res, user.id);
  res.status(201).json(user);
});

authRouter.post('/logout', async (req, res) => {
  // A demo workspace is useless once you leave it.
  if (req.userId) await users.deleteDemoUser(req.userId);
  endSession(res);
  res.json({ ok: true });
});

/** The signed-in user, or null when signed out (the landing page asks on every visit). */
authRouter.get('/me', async (req, res) => {
  res.json(req.userId ? await users.getUser(req.userId) : null);
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1).max(80) }), req.body);
  res.json(await users.renameUser(req.userId, body.name));
});

authRouter.post('/password', requireAuth, limiter, async (req, res) => {
  const body = parse(z.object({ current: z.string(), next: password }), req.body);
  await users.changePassword(req.userId, body.current, body.next);
  res.json({ ok: true });
});

authRouter.delete('/me', requireAuth, async (req, res) => {
  await users.deleteUser(req.userId);
  endSession(res);
  res.json({ ok: true });
});
