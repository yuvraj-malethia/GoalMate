/** Accounts: sign-up, sign-in, the demo workspace, profile and password. */
import { query, queryOne, transaction } from '../db/pool.js';
import { checkPassword, hashPassword } from '../lib/auth.js';
import { localDate } from '../lib/dates.js';
import { HttpError } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { seedDemoWorkspace } from '../seed/demo.js';
import { toUser } from './mappers.js';

export async function getUser(userId) {
  const row = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
  return row ? toUser(row) : null;
}

export async function createUser({ name, email, password }) {
  if (await queryOne('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email])) {
    throw new HttpError(409, 'An account with this email already exists. Try signing in.');
  }
  const row = await queryOne('INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *', [
    newId(),
    name,
    email,
    await hashPassword(password),
  ]);
  return toUser(row);
}

export async function login(email, password) {
  const row = await queryOne('SELECT * FROM users WHERE lower(email) = lower($1) AND NOT is_demo', [email]);
  // Same message whether the email or the password is wrong, so emails can't be probed.
  if (!row || !(await checkPassword(password, row.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  return toUser(row);
}

/**
 * "Try the demo": a private, throwaway account filled with realistic sample
 * data, dated relative to the visitor's own today. Deleted on sign-out or after 24 hours.
 */
export async function createDemoUser(tzOffset) {
  const id = newId();
  await transaction(async (tx) => {
    await tx.query("INSERT INTO users (id, name, email, password_hash, is_demo) VALUES ($1, 'Aarav Sharma', $2, '!', true)", [
      id,
      `demo-${id.toLowerCase()}@demo.goalmate.local`,
    ]);
    await seedDemoWorkspace(id, localDate(new Date(), tzOffset), tzOffset, tx);
  });
  return getUser(id);
}

export async function deleteDemoUser(userId) {
  await query('DELETE FROM users WHERE id = $1 AND is_demo', [userId]);
}

export async function renameUser(userId, name) {
  await query('UPDATE users SET name = $1 WHERE id = $2', [name, userId]);
  return getUser(userId);
}

export async function changePassword(userId, current, next) {
  const row = await queryOne('SELECT password_hash, is_demo FROM users WHERE id = $1', [userId]);
  if (row.is_demo) throw new HttpError(400, 'The demo account has no password.');
  if (!(await checkPassword(current, row.password_hash))) throw new HttpError(400, 'Current password is incorrect.');
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(next), userId]);
}

/** ON DELETE CASCADE removes the user's goals, tasks, pages, messages and activity. */
export async function deleteUser(userId) {
  await query('DELETE FROM users WHERE id = $1', [userId]);
}
