/** The "Recent activity" feed on the Insights page. */
import { pool, query } from '../db/pool.js';
import { toActivity } from './mappers.js';

/**
 * Record something the user did. `type` is "<entity>.<verb>", e.g. "task.completed";
 * the entity column is the part before the dot.
 */
export async function logActivity(userId, type, entityId, label, db = pool) {
  await db.query('INSERT INTO activity (user_id, type, entity, entity_id, label) VALUES ($1, $2, $3, $4, $5)', [
    userId,
    type,
    type.split('.')[0],
    entityId,
    label,
  ]);
}

export async function recentActivity(userId, limit = 12) {
  const rows = await query('SELECT * FROM activity WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2', [
    userId,
    limit,
  ]);
  return rows.map(toActivity);
}
