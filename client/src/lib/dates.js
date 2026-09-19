/**
 * Dates in GoalMate are *calendar days* (YYYY-MM-DD strings) in the user's
 * local time zone. Keeping them as strings avoids the classic bug where a task
 * due "on the 18th" shows up on the 17th for someone west of UTC.
 */
import { addDays as addD, differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

export const toKey = (d) => format(d, 'yyyy-MM-dd');
export const fromKey = (s) => parseISO(s);
export const todayKey = () => toKey(new Date());
export const addDays = (key, n) => toKey(addD(fromKey(key), n));
export const diffDays = (a, b) => differenceInCalendarDays(fromKey(b), fromKey(a));
/** Minutes east of UTC (IST = 330). */
export const tzOffset = () => -new Date().getTimezoneOffset();

export function weekStart(key) {
  const d = fromKey(key);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return toKey(addD(d, -dow));
}

/** "Today", "Tomorrow", "Yesterday", weekday within a week, else "12 Sep". */
export function dueLabel(key, today = todayKey()) {
  const diff = diffDays(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = fromKey(key);
  if (diff > 1 && diff < 7) return format(d, 'EEEE');
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'd MMM');
  return format(d, 'd MMM yyyy');
}

export function longDate(key) {
  return format(fromKey(key), 'EEEE, d MMMM');
}

export function shortDate(key) {
  const d = fromKey(key);
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy');
}

export function relativeTime(iso) {
  const d = parseISO(iso);
  if (!isValid(d)) return '';
  const secs = (Date.now() - d.getTime()) / 1000;
  if (secs < 45) return 'just now';
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

export { format, fromKey as parseKey };
