/**
 * Calendar-date helpers. Calendar dates travel as "YYYY-MM-DD" strings, and
 * the maths is done at noon UTC so daylight-saving changes never shift a day.
 */

/** True for a real calendar date in YYYY-MM-DD form ("2026-02-31" is false). */
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Local calendar date for a moment, given the user's UTC offset in minutes (India = 330). */
export function localDate(moment = new Date(), tzOffsetMinutes = 0) {
  return new Date(moment.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86_400_000);
}

/** "Friday" */
export function weekdayName(date) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}
