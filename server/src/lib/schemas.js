/**
 * zod schemas for values that several routes accept. Route-specific request
 * shapes live in the route files; these are the shared building blocks.
 */
import { z } from 'zod';
import { GOAL_COLORS } from '../../../shared/types.js';
import { isDate } from './dates.js';

export const priority = z.enum(['high', 'medium', 'low', 'none']);
export const difficulty = z.enum(['easy', 'medium', 'hard']);
export const goalColor = z.enum(GOAL_COLORS);
export const dateString = z.string().refine(isDate, 'Use a real date in YYYY-MM-DD form.');
export const tzOffset = z.number().int().min(-840).max(840);
export const tagList = (max) => z.array(z.string().trim().toLowerCase().min(1).max(30)).max(max);

/** A task inside a new goal: from the New goal dialog, an AI roadmap, or an import. */
const taskDraft = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).default(''),
  dueDate: dateString.nullable().optional(),
  difficulty: difficulty.nullable().optional(),
  estimateMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  priority: priority.optional(),
  completed: z.boolean().optional(),
  subtasks: z
    .array(z.union([z.string(), z.object({ title: z.string(), completed: z.boolean().optional() })]))
    .max(20)
    .default([]),
});

/** POST /api/goals — a goal with its tasks (and their steps) created in one go. */
export const newGoal = z.object({
  title: z.string().trim().min(1, 'Give the goal a title.').max(200),
  description: z.string().max(4000).default(''),
  priority: priority.default('medium'),
  color: goalColor.default('blue'),
  tags: tagList(8).default([]),
  startDate: dateString.nullable().default(null),
  targetDate: dateString.nullable().default(null),
  aiGenerated: z.boolean().default(false),
  tasks: z.array(taskDraft).max(80).default([]),
});
