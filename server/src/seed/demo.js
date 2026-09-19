/**
 * Demo workspace generator.
 *
 * "Try the live demo" creates a private, throwaway account and fills it with a
 * realistic three-month history for a final-year CS student: placement prep,
 * a linear algebra course, a running plan, a portfolio, and a finished AWS
 * certification. Everything is dated relative to "today" so the demo never
 * looks stale, and a seeded random generator keeps it identical between runs.
 *
 * All rows are built in memory first and written with one INSERT per table
 * (about 200 rows in 5 statements), so creating a demo is quick even on a
 * hosted database where every round trip costs a few milliseconds.
 */

import { insertRows, pool } from '../db/pool.js';
import { markdownToBlocks } from '../lib/blocks.js';
import { addDays, daysBetween } from '../lib/dates.js';
import { newId } from '../lib/ids.js';
import { pageRow, taskRow } from '../services/rows.js';

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dsaTitles = [
  [
    'Arrays & hashing: 6 easy problems',
    'Two sum, contains duplicate, valid anagram, group anagrams, top-k frequent, product except self.',
    'easy',
  ],
  ['Revise Big-O with examples', 'Write the time and space complexity for 10 snippets without looking anything up.', 'easy'],
  [
    'Two pointers: 5 problems',
    undefined,
    'medium',
    ['Valid palindrome', 'Two sum II', '3Sum', 'Container with most water', 'Trapping rain water'],
  ],
  ['Prefix sums: 4 problems', undefined, 'medium'],
  [
    'Sliding window: 5 problems',
    'Fixed and variable windows. Focus on when to shrink the window.',
    'medium',
    [
      'Best time to buy and sell stock',
      'Longest substring without repeating characters',
      'Longest repeating character replacement',
      'Permutation in string',
      'Minimum window substring',
    ],
  ],
  ['Review: redo 3 missed problems', 'Redo from a blank file, timed, without looking at old solutions.', 'medium'],
  ['Stack: valid parentheses & min stack', undefined, 'easy'],
  [
    'Monotonic stack: 3 problems',
    undefined,
    'medium',
    ['Daily temperatures', 'Next greater element', 'Largest rectangle in histogram'],
  ],
  [
    'Binary search on answers: 4 problems',
    'Koko eating bananas, ship packages, split array, minimum days for bouquets.',
    'medium',
  ],
  ['Review: timed set of 3 mediums', '75 minutes, no hints. Log what went wrong.', 'hard'],
  [
    'Linked lists: reverse, merge, cycle',
    undefined,
    'easy',
    ['Reverse linked list', 'Merge two sorted lists', 'Linked list cycle'],
  ],
  ['Fast & slow pointers: 3 problems', undefined, 'medium'],
  ['Trees: DFS traversals from scratch', 'Recursive and iterative pre/in/post-order.', 'medium'],
  ['Trees: BFS & level order problems', undefined, 'medium', ['Level order traversal', 'Right side view', 'Zigzag level order']],
  ['BST: validate, kth smallest, LCA', undefined, 'medium'],
  ['Review: explain 5 solutions out loud', 'Record yourself. Aim for under 3 minutes per explanation.', 'medium'],
  ['Heaps: top-k and merge k lists', undefined, 'hard'],
  [
    'Graphs: BFS/DFS on grids',
    'Number of islands, rotting oranges, flood fill.',
    'medium',
    ['Number of islands', 'Rotting oranges', 'Flood fill'],
  ],
  ['Graphs: topological sort', 'Course schedule I and II using Kahn’s algorithm.', 'hard'],
  ['Review: timed mock OA (2 problems)', '90 minutes, camera on, no hints. Log every mistake afterwards.', 'hard'],
  ['Union-find: 3 problems', undefined, 'hard'],
  [
    'DP 1D: climbing stairs to house robber',
    undefined,
    'medium',
    ['Climbing stairs', 'Min cost climbing stairs', 'House robber', 'House robber II'],
  ],
  ['DP 1D: coin change & LIS', undefined, 'hard'],
  ['DP 2D: grid paths & LCS', undefined, 'hard'],
  ['Backtracking: subsets & permutations', undefined, 'medium'],
  ['Greedy: interval problems', 'Merge intervals, non-overlapping intervals, meeting rooms.', 'medium'],
  ['Tries: implement + word search II', undefined, 'hard'],
  ['Final: 2 full mock OAs (90 min each)', 'Simulate the real thing: camera on, no phone, strict timer.', 'hard'],
];

const laTitles = [
  ['Vectors and what they represent', '3Blue1Brown, Essence of Linear Algebra, ep. 1. Take notes by hand.'],
  ['Linear combinations, span and basis', 'Ep. 2, then 6 textbook problems.'],
  ['Matrices as linear transformations', 'Ep. 3. Draw where î and ĵ land for 4 example matrices.'],
  ['Matrix multiplication as composition', 'Ep. 4. Verify 3 compositions by hand and in NumPy.'],
  ['Review: 10 problems from Strang ch. 1–2', undefined],
  ['Determinants and what they measure', 'Ep. 6. Area/volume scaling, sign and orientation.'],
  ['Inverse matrices, rank and null space', 'Ep. 7. Connect rank to “how many dimensions survive”.'],
  ['Dot products and projections', 'Ep. 9. Derive the projection formula yourself.'],
  [
    'Eigenvectors and eigenvalues',
    'Ep. 14. Compute them by hand for 3 matrices, then check in NumPy.',
    ['Watch episode 14 twice', 'Solve 3 by hand', 'Check with numpy.linalg.eig'],
  ],
  ['Change of basis', 'Ep. 13. Why PCA is a change of basis.'],
  ['Implement matrix ops in NumPy', 'Multiply, transpose, inverse (Gauss–Jordan) without np.linalg.'],
  ['Review: problem set on eigenvalues', undefined],
  [
    'PCA from scratch on the Iris dataset',
    'Covariance matrix → eigen decomposition → project to 2D → plot.',
    ['Load and standardise data', 'Covariance + eigen decomposition', 'Project and plot', 'Compare with sklearn PCA'],
  ],
  ['Write a one-page summary of the course', undefined],
];

const runWeeks = [
  ['Easy run: 2.5 km', 'Intervals: 6 × 400 m', 'Long run: 4 km'],
  ['Easy run: 3 km', 'Intervals: 5 × 600 m', 'Long run: 4.5 km'],
  ['Easy run: 3 km', 'Intervals: 4 × 800 m', 'Long run: 5 km'],
  ['Easy run: 3.5 km', 'Tempo run: 15 minutes', '5 km time trial'],
  ['Easy run: 3.5 km', 'Intervals: 6 × 400 m, faster', 'Long run: 5.5 km'],
  ['Easy run: 4 km', 'Tempo run: 20 minutes', 'Long run: 6 km'],
  ['Easy run: 4 km', 'Intervals: 3 × 1 km', 'Long run: 5 km, easy'],
  ['Easy shakeout: 2 km', 'Strides: 6 × 100 m', 'Race day: 5K time trial'],
];

const awsTitles = [
  'Cloud concepts & shared responsibility',
  'Global infrastructure: regions, AZs, edge',
  'IAM: users, groups, roles, policies',
  'EC2 instance types and pricing models',
  'S3 storage classes and lifecycle rules',
  'VPC basics: subnets and gateways',
  'RDS vs DynamoDB: when to use which',
  'Lambda and serverless basics',
  'CloudWatch and CloudTrail',
  'Practice test 1 (scored 64%)',
  'Review weak areas: billing & pricing',
  'Well-Architected Framework pillars',
  'Security services: Shield, WAF, KMS',
  'Support plans and Trusted Advisor',
  'Practice test 2 (scored 78%)',
  'Flashcards: 60 service names',
  'Practice test 3 (scored 86%)',
  'Final revision of notes',
  'Take the exam',
];

function goals() {
  return [
    {
      key: 'dsa',
      title: 'DSA prep for placement season',
      description: 'Work through the core interview patterns before the first online assessments in October.',
      color: 'red',
      priority: 'high',
      tags: ['placements', 'dsa'],
      startAgo: 38,
      lengthDays: 56,
      hours: [20, 23],
      doneRate: 0.9,
      tasks: dsaTitles.map(([title, description, difficulty, steps], i) => ({
        title,
        description,
        difficulty,
        steps,
        offset: i * 2,
        minutes: difficulty === 'hard' ? 120 : difficulty === 'easy' ? 60 : 90,
        priority: title.startsWith('Review') || title.startsWith('Final') ? 'high' : 'none',
        // keep a realistic backlog: two recent tasks slipped
        done: i === 16 || i === 18 ? false : undefined,
      })),
    },
    {
      key: 'la',
      title: 'Linear algebra for machine learning',
      description: 'Build real intuition for vectors, matrices and eigenvalues, ending with PCA from scratch.',
      color: 'indigo',
      priority: 'medium',
      tags: ['ml', 'maths'],
      startAgo: 22,
      lengthDays: 42,
      hours: [15, 18],
      doneRate: 0.85,
      tasks: laTitles.map(([title, description, steps], i) => ({
        title,
        description,
        steps,
        offset: i * 3,
        minutes: 60,
        difficulty: i > 9 ? 'hard' : i > 4 ? 'medium' : 'easy',
        done: i === 6 ? false : undefined,
      })),
    },
    {
      key: 'run',
      title: 'Run 5 km in under 30 minutes',
      description: 'Eight-week plan, three runs a week. Current best: 33:10.',
      color: 'green',
      priority: 'medium',
      tags: ['fitness', 'running'],
      startAgo: 30,
      lengthDays: 56,
      hours: [6, 7],
      doneRate: 0.8,
      tasks: runWeeks.flatMap((week, w) =>
        week.map((title, k) => ({
          title,
          offset: w * 7 + [0, 2, 5][k],
          minutes: k === 2 ? 45 : 30,
          difficulty: k === 1 ? 'hard' : k === 2 ? 'medium' : 'easy',
        })),
      ),
    },
    {
      key: 'portfolio',
      title: 'Personal portfolio website',
      description: 'A fast, simple site with two strong case studies, live before placements start.',
      color: 'blue',
      priority: 'low',
      tags: ['career', 'web'],
      startAgo: 6,
      lengthDays: 28,
      hours: [16, 19],
      doneRate: 1,
      tasks: [
        'Collect 3 portfolio sites I like',
        'Wireframe home and project pages',
        'Set up the repo: Vite, React, Tailwind',
        'Write the capstone case study',
        'Build project cards and detail page',
        'Add GoalMate as the second project',
        'Lighthouse pass: performance and a11y',
        'Deploy on Vercel with a custom domain',
      ].map((title, i) => ({ title, offset: i * 3 + 1, minutes: 90, difficulty: 'medium' })),
    },
    {
      key: 'aws',
      title: 'AWS Certified Cloud Practitioner',
      description: 'Pass the CLF-C02 exam. Passed with 842.',
      color: 'orange',
      priority: 'medium',
      tags: ['cloud', 'certification'],
      startAgo: 92,
      lengthDays: 52,
      hours: [21, 23],
      doneRate: 1,
      status: 'completed',
      tasks: awsTitles.map((title, i) => ({
        title,
        offset: Math.round(i * 2.8),
        minutes: 60,
        difficulty: 'easy',
        done: true,
      })),
    },
  ];
}

export async function seedDemoWorkspace(userId, today, tzOffset = 330, db = pool) {
  const rand = rng(42);
  const now = Date.now();

  /** ISO timestamp for a local date + hour, never in the future. */
  const at = (date, hour, minute = Math.floor(rand() * 60)) => {
    const [y, m, d] = date.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d, hour, minute) - tzOffset * 60_000;
    return new Date(Math.min(t, now - 10 * 60_000)).toISOString();
  };

  // Rows are collected first and inserted at the end, one INSERT per table.
  const goalRows = [];
  const taskRows = [];
  const pageRows = [];
  const messageRows = [];
  const activityRows = [];
  const activity = (type, entityId, label, createdAt) =>
    activityRows.push({ user_id: userId, type, entity: type.split('.')[0], entity_id: entityId, label, created_at: createdAt });
  const page = (p) => {
    const row = pageRow(userId, p);
    pageRows.push(row);
    return row.id;
  };
  const message = (thread, role, content, createdAt) =>
    messageRows.push({ id: newId(), user_id: userId, thread, role, content, created_at: createdAt });

  const ids = {};
  const taskIds = {};

  goals().forEach((g, gi) => {
    const goalId = newId();
    ids[g.key] = goalId;
    const start = addDays(today, -g.startAgo);
    const created = at(addDays(start, -1), 21);
    const completedAt = g.status === 'completed' ? at(addDays(start, g.lengthDays - 1), 12) : null;
    goalRows.push({
      id: goalId,
      user_id: userId,
      title: g.title,
      description: g.description,
      priority: g.priority,
      status: g.status ?? 'active',
      color: g.color,
      tags: g.tags,
      start_date: start,
      target_date: addDays(start, g.lengthDays - 1),
      ai_generated: g.key === 'la',
      position: gi,
      created_at: created,
      updated_at: created,
      completed_at: completedAt,
    });
    activity('goal.created', goalId, `Created goal “${g.title}”`, created);
    if (completedAt) activity('goal.completed', goalId, `Completed goal “${g.title}”`, completedAt);

    g.tasks.forEach((t, i) => {
      const due = addDays(start, t.offset);
      const past = due < today;
      const isToday = due === today;
      // Older work is almost always finished; the last few days carry a realistic backlog.
      const daysAgo = daysBetween(due, today);
      const done = t.done ?? (past ? daysAgo > 3 || rand() < g.doneRate : isToday && g.key === 'run');
      // Most tasks get done on the due date; some a day early or late.
      const jitter = rand() < 0.2 ? -1 : rand() < 0.25 ? 1 : 0;
      const doneDay = due < today && addDays(due, jitter) <= today ? addDays(due, jitter) : due;
      const hour = g.hours[0] + Math.floor(rand() * (g.hours[1] - g.hours[0] + 1));
      const completedAt = done ? at(doneDay, hour) : null;
      const task = taskRow(userId, {
        goalId,
        title: t.title,
        description: t.description,
        dueDate: due,
        priority: t.priority,
        difficulty: t.difficulty,
        estimateMinutes: t.minutes,
        position: i,
        completedAt,
        createdAt: created,
        updatedAt: completedAt ?? created,
      });
      taskRows.push(task);
      taskIds[`${g.key}:${i}`] = task.id;
      if (completedAt) activity('task.completed', task.id, `Completed “${t.title}”`, completedAt);

      (t.steps ?? []).forEach((title, j) => {
        const stepDone = done || (past && rand() < 0.4) || (isToday && j === 0);
        taskRows.push(
          taskRow(userId, {
            goalId,
            parentId: task.id,
            title,
            position: j,
            completedAt: stepDone ? (completedAt ?? at(today, 9)) : null,
            createdAt: created,
          }),
        );
      });
    });
  });

  // Inbox (tasks without a goal)
  const inbox = [
    ['Email mentor about capstone review slot', 0, 'high', false],
    ['Pay hostel mess fee', 1, 'medium', false],
    ['Return library books', -1, 'none', true],
    ['Update resume with capstone project', null, 'medium', false],
  ];
  inbox.forEach(([title, offset, priority, done], i) => {
    const created = at(addDays(today, -3), 10);
    const completedAt = done ? at(addDays(today, -1), 13) : null;
    const task = taskRow(userId, {
      title,
      dueDate: offset === null ? null : addDays(today, offset),
      priority,
      position: i,
      completedAt,
      createdAt: created,
    });
    taskRows.push(task);
    if (completedAt) activity('task.completed', task.id, `Completed “${title}”`, completedAt);
  });

  /* ---------------- journal ---------------- */
  const entry = (ago, mood, title, md, tags = [], goal) => {
    const date = addDays(today, -ago);
    const createdAt = at(date, 22);
    const id = page({
      kind: 'journal',
      title,
      icon: 'notebook-pen',
      content: markdownToBlocks(md),
      entryDate: date,
      mood,
      tags,
      goalId: goal ? ids[goal] : null,
      createdAt,
    });
    activity('page.created', id, `Wrote “${title}”`, createdAt);
  };

  entry(
    1,
    4,
    'Mock interview with Rohan',
    `Did my first proper mock interview with Rohan today. He gave me "Longest substring without repeating characters" and I spotted the sliding window idea in about five minutes, but fumbled the part where the left pointer jumps forward.
## What went well
- Talked through the brute force first instead of freezing
- Wrote clean code once I had the idea
## What didn't
- Forgot to test with an empty string
- Went quiet for almost a minute while thinking — need to keep narrating
## Next
[x] Book another mock for Saturday
[ ] Redo the problem tomorrow, out loud, with a timer
[ ] Make a checklist of edge cases to say before coding`,
    ['interviews'],
    'dsa',
  );

  entry(
    2,
    2,
    'Slow day',
    `Slept at 3 am after the hackathon debrief, so today was mostly gone. Skipped the morning run and only did one DP problem, which took me an hour.
Not beating myself up about it. The plan has slack for days like this, but two in a row would hurt. Early night today, phone outside the room.`,
    ['energy'],
  );

  entry(
    4,
    5,
    'Eigenvectors finally made sense',
    `Watched the 3Blue1Brown video on eigenvectors twice and then drew the transformations by hand. An eigenvector is a direction the matrix only stretches and never rotates. That is so much simpler than the formula made it look in second year.
> det(A − λI) = 0 is just asking: for which λ does (A − λI) squash space flat?
Tried it on [[2, 1], [1, 2]] and got λ = 3 and λ = 1, with eigenvectors (1, 1) and (1, −1). Checked in NumPy and it matched.
Next up is change of basis, which is apparently where PCA starts to make sense.`,
    ['maths'],
    'la',
  );

  entry(
    6,
    4,
    'Long run in the rain',
    `5 km in 33:10. It started raining at the 2 km mark and honestly it made it easier. Knees felt fine, left calf a bit tight near the end.
- Keep long runs at conversational pace, like the plan says
- Stretch calves after every run this week
Sub-30 still feels far, but a month ago 5 km without stopping wasn't possible at all.`,
    ['running'],
    'run',
  );

  entry(
    8,
    2,
    'Placement talk',
    `Seniors from last year's batch came for the placement talk. Most online assessments had two DSA questions in 90 minutes, one medium and one hard, and graphs and DP came up a lot.
Came back feeling behind. I'm on track with the plan, but the plan ends in three weeks and the first companies arrive in four.
What I can actually control:
[x] Move graphs one week earlier
[x] Add one timed set of mediums every Sunday
[ ] Ask Rohan for weekly mocks`,
    ['placements'],
    'dsa',
  );

  entry(
    11,
    3,
    'Graphs are harder than trees',
    `Spent two hours on "Number of islands" variants. BFS on a grid is fine, but I keep marking cells visited when I pop them instead of when I push them, which makes the queue explode.
Writing it here so I remember: mark visited on push.`,
    ['dsa'],
    'dsa',
  );

  entry(
    14,
    4,
    'Sunday reset',
    `Cleaned my desk, planned the week, and finally set up the timed practice routine: three mediums, 75 minutes, no hints. Got two out of three.
Energy is better when I run in the morning and do DSA at night. Keeping that split.`,
    ['planning'],
  );

  entry(
    17,
    5,
    'First 5 km without stopping',
    `Ran the whole 5 km without walking for the first time. 34:40. Didn't expect how good that would feel.`,
    ['running'],
    'run',
  );

  entry(
    20,
    3,
    'Binary search on answers',
    `Koko eating bananas took me far too long. The trick is realising you binary search over the answer (the eating speed), not over the array. Once that clicked, "Capacity to ship packages" was the same problem in a different costume.`,
    ['dsa'],
    'dsa',
  );

  entry(
    23,
    4,
    'Starting linear algebra again',
    `Started the linear algebra goal. Every ML paper I open assumes I'm comfortable with matrices, and I'm not. Six weeks, a session every three days. 3Blue1Brown for intuition, Strang's book for problems.`,
    ['maths'],
    'la',
  );

  entry(
    27,
    3,
    'Two pointers week',
    `Two pointers is starting to feel natural. 3Sum still needs a second look: I keep forgetting to skip duplicates after moving the pointers.`,
    ['dsa'],
    'dsa',
  );

  entry(
    40,
    5,
    'Passed AWS Cloud Practitioner',
    `Passed with 842. The practice tests were the most useful part of the prep, and the third one was harder than the real exam.
Lessons for the next certification:
- Start practice tests in week 2, not week 5
- Flashcards for service names actually worked`,
    ['cloud'],
    'aws',
  );

  // Pinned reference note
  page({
    kind: 'note',
    title: 'Interview checklist',
    icon: 'list-checks',
    pinned: true,
    tags: ['interviews'],
    goalId: ids.dsa,
    content: markdownToBlocks(`## Before coding
[ ] Repeat the problem in my own words
[ ] Ask about input size and edge cases
[ ] Say the brute force and its complexity
## While coding
- Narrate what each block does
- Clear variable names; single letters only for loop indices
## After coding
[ ] Walk through one normal case and one edge case
[ ] State time and space complexity`),
    createdAt: at(addDays(today, -9), 23),
  });

  // A saved weekly review
  const wkStart = addDays(today, -13);
  const wkEnd = addDays(today, -7);
  const fmt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  page({
    kind: 'review',
    title: `Weekly review · ${fmt(wkStart)} – ${fmt(wkEnd)}`,
    icon: 'sparkles',
    entryDate: wkEnd,
    tags: ['review'],
    content: markdownToBlocks(`## Summary
A strong DSA week: every stack problem done and the first timed set completed. Running stayed on schedule; linear algebra slipped by one session.
## Wins
- Finished monotonic stack two days ahead of plan
- Three runs, the longest 4.5 km
## What got in the way
- The hackathon weekend took two evenings
## Next week
- Protect Tuesday and Thursday evenings for DSA
- Catch up the missed linear algebra session on Sunday morning
- Book a mock interview`),
    createdAt: at(wkEnd, 22),
  });

  /* ---------------- task notes + AI chat ---------------- */
  const slidingId = taskIds['dsa:4'];
  page({
    kind: 'note',
    title: 'Sliding window: 5 problems',
    icon: 'file-text',
    goalId: ids.dsa,
    taskId: slidingId,
    content: [
      ...markdownToBlocks(`> Use it when the answer is a contiguous subarray or substring and the window can be updated in O(1) as it grows or shrinks.
## Template`),
      {
        type: 'codeBlock',
        props: { language: 'python' },
        content: [
          {
            type: 'text',
            text: 'def longest_unique(s: str) -> int:\n    last = {}\n    left = best = 0\n    for right, ch in enumerate(s):\n        if ch in last and last[ch] >= left:\n            left = last[ch] + 1\n        last[ch] = right\n        best = max(best, right - left + 1)\n    return best',
            styles: {},
          },
        ],
      },
      ...markdownToBlocks(`## What I learned
- Fixed-size and variable-size windows need different loop shapes
- Store the last index (not a set) when the left edge has to jump forward
- "Minimum window substring" = variable window + a counter of still-missing characters`),
    ],
    createdAt: at(addDays(today, -30), 22),
  });

  const chatAt = addDays(today, -30);
  message(
    `task:${slidingId}`,
    'user',
    'How do I know when a problem needs sliding window and not two pointers?',
    at(chatAt, 21, 10),
  );
  message(
    `task:${slidingId}`,
    'model',
    `Both move two indices, but they answer different questions.

**Sliding window** — look for these signals:
- The answer is a **contiguous** subarray or substring
- Words like *longest*, *shortest*, *at most k*, *contains all*
- You can update the window's state in O(1) when you add or remove one element (a count, a sum, a hashmap)

**Two pointers** (from both ends) fits when:
- The input is **sorted**, or order doesn't matter
- You compare a *pair* of elements (sum to a target, container with most water)
- Moving one pointer rules out a whole set of answers

A quick test: if you'd describe the answer as "a range [l, r]", think window. If you'd describe it as "a pair (i, j)", think two pointers.`,
    at(chatAt, 21, 11),
  );

  const eigenId = taskIds['la:8'];
  message(
    `task:${eigenId}`,
    'user',
    'Explain eigenvectors like I have only seen matrices as tables of numbers.',
    at(addDays(today, -4), 16, 5),
  );
  message(
    `task:${eigenId}`,
    'model',
    `Think of a matrix as a **machine that moves every arrow in the plane**: it stretches, squashes, rotates or shears them.

Most arrows get knocked off their original line. An **eigenvector** is a rare arrow that stays on its own line — the machine only makes it longer, shorter or flips it. The **eigenvalue** is how much it gets stretched:
- λ = 3 → three times longer
- λ = 0.5 → half as long
- λ = −1 → same length, pointing the other way

Try it: for A = [[2, 1], [1, 2]], multiply A by (1, 1). You get (3, 3) — same direction, 3× longer. So (1, 1) is an eigenvector with λ = 3.`,
    at(addDays(today, -4), 16, 6),
  );

  for (const [table, rows] of [
    ['goals', goalRows],
    ['tasks', taskRows],
    ['pages', pageRows],
    ['messages', messageRows],
    ['activity', activityRows],
  ]) {
    await insertRows(table, rows, db);
  }
}
