/**
 * Prompts and response schemas for every AI feature, kept in one place so the
 * wording can be tuned without touching route code.
 *
 * Schemas use Gemini's OpenAPI subset (uppercase type names).
 */
import { GOAL_COLORS } from '../../../shared/types.js';

const S = {
  str: { type: 'STRING' },
  int: { type: 'INTEGER' },
  arr: (items) => ({ type: 'ARRAY', items }),
  obj: (properties, required = Object.keys(properties)) => ({
    type: 'OBJECT',
    properties,
    required,
  }),
};

const STYLE = `Write in plain, direct English. No hype words (journey, launchpad, ignite, unlock, mastery, supercharge), no emoji, no exclamation marks.`;

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export const roadmapSchema = S.obj({
  title: S.str,
  description: S.str,
  tags: S.arr(S.str),
  color: { type: 'STRING', enum: [...GOAL_COLORS] },
  tasks: S.arr(
    S.obj({
      title: S.str,
      description: S.str,
      dayOffset: S.int,
      difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
      estimateMinutes: S.int,
      subtasks: S.arr(S.str),
    }),
  ),
});

export function roadmapPrompt(i) {
  const sessionsPerWeek = Math.min(6, Math.max(2, Math.round(i.hoursPerWeek / 1.5)));
  const taskCount = Math.min(42, i.weeks * sessionsPerWeek);
  const minutes = Math.round((i.hoursPerWeek * 60) / sessionsPerWeek);
  return {
    system: `You are an experienced coach and curriculum designer. You turn a person's goal into a realistic, dated study or training plan made of concrete work sessions. ${STYLE}`,
    prompt: `Create a plan for this goal.

Goal: ${i.goal}
Current level: ${i.level}
Length: ${i.weeks} weeks, starting ${i.startWeekday} ${i.startDate}
Time available: about ${i.hoursPerWeek} hours per week
${i.context ? `Extra context from the person: ${i.context}` : ''}

Rules:
- Produce about ${taskCount} tasks (roughly ${sessionsPerWeek} per week). Each task is ONE sitting of about ${minutes} minutes.
- dayOffset is the number of days after the start date (0 = start date). Spread tasks across the whole ${i.weeks} weeks, leaving rest days. Maximum dayOffset is ${i.weeks * 7 - 1}.
- Task titles are short and specific (max 60 characters), e.g. "Solve 5 sliding-window problems" rather than "Practice". Never put "Week N" or "Day N" in a title.
- description: 1–2 sentences saying exactly what to do and what "done" looks like. Name specific topics, exercises or well-known free resources where useful.
- subtasks: 2–4 short concrete steps (max 70 characters each), no numbering.
- Increase difficulty over time. End each week with a short review or checkpoint task, and finish the plan with a milestone that proves the goal was reached.
- estimateMinutes: realistic minutes for that particular task; they should vary (a quick review is shorter than a hard problem set), averaging about the sitting length above.
- title: a plain descriptive name for the whole goal (max 50 characters), e.g. "Linear algebra for machine learning".
- description: one sentence describing the outcome.
- tags: 1–3 short lowercase tags.
- color: pick a fitting colour from the allowed list.`,
  };
}

/* ------------------------------------------------------------------ */
/* Task breakdown                                                      */
/* ------------------------------------------------------------------ */

export const breakdownSchema = S.obj({ steps: S.arr(S.str), tip: S.str });

export function breakdownPrompt(c) {
  return {
    system: `You help people start tasks by splitting them into small, concrete steps. ${STYLE}`,
    prompt: `${c.goal ? `Goal: ${c.goal}\n` : ''}Task: ${c.task}
${c.description ? `Task details: ${c.description}\n` : ''}${c.existing.length ? `Steps that already exist (do not repeat them): ${c.existing.join('; ')}\n` : ''}
Return 3 to 6 new steps that together finish the task. Each step is one action, max 70 characters, no numbering or bullets.
Also return "tip": one sentence of practical advice for doing this task well (max 160 characters).`,
  };
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const chatSystem = (context) =>
  `You are the coach inside GoalMate, a goal planner and journal. Help the person make progress on the thing described below.

Answer the actual question first. Be concrete and practical: name specific methods, examples, exercises or free resources. Keep answers short (under 180 words unless they ask for more). Use Markdown: short paragraphs, bullet lists, **bold** for key terms, code blocks for code. Never use LaTeX or $…$ math notation; write maths as plain text or inline code, e.g. \`O(n log k)\` or x^2 + y^2.
You cannot change anything in the app yourself, so never claim you did. ${STYLE}

--- Context from the app ---
${context}`;

/* ------------------------------------------------------------------ */
/* Plan my day                                                         */
/* ------------------------------------------------------------------ */

export const dayPlanSchema = S.obj({
  summary: S.str,
  focus: S.arr(S.obj({ taskId: S.str, reason: S.str })),
});

export function dayPlanPrompt(date, weekday, tasksText, moodText) {
  return {
    system: `You help a person choose what to work on today from their task list. ${STYLE}`,
    prompt: `Today is ${weekday} ${date}.
${moodText}
Open tasks (id | title | goal | due | priority | difficulty | minutes):
${tasksText}

Choose the 3 tasks (fewer if the list is short) that matter most today. Rules, in order:
1. If any task is overdue, include the most important overdue one.
2. Then due-today and high-priority work, and tasks that unblock a goal.
3. Only pick a task due later if nothing overdue or due today is left.
Avoid stacking several hard tasks.
For each, give "reason": one short sentence (max 110 characters) explaining why it matters today.
"summary": one or two sentences describing the day's plan in a calm, practical tone (max 220 characters).
Only use task ids from the list.`,
  };
}

/* ------------------------------------------------------------------ */
/* Weekly review                                                       */
/* ------------------------------------------------------------------ */

export const weeklyReviewSchema = S.obj({
  headline: S.str,
  summary: S.str,
  wins: S.arr(S.str),
  blockers: S.arr(S.str),
  patterns: S.arr(S.str),
  nextWeek: S.arr(S.str),
});

export function weeklyReviewPrompt(data) {
  return {
    system: `You write honest weekly reviews for a person using a goal planner and journal. Base every statement on the data given; if there is little data, say so plainly instead of inventing. ${STYLE}`,
    prompt: `Here is what happened over the last 7 days.

${data}

Write a weekly review:
- headline: max 70 characters, specific to this week.
- summary: 2–3 sentences.
- wins: 2–4 specific things that went well.
- blockers: 1–3 things that got in the way or slipped (use the journal and overdue tasks).
- patterns: 1–3 observations about when or how they work best (days, mood vs output, task types).
- nextWeek: 3 concrete suggestions for next week, referring to real goals or tasks.`,
  };
}

/* ------------------------------------------------------------------ */
/* Journal writing assistant                                           */
/* ------------------------------------------------------------------ */

export function writePrompt(action, title, text, selection) {
  const doc = `Page title: ${title || 'Untitled'}\n\nPage content:\n${text || '(empty)'}`;
  const tasks = {
    continue:
      'Continue writing this page from where it ends, in the same voice and person (usually first person). Write 1–2 short paragraphs of new prose. Do not repeat, quote or list anything already on the page, and do not start with a bullet or checklist item. Output only the new text.',
    summarize: 'Summarize this page in 2–4 bullet points ("- " prefix). Output only the bullets.',
    prompts:
      'Write 4 thoughtful reflection questions that would help the writer go deeper on what this page is about. Output them as bullet points ("- " prefix), questions only.',
    improve: `Rewrite the following passage to be clearer and better written while keeping the meaning, voice and roughly the same length. Output only the rewritten passage.\n\nPassage:\n${selection ?? ''}`,
    actions:
      'List the concrete next actions this page implies, as a Markdown checklist: every line starts with "- [ ] ". Skip anything the page already shows as done ([x]) and do not copy existing checklist items word for word; add the follow-ups they lead to. Max 6 items, each under 70 characters. If there is nothing to do, output one line: "- [ ] Decide the next step".',
  };
  return {
    system: `You are a writing assistant inside a personal journal. Use Markdown only for bullets or checklists when asked. ${STYLE}`,
    prompt: `${doc}\n\nTask: ${tasks[action]}`,
  };
}
