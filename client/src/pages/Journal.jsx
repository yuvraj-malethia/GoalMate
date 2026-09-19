/**
 * Journal: a Notion-style workspace for daily entries, task notes and weekly
 * reviews. Left: searchable page list. Right: the open page, with properties
 * (date, mood, tags, linked goal/task), the block editor and an AI panel.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Download,
  FileText,
  Hash,
  Lightbulb,
  Link2,
  ListChecks,
  Menu as MenuIcon,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  PanelRightClose,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Search,
  Smile,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { ChatPanel } from '@/components/Chat';
import { LazyEditor } from '@/components/editor/LazyEditor';
import { PAGE_ICONS, PageIcon } from '@/components/PageIcon';
import { DatePicker } from '@/components/Pickers';
import { useOpenTask } from '@/components/TaskRow';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { Chip, EmptyState, GoalDot, Skeleton } from '@/components/ui/misc';
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
  Sheet,
  Tip,
} from '@/components/ui/Overlay';
import { api, errorMessage } from '@/lib/api';
import { format, fromKey, longDate, relativeTime, toKey, todayKey } from '@/lib/dates';
import { invalidatePages, useGoals, usePage, usePages, useUpdatePage } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { cn, downloadBlob, MOODS, moodMeta, plural } from '@/lib/utils';

export default function JournalPage() {
  const { pageId } = useParams();
  return (
    <div className="flex min-h-0 flex-1">
      <PageList activeId={pageId} className={pageId ? 'hidden lg:flex' : 'flex'} />
      <div className={cn('min-w-0 flex-1 flex-col', pageId ? 'flex' : 'hidden lg:flex')}>
        {pageId ? <PageView key={pageId} id={pageId} /> : <JournalHome />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function useCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return {
    today: async () => {
      try {
        const page = await api.post('/pages/daily', { date: todayKey() });
        qc.setQueryData(['page', page.id], page);
        invalidatePages(qc);
        navigate(`/app/journal/${page.id}`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    blank: async (kind = 'note') => {
      try {
        const page = await api.post('/pages', { kind, icon: kind === 'note' ? 'file-text' : null });
        qc.setQueryData(['page', page.id], page);
        invalidatePages(qc);
        navigate(`/app/journal/${page.id}`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
  };
}

const pageTitle = (p) => p.title || (p.kind === 'journal' && p.entryDate ? longDate(p.entryDate) : 'Untitled');

const pageDate = (p) => p.entryDate ?? p.createdAt.slice(0, 10);

/* ------------------------------------------------------------------ */
/* Page list                                                           */
/* ------------------------------------------------------------------ */

function PageList({ activeId, className }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data: pages = [], isLoading } = usePages({ kind: filter === 'all' ? undefined : filter, q: debounced || undefined });
  const create = useCreatePage();
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);

  const groups = useMemo(() => {
    const pinned = pages.filter((p) => p.pinned);
    const rest = pages.filter((p) => !p.pinned);
    const byMonth = new Map();
    for (const p of rest) {
      const key = pageDate(p).slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(p);
    }
    return { pinned, months: [...byMonth.entries()] };
  }, [pages]);

  return (
    <div
      className={cn(
        'w-full flex-col border-r border-line bg-surface lg:w-[320px] lg:shrink-0 lg:bg-surface-2/50 dark:lg:bg-black/10',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <button
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
          className="-ml-1 grid size-8 place-items-center rounded-md text-fg-2 hover:bg-surface-3 md:hidden"
        >
          <MenuIcon className="size-[18px]" />
        </button>
        <h1 className="flex-1 text-[17px] font-semibold tracking-[-0.015em]">Journal</h1>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="primary">
              <Plus className="size-3.5" /> New
            </Button>
          </MenuTrigger>
          <MenuContent className="w-[220px]">
            <MenuItem icon={NotebookPen} onSelect={create.today}>
              Today’s entry
            </MenuItem>
            <MenuItem icon={FileText} onSelect={() => create.blank('note')}>
              Blank page
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="space-y-2.5 border-b border-line p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages"
            aria-label="Search pages"
            className="h-8 w-full rounded-lg border border-line bg-surface pr-2 pl-8 text-[13px] outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 dark:bg-surface-2"
          />
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          className="w-full"
          options={[
            { value: 'all', label: 'All' },
            { value: 'journal', label: 'Entries' },
            { value: 'note', label: 'Notes' },
            { value: 'review', label: 'Reviews' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-fg-3">
            {debounced ? `No pages match “${debounced}”.` : 'No pages yet.'}
          </div>
        ) : (
          <>
            {groups.pinned.length > 0 && (
              <ListGroup label="Pinned">
                {groups.pinned.map((p) => (
                  <PageListItem key={p.id} page={p} active={p.id === activeId} />
                ))}
              </ListGroup>
            )}
            {groups.months.map(([month, list]) => (
              <ListGroup key={month} label={format(fromKey(`${month}-01`), 'MMMM yyyy')}>
                {list.map((p) => (
                  <PageListItem key={p.id} page={p} active={p.id === activeId} />
                ))}
              </ListGroup>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ListGroup({ label, children }) {
  return (
    <div className="mb-2">
      <p className="px-2.5 pt-2 pb-1 text-[11.5px] font-semibold text-fg-3">{label}</p>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function PageListItem({ page, active }) {
  const mood = moodMeta(page.mood);
  return (
    <Link
      to={`/app/journal/${page.id}`}
      className={cn(
        'block rounded-lg px-2.5 py-2 transition-colors',
        active ? 'bg-accent text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
      )}
    >
      <div className="flex items-center gap-2">
        <PageIcon icon={page.icon} kind={page.kind} className={cn('size-3.5 shrink-0', active ? 'text-white/80' : 'text-fg-3')} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{pageTitle(page)}</span>
        {mood && (
          <span
            className="size-2 shrink-0 rounded-full ring-1 ring-white/40"
            style={{ background: mood.color }}
            title={mood.label}
          />
        )}
      </div>
      <p className={cn('mt-0.5 line-clamp-1 pl-5.5 text-[12.5px]', active ? 'text-white/80' : 'text-fg-3')}>
        {page.excerpt || 'Empty page'}
      </p>
      <div className={cn('mt-1 flex items-center gap-2 pl-5.5 text-[11.5px]', active ? 'text-white/70' : 'text-fg-3')}>
        <span>{format(fromKey(pageDate(page)), 'd MMM')}</span>
        {page.task ? (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <ListChecks className="size-3 shrink-0" /> <span className="truncate">{page.task.title}</span>
          </span>
        ) : page.goal ? (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <GoalDot color={page.goal.color} size={6} /> <span className="truncate">{page.goal.title}</span>
          </span>
        ) : null}
        {page.kind === 'review' && <span>Review</span>}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Journal home (nothing selected)                                     */
/* ------------------------------------------------------------------ */

function JournalHome() {
  const create = useCreatePage();
  const today = todayKey();
  const monthStart = toKey(startOfMonth(new Date()));
  const monthEnd = toKey(endOfMonth(new Date()));
  const { data: entries = [] } = usePages({ kind: 'journal', from: monthStart, to: monthEnd });
  const navigate = useNavigate();
  const byDay = new Map(entries.map((e) => [e.entryDate, e]));
  const days = eachDayOfInterval({ start: fromKey(monthStart), end: fromKey(monthEnd) }).map(toKey);
  const lead = (fromKey(monthStart).getDay() + 6) % 7;
  const moods = entries.filter((e) => e.mood).map((e) => e.mood);
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const todayEntry = byDay.get(today);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[560px] px-6 pt-[10vh] pb-20">
        <div className="grid size-12 place-items-center rounded-2xl border border-line bg-surface text-fg-2 shadow-sm">
          <NotebookPen className="size-5" />
        </div>
        <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.025em]">Your journal</h2>
        <p className="mt-1.5 text-[14.5px] text-fg-3">
          Daily entries, notes attached to tasks, and weekly reviews, all in one place. Type “/” in any page for blocks and AI
          help.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" size="lg" onClick={create.today}>
            <PenLine className="size-4" /> {todayEntry ? 'Continue today’s entry' : 'Write today’s entry'}
          </Button>
          <Button size="lg" onClick={() => create.blank('note')}>
            <FileText className="size-4" /> Blank page
          </Button>
        </div>

        <div className="card mt-10 p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-semibold">{format(new Date(), 'MMMM')} at a glance</h3>
            <span className="text-[12px] text-fg-3">
              {plural(entries.length, 'entry', 'entries')}
              {avg !== null && ` · average mood ${MOODS[Math.round(avg) - 1].label.toLowerCase()}`}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10.5px] text-fg-3">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
            {Array.from({ length: lead }).map((_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {days.map((d) => {
              const e = byDay.get(d);
              const mood = moodMeta(e?.mood);
              return (
                <Tip
                  key={d}
                  label={
                    e
                      ? `${format(fromKey(d), 'd MMM')} · ${pageTitle(e)}${mood ? ` · ${mood.label}` : ''}`
                      : format(fromKey(d), 'd MMM')
                  }
                >
                  <button
                    onClick={() => (e ? navigate(`/app/journal/${e.id}`) : undefined)}
                    className={cn(
                      'mx-auto grid aspect-square w-full max-w-9 place-items-center rounded-lg text-[11.5px] tabular-nums transition-transform',
                      e ? 'font-medium text-white hover:scale-105' : d > today ? 'text-fg-3/40' : 'bg-surface-3/60 text-fg-3',
                      d === today && !e && 'ring-1 ring-accent',
                    )}
                    style={e ? { background: mood?.color ?? 'var(--fg-3)' } : undefined}
                  >
                    {fromKey(d).getDate()}
                  </button>
                </Tip>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px] text-fg-3">
            {MOODS.map((m) => (
              <span key={m.value} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: m.color }} /> {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page view                                                           */
/* ------------------------------------------------------------------ */

function PageView({ id }) {
  const { data: page, isLoading, error } = usePage(id);
  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Page not found"
        description="It may have been moved to the Trash."
        action={
          <Link className="text-[13px] font-medium text-accent" to="/app/journal">
            Back to Journal
          </Link>
        }
      />
    );
  }
  if (isLoading || !page) {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-4 px-14 pt-20">
        <Skeleton className="size-10" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  return <PageDocument page={page} />;
}

function PageDocument({ page }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const update = useUpdatePage();
  const openTask = useOpenTask();
  const { data: goals = [] } = useGoals('active');
  const editorRef = useRef(null);
  const [status, setStatus] = useState('saved');
  const [title, setTitle] = useState(page.title);
  const [aiOpen, setAiOpen] = useState(false);
  const [isWide, setIsWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches);

  useEffect(() => {
    const m = window.matchMedia('(min-width: 1280px)');
    const on = () => setIsWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  // Debounced title save.
  useEffect(() => {
    if (title === page.title) return;
    const t = setTimeout(() => update.mutate({ id: page.id, title }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const patch = (body) => update.mutate({ id: page.id, ...body });

  const remove = async () => {
    await api.del(`/pages/${page.id}`);
    invalidatePages(qc);
    navigate('/app/journal');
    toast(`Moved “${pageTitle(page)}” to Trash`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          await api.post(`/pages/${page.id}/restore`);
          invalidatePages(qc);
          navigate(`/app/journal/${page.id}`);
        },
      },
    });
  };

  const exportMarkdown = async () => {
    const md = (await editorRef.current?.toMarkdown()) ?? '';
    const heading = `# ${pageTitle(page)}\n\n`;
    downloadBlob(
      new Blob([heading + md], { type: 'text/markdown' }),
      `${
        pageTitle(page)
          .replace(/[^\w\- ]+/g, '')
          .trim() || 'page'
      }.md`,
    );
  };

  const kindLabel = page.kind === 'journal' ? 'Entries' : page.kind === 'review' ? 'Reviews' : 'Notes';
  const statusText =
    status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Edited' : status === 'error' ? 'Not saved' : 'Saved';

  const aiPanel = (
    <ChatPanel
      thread={`page:${page.id}`}
      className="min-h-0 flex-1"
      intro="Think out loud with the coach. It reads this page and answers like a reflection partner — questions, patterns, next steps."
      suggestions={[
        'What patterns do you notice?',
        'Ask me a question to go deeper',
        'Turn this into next steps',
        'What am I avoiding?',
      ]}
    />
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-line px-3 sm:px-4">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Back to Journal"
            onClick={() => navigate('/app/journal')}
            className="lg:hidden"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-fg-3">
            <Link to="/app/journal" className="hidden hover:text-fg sm:inline">
              Journal
            </Link>
            <span className="hidden sm:inline">/</span>
            <span className="hidden sm:inline">{kindLabel}</span>
            <span className="hidden sm:inline">/</span>
            <span className="truncate text-fg-2">{pageTitle({ ...page, title })}</span>
          </div>
          <span className={cn('mr-1 hidden text-[12px] sm:inline', status === 'error' ? 'text-danger' : 'text-fg-3')}>
            {statusText} · {plural(page.wordCount, 'word')}
          </span>

          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Wand2 className="size-3.5 text-accent" /> <span className="hidden sm:inline">Write with AI</span>
              </Button>
            </MenuTrigger>
            <MenuContent className="w-[240px]">
              <MenuLabel>Adds to the page at the cursor</MenuLabel>
              <MenuItem icon={PenLine} onSelect={() => editorRef.current?.runAi('continue')}>
                Continue writing
              </MenuItem>
              <MenuItem icon={Sparkles} onSelect={() => editorRef.current?.runAi('summarize')}>
                Summarize page
              </MenuItem>
              <MenuItem icon={Lightbulb} onSelect={() => editorRef.current?.runAi('prompts')}>
                Reflection questions
              </MenuItem>
              <MenuItem icon={ListChecks} onSelect={() => editorRef.current?.runAi('actions')}>
                Extract action items
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={Wand2} onSelect={() => editorRef.current?.runAi('improve')}>
                Improve selected text
              </MenuItem>
            </MenuContent>
          </Menu>
          <Tip label={aiOpen ? 'Close coach' : 'Ask the coach about this page'}>
            <Button
              size="icon-sm"
              variant={aiOpen ? 'subtle' : 'ghost'}
              aria-label="Toggle coach"
              onClick={() => setAiOpen((o) => !o)}
            >
              {aiOpen && isWide ? <PanelRightClose className="size-4" /> : <MessageSquare className="size-4" />}
            </Button>
          </Tip>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Page actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-[220px]">
              <MenuItem icon={page.pinned ? PinOff : Pin} onSelect={() => patch({ pinned: !page.pinned })}>
                {page.pinned ? 'Unpin' : 'Pin to top'}
              </MenuItem>
              <MenuItem icon={NotebookPen} onSelect={() => editorRef.current?.insertTodayTasks()}>
                Insert today’s tasks
              </MenuItem>
              <MenuItem
                icon={Copy}
                onSelect={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copied');
                }}
              >
                Copy link
              </MenuItem>
              <MenuItem icon={Download} onSelect={exportMarkdown}>
                Export as Markdown
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={Trash2} danger onSelect={remove}>
                Move to Trash
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>

        {/* Document */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[780px] px-5 pt-10 pb-40 sm:px-14 sm:pt-14">
            <IconPicker value={page.icon} kind={page.kind} onChange={(icon) => patch({ icon })} />
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              rows={1}
              placeholder={page.kind === 'journal' && page.entryDate ? longDate(page.entryDate) : 'Untitled'}
              aria-label="Page title"
              className="mt-3 w-full resize-none bg-transparent text-[34px] leading-[1.2] font-bold tracking-[-0.03em] outline-none placeholder:text-fg-3/60 [field-sizing:content] sm:text-[38px]"
            />

            <div className="mt-4 space-y-0.5 text-[13px]">
              {page.kind !== 'note' ? (
                <Property icon={CalendarDays} label="Date">
                  <DatePicker value={page.entryDate} onChange={(entryDate) => patch({ entryDate })}>
                    <button className="h-7 rounded-md px-2 hover:bg-surface-3">
                      {page.entryDate ? format(fromKey(page.entryDate), 'EEEE, d MMMM yyyy') : 'Empty'}
                    </button>
                  </DatePicker>
                </Property>
              ) : (
                <Property icon={CalendarDays} label="Created">
                  <span className="px-2 text-fg-2">
                    {format(new Date(page.createdAt), 'd MMMM yyyy')} · edited {relativeTime(page.updatedAt)}
                  </span>
                </Property>
              )}
              {page.kind === 'journal' && (
                <Property icon={Smile} label="Mood">
                  <div className="flex flex-wrap gap-1">
                    {MOODS.map((m) => {
                      const active = page.mood === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => patch({ mood: active ? null : m.value })}
                          aria-pressed={active}
                          className={cn(
                            'flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors',
                            active ? 'bg-surface-3 font-medium' : 'text-fg-3 hover:bg-surface-3 hover:text-fg-2',
                          )}
                        >
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: m.color, opacity: active || !page.mood ? 1 : 0.4 }}
                          />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </Property>
              )}
              <Property icon={Hash} label="Tags">
                <TagsInput tags={page.tags} onChange={(tags) => patch({ tags })} />
              </Property>
              <Property icon={Target} label="Goal">
                <Menu>
                  <MenuTrigger asChild>
                    <button
                      className={cn(
                        'flex h-7 max-w-full items-center gap-1.5 truncate rounded-md px-2 hover:bg-surface-3',
                        !page.goal && 'text-fg-3',
                      )}
                    >
                      {page.goal ? (
                        <>
                          <GoalDot color={page.goal.color} size={8} /> {page.goal.title}
                        </>
                      ) : (
                        'Not linked'
                      )}
                    </button>
                  </MenuTrigger>
                  <MenuContent align="start" className="max-h-[300px] w-[260px] overflow-y-auto">
                    <MenuLabel>Link to a goal</MenuLabel>
                    {goals.map((g) => (
                      <MenuItem key={g.id} onSelect={() => patch({ goalId: g.id })}>
                        <span className="flex items-center gap-2">
                          <GoalDot color={g.color} size={8} />
                          <span className="flex-1 truncate">{g.title}</span>
                          {page.goal?.id === g.id && <Check className="size-3.5" />}
                        </span>
                      </MenuItem>
                    ))}
                    {page.goal && (
                      <>
                        <MenuSeparator />
                        <MenuItem icon={Target} onSelect={() => navigate(`/app/goals/${page.goal.id}`)}>
                          Open goal
                        </MenuItem>
                        <MenuItem icon={X} onSelect={() => patch({ goalId: null })}>
                          Unlink
                        </MenuItem>
                      </>
                    )}
                  </MenuContent>
                </Menu>
              </Property>
              {page.task && (
                <Property icon={Link2} label="Task">
                  <button
                    onClick={() => openTask(page.task.id)}
                    className="flex h-7 max-w-full items-center gap-1.5 truncate rounded-md px-2 text-accent hover:bg-surface-3"
                  >
                    <ListChecks className="size-3.5" /> {page.task.title}
                  </button>
                </Property>
              )}
            </div>

            <div className="my-6 h-px bg-line" />
            <div className="-ml-12 sm:-ml-[54px]">
              <LazyEditor key={page.id} page={page} onStatus={setStatus} handleRef={editorRef} className="pl-12 sm:pl-[54px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Coach panel: docked on wide screens, a sheet otherwise */}
      {aiOpen && isWide && (
        <aside className="flex w-[380px] shrink-0 animate-slide-in-right flex-col border-l border-line">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 text-[13.5px] font-semibold">
            <MessageSquare className="size-4 text-accent" /> Coach
          </div>
          {aiPanel}
        </aside>
      )}
      {!isWide && (
        <Sheet open={aiOpen} onOpenChange={setAiOpen} title="Coach">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <MessageSquare className="size-4 text-accent" /> Coach
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setAiOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          {aiPanel}
        </Sheet>
      )}
    </div>
  );
}

function Property({ icon: Icon, label, children }) {
  return (
    <div className="flex min-h-8 items-center gap-1">
      <div className="flex w-[110px] shrink-0 items-center gap-2 text-fg-3">
        <Icon className="size-4" strokeWidth={1.75} /> {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function IconPicker({ value, kind, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Change icon"
          className="grid size-14 place-items-center rounded-xl text-fg-2 transition-colors hover:bg-surface-3"
        >
          <PageIcon icon={value} kind={kind} className="size-10" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[272px] p-2">
        <div className="grid grid-cols-6 gap-1">
          {Object.entries(PAGE_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              aria-label={name}
              className={cn(
                'grid size-10 place-items-center rounded-lg text-fg-2 hover:bg-accent hover:text-white',
                value === name && 'bg-surface-3 text-fg',
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagsInput({ tags, onChange }) {
  const [value, setValue] = useState('');
  const add = () => {
    const t = value.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '');
    if (t && !tags.includes(t)) onChange([...tags, t].slice(0, 12));
    setValue('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1 px-1">
      {tags.map((t) => (
        <Chip key={t} className="pr-1">
          {t}
          <button
            aria-label={`Remove ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="grid size-4 place-items-center rounded opacity-50 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </Chip>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Backspace' && !value && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        placeholder={tags.length ? '' : 'Add a tag'}
        aria-label="Add tag"
        className="h-7 min-w-[80px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-fg-3"
      />
    </div>
  );
}
