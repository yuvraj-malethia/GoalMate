/** The Trash page: deleted goals and pages, which can be restored for 30 days. */
import { transaction } from '../db/pool.js';
import { localDate } from '../lib/dates.js';
import { goalSummaries } from './goals.js';
import { trashedPages } from './pages.js';

export async function getTrash(userId) {
  const [goals, pages] = await Promise.all([goalSummaries(userId, localDate(), { inTrash: true }), trashedPages(userId)]);
  return { goals, pages };
}

export async function emptyTrash(userId) {
  await transaction(async (tx) => {
    for (const table of ['goals', 'pages', 'tasks']) {
      await tx.query(`DELETE FROM ${table} WHERE user_id = $1 AND deleted_at IS NOT NULL`, [userId]);
    }
  });
}
