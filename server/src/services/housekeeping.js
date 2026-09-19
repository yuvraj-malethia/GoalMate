/**
 * Clean-up that runs at start-up and then every hour (see index.js):
 * expired demo workspaces, Trash older than 30 days, and chats whose task,
 * page or goal no longer exists.
 */
import { DEMO_TTL_HOURS, TRASH_TTL_DAYS } from '../config.js';
import { transaction } from '../db/pool.js';

export async function purgeExpired() {
  await transaction(async (tx) => {
    await tx.query('DELETE FROM users WHERE is_demo AND created_at < now() - make_interval(hours => $1)', [DEMO_TTL_HOURS]);
    for (const table of ['goals', 'tasks', 'pages']) {
      await tx.query(`DELETE FROM ${table} WHERE deleted_at < now() - make_interval(days => $1)`, [TRASH_TTL_DAYS]);
    }
    // thread is "task:<id>", "page:<id>" or "goal:<id>"
    await tx.query(`
      DELETE FROM messages m WHERE
        (m.thread LIKE 'task:%' AND NOT EXISTS (SELECT 1 FROM tasks WHERE id = split_part(m.thread, ':', 2))) OR
        (m.thread LIKE 'page:%' AND NOT EXISTS (SELECT 1 FROM pages WHERE id = split_part(m.thread, ':', 2))) OR
        (m.thread LIKE 'goal:%' AND NOT EXISTS (SELECT 1 FROM goals WHERE id = split_part(m.thread, ':', 2)))`);
  });
}
