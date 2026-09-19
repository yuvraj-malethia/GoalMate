/**
 * Build complete database rows (column name → value) with sensible defaults,
 * ready for insertRows(). Normal requests, the demo seed and imports all
 * create tasks and pages through these, so a new row always has every column.
 */
import { blocksToText, wordCount } from '../lib/blocks.js';
import { newId } from '../lib/ids.js';

export function taskRow(userId, t) {
  const at = t.createdAt ?? new Date().toISOString();
  return {
    id: t.id ?? newId(),
    user_id: userId,
    goal_id: t.goalId ?? null,
    parent_id: t.parentId ?? null,
    title: t.title,
    description: t.description ?? '',
    due_date: t.dueDate ?? null,
    priority: t.priority ?? 'none',
    difficulty: t.difficulty ?? null,
    estimate_minutes: t.estimateMinutes ?? null,
    position: t.position ?? 0,
    completed_at: t.completedAt ?? null,
    created_at: at,
    updated_at: t.updatedAt ?? at,
  };
}

/** `content` is a BlockNote document; its plain text and word count are stored alongside for search and AI. */
export function pageRow(userId, p) {
  const content = Array.isArray(p.content) ? p.content : [];
  const text = blocksToText(content);
  const at = p.createdAt ?? new Date().toISOString();
  return {
    id: p.id ?? newId(),
    user_id: userId,
    kind: p.kind ?? 'journal',
    title: p.title ?? '',
    icon: p.icon ?? null,
    content: JSON.stringify(content), // JSONB column: send JSON text
    plain_text: text,
    word_count: wordCount(text),
    entry_date: p.entryDate ?? null,
    mood: p.mood ?? null,
    tags: p.tags ?? [],
    goal_id: p.goalId ?? null,
    task_id: p.taskId ?? null,
    pinned: !!p.pinned,
    created_at: at,
    updated_at: at,
  };
}
