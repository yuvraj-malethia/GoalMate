/**
 * `npm run db:reset` — delete all GoalMate tables and data, then create the
 * empty schema again. Only for local development.
 */
import { migrate } from '../db/migrate.js';
import { pool } from '../db/pool.js';

await pool.query('DROP TABLE IF EXISTS activity, messages, pages, tasks, goals, users, schema_migrations CASCADE');
await migrate();
await pool.end();
console.log('Database reset: all tables are empty.');
