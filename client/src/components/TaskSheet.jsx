import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Flag,
  Gauge,
  Inbox,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError, errorMessage } from '@/lib/api';
import { dueLabel, todayKey } from '@/lib/dates';
import {
  invalidatePages,
  invalidateWork,
  useCreateTask,
  useDeleteTask,
  useGoals,
  usePage,
  useTask,
  useToggleTask,
  useUpdateTask,
} from '@/lib/queries';
import { cn, formatMinutes, goalColor, priorityMeta } from '@/lib/utils';
import { AiSetupNotice, ChatPanel } from './Chat';
import { LazyEditor } from './editor/LazyEditor';
import { DatePicker, GoalPicker, PriorityPicker } from './Pickers';
import { Button } from './ui/Button';
import { CheckCircle } from './ui/Checkbox';
import { Segmented, Textarea } from './ui/Controls';
import { EmptyState, GoalDot, Spinner } from './ui/misc';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Sheet } from './ui/Overlay';

export function TaskSheet() {
  const [params, setParams] = useSearchParams();
  const id = params.get('task');
  const { data: task, error } = useTask(id);
  const close = () =>
    setParams((p) => {
      p.delete('task');
      p.delete('tab');
      return p;
    });

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && close()} title={task?.title ?? 'Task'}>
      {task ? (
        <TaskDetailView key={task.id} task={task} onClose={close} />
      ) : error ? (
        <div className="p-6">
          <EmptyState
            icon={X}
            title="Task not found"
            description="It may have been deleted."
            action={<Button onClick={close}>Close</Button>}
          />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center text-fg-3">
          <Spinner />
        </div>
      )}
    </Sheet>
  );
}

function PropRow({ icon: Icon, label, children }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <div className="flex w-[108px] shrink-0 items-center gap-2 text-[12.5px] text-fg-3">
        <Icon className="size-[15px]" />
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const propButton = 'inline-flex h-7 max-w-full items-center gap-1.5 truncate rounded-md px-2 text-[13px] hover:bg-surface-3';

function TaskDetailView({ task, onClose }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'steps';
  const setTab = (t) =>
    setParams(
      (p) => {
        p.set('tab', t);
        return p;
      },
      { replace: true },
    );

  const update = useUpdateTask();
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const { data: goals = [] } = useGoals('active');
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const done = !!task.completedAt;
  const color = goalColor(task.goal?.color);
  const today = todayKey();
  const overdue = !done && task.dueDate && task.dueDate < today;

  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) update.mutate({ id: task.id, title: t });
  };
  const saveDescription = () => {
    if (description !== task.description) update.mutate({ id: task.id, description });
  };

  const goal = task.goal ?? null;
  const estimates = [15, 30, 45, 60, 90, 120, 180];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        {goal ? (
          <Link
            to={`/app/goals/${goal.id}`}
            onClick={onClose}
            className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[13px] text-fg-2 hover:bg-surface-3"
          >
            <GoalDot color={goal.color} size={9} />
            <span className="truncate">{goal.title}</span>
          </Link>
        ) : (
          <span className="flex items-center gap-2 px-2 text-[13px] text-fg-2">
            <Inbox className="size-4" /> Inbox
          </span>
        )}
        <div className="flex-1" />
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More">
              <MoreHorizontal className="size-4" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {task.pageId && (
              <MenuItem icon={ExternalLink} asChild>
                <Link to={`/app/journal/${task.pageId}`} onClick={onClose}>
                  Open notes as a full page
                </Link>
              </MenuItem>
            )}
            <MenuItem icon={Check} onSelect={() => toggle(task)}>
              {done ? 'Mark as not done' : 'Mark as done'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={Trash2}
              danger
              onSelect={() => {
                remove.mutate(task);
                onClose();
              }}
            >
              Delete task
            </MenuItem>
          </MenuContent>
        </Menu>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className={cn('min-h-0 flex-1', tab === 'coach' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto')}>
        <div className="px-5 pt-5 sm:px-7">
          {/* Title */}
          <div className="flex items-start gap-3">
            <CheckCircle
              checked={done}
              onToggle={() => toggle(task)}
              color={color}
              size={22}
              label="Complete task"
              className="mt-[5px]"
            />
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
              aria-label="Task title"
              className={cn(
                'border-0 bg-transparent p-0 text-[21px] leading-[30px] font-semibold tracking-[-0.015em] shadow-none focus:ring-0 dark:bg-transparent',
                done && 'text-fg-3 line-through',
              )}
            />
          </div>

          {/* Details are hidden on the Coach tab so the conversation gets the full height. */}
          {tab !== 'coach' && (
            <>
              {/* Properties */}
              <div className="mt-4 space-y-0.5">
                <PropRow icon={CalendarDays} label="Due">
                  <DatePicker value={task.dueDate} onChange={(dueDate) => update.mutate({ id: task.id, dueDate })}>
                    <button className={cn(propButton, overdue && 'text-danger', !task.dueDate && 'text-fg-3')}>
                      {task.dueDate ? `${dueLabel(task.dueDate)}${overdue ? ' · overdue' : ''}` : 'No date'}
                    </button>
                  </DatePicker>
                </PropRow>
                <PropRow icon={Flag} label="Priority">
                  <PriorityPicker value={task.priority} onChange={(priority) => update.mutate({ id: task.id, priority })}>
                    <button className={cn(propButton, task.priority === 'none' && 'text-fg-3')}>
                      {task.priority !== 'none' && (
                        <Flag className="size-3.5" fill="currentColor" style={{ color: priorityMeta(task.priority).color }} />
                      )}
                      {task.priority === 'none' ? 'None' : priorityMeta(task.priority).label}
                    </button>
                  </PriorityPicker>
                </PropRow>
                <PropRow icon={Gauge} label="Difficulty">
                  <Segmented
                    size="sm"
                    value={task.difficulty ?? 'none'}
                    onChange={(v) => update.mutate({ id: task.id, difficulty: v === 'none' ? null : v })}
                    options={[
                      { value: 'easy', label: 'Easy' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'hard', label: 'Hard' },
                    ]}
                  />
                </PropRow>
                <PropRow icon={Timer} label="Estimate">
                  <Menu>
                    <MenuTrigger asChild>
                      <button className={cn(propButton, !task.estimateMinutes && 'text-fg-3')}>
                        {task.estimateMinutes ? formatMinutes(task.estimateMinutes) : 'None'}
                      </button>
                    </MenuTrigger>
                    <MenuContent align="start" className="min-w-[140px]">
                      {estimates.map((m) => (
                        <MenuItem
                          key={m}
                          onSelect={() => update.mutate({ id: task.id, estimateMinutes: m })}
                          shortcut={task.estimateMinutes === m ? '✓' : undefined}
                        >
                          {formatMinutes(m)}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem onSelect={() => update.mutate({ id: task.id, estimateMinutes: null })}>No estimate</MenuItem>
                    </MenuContent>
                  </Menu>
                </PropRow>
                {!task.parentId && (
                  <PropRow icon={Target} label="Goal">
                    <GoalPicker value={task.goalId} onChange={(goalId) => update.mutate({ id: task.id, goalId })}>
                      <button className={propButton}>
                        {goal ? <GoalDot color={goal.color} size={8} /> : <Inbox className="size-3.5 text-fg-3" />}
                        <span className="truncate">
                          {goals.find((g) => g.id === task.goalId)?.title ?? goal?.title ?? 'Inbox'}
                        </span>
                      </button>
                    </GoalPicker>
                  </PropRow>
                )}
              </div>

              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                placeholder="Add details, links or what “done” looks like…"
                rows={2}
                aria-label="Task details"
                className="mt-3 border-transparent bg-surface-2 text-[13.5px] shadow-none focus:bg-surface dark:bg-surface-2"
              />
            </>
          )}
        </div>

        {/* Tabs */}
        <div
          className={cn(
            'sticky top-0 z-10 shrink-0 border-b border-line bg-surface/90 px-5 backdrop-blur sm:px-7',
            tab === 'coach' ? 'mt-3' : 'mt-5',
          )}
        >
          <div className="flex gap-5">
            {[
              ['steps', 'Steps', ListChecks, task.subtaskCount ? `${task.subtaskDone}/${task.subtaskCount}` : ''],
              ['notes', 'Notes', FileText, ''],
              ['coach', 'Coach', MessageSquare, task.messageCount ? String(Math.ceil(task.messageCount / 2)) : ''],
            ].map(([key, label, Icon, badge]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  '-mb-px flex h-10 items-center gap-1.5 border-b-2 text-[13px] font-medium transition-colors',
                  tab === key ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg-2',
                )}
              >
                <Icon className="size-4" />
                {label}
                {badge && <span className="text-[11.5px] text-fg-3 tabular-nums">{badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {tab === 'steps' && <StepsTab task={task} />}
        {tab === 'notes' && <NotesTab task={task} onNavigate={onClose} />}
        {tab === 'coach' && (
          <ChatPanel
            thread={`task:${task.id}`}
            className="min-h-0 flex-1"
            intro="Ask about this task. The coach already knows the goal, the task, its steps and your notes."
            suggestions={[
              'How should I start this?',
              'Explain the key idea simply',
              'Give me a practice exercise',
              'Recommend free resources',
            ]}
            onMessagesChange={() => invalidateWork()}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Steps ------------------------------- */

function StepsTab({ task }) {
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const create = useCreateTask();
  const qc = useQueryClient();
  const [newStep, setNewStep] = useState('');
  const [suggest, setSuggest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const color = goalColor(task.goal?.color);

  const breakdown = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await api.post('/ai/breakdown', { taskId: task.id });
      setSuggest({ ...res, picked: res.steps.map(() => true) });
    } catch (e) {
      setAiError({ setup: e instanceof ApiError && e.isAiSetup, message: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  const addPicked = async () => {
    if (!suggest) return;
    const titles = suggest.steps.filter((_, i) => suggest.picked[i]);
    if (!titles.length) return setSuggest(null);
    try {
      await api.post(`/tasks/${task.id}/subtasks`, { titles });
      invalidateWork(qc);
      setSuggest(null);
      toast.success(`Added ${titles.length} steps`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="px-5 py-3 sm:px-7">
      <div className="space-y-px">
        {task.subtasks.map((s) => (
          <StepRow
            key={s.id}
            step={s}
            color={color}
            onToggle={() => toggle(s)}
            onRename={(title) => update.mutate({ id: s.id, title })}
          />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newStep.trim()) return;
          create.mutate({ title: newStep.trim(), parentId: task.id });
          setNewStep('');
        }}
        className="flex h-9 items-center gap-3 rounded-md px-1.5"
      >
        <Plus className="size-4 text-fg-3" />
        <input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          placeholder="Add a step"
          aria-label="Add a step"
          className="h-full flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-3"
        />
      </form>

      <div className="mt-3">
        {suggest ? (
          <div className="animate-pop-in rounded-xl border border-line bg-surface-2 p-3">
            <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium">
              <Sparkles className="size-3.5 text-accent" /> Suggested steps
            </div>
            <div className="space-y-1">
              {suggest.steps.map((s, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 text-[13.5px] hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    checked={suggest.picked[i]}
                    onChange={() => setSuggest({ ...suggest, picked: suggest.picked.map((p, j) => (j === i ? !p : p)) })}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
            {suggest.tip && <p className="mt-2 border-t border-line pt-2 text-[12.5px] text-fg-3">Tip: {suggest.tip}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSuggest(null)}>
                Dismiss
              </Button>
              <Button size="sm" variant="primary" onClick={addPicked}>
                Add {suggest.picked.filter(Boolean).length} steps
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={breakdown} loading={loading}>
            {!loading && <Sparkles className="size-3.5 text-accent" />}
            {loading ? 'Thinking…' : task.subtaskCount ? 'Suggest more steps' : 'Break down with AI'}
          </Button>
        )}
        {aiError && (
          <div className="mt-3">
            {aiError.setup ? (
              <AiSetupNotice compact message={aiError.message} />
            ) : (
              <p className="text-[12.5px] text-danger">{aiError.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepRow({ step, color, onToggle, onRename }) {
  const [value, setValue] = useState(step.title);
  const remove = useDeleteTask();
  useEffect(() => setValue(step.title), [step.title]);
  return (
    <div className="group flex h-9 items-center gap-3 rounded-md px-1.5 hover:bg-surface-2">
      <CheckCircle checked={!!step.completedAt} onToggle={onToggle} color={color} size={16} label={`Complete ${step.title}`} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const v = value.trim();
          if (!v) setValue(step.title);
          else if (v !== step.title) onRename(v);
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        aria-label="Step title"
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none',
          step.completedAt && 'text-fg-3 line-through',
        )}
      />
      <button
        aria-label="Delete step"
        onClick={() => remove.mutate(step)}
        className="grid size-6 place-items-center rounded text-fg-3 opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-danger"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------- Notes ------------------------------- */

function NotesTab({ task, onNavigate }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('saved');
  const { data: page, isLoading } = usePage(task.pageId ?? undefined);

  const create = async () => {
    setCreating(true);
    try {
      const p = await api.post(`/tasks/${task.id}/page`);
      qc.setQueryData(['page', p.id], p);
      invalidateWork(qc);
      invalidatePages(qc);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  if (!task.pageId) {
    return (
      <EmptyState
        icon={FileText}
        title="A page for this task"
        description="Keep notes, code snippets, links and what you learned. It also shows up in your Journal and the coach can read it."
        action={
          <Button variant="primary" onClick={create} loading={creating}>
            Start notes
          </Button>
        }
      />
    );
  }
  if (isLoading || !page) {
    return (
      <div className="grid place-items-center py-10 text-fg-3">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="pt-2 pb-10">
      <div className="flex items-center justify-between px-5 pb-2 text-[12px] text-fg-3 sm:px-7">
        <span>
          {status === 'saving'
            ? 'Saving…'
            : status === 'unsaved'
              ? 'Edited'
              : status === 'error'
                ? 'Couldn’t save — retrying on next edit'
                : 'Saved'}
        </span>
        <Link to={`/app/journal/${page.id}`} onClick={onNavigate} className="inline-flex items-center gap-1 hover:text-fg">
          Open full page <ExternalLink className="size-3" />
        </Link>
      </div>
      {/* Left padding leaves room for the editor's drag handles. */}
      <div className="pr-5 pl-10 sm:pr-7 sm:pl-12">
        <LazyEditor key={page.id} page={page} onStatus={setStatus} />
      </div>
    </div>
  );
}
