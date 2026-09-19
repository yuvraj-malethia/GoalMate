import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChartNoAxesColumn,
  CircleCheck,
  FileText,
  Inbox,
  Moon,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trash2,
} from 'lucide-react';

import { api, qs } from '@/lib/api';
import { todayKey } from '@/lib/dates';
import { invalidatePages } from '@/lib/queries';
import { resolvedDark, useUi } from '@/lib/store';
import { cn } from '@/lib/utils';
import { PageIcon } from './PageIcon';
import { GoalDot, Kbd } from './ui/misc';

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette() {
  const { paletteOpen: open, setPaletteOpen: setOpen, openNewGoal, theme, setTheme } = useUi();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 150);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const { data: results } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get(`/search${qs({ q })}`),
    enabled: open && q.length >= 2,
    placeholderData: (prev) => prev,
  });

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const openToday = async () => {
    const page = await api.post('/pages/daily', { date: todayKey() });
    invalidatePages();
    go(`/app/journal/${page.id}`);
  };
  const newPage = async () => {
    const page = await api.post('/pages', { kind: 'note' });
    invalidatePages();
    go(`/app/journal/${page.id}`);
  };

  const actions = useMemo(
    () => [
      { id: 'today', label: 'Today', icon: Sun, group: 'Go to', run: () => go('/app/today') },
      { id: 'inbox', label: 'Inbox', icon: Inbox, group: 'Go to', run: () => go('/app/inbox') },
      {
        id: 'calendar',
        label: 'Calendar',
        icon: CalendarDays,
        group: 'Go to',
        keywords: 'upcoming schedule',
        run: () => go('/app/calendar'),
      },
      { id: 'goals', label: 'All goals', icon: Target, group: 'Go to', run: () => go('/app/goals') },
      {
        id: 'journal',
        label: 'Journal',
        icon: NotebookPen,
        group: 'Go to',
        keywords: 'notes pages diary',
        run: () => go('/app/journal'),
      },
      {
        id: 'insights',
        label: 'Insights',
        icon: ChartNoAxesColumn,
        group: 'Go to',
        keywords: 'dashboard stats analytics',
        run: () => go('/app/insights'),
      },
      { id: 'trash', label: 'Trash', icon: Trash2, group: 'Go to', keywords: 'deleted restore', run: () => go('/app/trash') },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        group: 'Go to',
        keywords: 'preferences account export import',
        run: () => go('/app/settings'),
      },
      {
        id: 'new-goal-ai',
        label: 'Plan a goal with AI',
        icon: Sparkles,
        group: 'Create',
        keywords: 'roadmap generate',
        run: () => openNewGoal('ai'),
      },
      { id: 'new-goal', label: 'New goal', icon: Target, group: 'Create', run: () => openNewGoal('manual') },
      {
        id: 'daily',
        label: 'Open today’s journal entry',
        icon: NotebookPen,
        group: 'Create',
        keywords: 'diary write',
        run: openToday,
      },
      { id: 'new-page', label: 'New page', icon: FileText, group: 'Create', keywords: 'note document', run: newPage },
      {
        id: 'theme',
        label: resolvedDark(theme) ? 'Switch to light mode' : 'Switch to dark mode',
        icon: resolvedDark(theme) ? Sun : Moon,
        group: 'Preferences',
        keywords: 'theme appearance dark light',
        run: () => {
          setTheme(resolvedDark(theme) ? 'light' : 'dark');
          setOpen(false);
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );

  const needle = query.trim().toLowerCase();
  const visible = needle ? actions.filter((a) => `${a.label} ${a.keywords ?? ''}`.toLowerCase().includes(needle)) : actions;
  const groups = ['Go to', 'Create', 'Preferences'];
  const showResults = q.length >= 2 && results;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-[var(--overlay)] animate-fade-in"
      contentClassName="fixed top-[14vh] left-1/2 z-50 w-[calc(100vw-24px)] max-w-[620px] -translate-x-1/2 animate-pop-in overflow-hidden rounded-2xl border border-line floating shadow-lg"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-[18px] text-fg-3" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search goals, tasks and pages, or type a command"
          className="h-[52px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
        />
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
        <Command.Empty className="px-3 py-8 text-center text-[13px] text-fg-3">No results for “{query}”.</Command.Empty>

        {showResults && results.goals.length > 0 && (
          <Command.Group heading="Goals">
            {results.goals.map((g) => (
              <Item key={g.id} value={`goal-${g.id}`} onSelect={() => go(`/app/goals/${g.id}`)}>
                <GoalDot color={g.color} size={9} className="mx-[3px]" />
                {g.title}
              </Item>
            ))}
          </Command.Group>
        )}
        {showResults && results.tasks.length > 0 && (
          <Command.Group heading="Tasks">
            {results.tasks.map((t) => (
              <Item
                key={t.id}
                value={`task-${t.id}`}
                onSelect={() => go(`${t.goalId ? `/app/goals/${t.goalId}` : '/app/inbox'}?task=${t.parentId ?? t.id}`)}
              >
                <CircleCheck className={cn('size-4', t.completedAt ? 'text-success' : 'text-fg-3')} />
                <span className={cn('flex-1 truncate', t.completedAt && 'text-fg-3 line-through')}>{t.title}</span>
                <span className="truncate text-[12px] text-fg-3">{t.goalTitle ?? 'Inbox'}</span>
              </Item>
            ))}
          </Command.Group>
        )}
        {showResults && results.pages.length > 0 && (
          <Command.Group heading="Journal">
            {results.pages.map((p) => (
              <Item key={p.id} value={`page-${p.id}`} onSelect={() => go(`/app/journal/${p.id}`)}>
                <PageIcon icon={null} kind={p.kind} className="size-4 text-fg-3" />
                <span className="flex-1 truncate">{p.title || 'Untitled'}</span>
                {p.entryDate && <span className="text-[12px] text-fg-3">{p.entryDate}</span>}
              </Item>
            ))}
          </Command.Group>
        )}

        {groups.map((group) => {
          const items = visible.filter((a) => a.group === group);
          if (!items.length) return null;
          return (
            <Command.Group key={group} heading={group}>
              {items.map((a) => (
                <Item key={a.id} value={a.id} onSelect={a.run}>
                  <a.icon className="size-4 text-fg-3" />
                  {a.label}
                  {a.id === 'new-goal' && <Plus className="ml-auto size-3.5 text-fg-3" />}
                </Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </Command.Dialog>
  );
}

function Item({ children, value, onSelect }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] select-none data-[selected=true]:bg-surface-3"
    >
      {children}
    </Command.Item>
  );
}
