import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, ChevronDown, Flame, NotebookPen, Sparkles, Sun, X } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/AppShell';
import { AiSetupNotice } from '@/components/Chat';
import { DueChip, QuickAdd, TaskRow, useOpenTask } from '@/components/TaskRow';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/Controls';
import { EmptyState, GoalDot, SectionTitle, Skeleton } from '@/components/ui/misc';
import { api, ApiError, errorMessage } from '@/lib/api';
import { addDays, dueLabel, format, fromKey, greeting, longDate, todayKey } from '@/lib/dates';
import { invalidatePages, invalidateWork, todayQuery, useInsights, useMe, usePages, useTasks } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { cn, goalColor, MOODS, plural } from '@/lib/utils';

const planKey = (userId, date) => `goalmate-dayplan-${userId}-${date}`;

export function TodayPage() {
  const today = todayKey();
  const { data: me } = useMe();
  const { data: tasks = [], isLoading } = useTasks(todayQuery());
  const { data: upcoming = [] } = useTasks({ from: addDays(today, 1), to: addDays(today, 7), status: 'open' });
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);

  const overdue = tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today);
  const open = tasks.filter((t) => !t.completedAt && t.dueDate === today);
  const done = tasks.filter((t) => t.completedAt);
  const total = open.length + done.length + overdue.length;

  const [plan, setPlan] = useState(() => {
    try {
      return me ? JSON.parse(localStorage.getItem(planKey(me.id, today)) || 'null') : null;
    } catch {
      return null;
    }
  });
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState(null);

  const planDay = async () => {
    setPlanning(true);
    setPlanError(null);
    try {
      const p = await api.post('/ai/plan-day', { date: today });
      setPlan(p);
      if (me) localStorage.setItem(planKey(me.id, today), JSON.stringify(p));
    } catch (e) {
      setPlanError({ setup: e instanceof ApiError && e.isAiSetup, message: errorMessage(e) });
    } finally {
      setPlanning(false);
    }
  };
  const dismissPlan = () => {
    setPlan(null);
    if (me) localStorage.removeItem(planKey(me.id, today));
  };

  const moveOverdue = async () => {
    await Promise.all(overdue.map((t) => api.patch(`/tasks/${t.id}`, { dueDate: today })));
    invalidateWork(qc);
    toast.success(`Moved ${plural(overdue.length, 'task')} to today`);
  };

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={longDate(today)}
        actions={
          <Button onClick={planDay} loading={planning}>
            {!planning && <Sparkles className="size-3.5 text-accent" />}
            {planning ? 'Planning…' : plan ? 'Re-plan my day' : 'Plan my day'}
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-8 px-4 pt-7 pb-24 sm:px-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <h2 className="text-[26px] font-semibold tracking-[-0.025em]">{greeting(me?.name)}</h2>
            <p className="mt-1 text-[14px] text-fg-3">
              {isLoading
                ? ' '
                : total === 0
                  ? 'Nothing scheduled for today. Pick something from a goal, or enjoy the space.'
                  : open.length + overdue.length === 0
                    ? `All ${plural(done.length, 'task')} done for today. Nice work.`
                    : `${plural(open.length + overdue.length, 'task')} left${overdue.length ? `, ${overdue.length} overdue` : ''}. ${done.length ? `${done.length} done so far.` : ''}`}
            </p>

            {planError && (
              <div className="mt-5">
                {planError.setup ? (
                  <AiSetupNotice message={planError.message} />
                ) : (
                  <p className="rounded-lg bg-danger/8 px-3 py-2 text-[13px] text-danger">{planError.message}</p>
                )}
              </div>
            )}
            {plan && <PlanCard plan={plan} onDismiss={dismissPlan} tasks={[...tasks, ...upcoming]} />}

            {isLoading ? (
              <div className="mt-8 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <>
                {overdue.length > 0 && (
                  <section className="mt-8">
                    <SectionTitle
                      right={
                        <button onClick={moveOverdue} className="text-[12.5px] font-medium text-accent hover:underline">
                          Move all to today
                        </button>
                      }
                    >
                      <span className="text-danger">Overdue</span> <span className="font-normal text-fg-3">{overdue.length}</span>
                    </SectionTitle>
                    <div className="-mx-2.5">
                      {overdue.map((t) => (
                        <TaskRow key={t.id} task={t} showGoal />
                      ))}
                    </div>
                  </section>
                )}

                <section className="mt-8">
                  <SectionTitle>
                    Today <span className="font-normal text-fg-3">{open.length || ''}</span>
                  </SectionTitle>
                  <div className="-mx-2.5">
                    {open.map((t) => (
                      <TaskRow key={t.id} task={t} showGoal showDue={false} />
                    ))}
                    <QuickAdd defaultDate={today} placeholder="Add a task for today" />
                  </div>
                  {total === 0 && (
                    <EmptyState
                      icon={Sun}
                      title="A clear day"
                      description="Tasks from your goals appear here on the day they’re due. Anything overdue shows up too."
                      className="py-10"
                    />
                  )}
                </section>

                {done.length > 0 && (
                  <section className="mt-6">
                    <button
                      onClick={() => setShowDone((s) => !s)}
                      className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-2 hover:text-fg"
                    >
                      <ChevronDown className={cn('size-4 transition-transform', !showDone && '-rotate-90')} />
                      Completed <span className="font-normal text-fg-3">{done.length}</span>
                    </button>
                    {showDone && (
                      <div className="-mx-2.5 mt-1 animate-fade-in">
                        {done.map((t) => (
                          <TaskRow key={t.id} task={t} showGoal showDue={false} />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          <aside className="space-y-4 xl:pt-2">
            <ProgressCard done={done.length} total={total} />
            <JournalCard />
            <UpcomingCard tasks={upcoming} />
          </aside>
        </div>
      </div>
    </>
  );
}

function PlanCard({ plan, onDismiss, tasks }) {
  const openTask = useOpenTask();
  return (
    <div className="mt-6 animate-pop-in overflow-hidden rounded-2xl border border-accent/25 bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))]">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Suggested focus</p>
          <p className="mt-0.5 text-[13px] text-fg-2">{plan.summary}</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss plan"
          className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 space-y-px px-2 pb-2">
        {plan.focus.map((f, i) => {
          const live = tasks.find((t) => t.id === f.taskId);
          const done = !!live?.completedAt;
          return (
            <li key={f.taskId}>
              <button
                onClick={() => openTask(f.taskId)}
                className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface/70"
              >
                <span
                  className={cn(
                    'mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                    done && 'opacity-40',
                  )}
                  style={{ background: goalColor(f.goal?.color) }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13.5px] font-medium', done && 'text-fg-3 line-through')}>{f.title}</span>
                  <span className="block text-[12.5px] text-fg-3">{f.reason}</span>
                </span>
                {f.dueDate && <DueChip date={f.dueDate} done={done} />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ProgressCard({ done, total }) {
  const { data: insights } = useInsights();
  const pct = total ? done / total : 0;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <ProgressRing value={pct} size={56} stroke={5}>
          <span className="text-[13px] font-semibold tabular-nums">{total ? Math.round(pct * 100) : 0}%</span>
        </ProgressRing>
        <div>
          <p className="text-[13.5px] font-semibold tabular-nums">
            {done} of {total} done
          </p>
          <p className="text-[12.5px] text-fg-3">today</p>
        </div>
      </div>
      {insights && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[12px]">
          <div>
            <p className="flex items-center gap-1 text-fg-3">
              <Flame className="size-3.5" /> Streak
            </p>
            <p className="text-[15px] font-semibold tabular-nums">{plural(insights.streak.current, 'day')}</p>
          </div>
          <div>
            <p className="text-fg-3">Last 30 days</p>
            <p className="text-[15px] font-semibold tabular-nums">{plural(insights.totals.done30, 'task')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function JournalCard() {
  const today = todayKey();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: entries } = usePages({ kind: 'journal', from: today, to: today });
  const entry = entries?.[0];
  const [busy, setBusy] = useState(false);

  const ensureEntry = async () => entry ?? (await api.post('/pages/daily', { date: today }));

  const setMood = async (mood) => {
    setBusy(true);
    try {
      const page = await ensureEntry();
      await api.patch(`/pages/${page.id}`, { mood: page.mood === mood ? null : mood });
      invalidatePages(qc);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const openEntry = async () => {
    const page = await ensureEntry();
    invalidatePages(qc);
    navigate(`/app/journal/${page.id}`);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <NotebookPen className="size-4 text-fg-3" /> How’s today going?
      </div>
      <div className={cn('mt-3 grid grid-cols-5 gap-1', busy && 'pointer-events-none opacity-60')}>
        {MOODS.map((m) => {
          const active = entry?.mood === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg py-2 text-[11px] text-fg-3 transition-colors hover:bg-surface-3',
                active && 'bg-surface-3 font-medium text-fg',
              )}
            >
              <span
                className="size-3.5 rounded-full transition-transform"
                style={{
                  background: m.color,
                  opacity: active || !entry?.mood ? 1 : 0.35,
                  transform: active ? 'scale(1.25)' : undefined,
                }}
              />
              {m.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={openEntry}
        className="mt-3 flex w-full items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-left text-[12.5px] hover:bg-surface-3"
      >
        <span className="min-w-0">
          <span className="block font-medium">{entry ? entry.title || 'Today’s entry' : 'Write today’s entry'}</span>
          <span className="block truncate text-fg-3">{entry?.excerpt || 'A few lines is enough.'}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-fg-3" />
      </button>
    </div>
  );
}

function UpcomingCard({ tasks }) {
  const openTask = useOpenTask();
  const { openNewGoal } = useUi();
  const byDay = new Map();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    if (!byDay.has(t.dueDate)) byDay.set(t.dueDate, []);
    byDay.get(t.dueDate).push(t);
  }
  const days = [...byDay.entries()].slice(0, 4);
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <CalendarClock className="size-4 text-fg-3" /> Coming up
        </span>
        <Link to="/app/calendar" className="text-[12px] text-fg-3 hover:text-accent">
          Calendar
        </Link>
      </div>
      {days.length === 0 ? (
        <div className="py-3 text-[12.5px] text-fg-3">
          Nothing in the next 7 days.{' '}
          <button onClick={() => openNewGoal('ai')} className="font-medium text-accent hover:underline">
            Plan a goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(([day, list]) => (
            <div key={day}>
              <p className="mb-1 text-[11.5px] font-medium text-fg-3">
                {dueLabel(day)} <span className="font-normal">· {format(fromKey(day), 'd MMM')}</span>
              </p>
              {list.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTask(t.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[12.5px] hover:bg-surface-3"
                >
                  <GoalDot color={t.goal?.color} size={7} />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
              {list.length > 4 && <p className="px-1 text-[11.5px] text-fg-3">+{list.length - 4} more</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
