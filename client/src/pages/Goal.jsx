import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Download,
  Eye,
  EyeOff,
  Flag,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/AppShell';
import { ChatPanel } from '@/components/Chat';
import { ColorPicker } from '@/components/NewGoalDialog';
import { DatePicker, PriorityPicker } from '@/components/Pickers';
import { DueChip, QuickAdd, TaskRow, useOpenTask } from '@/components/TaskRow';
import { Button } from '@/components/ui/Button';
import { ProgressBar, ProgressRing, Textarea } from '@/components/ui/Controls';
import { Chip, EmptyState, Skeleton } from '@/components/ui/misc';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetClose,
} from '@/components/ui/Overlay';
import { addDays, diffDays, format, fromKey, shortDate, todayKey, weekStart } from '@/lib/dates';
import { useDeleteGoal, useGoal, useUpdateGoal } from '@/lib/queries';
import { cn, downloadJson, goalColor, plural, priorityMeta } from '@/lib/utils';
import { expectedProgress } from './Goals';

export function GoalPage() {
  const { id } = useParams();
  const { data: goal, isLoading, error } = useGoal(id);

  if (error) {
    return (
      <>
        <PageHeader title="Goal" />
        <EmptyState
          icon={Target}
          title="Goal not found"
          description="It may have been deleted."
          action={
            <Link to="/app/goals" className="text-[13px] font-medium text-accent">
              All goals
            </Link>
          }
        />
      </>
    );
  }
  if (isLoading || !goal) {
    return (
      <>
        <PageHeader title=" " />
        <div className="mx-auto w-full max-w-4xl space-y-4 px-8 pt-10">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-8 h-24" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </>
    );
  }
  return <GoalView key={goal.id} goal={goal} />;
}

function GoalView({ goal }) {
  const navigate = useNavigate();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const openTask = useOpenTask();
  const [coachOpen, setCoachOpen] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  useEffect(() => setTitle(goal.title), [goal.title]);
  useEffect(() => setDescription(goal.description), [goal.description]);

  const today = todayKey();
  const color = goalColor(goal.color);
  const top = goal.tasks.filter((t) => !t.parentId);
  const pct = goal.taskCount ? goal.doneCount / goal.taskCount : 0;
  const expected = expectedProgress(goal);
  const dueByToday = top.filter((t) => t.dueDate && t.dueDate <= today).length;
  const behind = Math.max(0, dueByToday - goal.doneCount);
  const nextTask = top.find((t) => !t.completedAt);

  const groups = useMemo(() => {
    const visible = hideDone ? top.filter((t) => !t.completedAt) : top;
    const base = goal.startDate ? weekStart(goal.startDate) : null;
    const map = new Map();
    const someday = [];
    for (const t of visible) {
      if (!t.dueDate) {
        someday.push(t);
        continue;
      }
      const ws = weekStart(t.dueDate);
      if (!map.has(ws)) {
        const n = base ? Math.floor(diffDays(base, ws) / 7) + 1 : null;
        map.set(ws, {
          key: ws,
          label: n && n > 0 ? `Week ${n}` : `Week of ${shortDate(ws)}`,
          sub: `${format(fromKey(ws), 'd MMM')} – ${format(fromKey(addDays(ws, 6)), 'd MMM')}`,
          current: ws === weekStart(today),
          tasks: [],
        });
      }
      map.get(ws).tasks.push(t);
    }
    const list = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
    if (someday.length) list.push({ key: 'someday', label: 'No date', tasks: someday });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.tasks, hideDone, goal.startDate, today]);

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(goal.title);
    if (t !== goal.title) update.mutate({ id: goal.id, title: t });
  };

  const exportGoal = () =>
    downloadJson({ app: 'goalmate', goal }, `${goal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: color }} />
            {goal.title}
          </span>
        }
        actions={
          <>
            <Button onClick={() => setCoachOpen(true)}>
              <MessageSquare className="size-3.5" /> <span className="hidden sm:inline">Goal coach</span>
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Goal actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                {goal.status === 'active' ? (
                  <MenuItem icon={CircleCheck} onSelect={() => update.mutate({ id: goal.id, status: 'completed' })}>
                    Mark goal as achieved
                  </MenuItem>
                ) : (
                  <MenuItem icon={RotateCcw} onSelect={() => update.mutate({ id: goal.id, status: 'active' })}>
                    Make active again
                  </MenuItem>
                )}
                {goal.status !== 'archived' ? (
                  <MenuItem icon={Archive} onSelect={() => update.mutate({ id: goal.id, status: 'archived' })}>
                    Archive
                  </MenuItem>
                ) : (
                  <MenuItem icon={ArchiveRestore} onSelect={() => update.mutate({ id: goal.id, status: 'active' })}>
                    Unarchive
                  </MenuItem>
                )}
                <MenuItem icon={Download} onSelect={exportGoal}>
                  Export as JSON
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={Trash2}
                  danger
                  onSelect={() => {
                    remove.mutate(goal);
                    navigate('/app/goals');
                  }}
                >
                  Move to Trash
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 pt-8 pb-28 sm:px-8">
          {goal.status !== 'active' && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-[13px] text-fg-2">
              {goal.status === 'completed' ? <CircleCheck className="size-4 text-success" /> : <Archive className="size-4" />}
              {goal.status === 'completed'
                ? `Achieved${goal.completedAt ? ` on ${format(new Date(goal.completedAt), 'd MMM yyyy')}` : ''}.`
                : 'This goal is archived.'}
            </div>
          )}

          {/* Title + description */}
          <div className="flex items-start gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="Change colour"
                  className="mt-2.5 size-4 shrink-0 rounded-full ring-offset-2 ring-offset-surface transition hover:ring-2"
                  style={{ background: color, ['--tw-ring-color']: color }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-[232px] p-3">
                <ColorPicker value={goal.color} onChange={(c) => update.mutate({ id: goal.id, color: c })} />
              </PopoverContent>
            </Popover>
            <div className="min-w-0 flex-1">
              <Textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                  }
                }}
                rows={1}
                aria-label="Goal title"
                className="border-0 bg-transparent p-0 text-[28px] leading-[36px] font-semibold tracking-[-0.025em] shadow-none focus:ring-0 dark:bg-transparent"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => description !== goal.description && update.mutate({ id: goal.id, description })}
                rows={1}
                placeholder="Add a description…"
                aria-label="Goal description"
                className="mt-1 border-0 bg-transparent p-0 text-[14.5px] text-fg-2 shadow-none focus:ring-0 dark:bg-transparent"
              />
            </div>
          </div>

          {/* Properties */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pl-7">
            <PriorityPicker value={goal.priority} onChange={(priority) => update.mutate({ id: goal.id, priority })}>
              <PropButton>
                <Flag
                  className="size-3.5"
                  style={{ color: priorityMeta(goal.priority).color }}
                  fill={goal.priority === 'none' ? 'none' : 'currentColor'}
                />
                {goal.priority === 'none' ? 'No priority' : `${priorityMeta(goal.priority).label} priority`}
              </PropButton>
            </PriorityPicker>
            <DatePicker value={goal.startDate} onChange={(startDate) => update.mutate({ id: goal.id, startDate })}>
              <PropButton>
                <CalendarDays className="size-3.5 text-fg-3" />
                {goal.startDate ? `Started ${shortDate(goal.startDate)}` : 'Set start'}
              </PropButton>
            </DatePicker>
            <DatePicker value={goal.targetDate} onChange={(targetDate) => update.mutate({ id: goal.id, targetDate })}>
              <PropButton>
                <Target className="size-3.5 text-fg-3" />
                {goal.targetDate ? `Target ${shortDate(goal.targetDate)}` : 'Set target date'}
              </PropButton>
            </DatePicker>
            <TagEditor tags={goal.tags} onChange={(tags) => update.mutate({ id: goal.id, tags })} />
            {goal.aiGenerated && (
              <Chip>
                <Sparkles className="size-3" /> Planned with AI
              </Chip>
            )}
          </div>

          {/* Stats */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat>
              <ProgressRing value={pct} size={46} stroke={4.5} color={color}>
                <span className="text-[11.5px] font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
              </ProgressRing>
              <div>
                <p className="text-[13.5px] font-semibold tabular-nums">
                  {goal.doneCount} of {goal.taskCount}
                </p>
                <p className="text-[12px] text-fg-3">tasks done</p>
              </div>
            </Stat>
            <Stat>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[13.5px] font-semibold', behind > 0 ? 'text-warning' : 'text-success')}>
                  {goal.taskCount === 0 ? 'No tasks yet' : behind > 0 ? `${plural(behind, 'task')} behind plan` : 'On track'}
                </p>
                <p className="mt-0.5 text-[12px] text-fg-3">
                  {dueByToday} due by today{expected !== null ? ` · ${Math.round(expected * 100)}% of time used` : ''}
                </p>
                <ProgressBar value={pct} color={color} marker={expected} className="mt-2" />
              </div>
            </Stat>
            <Stat onClick={nextTask ? () => openTask(nextTask.id) : undefined}>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-fg-3">Next up</p>
                <p className="truncate text-[13.5px] font-semibold">{nextTask?.title ?? 'Nothing left'}</p>
                {nextTask?.dueDate && <DueChip date={nextTask.dueDate} />}
              </div>
              {nextTask && <ArrowRight className="size-4 shrink-0 text-fg-3" />}
            </Stat>
          </div>

          {/* Tasks */}
          <div className="mt-9 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Plan</h2>
            <button
              onClick={() => setHideDone((h) => !h)}
              className="flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg"
            >
              {hideDone ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {hideDone ? 'Show completed' : 'Hide completed'}
            </button>
          </div>

          {top.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No tasks yet"
              description="Add the first step below. Small and specific works best."
              className="py-10"
            />
          ) : (
            <div className="mt-3 space-y-6">
              {groups.map((g) => {
                const done = g.tasks.filter((t) => t.completedAt).length;
                return (
                  <section key={g.key}>
                    <div className="mb-1 flex items-baseline gap-2 border-b border-line pb-1.5">
                      <h3 className="text-[13px] font-semibold">{g.label}</h3>
                      {g.sub && <span className="text-[12px] text-fg-3">{g.sub}</span>}
                      {g.current && (
                        <Chip color="var(--accent)" className="h-[18px] text-[10.5px]">
                          This week
                        </Chip>
                      )}
                      <span className="ml-auto text-[12px] text-fg-3 tabular-nums">
                        {done}/{g.tasks.length}
                      </span>
                    </div>
                    <div className="-mx-2.5">
                      {g.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} color={goal.color} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          <QuickAdd
            goalId={goal.id}
            allowGoalChange={false}
            placeholder={`Add a task to “${goal.title}”`}
            className="-mx-2.5 mt-4"
          />
        </div>
      </div>

      <Sheet open={coachOpen} onOpenChange={setCoachOpen} title="Goal coach">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: color }} /> Coach · {goal.title}
          </span>
          <SheetClose asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Close">
              <X className="size-4" />
            </Button>
          </SheetClose>
        </div>
        <ChatPanel
          thread={`goal:${goal.id}`}
          className="flex-1"
          intro="Talk through the whole goal: pacing, what to cut, what to do when you fall behind. The coach can see every task and its status."
          suggestions={[
            'Am I on track?',
            'I’m behind. What should I cut?',
            'Suggest a weekly routine',
            'What should I focus on this week?',
          ]}
        />
      </Sheet>
    </>
  );
}

function Stat({ children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn('card flex items-center gap-3 p-4 text-left', onClick && 'transition-shadow hover:shadow-md')}
    >
      {children}
    </Tag>
  );
}

function PropButton({ children, ...rest }) {
  return (
    <button
      {...rest}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12.5px] text-fg-2 shadow-sm hover:bg-surface-2 dark:bg-surface-2"
    >
      {children}
    </button>
  );
}

function TagEditor({ tags, onChange }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const commit = () => {
    const t = value.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) onChange([...tags, t].slice(0, 8));
    setValue('');
    setAdding(false);
  };
  return (
    <>
      {tags.map((t) => (
        <Chip key={t} className="group pr-1">
          #{t}
          <button
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="grid size-4 place-items-center rounded opacity-50 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </Chip>
      ))}
      {adding ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setAdding(false);
          }}
          placeholder="tag"
          className="h-[22px] w-24 rounded-md border border-line-strong bg-surface px-1.5 text-[12px] outline-none focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="h-[22px] rounded-md px-1.5 text-[12px] text-fg-3 hover:bg-surface-3 hover:text-fg-2"
        >
          + Tag
        </button>
      )}
    </>
  );
}
