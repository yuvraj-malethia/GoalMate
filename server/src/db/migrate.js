/**
 * Minimal migration runner.
 *
 * Every file in db/migrations is a plain .sql file, applied once, in name
 * order (001_…, 002_…). Applied files are recorded in the schema_migrations
 * table, so on every start only new files run. Each file runs in its own
 * transaction: it either applies completely or not at all.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query, transaction } from './pool.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const applied = new Set((await query('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await transaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`[db] applied migration ${file}`);
  }
}
