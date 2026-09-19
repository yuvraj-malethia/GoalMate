/**
 * The Insights dashboard, computed in SQL on each request.
 *
 * "Which day was this finished on?" depends on the user's time zone: a task
 * finished at 11:30 pm in India must count for that day, not the next UTC day.
 * The client sends its UTC offset in minutes, and every completion time is
 * shifted by it before taking the date:
 *   (completed_at + make_interval(mins => 330))::date
 */
import { query, queryOne } from '../db/pool.js';
import { addDays } from '../lib/dates.js';
import { recentActivity } from './activity.js';

/**
 * The user's live top-level tasks (not deleted, not steps, goal not deleted),
 * with the local day and local time each was finished.
 * Parameters: $1 user id, $2 UTC offset in minutes.
 */
const LIVE_TASKS = `
  WITH live AS (
    SELECT t.id, t.due_date, t.completed_at,
           (t.completed_at + make_interval(mins => $2)) AS done_local,
           (t.completed_at + make_interval(mins => $2))::date AS done_day
    FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.parent_id IS NULL
      AND (t.goal_id IS NULL OR g.deleted_at IS NULL)
  )`;

export async function getInsights(userId, today, tzOffset) {
  const base = [userId, tzOffset, today]; // $1, $2, $3 in the queries below
  const d30 = addDays(today, -29);
  const d90 = addDays(today, -89);
  const since = addDays(today, -370); // heatmap: the last 53 weeks

  // Monday of this week, and the 12 weeks up to it for the weekly chart.
  const weekday = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = Monday
  const firstMonday = addDays(today, -weekday - 7 * 11);

  const [totals, goalCounts, journal, perDay, plannedPerDay, moods, when, goals, recent] = await Promise.all([
    // Headline numbers. COUNT(*) FILTER (WHERE …) counts only the rows that match.
    queryOne(
      `${LIVE_TASKS}
       SELECT COUNT(*) FILTER (WHERE completed_at IS NULL) AS open_tasks,
              COUNT(*) FILTER (WHERE completed_at IS NULL AND due_date < $3) AS overdue_tasks,
              COUNT(*) FILTER (WHERE done_day BETWEEN $3::date - 29 AND $3) AS done30,
              COUNT(*) FILTER (WHERE done_day BETWEEN $3::date - 59 AND $3::date - 30) AS done_prev30,
              COUNT(*) FILTER (WHERE due_date IS NOT NULL AND done_day BETWEEN $3::date - 29 AND $3) AS dated30,
              COUNT(*) FILTER (WHERE due_date IS NOT NULL AND done_day BETWEEN $3::date - 29 AND $3
                                 AND done_day <= due_date) AS on_time30
       FROM live`,
      base,
    ),
    queryOne(
      `SELECT COUNT(*) FILTER (WHERE status = 'active') AS active,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed
       FROM goals WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    ),
    queryOne(
      `SELECT COUNT(*) AS entries, AVG(mood) AS avg_mood FROM pages
       WHERE user_id = $1 AND deleted_at IS NULL AND kind = 'journal' AND entry_date BETWEEN $2 AND $3`,
      [userId, d30, today],
    ),
    // Completions per local day (heatmap, streaks, weekly chart, mood chart).
    query(
      `${LIVE_TASKS}
       SELECT done_day AS day, COUNT(*) AS n FROM live
       WHERE done_day BETWEEN $4 AND $3 GROUP BY done_day ORDER BY done_day`,
      [...base, since],
    ),
    // Tasks due per day over the 12 weeks (the "planned" bars).
    query(
      `${LIVE_TASKS}
       SELECT due_date AS day, COUNT(*) AS n FROM live
       WHERE due_date BETWEEN $3 AND $4 GROUP BY due_date`,
      [userId, tzOffset, firstMonday, addDays(firstMonday, 7 * 12 - 1)],
    ),
    query(
      `SELECT entry_date AS day, AVG(mood) AS mood FROM pages
       WHERE user_id = $1 AND deleted_at IS NULL AND kind = 'journal' AND mood IS NOT NULL
         AND entry_date BETWEEN $2 AND $3
       GROUP BY entry_date`,
      [userId, d30, today],
    ),
    // When work gets done: ISO weekday (1 = Monday) and hour, last 90 days.
    query(
      `${LIVE_TASKS}
       SELECT EXTRACT(ISODOW FROM done_local)::int AS dow, EXTRACT(HOUR FROM done_local)::int AS hour, COUNT(*) AS n
       FROM live WHERE done_day BETWEEN $4 AND $3 GROUP BY 1, 2`,
      [...base, d90],
    ),
    // Progress of each active goal against its plan. COUNT(column) counts non-empty values.
    query(
      `SELECT g.id, g.title, g.color,
              COUNT(t.id) AS total,
              COUNT(t.completed_at) AS done,
              COUNT(t.due_date) AS dated,
              COUNT(*) FILTER (WHERE t.due_date <= $2) AS expected
       FROM goals g
       LEFT JOIN tasks t ON t.goal_id = g.id AND t.parent_id IS NULL AND t.deleted_at IS NULL
       WHERE g.user_id = $1 AND g.deleted_at IS NULL AND g.status = 'active'
       GROUP BY g.id
       ORDER BY g.position, g.created_at DESC`,
      [userId, today],
    ),
    recentActivity(userId),
  ]);

  /* ---- streaks ---- */
  const doneByDay = new Map(perDay.map((d) => [d.day, d.n]));
  let current = 0;
  // A streak survives until the end of today: if nothing is done yet today, count from yesterday.
  let cursor = doneByDay.has(today) ? today : addDays(today, -1);
  while (doneByDay.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  for (let d = since; d <= today; d = addDays(d, 1)) {
    run = doneByDay.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }

  /* ---- weekly throughput: 12 weeks, Monday start ---- */
  const plannedByDay = new Map(plannedPerDay.map((d) => [d.day, d.n]));
  const sumWeek = (byDay, weekStart) =>
    Array.from({ length: 7 }, (_, i) => byDay.get(addDays(weekStart, i)) ?? 0).reduce((a, b) => a + b, 0);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const weekStart = addDays(firstMonday, 7 * i);
    return { weekStart, done: sumWeek(doneByDay, weekStart), planned: sumWeek(plannedByDay, weekStart) };
  });

  /* ---- mood vs output, last 30 days ---- */
  const moodByDay = new Map(moods.map((m) => [m.day, m.mood]));
  const mood = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(d30, i);
    return { date, mood: moodByDay.get(date) ?? null, done: doneByDay.get(date) ?? 0 };
  });

  /* ---- weekday (Mon..Sun) and hour-of-day histograms ---- */
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const hours = Array.from({ length: 24 }, () => 0);
  for (const r of when) {
    weekdays[r.dow - 1] += r.n;
    hours[r.hour] += r.n;
  }

  return {
    totals: {
      activeGoals: goalCounts.active,
      completedGoals: goalCounts.completed,
      openTasks: totals.open_tasks,
      overdueTasks: totals.overdue_tasks,
      done30: totals.done30,
      donePrev30: totals.done_prev30,
      onTimeRate: totals.dated30 ? totals.on_time30 / totals.dated30 : null,
      journal30: journal.entries,
      avgMood30: journal.avg_mood,
    },
    streak: { current, best },
    heatmap: perDay.map((d) => ({ date: d.day, count: d.n })),
    weekly,
    mood,
    weekdays,
    hours,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      color: g.color,
      done: g.done,
      total: g.total,
      expected: g.dated ? g.expected : null,
    })),
    recent,
  };
}
