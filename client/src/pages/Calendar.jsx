import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react';

import { PageHeader } from '@/components/AppShell';
import { QuickAdd, TaskRow, useOpenTask } from '@/components/TaskRow';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { addDays, format, fromKey, longDate, toKey, todayKey, weekStart } from '@/lib/dates';
import { usePages, useTasks, useUpdateTask } from '@/lib/queries';
import { cn, goalColor, moodMeta } from '@/lib/utils';

export function CalendarPage() {
  const today = todayKey();
  const [view, setView] = useState(() => (window.innerWidth < 768 ? 'week' : 'month'));
  const [anchor, setAnchor] = useState(today); // any date inside the visible range
  const [selected, setSelected] = useState(today);
  const update = useUpdateTask();

  const days = useMemo(() => {
    const a = fromKey(anchor);
    if (view === 'week') {
      const ws = weekStart(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(a), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(a), { weekStartsOn: 1 }),
    }).map(toKey);
  }, [anchor, view]);

  const from = days[0];
  const to = days[days.length - 1];
  const { data: tasks = [] } = useTasks({ from, to });
  const { data: entries = [] } = usePages({ kind: 'journal', from, to });

  const byDay = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!m.has(t.dueDate)) m.set(t.dueDate, []);
      m.get(t.dueDate).push(t);
    }
    for (const list of m.values()) list.sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt));
    return m;
  }, [tasks]);
  const entryByDay = useMemo(() => new Map(entries.map((e) => [e.entryDate, e])), [entries]);

  const step = (dir) => {
    const next = view === 'month' ? toKey(addMonths(fromKey(anchor), dir)) : addDays(anchor, 7 * dir);
    setAnchor(next);
  };
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const onDrop = (date, e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task-id');
    const task = tasks.find((t) => t.id === id);
    if (task && task.dueDate !== date) update.mutate({ id, dueDate: date });
  };

  const title =
    view === 'month'
      ? format(fromKey(anchor), 'MMMM yyyy')
      : `${format(fromKey(days[0]), 'd MMM')} – ${format(fromKey(days[6]), 'd MMM yyyy')}`;

  const selectedTasks = byDay.get(selected) ?? [];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={<span className="hidden sm:inline">Drag a task to another day to reschedule it</span>}
        actions={
          <>
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
              ]}
            />
            <div className="ml-1 flex items-center">
              <Button size="icon-sm" variant="ghost" aria-label="Previous" onClick={() => step(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" onClick={goToday}>
                Today
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Next" onClick={() => step(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
        <div className="min-w-0 flex-1 xl:overflow-y-auto">
          {view === 'month' ? (
            <MonthGrid
              days={days}
              anchor={anchor}
              today={today}
              selected={selected}
              onSelect={setSelected}
              byDay={byDay}
              entryByDay={entryByDay}
              onDrop={onDrop}
            />
          ) : (
            <WeekColumns
              days={days}
              today={today}
              byDay={byDay}
              entryByDay={entryByDay}
              onDrop={onDrop}
              onSelect={setSelected}
              selected={selected}
            />
          )}
        </div>
        {view === 'month' && (
          <aside className="border-t border-line xl:w-[340px] xl:shrink-0 xl:overflow-y-auto xl:border-t-0 xl:border-l">
            <div className="p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">{longDate(selected)}</h2>
              <p className="text-[12.5px] text-fg-3">
                {selectedTasks.length
                  ? `${selectedTasks.filter((t) => !t.completedAt).length} open · ${selectedTasks.filter((t) => t.completedAt).length} done`
                  : 'Nothing scheduled'}
              </p>
              <DayEntryLink entry={entryByDay.get(selected)} />
              <div className="-mx-2.5 mt-3">
                {selectedTasks.map((t) => (
                  <TaskRow key={t.id} task={t} showGoal showDue={false} />
                ))}
                <QuickAdd key={selected} defaultDate={selected} placeholder="Add a task on this day" compact />
              </div>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

function DayEntryLink({ entry }) {
  const navigate = useNavigate();
  if (!entry) return null;
  const mood = moodMeta(entry.mood);
  return (
    <button
      onClick={() => navigate(`/app/journal/${entry.id}`)}
      className="mt-3 flex w-full items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2 text-left hover:bg-surface-3"
    >
      <NotebookPen className="size-4 shrink-0 text-fg-3" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">{entry.title || 'Journal entry'}</span>
        <span className="block truncate text-[12px] text-fg-3">{entry.excerpt}</span>
      </span>
      {mood && <span className="size-2.5 shrink-0 rounded-full" style={{ background: mood.color }} title={mood.label} />}
    </button>
  );
}

function TaskChip({ task }) {
  const open = useOpenTask();
  const done = !!task.completedAt;
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        e.stopPropagation();
        open(task.id);
      }}
      title={task.title}
      className={cn(
        'flex w-full cursor-grab items-center gap-1.5 rounded-[5px] px-1.5 py-[3px] text-left text-[11.5px] leading-tight active:cursor-grabbing',
        done ? 'text-fg-3 line-through' : 'text-fg',
      )}
      style={{ background: `color-mix(in srgb, ${goalColor(task.goal?.color)} ${done ? 6 : 13}%, transparent)` }}
    >
      <span
        className="h-3 w-[3px] shrink-0 rounded-full"
        style={{ background: goalColor(task.goal?.color), opacity: done ? 0.4 : 1 }}
      />
      <span className="truncate">{task.title}</span>
    </button>
  );
}

function useDropTarget(onDrop) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        onDrop(e);
      },
    },
  };
}

function MonthCell({ date, inMonth, isToday, isSelected, tasks, entry, onSelect, onDrop }) {
  const drop = useDropTarget(onDrop);
  const mood = moodMeta(entry?.mood);
  const shown = tasks.slice(0, 3);
  return (
    <div
      {...drop.props}
      onClick={onSelect}
      className={cn(
        'relative flex min-h-[64px] cursor-default flex-col gap-1 border-r border-b border-line p-1 transition-colors sm:min-h-[118px] sm:p-1.5',
        !inMonth && 'bg-surface-2/60 dark:bg-black/10',
        isSelected && 'bg-accent/[0.06]',
        drop.over && 'bg-accent/10 ring-2 ring-accent ring-inset',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'grid size-6 place-items-center rounded-full text-[12px] tabular-nums',
            isToday ? 'bg-accent font-semibold text-white' : inMonth ? 'text-fg-2' : 'text-fg-3/60',
          )}
        >
          {fromKey(date).getDate()}
        </span>
        {entry && (
          <span title={`Journal${mood ? ` · ${mood.label}` : ''}`} className="flex items-center gap-1 text-fg-3">
            <NotebookPen className="size-3" />
            {mood && <span className="size-1.5 rounded-full" style={{ background: mood.color }} />}
          </span>
        )}
      </div>
      {/* Phones: dots only */}
      <div className="flex flex-wrap gap-0.5 px-1 sm:hidden">
        {tasks.slice(0, 4).map((t) => (
          <span
            key={t.id}
            className="size-1.5 rounded-full"
            style={{ background: goalColor(t.goal?.color), opacity: t.completedAt ? 0.35 : 1 }}
          />
        ))}
      </div>
      <div className="hidden space-y-0.5 sm:block">
        {shown.map((t) => (
          <TaskChip key={t.id} task={t} />
        ))}
        {tasks.length > 3 && <p className="px-1.5 text-[11px] text-fg-3">+{tasks.length - 3} more</p>}
      </div>
    </div>
  );
}

function MonthGrid({ days, anchor, today, selected, onSelect, byDay, entryByDay, onDrop }) {
  const month = fromKey(anchor);
  return (
    <div>
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-line bg-surface/90 backdrop-blur">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-2 text-[11.5px] font-medium text-fg-3">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-line">
        {days.map((d) => (
          <MonthCell
            key={d}
            date={d}
            inMonth={isSameMonth(fromKey(d), month)}
            isToday={d === today}
            isSelected={d === selected}
            tasks={byDay.get(d) ?? []}
            entry={entryByDay.get(d)}
            onSelect={() => onSelect(d)}
            onDrop={(e) => onDrop(d, e)}
          />
        ))}
      </div>
    </div>
  );
}

function WeekColumn({ date, today, tasks, entry, onDrop, onSelect, selected }) {
  const drop = useDropTarget(onDrop);
  const isToday = date === today;
  return (
    <div
      {...drop.props}
      onClick={onSelect}
      className={cn(
        'flex min-h-[180px] flex-col border-b border-line p-3 lg:min-h-[calc(100dvh-120px)] lg:border-r lg:border-b-0',
        drop.over && 'bg-accent/10',
        selected && 'lg:bg-accent/[0.03]',
      )}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className={cn('text-[12px] font-medium', isToday ? 'text-accent' : 'text-fg-3')}>
          {format(fromKey(date), 'EEE')}
        </span>
        <span className={cn('text-[20px] font-semibold tabular-nums', isToday && 'text-accent')}>{fromKey(date).getDate()}</span>
      </div>
      <DayEntryLink entry={entry} />
      <div className="mt-1 space-y-1">
        {tasks.map((t) => (
          <TaskChip key={t.id} task={t} />
        ))}
      </div>
      {selected && (
        <div className="-mx-2 mt-2 lg:hidden">
          <QuickAdd defaultDate={date} placeholder="Add a task" compact />
        </div>
      )}
    </div>
  );
}

function WeekColumns({ days, today, byDay, entryByDay, onDrop, onSelect, selected }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-7">
      {days.map((d) => (
        <WeekColumn
          key={d}
          date={d}
          today={today}
          tasks={byDay.get(d) ?? []}
          entry={entryByDay.get(d)}
          onDrop={(e) => onDrop(d, e)}
          onSelect={() => onSelect(d)}
          selected={d === selected}
        />
      ))}
    </div>
  );
}
