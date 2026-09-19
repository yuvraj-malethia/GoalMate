/**
 * The Express application: security headers, body and cookie parsing, the
 * session check, the API routes, and one error handler that turns every
 * thrown error into a JSON response.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { IS_PROD } from './config.js';
import { AiError } from './ai/gemini.js';
import { readSession, requireAuth } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { goalsRouter } from './routes/goals.js';
import { insightsRouter } from './routes/insights.js';
import { miscRouter } from './routes/misc.js';
import { pagesRouter } from './routes/pages.js';
import { tasksRouter } from './routes/tasks.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (IS_PROD) app.set('trust proxy', 1); // behind the hosting provider's proxy: use the real client IP

  app.use(
    helmet({
      // Vite's dev server injects inline scripts, so the Content-Security-Policy is production-only.
      contentSecurityPolicy: IS_PROD
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              // Helmet adds this by default; it breaks `npm start` over plain http://localhost.
              // Hosts that serve HTTPS redirect to it anyway.
              upgradeInsecureRequests: null,
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(readSession);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);

  // Everything below needs a signed-in user.
  app.use('/api', requireAuth);
  app.use('/api/goals', goalsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/insights', insightsRouter);
  app.use('/api', miscRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Express 5 sends errors thrown in async route handlers here automatically.
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return res.end();
    if (err instanceof HttpError || err instanceof AiError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large (max 5 MB).' });
    // PostgreSQL error codes: 23505 = unique violation, 22xxx = invalid data, 23514 = CHECK failed.
    if (err?.code === '23505') return res.status(409).json({ error: 'That already exists.' });
    if (err?.code === '23514' || /^22/.test(err?.code ?? '')) return res.status(400).json({ error: 'Invalid value in request.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
