/**
 * The PostgreSQL connection pool and three small helpers every service uses.
 *
 *   query(sql, params)      -> all rows
 *   queryOne(sql, params)   -> first row or null
 *   transaction(async (tx) => { ... })  -> runs everything inside BEGIN/COMMIT,
 *                                          rolls back if anything throws
 *
 * Parameters are always passed separately ($1, $2 …), never pasted into the
 * SQL string, so user input can't change a query (no SQL injection).
 *
 * Service functions that write take an optional last argument `db` (the pool,
 * or the client of a running transaction), so the same function works on its
 * own or as one step of a bigger transaction.
 */
import pg from 'pg';
import { DATABASE_URL } from '../config.js';

/*
 * How Postgres values become JavaScript values.
 * - DATE stays a "YYYY-MM-DD" string. The default would turn it into a JS Date
 *   at local midnight, which shifts days across time zones.
 * - TIMESTAMPTZ becomes an ISO string, the format the API returns.
 * - COUNT(*) is BIGINT and AVG(...) is NUMERIC; pg returns those as strings to
 *   avoid precision loss, but our numbers are small, so plain numbers are fine.
 */
const { types } = pg;
const parseTimestamp = types.getTypeParser(types.builtins.TIMESTAMPTZ);
types.setTypeParser(types.builtins.DATE, (v) => v);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => parseTimestamp(v).toISOString());
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  // Opening a connection costs ~45 ms (the password handshake), so keep idle ones for a
  // minute instead of pg's default 10 s; a burst of clicks then reuses them.
  idleTimeoutMillis: 60_000,
  // All date maths in SQL is done in UTC; the user's own time zone is applied explicitly.
  options: '-c timezone=UTC',
});

pool.on('error', (err) => console.error('[db] idle client error:', err.message));

export async function query(sql, params = [], db = pool) {
  const { rows } = await db.query(sql, params);
  return rows;
}

export async function queryOne(sql, params = [], db = pool) {
  const { rows } = await db.query(sql, params);
  return rows[0] ?? null;
}

/**
 * Insert many rows with one statement: INSERT INTO t (a, b) VALUES ($1, $2), ($3, $4), …
 * `rows` are plain objects whose keys are column names (all rows use the first row's keys).
 * Used by the demo seed and imports, where one round trip per row would be slow on a hosted database.
 */
export async function insertRows(table, rows, db = pool) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  // Postgres allows at most 65,535 parameters per statement, so big imports go in batches.
  for (let start = 0; start < rows.length; start += 1000) {
    const params = [];
    const tuples = rows.slice(start, start + 1000).map((row) => {
      const placeholders = columns.map((col) => `$${params.push(row[col] ?? null)}`);
      return `(${placeholders.join(', ')})`;
    });
    await db.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`, params);
  }
}

/** Turn user text into an ILIKE pattern that matches it anywhere ("50%" matches a literal percent sign). */
export const containsPattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
