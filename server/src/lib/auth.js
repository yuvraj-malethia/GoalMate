/**
 * Authentication: bcrypt password hashes plus a signed JWT kept in an httpOnly
 * cookie. Page JavaScript can't read the cookie, which protects the session
 * from XSS, and every route after `requireAuth` can rely on `req.userId`.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IS_PROD, JWT_SECRET, SESSION_DAYS } from '../config.js';
import { queryOne } from '../db/pool.js';
import { HttpError } from './http.js';

const COOKIE = 'gm_session';

export const hashPassword = (password) => bcrypt.hash(password, 11);
export const checkPassword = (password, hash) => bcrypt.compare(password, hash);

export function startSession(res, userId) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: SESSION_DAYS * 86_400_000,
    path: '/',
  });
}

export function endSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Middleware: reads the session cookie (if any) and sets req.userId. Never rejects. */
export async function readSession(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    let userId = null;
    try {
      userId = jwt.verify(token, JWT_SECRET).sub;
    } catch {
      // Expired or tampered token: treat as signed out.
    }
    // The account may have been deleted (or the demo expired) since the cookie was issued.
    if (userId && (await queryOne('SELECT 1 FROM users WHERE id = $1', [userId]))) req.userId = userId;
  }
  next();
}

/** Middleware: 401 unless signed in. */
export function requireAuth(req, _res, next) {
  if (!req.userId) return next(new HttpError(401, 'Please sign in to continue.'));
  next();
}
