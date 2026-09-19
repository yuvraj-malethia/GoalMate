import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names; later Tailwind classes override earlier ones (e.g. a caller's `p-0` beats a default `py-2`). */
export const cn = (...inputs) => twMerge(clsx(inputs));

export const goalColor = (c) => `var(--c-${c ?? 'graphite'})`;

export const PRIORITIES = [
  { value: 'high', label: 'High', color: 'var(--c-red)' },
  { value: 'medium', label: 'Medium', color: 'var(--c-orange)' },
  { value: 'low', label: 'Low', color: 'var(--c-blue)' },
  { value: 'none', label: 'None', color: 'var(--fg-3)' },
];
export const priorityMeta = (p) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[3];

export const MOODS = [
  { value: 1, label: 'Rough', color: 'var(--c-red)' },
  { value: 2, label: 'Low', color: 'var(--c-orange)' },
  { value: 3, label: 'Okay', color: 'var(--c-yellow)' },
  { value: 4, label: 'Good', color: 'var(--c-teal)' },
  { value: 5, label: 'Great', color: 'var(--c-green)' },
];
export const moodMeta = (m) => (m ? MOODS[m - 1] : null);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const formatMinutes = (m) => {
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const modKey = isMac ? '⌘' : 'Ctrl';
