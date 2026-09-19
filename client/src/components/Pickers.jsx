import { useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarRange, CalendarX2, Check, ChevronLeft, ChevronRight, Flag, Inbox, Sun, Sunrise } from 'lucide-react';

import { addDays, fromKey, toKey, todayKey } from '@/lib/dates';
import { useGoals } from '@/lib/queries';
import { cn, PRIORITIES } from '@/lib/utils';
import { GoalDot } from './ui/misc';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/Overlay';

/* ------------------------------ DatePicker ------------------------------ */

export function DatePicker({ value, onChange, children, align = 'start' }) {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const [month, setMonth] = useState(() => startOfMonth(value ? fromKey(value) : new Date()));
  const pick = (v) => {
    onChange(v);
    setOpen(false);
  };
  const nextMonday = addDays(today, (8 - fromKey(today).getDay()) % 7 || 7);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const quick = [
    { label: 'Today', icon: Sun, value: today },
    { label: 'Tomorrow', icon: Sunrise, value: addDays(today, 1) },
    { label: 'Next week', icon: CalendarRange, value: nextMonday },
  ];

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(startOfMonth(value ? fromKey(value) : new Date()));
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-[252px] p-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-0.5">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => pick(q.value)}
              className="flex h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-white"
            >
              <q.icon className="size-[15px] opacity-70" />
              <span className="flex-1 text-left">{q.label}</span>
              <span className="text-[11.5px] opacity-50">{format(fromKey(q.value), 'EEE d MMM')}</span>
            </button>
          ))}
          {value && (
            <button
              onClick={() => pick(null)}
              className="flex h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent hover:text-white"
            >
              <CalendarX2 className="size-[15px] opacity-70" />
              <span>No date</span>
            </button>
          )}
        </div>
        <div className="mx-1 my-1.5 h-px bg-line-strong" />
        <div className="px-1 pb-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="pl-1 text-[13px] font-semibold">{format(month, 'MMMM yyyy')}</span>
            <div className="flex">
              <button
                aria-label="Previous month"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                className="grid size-6 place-items-center rounded-md hover:bg-surface-3"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                aria-label="Next month"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="grid size-6 place-items-center rounded-md hover:bg-surface-3"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-[10.5px] font-medium text-fg-3">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((d) => {
              const key = toKey(d);
              const selected = key === value;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  onClick={() => pick(key)}
                  className={cn(
                    'mx-auto grid size-[30px] place-items-center rounded-full text-[12.5px] tabular-nums',
                    !isSameMonth(d, month) && 'text-fg-3/60',
                    selected
                      ? 'bg-accent font-semibold text-white'
                      : isToday
                        ? 'font-semibold text-accent'
                        : 'hover:bg-surface-3',
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------ GoalPicker ------------------------------ */

export function GoalPicker({ value, onChange, children, allowInbox = true }) {
  const { data: goals = [] } = useGoals('active');
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="start" className="max-h-[320px] w-[240px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <MenuLabel>Move to</MenuLabel>
        {allowInbox && (
          <MenuItem icon={Inbox} onSelect={() => onChange(null)}>
            <span className="flex items-center justify-between">Inbox {value === null && <Check className="size-3.5" />}</span>
          </MenuItem>
        )}
        {allowInbox && goals.length > 0 && <MenuSeparator />}
        {goals.map((g) => (
          <MenuItem key={g.id} onSelect={() => onChange(g.id)}>
            <span className="flex items-center gap-2">
              <GoalDot color={g.color} size={9} />
              <span className="flex-1 truncate">{g.title}</span>
              {value === g.id && <Check className="size-3.5" />}
            </span>
          </MenuItem>
        ))}
        {goals.length === 0 && !allowInbox && <div className="px-2 py-1.5 text-[12.5px] text-fg-3">No active goals yet</div>}
      </MenuContent>
    </Menu>
  );
}

/* ---------------------------- PriorityPicker ---------------------------- */

export function PriorityPicker({ value, onChange, children }) {
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <MenuLabel>Priority</MenuLabel>
        {PRIORITIES.map((p) => (
          <MenuItem key={p.value} onSelect={() => onChange(p.value)}>
            <span className="flex items-center gap-2">
              <Flag className="size-[15px]" style={{ color: p.color }} fill={p.value === 'none' ? 'none' : 'currentColor'} />
              <span className="flex-1">{p.label}</span>
              {value === p.value && <Check className="size-3.5" />}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
