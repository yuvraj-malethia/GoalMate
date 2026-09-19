import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronRight, RotateCcw, Sparkles, Timer, X } from 'lucide-react';
import { toast } from 'sonner';
import { GOAL_COLORS } from '@shared/types';
import { api, ApiError, errorMessage } from '@/lib/api';
import { addDays, diffDays, format, fromKey, shortDate, todayKey, weekStart } from '@/lib/dates';
import { invalidateWork } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { cn, formatMinutes, goalColor, PRIORITIES } from '@/lib/utils';
import { AiSetupNotice } from './Chat';
import { DatePicker } from './Pickers';
import { Button } from './ui/Button';
import { Field, Input, Segmented, Textarea } from './ui/Controls';
import { Chip } from './ui/misc';
import { Modal } from './ui/Overlay';

const EXAMPLES = [
  'Prepare for DSA interviews for placements',
  'Learn conversational Spanish',
  'Run my first 10K',
  'Learn React and build a portfolio project',
];

export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Goal colour">
      {GOAL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            'size-6 rounded-full transition-transform hover:scale-110',
            value === c && 'ring-2 ring-offset-2 ring-offset-surface',
          )}
          style={{ background: goalColor(c), ['--tw-ring-color']: goalColor(c) }}
        />
      ))}
    </div>
  );
}

export function NewGoalDialog() {
  const { newGoalOpen, closeNewGoal, aiPrefill } = useUi();
  const [mode, setMode] = useState('ai');
  useEffect(() => {
    if (newGoalOpen) setMode(newGoalOpen);
  }, [newGoalOpen]);

  return (
    <Modal open={!!newGoalOpen} onOpenChange={(o) => !o && closeNewGoal()} title="New goal" className="max-w-[640px]" hideHeader>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'ai',
              label: (
                <>
                  <Sparkles className="size-3.5" /> Plan with AI
                </>
              ),
            },
            { value: 'manual', label: 'Write it myself' },
          ]}
        />
        <button
          onClick={closeNewGoal}
          aria-label="Close"
          className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
      {mode === 'manual' ? <ManualForm onDone={closeNewGoal} /> : <AiPlanner onDone={closeNewGoal} prefill={aiPrefill} />}
    </Modal>
  );
}

/* ------------------------------ manual ------------------------------ */

function ManualForm({ onDone }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [priority, setPriority] = useState('medium');
  const [targetDate, setTargetDate] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const goal = await api.post('/goals', {
        title: title.trim(),
        description,
        color,
        priority,
        startDate: todayKey(),
        targetDate,
      });
      invalidateWork(qc);
      onDone();
      navigate(`/app/goals/${goal.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5">
      <Field label="Goal">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finish the capstone report" />
      </Field>
      <Field label="Why it matters (optional)">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What does done look like?"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority">
          <Segmented
            value={priority}
            onChange={setPriority}
            className="w-full"
            options={PRIORITIES.filter((p) => p.value !== 'none').map((p) => ({ value: p.value, label: p.label }))}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">Target date</span>
          <DatePicker value={targetDate} onChange={setTargetDate}>
            <Button className="w-full justify-start font-normal">
              <CalendarDays className="size-4 text-fg-3" />
              {targetDate ? format(fromKey(targetDate), 'EEE d MMM yyyy') : 'No target date'}
            </Button>
          </DatePicker>
        </div>
      </div>
      <div>
        <span className="mb-2 block text-[12.5px] font-medium text-fg-2">Colour</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!title.trim()}>
          Create goal
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------- AI -------------------------------- */

const LOADING_LINES = [
  'Reading your goal…',
  'Working out a sensible pace…',
  'Splitting it into sessions…',
  'Adding checkpoints and a final milestone…',
  'Putting dates on everything…',
];

function AiPlanner({ onDone, prefill }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    goal: prefill,
    level: 'beginner',
    weeks: 4,
    hoursPerWeek: 5,
    startDate: todayKey(),
    context: '',
  });
  const [loading, setLoading] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!loading) return;
    setLine(0);
    const t = setInterval(() => setLine((l) => Math.min(l + 1, LOADING_LINES.length - 1)), 2200);
    return () => clearInterval(t);
  }, [loading]);

  const generate = async () => {
    if (form.goal.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.post('/ai/roadmap', { ...form, context: form.context || undefined });
      setDraft(d);
    } catch (e) {
      setError({ setup: e instanceof ApiError && e.isAiSetup, message: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  if (draft) {
    return (
      <RoadmapReview
        draft={draft}
        setDraft={setDraft}
        form={form}
        onBack={() => setDraft(null)}
        onRegenerate={generate}
        regenerating={loading}
        onCreate={async () => {
          try {
            const goal = await api.post('/goals', {
              title: draft.title,
              description: draft.description,
              color: draft.color,
              tags: draft.tags,
              priority: 'medium',
              startDate: form.startDate,
              targetDate: addDays(form.startDate, form.weeks * 7 - 1),
              aiGenerated: true,
              tasks: draft.tasks.map((t) => ({
                title: t.title,
                description: t.description,
                dueDate: t.dueDate,
                difficulty: t.difficulty,
                estimateMinutes: t.estimateMinutes,
                subtasks: t.subtasks,
              })),
            });
            invalidateWork(qc);
            onDone();
            toast.success(`Created “${goal.title}” with ${draft.tasks.length} tasks`);
            navigate(`/app/goals/${goal.id}`);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <div className="relative mb-5 grid size-12 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/15" />
          <span className="relative grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="size-5" />
          </span>
        </div>
        <p key={line} className="animate-fade-in text-[14px] font-medium">
          {LOADING_LINES[line]}
        </p>
        <p className="mt-1 text-[12.5px] text-fg-3">
          Building a {form.weeks}-week plan for “{form.goal.trim()}”. This usually takes 5–20 seconds.
        </p>
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        generate();
      }}
      className="space-y-4 overflow-y-auto p-5"
    >
      <Field label="What do you want to achieve?">
        <Textarea
          autoFocus
          value={form.goal}
          onChange={(e) => set('goal', e.target.value)}
          rows={2}
          placeholder="Be specific: “Clear the Amazon OA — arrays, graphs and DP” works better than “DSA”."
        />
      </Field>
      {!form.goal && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => set('goal', ex)}
              className="rounded-full border border-line-strong px-2.5 py-1 text-[12px] text-fg-2 hover:border-accent/50 hover:text-fg"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <Field label="Where are you starting from?">
        <Segmented
          value={form.level}
          onChange={(v) => set('level', v)}
          className="w-full"
          options={[
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Some experience' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Length"
          value={form.weeks}
          min={1}
          max={12}
          format={(v) => `${v} week${v === 1 ? '' : 's'}`}
          onChange={(v) => set('weeks', v)}
        />
        <Slider
          label="Time per week"
          value={form.hoursPerWeek}
          min={1}
          max={20}
          format={(v) => `${v} hour${v === 1 ? '' : 's'}`}
          onChange={(v) => set('hoursPerWeek', v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">Start</span>
          <DatePicker value={form.startDate} onChange={(v) => set('startDate', v ?? todayKey())}>
            <Button className="w-full justify-start font-normal">
              <CalendarDays className="size-4 text-fg-3" />
              {format(fromKey(form.startDate), 'EEE d MMM')}
              <span className="ml-auto text-[12px] text-fg-3">ends {shortDate(addDays(form.startDate, form.weeks * 7 - 1))}</span>
            </Button>
          </DatePicker>
        </div>
        <Field label="Anything else? (optional)">
          <Input
            value={form.context}
            onChange={(e) => set('context', e.target.value)}
            placeholder="e.g. weekends only, prefer videos"
          />
        </Field>
      </div>

      {error &&
        (error.setup ? (
          <AiSetupNotice message={error.message} />
        ) : (
          <p className="rounded-lg bg-danger/8 px-3 py-2 text-[13px] text-danger">{error.message}</p>
        ))}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-fg-3">You’ll review the plan before anything is saved.</p>
        <Button type="submit" variant="primary" disabled={form.goal.trim().length < 3}>
          <Sparkles className="size-3.5" /> Generate plan
        </Button>
      </div>
    </form>
  );
}

function Slider({ label, value, min, max, format: fmt, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
        {label}
        <span className="text-fg tabular-nums">{fmt(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-[var(--accent)]"
      />
    </label>
  );
}

/* ------------------------------ review ------------------------------ */

function RoadmapReview({ draft, setDraft, form, onBack, onRegenerate, regenerating, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const weeks = useMemo(() => {
    const groups = new Map();
    draft.tasks.forEach((task, index) => {
      const ws = weekStart(task.dueDate);
      if (!groups.has(ws)) groups.set(ws, []);
      groups.get(ws).push({ index, task });
    });
    return [...groups.entries()];
  }, [draft.tasks]);

  const totalMinutes = draft.tasks.reduce((s, t) => s + (t.estimateMinutes || 0), 0);
  const removeTask = (i) => setDraft({ ...draft, tasks: draft.tasks.filter((_, j) => j !== i) });
  const renameTask = (i, title) => setDraft({ ...draft, tasks: draft.tasks.map((t, j) => (j === i ? { ...t, title } : t)) });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start gap-3">
          <span className="mt-2 size-3 shrink-0 rounded-full" style={{ background: goalColor(draft.color) }} />
          <div className="min-w-0 flex-1">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-label="Goal title"
              className="w-full bg-transparent text-[19px] font-semibold tracking-[-0.015em] outline-none"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              aria-label="Goal description"
              rows={2}
              className="mt-0.5 w-full resize-none bg-transparent text-[13px] text-fg-2 outline-none"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
          <Chip>{draft.tasks.length} tasks</Chip>
          <Chip>{form.weeks} weeks</Chip>
          <Chip>
            <Timer className="size-3" /> ~{Math.round(totalMinutes / 60)} h total
          </Chip>
          {draft.tags.map((t) => (
            <Chip key={t}>#{t}</Chip>
          ))}
        </div>
        <div className="mt-3">
          <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        </div>

        <div className="mt-5 space-y-5">
          {weeks.map(([ws, items]) => (
            <div key={ws}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h4 className="text-[12.5px] font-semibold">
                  Week {Math.floor(diffDays(weekStart(form.startDate), ws) / 7) + 1}
                </h4>
                <span className="text-[11.5px] text-fg-3">
                  {shortDate(ws)} – {shortDate(addDays(ws, 6))}
                </span>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {items.map(({ index, task }) => (
                  <div key={index} className="group bg-surface">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        onClick={() => setExpanded(expanded === index ? null : index)}
                        aria-label="Show details"
                        className="grid size-5 place-items-center rounded text-fg-3 hover:bg-surface-3"
                      >
                        {expanded === index ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                      <input
                        value={task.title}
                        onChange={(e) => renameTask(index, e.target.value)}
                        aria-label="Task title"
                        className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
                      />
                      <span className="shrink-0 text-[11.5px] text-fg-3 tabular-nums">
                        {format(fromKey(task.dueDate), 'EEE d')} · {formatMinutes(task.estimateMinutes)}
                      </span>
                      <button
                        onClick={() => removeTask(index)}
                        aria-label="Remove task"
                        className="grid size-6 place-items-center rounded text-fg-3 opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-danger focus:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    {expanded === index && (
                      <div className="animate-fade-in px-10 pb-3 text-[12.5px] text-fg-2">
                        {task.description && <p>{task.description}</p>}
                        {task.subtasks.length > 0 && (
                          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-fg-3">
                            {task.subtasks.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" /> Edit request
        </Button>
        <Button variant="ghost" onClick={onRegenerate} loading={regenerating}>
          {!regenerating && <RotateCcw className="size-3.5" />} Regenerate
        </Button>
        <div className="flex-1" />
        <Button
          variant="primary"
          loading={creating}
          disabled={!draft.tasks.length || !draft.title.trim()}
          onClick={async () => {
            setCreating(true);
            await onCreate();
            setCreating(false);
          }}
        >
          Create goal
        </Button>
      </div>
    </div>
  );
}
