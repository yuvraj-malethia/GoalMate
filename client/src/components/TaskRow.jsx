import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  CalendarDays,
  CalendarX2,
  FileText,
  Flag,
  Inbox,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sun,
  Sunrise,
  Trash2,
} from 'lucide-react';

import { addDays, diffDays, dueLabel, todayKey } from '@/lib/dates';
import { useCreateTask, useDeleteTask, useGoals, useToggleTask, useUpdateTask } from '@/lib/queries';
import { cn, goalColor, priorityMeta } from '@/lib/utils';
import { DatePicker, GoalPicker } from './Pickers';
import { CheckCircle } from './ui/Checkbox';
import { GoalDot } from './ui/misc';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './ui/Overlay';

/** Opens the task sheet by setting ?task=<id> — so it works from any page and the Back button closes it. */
export function useOpenTask() {
  const [, setParams] = useSearchParams();
  return (id) =>
    setParams((p) => {
      p.set('task', id);
      return p;
    });
}

export function DueChip({ date, done }) {
  const today = todayKey();
  const diff = diffDays(today, date);
  const color = done ? undefined : diff < 0 ? 'var(--danger)' : diff === 0 ? 'var(--accent)' : undefined;
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap tabular-nums"
      style={{ color: color ?? 'var(--fg-3)' }}
    >
      <CalendarDays className="size-3.5" />
      {dueLabel(date, today)}
    </span>
  );
}

export function PriorityFlag({ priority }) {
  if (priority === 'none' || priority === 'low') return null;
  const meta = priorityMeta(priority);
  return (
    <Flag className="size-3.5 shrink-0" style={{ color: meta.color }} fill="currentColor" aria-label={`${meta.label} priority`} />
  );
}

export function TaskRow({ task, color, showGoal = false, showDue = true, className }) {
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const open = useOpenTask();
  const done = !!task.completedAt;
  const goal = 'goal' in task ? task.goal : null;
  const c = goalColor(color ?? goal?.color ?? null);
  const today = todayKey();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) open(task.id);
      }}
      className={cn(
        'group relative flex min-h-[42px] items-start gap-3 rounded-lg px-2.5 py-2.5 outline-none hover:bg-surface-2 focus-visible:bg-surface-2 dark:hover:bg-surface-2/70',
        className,
      )}
    >
      <CheckCircle checked={done} onToggle={() => toggle(task)} color={c} label={`Complete ${task.title}`} className="mt-px" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className={cn('min-w-0 flex-1 text-[14px] leading-[20px]', done && 'text-fg-3 line-through decoration-fg-3/50')}>
            {task.title}
          </span>
        </div>
        {(showGoal ||
          task.subtaskCount > 0 ||
          task.pageId ||
          task.messageCount > 0 ||
          (showDue && task.dueDate) ||
          task.priority === 'high' ||
          task.priority === 'medium') && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-3">
            {showGoal && (
              <span className="inline-flex max-w-[220px] items-center gap-1.5 truncate">
                {goal ? <GoalDot color={goal.color} size={7} /> : <Inbox className="size-3" />}
                <span className="truncate">{goal?.title ?? 'Inbox'}</span>
              </span>
            )}
            {showDue && task.dueDate && <DueChip date={task.dueDate} done={done} />}
            {task.subtaskCount > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ListChecks className="size-3.5" />
                {task.subtaskDone}/{task.subtaskCount}
              </span>
            )}
            {task.pageId && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" /> Notes
              </span>
            )}
            {task.messageCount > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MessageSquare className="size-3.5" /> {Math.ceil(task.messageCount / 2)}
              </span>
            )}
            <PriorityFlag priority={task.priority} />
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2 flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
        <Menu>
          <MenuTrigger asChild>
            <button
              aria-label="Task actions"
              onClick={(e) => e.stopPropagation()}
              className="grid size-7 place-items-center rounded-md bg-surface text-fg-3 shadow-sm ring-1 ring-line hover:text-fg dark:bg-surface-3"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={Sun} onSelect={() => update.mutate({ id: task.id, dueDate: today })}>
              Do today
            </MenuItem>
            <MenuItem icon={Sunrise} onSelect={() => update.mutate({ id: task.id, dueDate: addDays(today, 1) })}>
              Tomorrow
            </MenuItem>
            <MenuItem
              icon={CalendarDays}
              onSelect={() =>
                update.mutate({ id: task.id, dueDate: addDays(task.dueDate && task.dueDate > today ? task.dueDate : today, 7) })
              }
            >
              Push a week
            </MenuItem>
            {task.dueDate && (
              <MenuItem icon={CalendarX2} onSelect={() => update.mutate({ id: task.id, dueDate: null })}>
                Remove date
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={Trash2} danger onSelect={() => remove.mutate(task)}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}

/** Inline "Add a task" row with optional goal and date pickers. */
export function QuickAdd({
  goalId: fixedGoal,
  defaultDate = null,
  placeholder = 'Add a task',
  allowGoalChange = true,
  className,
  autoFocus,
  compact,
}) {
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState(fixedGoal ?? null);
  const [date, setDate] = useState(defaultDate);
  const [focused, setFocused] = useState(false);
  const create = useCreateTask();
  const input = useRef(null);
  const { data: goals = [] } = useGoals('active');
  const goal = goals.find((g) => g.id === goalId);

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    create.mutate({ title: t, goalId, dueDate: date });
    setTitle('');
    input.current?.focus();
  };

  const active = focused || title.length > 0;
  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex min-h-[42px] items-center gap-3 rounded-lg px-2.5 transition-colors',
        active ? 'bg-surface-2 ring-1 ring-line' : 'hover:bg-surface-2',
        className,
      )}
    >
      <Plus className={cn('size-[18px] shrink-0', active ? 'text-accent' : 'text-fg-3')} />
      <input
        ref={input}
        value={title}
        autoFocus={autoFocus}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3"
      />
      <div className="flex items-center gap-1">
        {allowGoalChange && (
          <GoalPicker value={goalId} onChange={setGoalId}>
            <button
              type="button"
              title={goal?.title ?? 'Inbox'}
              className="flex h-7 max-w-[160px] items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2 hover:bg-surface-3"
            >
              {goal ? <GoalDot color={goal.color} size={8} /> : <Inbox className="size-3.5" />}
              {!compact && <span className="truncate">{goal?.title ?? 'Inbox'}</span>}
            </button>
          </GoalPicker>
        )}
        <DatePicker value={date} onChange={setDate} align="end">
          <button
            type="button"
            title={date ? dueLabel(date) : 'Set a date'}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2 hover:bg-surface-3"
          >
            <CalendarDays className="size-3.5" />
            {!compact && (date ? dueLabel(date) : 'Date')}
          </button>
        </DatePicker>
      </div>
    </form>
  );
}
