/** Search for the command palette (Ctrl+K): goals, tasks and pages whose text contains the query. */
import { containsPattern, query } from '../db/pool.js';

export async function search(userId, text) {
  const pattern = containsPattern(text);
  // The three lookups are independent, so they run at the same time.
  const [goals, tasks, pages] = await Promise.all([
    query(
      `SELECT id, title, color FROM goals
       WHERE user_id = $1 AND deleted_at IS NULL AND title ILIKE $2
       ORDER BY position LIMIT 5`,
      [userId, pattern],
    ),
    query(
      `SELECT t.id, t.parent_id AS "parentId", t.title, t.goal_id AS "goalId", t.completed_at AS "completedAt",
              g.title AS "goalTitle", g.color AS "goalColor"
       FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id
       WHERE t.user_id = $1 AND t.deleted_at IS NULL AND (g.id IS NULL OR g.deleted_at IS NULL) AND t.title ILIKE $2
       ORDER BY t.completed_at IS NOT NULL, t.due_date NULLS LAST LIMIT 6`,
      [userId, pattern],
    ),
    query(
      `SELECT id, title, kind, entry_date AS "entryDate" FROM pages
       WHERE user_id = $1 AND deleted_at IS NULL AND (title ILIKE $2 OR plain_text ILIKE $2)
       ORDER BY updated_at DESC LIMIT 5`,
      [userId, pattern],
    ),
  ]);
  return { goals, tasks, pages };
}
