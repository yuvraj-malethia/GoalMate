/**
 * Static, non-interactive replicas of GoalMate screens for the landing page.
 * They use the same design tokens as the real app, so they stay in sync with
 * dark mode and the accent colour.
 */

import {
  CalendarDays,
  ChartNoAxesColumn,
  Code2,
  FileText,
  Flag,
  Heading1,
  Inbox,
  ListChecks,
  ListTodo,
  NotebookPen,
  PenLine,
  Search,
  Sparkles,
  Sun,
  Target,
} from 'lucide-react';

import { cn, goalColor } from '@/lib/utils';
import { LogoMark } from '../Logo';

/** A framed screen of the app for the landing page. With a title, a slim header shows where you are. */
export function AppFrame({ children, className, title }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line-strong bg-surface shadow-lg', className)}>
      {title && (
        <div className="flex h-9 items-center gap-2 border-b border-line bg-sidebar px-3.5">
          <LogoMark size={16} />
          <span className="text-[12px] font-medium text-fg-2">GoalMate</span>
          <span className="truncate text-[12px] text-fg-3">/ {title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function Check({ done, color }) {
  const c = goalColor(color);
  return (
    <span
      className="mt-[2px] grid size-[16px] shrink-0 place-items-center rounded-full border-[1.5px]"
      style={{ borderColor: done ? c : `color-mix(in srgb, ${c} 55%, var(--line-strong))`, background: done ? c : 'transparent' }}
    >
      {done && (
        <svg viewBox="0 0 12 12" className="size-[11px]">
          <path
            d="M2.8 6.3l2.1 2.1 4.3-4.7"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function MockTask({ title, goal, color, due, dueTone, done, extra, flag }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-[7px]">
      <Check done={done} color={color} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[12.5px] leading-[18px]', done && 'text-fg-3 line-through')}>{title}</p>
        <div className="mt-0.5 flex items-center gap-2.5 text-[10.5px] text-fg-3">
          {goal && (
            <span className="flex items-center gap-1">
              {color ? (
                <span className="size-[6px] rounded-full" style={{ background: goalColor(color) }} />
              ) : (
                <Inbox className="size-2.5" />
              )}
              {goal}
            </span>
          )}
          {due && (
            <span
              className="flex items-center gap-1"
              style={{ color: dueTone === 'danger' ? 'var(--danger)' : dueTone === 'accent' ? 'var(--accent)' : undefined }}
            >
              <CalendarDays className="size-2.5" /> {due}
            </span>
          )}
          {extra}
          {flag && <Flag className="size-2.5 text-[var(--c-red)]" fill="currentColor" />}
        </div>
      </div>
    </div>
  );
}

const sideGoals = [
  ['DSA prep for placements', 'red', 11],
  ['Linear algebra for ML', 'indigo', 8],
  ['Run 5 km under 30 min', 'green', 16],
  ['Portfolio website', 'blue', 6],
];

/** The hero screenshot: sidebar + Today + suggested focus. */
export function AppPreview({ className }) {
  return (
    <AppFrame className={cn('text-left', className)}>
      <div className="flex h-[480px] sm:h-[540px]">
        {/* Sidebar */}
        <div className="hidden w-[200px] shrink-0 flex-col border-r border-line bg-sidebar p-3 md:flex">
          <div className="mb-3 flex items-center gap-2 px-1.5 text-[13px] font-semibold tracking-tight">
            <LogoMark size={18} /> GoalMate
          </div>
          <div className="mb-3 flex h-7 items-center gap-2 rounded-md border border-line bg-surface/70 px-2 text-[11px] text-fg-3">
            <Search className="size-3" /> Search{' '}
            <span className="ml-auto rounded border border-line-strong px-1 text-[9.5px]">⌘K</span>
          </div>
          {[
            [Sun, 'Today', '4', true],
            [Inbox, 'Inbox', '2', false],
            [CalendarDays, 'Calendar', '', false],
            [NotebookPen, 'Journal', '', false],
            [ChartNoAxesColumn, 'Insights', '', false],
          ].map(([Icon, label, count, active]) => {
            const I = Icon;
            return (
              <div
                key={label}
                className={cn(
                  'flex h-[26px] items-center gap-2 rounded-md px-1.5 text-[12px]',
                  active ? 'bg-black/[0.07] font-medium dark:bg-white/[0.09]' : 'text-fg-2',
                )}
              >
                <I className={cn('size-3.5', active ? 'text-accent' : 'text-fg-3')} />
                <span className="flex-1">{label}</span>
                <span className={cn('text-[10.5px]', active ? 'font-medium text-danger' : 'text-fg-3')}>{count}</span>
              </div>
            );
          })}
          <p className="mt-4 mb-1 px-1.5 text-[9.5px] font-semibold tracking-wider text-fg-3 uppercase">Goals</p>
          {sideGoals.map(([g, c, n]) => (
            <div key={g} className="flex h-[26px] items-center gap-2 rounded-md px-1.5 text-[12px] text-fg-2">
              <span className="mx-[3px] size-[7px] rounded-full" style={{ background: goalColor(c) }} />
              <span className="flex-1 truncate">{g}</span>
              <span className="text-[10.5px] text-fg-3">{n}</span>
            </div>
          ))}
        </div>

        {/* Today */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-11 items-center justify-between border-b border-line px-5">
            <div>
              <p className="text-[13px] leading-tight font-semibold">Today</p>
              <p className="text-[10.5px] text-fg-3">Friday, 18 September</p>
            </div>
            <span className="flex h-6 items-center gap-1 rounded-md border border-line-strong bg-surface px-2 text-[11px] font-medium shadow-sm">
              <Sparkles className="size-3 text-accent" /> Plan my day
            </span>
          </div>
          <div className="flex gap-5 px-5 pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-semibold tracking-[-0.02em]">Good evening, Aarav</p>
              <p className="text-[11.5px] text-fg-3">4 tasks left, 1 overdue. 2 done so far.</p>

              <div className="mt-3 rounded-xl border border-accent/25 bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] p-3">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <Sparkles className="size-3 text-accent" /> Suggested focus
                </p>
                {[
                  ['red', 'Graphs: topological sort', 'Overdue, and it unblocks Sunday’s mock OA.'],
                  ['indigo', 'Eigenvectors and eigenvalues', 'Short session; your notes are already half done.'],
                ].map(([c, t, r], i) => (
                  <div key={t} className="mt-2 flex items-start gap-2">
                    <span
                      className="grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
                      style={{ background: goalColor(c) }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium">{t}</p>
                      <p className="truncate text-[10.5px] text-fg-3">{r}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 mb-0.5 text-[11px] font-semibold text-danger">Overdue</p>
              <MockTask title="Graphs: topological sort" goal="DSA prep" color="red" due="Wednesday" dueTone="danger" />
              <p className="mt-2 mb-0.5 text-[11px] font-semibold text-fg-2">Today</p>
              <MockTask title="Review: timed mock OA (2 problems)" goal="DSA prep" color="red" flag />
              <MockTask
                title="Eigenvectors and eigenvalues"
                goal="Linear algebra"
                color="indigo"
                extra={
                  <>
                    <span className="flex items-center gap-1">
                      <ListChecks className="size-2.5" /> 2/3
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="size-2.5" /> Notes
                    </span>
                  </>
                }
              />
              <MockTask title="Intervals: 6 × 400 m, faster" goal="5K under 30" color="green" done />
              <MockTask title="Email mentor about capstone review" goal="Inbox" color={null} flag />
            </div>

            <div className="hidden w-[190px] shrink-0 space-y-3 lg:block">
              <div className="rounded-xl border border-line p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <svg width="44" height="44" className="-rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-3)" strokeWidth="4" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="113"
                      strokeDashoffset="68"
                    />
                  </svg>
                  <div>
                    <p className="text-[12px] font-semibold">2 of 6 done</p>
                    <p className="text-[10.5px] text-fg-3">today</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 border-t border-line pt-2 text-[10px] text-fg-3">
                  <span>
                    Streak
                    <br />
                    <b className="text-[12.5px] text-fg">9 days</b>
                  </span>
                  <span>
                    30 days
                    <br />
                    <b className="text-[12.5px] text-fg">31 tasks</b>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-line p-3 shadow-sm">
                <p className="text-[11.5px] font-semibold">How’s today going?</p>
                <div className="mt-2 flex justify-between">
                  {['c-red', 'c-orange', 'c-yellow', 'c-teal', 'c-green'].map((c, i) => (
                    <span
                      key={c}
                      className="size-3 rounded-full"
                      style={{
                        background: `var(--${c})`,
                        opacity: i === 3 ? 1 : 0.35,
                        transform: i === 3 ? 'scale(1.25)' : undefined,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-2.5 rounded-md bg-surface-2 px-2 py-1.5 text-[10.5px] text-fg-3">
                  Mock interview went better than expected…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

/** Step 1: the AI goal form. */
export function MockDescribe() {
  return (
    <div className="space-y-3 p-4 text-[12px]">
      <div>
        <p className="mb-1 font-medium text-fg-2">What do you want to achieve?</p>
        <div className="rounded-lg border border-accent bg-surface px-2.5 py-2 ring-3 ring-accent/15">
          Clear the DSA rounds for placement season
        </div>
      </div>
      <div className="flex rounded-lg border border-line bg-surface-3 p-[2px] text-[11px] font-medium">
        <span className="flex-1 rounded-[6px] py-1 text-center text-fg-2">Beginner</span>
        <span className="flex-1 rounded-[6px] bg-surface py-1 text-center shadow-sm">Some experience</span>
        <span className="flex-1 rounded-[6px] py-1 text-center text-fg-2">Advanced</span>
      </div>
      {[
        ['Length', '6 weeks', 45],
        ['Time per week', '8 hours', 38],
      ].map(([l, v, p]) => (
        <div key={l}>
          <p className="mb-1 flex justify-between font-medium text-fg-2">
            {l} <span className="text-fg">{v}</span>
          </p>
          <div className="relative h-1 rounded-full bg-surface-3">
            <div className="h-1 rounded-full bg-accent" style={{ width: `${p}%` }} />
            <span
              className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border border-line-strong bg-white shadow-sm"
              style={{ left: `calc(${p}% - 7px)` }}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <span className="flex h-7 items-center gap-1 rounded-lg bg-accent px-3 text-[11.5px] font-medium text-white">
          <Sparkles className="size-3" /> Generate plan
        </span>
      </div>
    </div>
  );
}

/** Step 2: the plan review. */
export function MockReview() {
  const week = (n, range, tasks) => (
    <div>
      <p className="mb-1 flex justify-between text-[11px]">
        <b>Week {n}</b> <span className="text-fg-3">{range}</span>
      </p>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {tasks.map(([t, d]) => (
          <div key={t} className="flex items-center justify-between gap-2 bg-surface px-2.5 py-[6px] text-[11.5px]">
            <span className="truncate">{t}</span>
            <span className="shrink-0 text-[10.5px] text-fg-3">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-[var(--c-red)]" />
        <p className="text-[13px] font-semibold">DSA for placement season</p>
      </div>
      {week(1, '21 – 27 Sep', [
        ['Arrays & hashing: 6 problems', 'Mon · 90 min'],
        ['Two pointers: 5 problems', 'Wed · 90 min'],
        ['Review: redo missed problems', 'Sat · 60 min'],
      ])}
      {week(2, '28 Sep – 4 Oct', [
        ['Sliding window: 5 problems', 'Mon · 90 min'],
        ['Stack & monotonic stack', 'Thu · 90 min'],
      ])}
    </div>
  );
}

/** Step 3: today list. */
export function MockToday() {
  return (
    <div className="p-3">
      <MockTask title="Arrays & hashing: 6 problems" goal="DSA" color="red" done />
      <MockTask title="Linear combinations and span" goal="Linear algebra" color="indigo" due="Today" dueTone="accent" />
      <MockTask title="Easy run: 3 km" goal="5K" color="green" due="Today" dueTone="accent" />
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] text-fg-3">
        <span className="text-[13px] leading-none text-accent">+</span> Add a task for today
      </div>
    </div>
  );
}

/** The Notion-style page with the slash menu open. */
export function MockNotebook() {
  return (
    <AppFrame title="Sliding window: 5 problems">
      <div className="relative px-8 pt-7 pb-6 text-[13px] sm:px-12">
        <FileText className="size-8 text-fg-3" strokeWidth={1.5} />
        <p className="mt-2 text-[24px] font-bold tracking-[-0.03em]">Sliding window: 5 problems</p>
        <div className="mt-3 space-y-1 text-[12px]">
          <p className="flex gap-6">
            <span className="w-14 text-fg-3">Goal</span>
            <span className="flex items-center gap-1.5">
              <span className="size-[7px] rounded-full bg-[var(--c-red)]" /> DSA prep for placements
            </span>
          </p>
          <p className="flex gap-6">
            <span className="w-14 text-fg-3">Task</span>
            <span className="text-accent">Sliding window: 5 problems</span>
          </p>
        </div>
        <div className="my-4 h-px bg-line" />
        <p className="border-l-2 border-line-strong pl-3 text-fg-2">
          Use it when the answer is a contiguous range and the window updates in O(1).
        </p>
        <p className="mt-3 text-[15px] font-semibold">What I learned</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fg-2">
          <li>Store the last index, not a set, when the left edge jumps</li>
          <li>Fixed and variable windows need different loop shapes</li>
        </ul>
        <p className="mt-2 text-fg-3">
          /<span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-fg" />
        </p>

        <div className="mt-2 w-[260px] rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <p className="px-2 pt-1 pb-0.5 text-[10.5px] font-medium text-fg-3">AI</p>
          {[
            [PenLine, 'Continue writing', 'AI continues from where the page ends', true],
            [Sparkles, 'Summarize page', 'AI adds a short summary', false],
            [ListChecks, 'Action items', 'Turn this page into a checklist', false],
          ].map(([Icon, t, s, active]) => {
            const I = Icon;
            return (
              <div key={t} className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5', active && 'bg-surface-3')}>
                <span className="grid size-7 place-items-center rounded-md border border-line bg-surface">
                  <I className="size-3.5" />
                </span>
                <span>
                  <span className="block text-[12px] font-medium">{t}</span>
                  <span className="block text-[10.5px] text-fg-3">{s}</span>
                </span>
              </div>
            );
          })}
          <p className="px-2 pt-1.5 pb-0.5 text-[10.5px] font-medium text-fg-3">Blocks</p>
          {[
            [Heading1, 'Heading 1'],
            [ListTodo, 'Check list'],
            [Code2, 'Code block'],
          ].map(([Icon, t]) => {
            const I = Icon;
            return (
              <div key={t} className="flex items-center gap-2.5 rounded-lg px-2 py-1">
                <span className="grid size-7 place-items-center rounded-md border border-line bg-surface">
                  <I className="size-3.5" />
                </span>
                <span className="text-[12px]">{t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppFrame>
  );
}

/** The coach answering with task context. */
export function MockCoach() {
  return (
    <AppFrame title="Coach">
      <div className="space-y-3 p-5 text-[12.5px]">
        <div className="flex flex-wrap gap-1.5 text-[10.5px]">
          <span className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-fg-2">
            <Target className="size-2.5" /> DSA prep for placements
          </span>
          <span className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-fg-2">
            <ListChecks className="size-2.5" /> Sliding window · 3/5 steps
          </span>
          <span className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-fg-2">
            <FileText className="size-2.5" /> Your notes
          </span>
        </div>
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-white">
            How do I know when it’s sliding window and not two pointers?
          </p>
        </div>
        <div className="flex gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-3">
            <Sparkles className="size-3.5 text-fg-2" />
          </span>
          <div className="space-y-1.5 text-fg-2">
            <p>
              Both move two indices, but they answer different questions. Reach for a <b className="text-fg">sliding window</b>{' '}
              when:
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                the answer is a <b className="text-fg">contiguous</b> range
              </li>
              <li>you can update the window in O(1)</li>
            </ul>
            <p>
              In your notes you wrote about storing the last index. That’s exactly the trick for{' '}
              <i>Longest substring without repeating characters</i>.
            </p>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

/** Mini insights: heatmap + plan vs actual. */
export function MockInsights() {
  const cells = Array.from({ length: 30 * 7 }, (_, i) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    const r = x - Math.floor(x);
    const recent = i > 70;
    return recent ? (r < 0.18 ? 0 : r < 0.45 ? 1 : r < 0.7 ? 2 : r < 0.9 ? 3 : 4) : r < 0.7 ? 0 : 1;
  });
  return (
    <AppFrame title="Insights">
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Tasks done, 30 days', '31', '+48% vs previous'],
            ['Current streak', '9 days', 'Best: 12 days'],
            ['On time', '84%', '2 overdue now'],
          ].map(([l, v, f]) => (
            <div key={l} className="rounded-lg border border-line p-2.5">
              <p className="text-[9.5px] text-fg-3">{l}</p>
              <p className="mt-0.5 text-[17px] font-semibold tracking-tight">{v}</p>
              <p className="text-[9.5px] text-fg-3">{f}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="mb-2 text-[11px] font-semibold">Activity</p>
          <div className="grid grid-flow-col grid-rows-7 justify-start gap-[3px]">
            {cells.map((l, i) => (
              <span key={i} className="size-[9px] rounded-[2px] sm:size-[10px]" style={{ background: `var(--viz-seq-${l})` }} />
            ))}
          </div>
        </div>
        <div className="space-y-2.5 rounded-lg border border-line p-3">
          <p className="text-[11px] font-semibold">Goals against their plan</p>
          {[
            ['DSA prep for placements', 'red', 61, 71, '3 tasks behind plan'],
            ['Linear algebra for ML', 'indigo', 43, 50, '1 task behind plan'],
            ['Portfolio website', 'blue', 25, 25, 'Exactly on plan'],
          ].map(([t, c, v, m, s]) => (
            <div key={t}>
              <p className="mb-1 flex items-center gap-1.5 text-[10.5px]">
                <span className="size-[6px] rounded-full" style={{ background: goalColor(c) }} />
                {t}
                <span className="ml-auto text-fg-3">{s}</span>
              </p>
              <div className="relative h-1.5 rounded-full bg-surface-3">
                <div className="h-1.5 rounded-full" style={{ width: `${v}%`, background: goalColor(c) }} />
                <span className="absolute top-0 h-1.5 w-0.5 bg-fg/40" style={{ left: `${m}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
}
