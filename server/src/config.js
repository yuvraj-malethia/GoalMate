/**
 * Central configuration. Everything that depends on the environment or on
 * file-system locations is resolved here, relative to the project root —
 * never relative to the current working directory — so `npm run dev` works no
 * matter which folder it is started from.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

// Load .env from the project root if it exists (built into Node 22, no dotenv needed).
// Variables already set in the shell win over the file.
const envFile = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export const IS_PROD = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
export const PORT = Number(process.env.PORT) || 5000;
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

/** PostgreSQL connection string, e.g. postgres://goalmate:goalmate@localhost:5432/goalmate */
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://goalmate:goalmate@localhost:5432/goalmate';

/**
 * Secret used to sign login cookies. In production set JWT_SECRET. Locally, a
 * random secret is created once and kept in .jwt-secret (git-ignored) so you
 * stay logged in across restarts.
 */
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(ROOT_DIR, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret);
  return secret;
}
export const JWT_SECRET = loadSecret();
export const SESSION_DAYS = 30;

/** "Try the demo" workspaces are deleted after this many hours. */
export const DEMO_TTL_HOURS = 24;
/** Items in the Trash are deleted for good after this many days. */
export const TRASH_TTL_DAYS = 30;

/* ------------------------------------------------------------------ */
/* Gemini                                                              */
/* ------------------------------------------------------------------ */

export const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
/** Only override for proxies or tests. */
export const GEMINI_BASE_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(
  /\/$/,
  '',
);

/**
 * Which Gemini models to try, in order. Google retires models regularly
 * (gemini-1.5 and 2.0 are shut down, 2.5-flash is closed to new keys), so each
 * request walks a list and moves on when a model is unavailable or busy.
 *
 * - "fast": Lite models first. They answered in ~1–2 s in testing, so chat,
 *   step suggestions, Plan my day and journal help use them.
 * - "smart": full Flash models first, for the bigger jobs (roadmaps, weekly
 *   review). The free tier is often overloaded, so these get a time budget and
 *   then the fast models take over (see ai/gemini.js).
 */
const SMART = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const FAST = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];
const withOverride = (models) => [process.env.GEMINI_MODEL?.trim(), ...models].filter((m, i, all) => m && all.indexOf(m) === i);

export const GEMINI_MODELS = {
  smart: withOverride([...SMART, ...FAST]),
  fast: withOverride([...FAST, ...SMART]),
};
