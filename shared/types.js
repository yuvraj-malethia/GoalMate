/**
 * Shared between the server and the client.
 *
 * The only runtime value is GOAL_COLORS. Everything else in this file is JSDoc
 * documentation of the JSON objects the API sends and receives, so both sides
 * (and your editor's autocomplete) agree on the shapes.
 *
 * Conventions used by every API object:
 *   - ids are short random strings
 *   - timestamps (…At) are ISO-8601 strings in UTC, e.g. "2026-09-18T10:15:00.000Z"
 *   - calendar dates (dueDate, startDate, targetDate, entryDate) are "YYYY-MM-DD"
 *     strings in the user's local time zone
 */

/** Colours used to identify goals. */
export const GOAL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'brown', 'graphite'];

/**
 * @typedef {'high' | 'medium' | 'low' | 'none'} Priority
 * @typedef {'active' | 'completed' | 'archived'} GoalStatus
 * @typedef {'easy' | 'medium' | 'hard'} Difficulty
 * @typedef {'journal' | 'note' | 'review'} PageKind
 * @typedef {'red'|'orange'|'yellow'|'green'|'teal'|'blue'|'indigo'|'purple'|'pink'|'brown'|'graphite'} GoalColor
 */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {boolean} isDemo   true for "Try the demo" workspaces
 * @property {string} createdAt
 */

/**
 * @typedef {object} Goal
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {Priority} priority
 * @property {GoalStatus} status
 * @property {GoalColor} color
 * @property {string[]} tags
 * @property {string|null} startDate
 * @property {string|null} targetDate
 * @property {boolean} aiGenerated
 * @property {number} position
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} completedAt
 * @property {string|null} deletedAt   set when the goal is in the Trash
 */

/**
 * A goal as returned by list endpoints, with progress numbers attached
 * (counts are of top-level tasks only; steps don't count).
 * @typedef {Goal & {
 *   taskCount: number,
 *   doneCount: number,
 *   overdueCount: number,
 *   nextTask: { id: string, title: string, dueDate: string|null } | null
 * }} GoalSummary
 */

/**
 * @typedef {object} Task
 * @property {string} id
 * @property {string|null} goalId      null = Inbox
 * @property {string|null} parentId    set for steps (subtasks), one level deep
 * @property {string} title
 * @property {string} description
 * @property {string|null} dueDate
 * @property {Priority} priority
 * @property {Difficulty|null} difficulty
 * @property {number|null} estimateMinutes
 * @property {number} position
 * @property {string|null} completedAt   null = open
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} pageId        the task's notes page, if any
 * @property {number} messageCount       stored coach messages for this task
 * @property {number} subtaskCount
 * @property {number} subtaskDone
 */

/**
 * @typedef {Task & { goal: { id: string, title: string, color: GoalColor } | null }} TaskWithGoal
 * @typedef {GoalSummary & { tasks: Task[] }} GoalDetail   tasks is flat; steps carry parentId
 */

/**
 * @typedef {object} PageSummary
 * @property {string} id
 * @property {string} title
 * @property {string|null} icon         a Lucide icon name, e.g. "notebook-pen"
 * @property {PageKind} kind
 * @property {string|null} entryDate
 * @property {number|null} mood         1 (rough) … 5 (great)
 * @property {string[]} tags
 * @property {boolean} pinned
 * @property {string} excerpt
 * @property {number} wordCount
 * @property {{ id: string, title: string, color: GoalColor } | null} goal
 * @property {{ id: string, title: string } | null} task
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} deletedAt
 */

/**
 * @typedef {PageSummary & { content: object[] }} Page   content = the BlockNote document (array of blocks)
 */

/**
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {string} thread        "task:<id>", "page:<id>" or "goal:<id>"
 * @property {'user'|'model'} role
 * @property {string} content       Markdown
 * @property {string} createdAt
 */

/**
 * @typedef {object} ActivityItem
 * @property {number} id
 * @property {string} type          e.g. "task.completed"
 * @property {string} label         human-readable sentence
 * @property {string} entity
 * @property {string|null} entityId
 * @property {string} createdAt
 */

/**
 * @typedef {object} AiStatus
 * @property {boolean} configured
 * @property {string[]} models
 * @property {string|null} lastError
 * @property {string|null} lastModel
 */

/**
 * AI roadmap draft — returned by POST /api/ai/roadmap, not saved until the user creates the goal.
 * @typedef {object} RoadmapDraft
 * @property {string} title
 * @property {string} description
 * @property {string[]} tags
 * @property {GoalColor} color
 * @property {{ title: string, description: string, dueDate: string, difficulty: Difficulty,
 *              estimateMinutes: number, subtasks: string[] }[]} tasks
 */

/**
 * @typedef {object} DayPlan
 * @property {string} summary
 * @property {{ taskId: string, reason: string, title: string, dueDate: string|null,
 *              goal: { title: string, color: GoalColor } | null }[]} focus
 */

/**
 * @typedef {object} WeeklyReview
 * @property {string} headline
 * @property {string} summary
 * @property {string[]} wins
 * @property {string[]} blockers
 * @property {string[]} patterns
 * @property {string[]} nextWeek
 */

/**
 * GET /api/insights
 * @typedef {object} Insights
 * @property {{ activeGoals: number, completedGoals: number, openTasks: number, overdueTasks: number,
 *   done30: number, donePrev30: number, onTimeRate: number|null, journal30: number, avgMood30: number|null }} totals
 * @property {{ current: number, best: number }} streak
 * @property {{ date: string, count: number }[]} heatmap
 * @property {{ weekStart: string, done: number, planned: number }[]} weekly
 * @property {{ date: string, mood: number|null, done: number }[]} mood
 * @property {number[]} weekdays   Mon..Sun completions, last 90 days
 * @property {number[]} hours      0..23 completions, last 90 days
 * @property {{ id: string, title: string, color: GoalColor, done: number, total: number, expected: number|null }[]} goals
 * @property {ActivityItem[]} recent
 */
