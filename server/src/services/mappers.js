/**
 * Database row (snake_case columns) → API object (camelCase), in the shapes
 * documented in shared/types.js. Keeping this in one place means the database
 * can change without the frontend noticing.
 */
import { excerpt } from '../lib/blocks.js';

export const toUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  isDemo: r.is_demo,
  createdAt: r.created_at,
});

export const toGoal = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  priority: r.priority,
  status: r.status,
  color: r.color,
  tags: r.tags,
  startDate: r.start_date,
  targetDate: r.target_date,
  aiGenerated: r.ai_generated,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at,
  deletedAt: r.deleted_at,
});

/** A goal plus the progress numbers computed by the goal-summary query. */
export const toGoalSummary = (r) => ({
  ...toGoal(r),
  taskCount: r.task_count,
  doneCount: r.done_count,
  overdueCount: r.overdue_count,
  nextTask: r.next_id ? { id: r.next_id, title: r.next_title, dueDate: r.next_due_date } : null,
});

export const toTask = (r) => ({
  id: r.id,
  goalId: r.goal_id,
  parentId: r.parent_id,
  title: r.title,
  description: r.description,
  dueDate: r.due_date,
  priority: r.priority,
  difficulty: r.difficulty,
  estimateMinutes: r.estimate_minutes,
  position: r.position,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  pageId: r.page_id ?? null,
  messageCount: r.message_count ?? 0,
  subtaskCount: r.subtask_count ?? 0,
  subtaskDone: r.subtask_done ?? 0,
});

export const toTaskWithGoal = (r) => ({
  ...toTask(r),
  goal: r.goal_id ? { id: r.goal_id, title: r.goal_title, color: r.goal_color } : null,
});

export const toPageSummary = (r) => ({
  id: r.id,
  title: r.title,
  icon: r.icon,
  kind: r.kind,
  entryDate: r.entry_date,
  mood: r.mood,
  tags: r.tags,
  pinned: r.pinned,
  excerpt: excerpt(r.plain_text || ''),
  wordCount: r.word_count,
  goal: r.goal_id && r.goal_title ? { id: r.goal_id, title: r.goal_title, color: r.goal_color } : null,
  task: r.task_id && r.task_title ? { id: r.task_id, title: r.task_title } : null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

export const toPage = (r) => ({
  ...toPageSummary(r),
  content: Array.isArray(r.content) ? r.content : [],
});

export const toMessage = (r) => ({
  id: r.id,
  thread: r.thread,
  role: r.role,
  content: r.content,
  createdAt: r.created_at,
});

export const toActivity = (r) => ({
  id: r.id,
  type: r.type,
  label: r.label,
  entity: r.entity,
  entityId: r.entity_id,
  createdAt: r.created_at,
});
