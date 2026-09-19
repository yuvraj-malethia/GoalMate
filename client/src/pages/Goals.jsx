import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CalendarDays, Plus, Sparkles, Target } from 'lucide-react';

import { PageHeader } from '@/components/AppShell';
import { DueChip } from '@/components/TaskRow';
import { Button } from '@/components/ui/Button';
import { ProgressBar, Segmented } from '@/components/ui/Controls';
import { Chip, EmptyState, Skeleton } from '@/components/ui/misc';
import { diffDays, shortDate, todayKey } from '@/lib/dates';
import { useGoals } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { goalColor, plural } from '@/lib/utils';

const SUGGESTIONS = [
  'Prepare for DSA interviews in 6 weeks',
  'Learn the basics of machine learning',
  'Build and deploy a full-stack project',
  'Get fit: 3 workouts a week for 2 months',
];

/** Where the goal should be by today, if it has a timeline (0..1). */
export function expectedProgress(g) {
  if (!g.startDate || !g.targetDate) return null;
  const total = diffDays(g.startDate, g.targetDate) + 1;
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, (diffDays(g.startDate, todayKey()) + 1) / total));
}

export function paceLabel(g) {
  if (g.status === 'completed') return { text: 'Completed', tone: 'good' };
  if (!g.taskCount) return { text: 'No tasks yet', tone: 'muted' };
  if (g.doneCount === g.taskCount) return { text: 'All tasks done', tone: 'good' };
  if (g.overdueCount >= 3) return { text: `${g.overdueCount} overdue`, tone: 'bad' };
  if (g.overdueCount > 0) return { text: `${g.overdueCount} overdue`, tone: 'warn' };
  return { text: 'On track', tone: 'good' };
}

const toneColor = { good: 'var(--success)', warn: 'var(--warning)', bad: 'var(--danger)', muted: 'var(--fg-3)' };

export function GoalsPage() {
  const [status, setStatus] = useState('active');
  const { data: goals = [], isLoading } = useGoals(status);
  const { openNewGoal } = useUi();

  return (
    <>
      <PageHeader
        title="Goals"
        subtitle={isLoading ? ' ' : `${plural(goals.length, `${status} goal`)}`}
        actions={
          <>
            <Button onClick={() => openNewGoal('manual')} className="hidden sm:inline-flex">
              <Plus className="size-4" /> New goal
            </Button>
            <Button variant="primary" onClick={() => openNewGoal('ai')}>
              <Sparkles className="size-3.5" /> Plan with AI
            </Button>
          </>
        }
      >
        <div className="px-4 pb-3 sm:px-6">
          <Segmented
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-24 sm:px-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[196px] rounded-2xl" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            status === 'active' ? (
              <EmptyState
                icon={Target}
                title="Start with one goal"
                description="Describe something you want to achieve and GoalMate will draft a dated plan you can edit."
                action={
                  <div className="flex max-w-lg flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => openNewGoal('ai', s)}
                        className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] text-fg-2 shadow-sm hover:border-accent/50 hover:text-fg"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={Target}
                title={`No ${status} goals`}
                description={
                  status === 'completed'
                    ? 'Finished goals are kept here.'
                    : 'Archived goals are hidden from your sidebar but keep their history.'
                }
              />
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {goals.map((g, i) => (
                <GoalCard key={g.id} goal={g} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function GoalCard({ goal: g, index }) {
  const pct = g.taskCount ? g.doneCount / g.taskCount : 0;
  const expected = expectedProgress(g);
  const pace = paceLabel(g);
  const today = todayKey();
  const daysLeft = g.targetDate ? diffDays(today, g.targetDate) : null;

  return (
    <Link
      to={`/app/goals/${g.id}`}
      className="group card relative flex animate-rise flex-col overflow-hidden p-5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: goalColor(g.color) }} />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15.5px] leading-snug font-semibold tracking-[-0.01em]">{g.title}</h3>
        <span
          className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium"
          style={{ color: toneColor[pace.tone] }}
        >
          <span className="size-1.5 rounded-full" style={{ background: toneColor[pace.tone] }} />
          {pace.text}
        </span>
      </div>
      {g.description && <p className="mt-1 line-clamp-2 text-[13px] text-fg-3">{g.description}</p>}

      <div className="mt-auto pt-5">
        <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
          <span className="font-medium tabular-nums">
            {g.doneCount}/{g.taskCount} tasks
          </span>
          <span className="text-fg-3 tabular-nums">{Math.round(pct * 100)}%</span>
        </div>
        <ProgressBar value={pct} color={goalColor(g.color)} marker={g.status === 'active' ? expected : null} />
        <div className="mt-3.5 flex min-h-[22px] items-center justify-between gap-2 text-[12px] text-fg-3">
          {g.nextTask && g.status === 'active' ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <ArrowRight className="size-3.5 shrink-0" />
              <span className="truncate text-fg-2">{g.nextTask.title}</span>
              {g.nextTask.dueDate && <DueChip date={g.nextTask.dueDate} />}
            </span>
          ) : (
            <span />
          )}
          {g.targetDate && daysLeft !== null && g.status === 'active' && (
            <Chip className="shrink-0" title={`Target: ${shortDate(g.targetDate)}`}>
              <CalendarDays className="size-3" />
              {daysLeft < 0 ? `${-daysLeft}d past target` : daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
            </Chip>
          )}
        </div>
      </div>
    </Link>
  );
}
