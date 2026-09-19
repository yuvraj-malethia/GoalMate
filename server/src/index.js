/**
 * Entry point.
 *   npm run dev  → one server on :5000, with the React app served by Vite (hot reload) inside it
 *   npm start    → serves the production build from /dist (run `npm run build` first)
 *
 * Start-up order: connect to PostgreSQL and apply migrations, clean up expired
 * data, then start listening.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { DATABASE_URL, DIST_DIR, GEMINI_API_KEY, IS_PROD, PORT, ROOT_DIR } from './config.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { createApp } from './app.js';
import { purgeExpired } from './services/housekeeping.js';

try {
  await migrate();
} catch (err) {
  const where = DATABASE_URL.replace(/\/\/[^@]*@/, '//'); // hide the password
  console.error(`\n  Could not connect to PostgreSQL at ${where}\n  ${err.message}`);
  console.error('  Is PostgreSQL running, and is DATABASE_URL in .env correct? See README → Getting started.\n');
  process.exit(1);
}

const housekeeping = () => purgeExpired().catch((err) => console.error('[housekeeping]', err.message));
await housekeeping();
setInterval(housekeeping, 60 * 60_000).unref(); // every hour

const app = createApp();
const server = http.createServer(app);

if (IS_PROD) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error('No production build found. Run `npm run build` first.');
    process.exit(1);
  }
  app.use(express.static(DIST_DIR, { index: false, maxAge: '7d' }));
  // Single-page app: every other GET that isn't an API call gets index.html, and React Router takes over.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(ROOT_DIR, 'vite.config.js'),
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, () => {
  console.log(`\n  GoalMate running at http://localhost:${PORT}  (${IS_PROD ? 'production' : 'development'})`);
  console.log(
    GEMINI_API_KEY
      ? '  Gemini API key found. AI features are on.\n'
      : '  AI features are off: add GEMINI_API_KEY to .env to turn them on.\n',
  );
});

// Close database connections cleanly on Ctrl+C or when the host stops the app.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    pool.end().finally(() => process.exit(0));
  });
}
