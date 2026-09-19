import { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChartNoAxesColumn,
  Inbox,
  LogOut,
  Menu as MenuIcon,
  Monitor,
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
import { api } from '@/lib/api';
import { todayKey } from '@/lib/dates';
import { todayQuery, useGoals, useMe, useTasks } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { cn, modKey } from '@/lib/utils';
import { CommandPalette } from './CommandPalette';
import { Logo } from './Logo';
import { NewGoalDialog } from './NewGoalDialog';
import { TaskSheet } from './TaskSheet';
import { Button } from './ui/Button';
import { GoalDot, Kbd, Spinner } from './ui/misc';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './ui/Overlay';

/** Layout for every signed-in page: sidebar + content, plus global overlays. */
export function AppShell() {
  const { data: me, isLoading } = useMe();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, setPaletteOpen } = useUi();

  // Close the mobile sidebar on navigation.
  useEffect(() => setSidebarOpen(false), [location.pathname, setSidebarOpen]);

  // ⌘K / Ctrl+K anywhere opens the command palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  if (isLoading) {
    return (
      <div className="grid h-dvh place-items-center text-fg-3">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-[var(--overlay)] transition-opacity md:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-[252px] shrink-0 flex-col border-r border-line bg-sidebar transition-transform duration-200 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full',
        )}
      >
        <Sidebar />
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        <Outlet />
      </main>
      <TaskSheet />
      <CommandPalette />
      <NewGoalDialog />
    </div>
  );
}

/** Sticky page header used by every app page. */
export function PageHeader({ title, subtitle, actions, className, children }) {
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  return (
    <header className={cn('sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-xl', className)}>
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-2 sm:px-6">
        <button
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
          className="-ml-1 grid size-8 place-items-center rounded-md text-fg-2 hover:bg-surface-3 md:hidden"
        >
          <MenuIcon className="size-[18px]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{title}</h1>
          {subtitle && <p className="truncate text-[12.5px] text-fg-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

function NavItem({ to, icon: Icon, label, count, countTone, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors',
          isActive
            ? 'bg-black/[0.07] font-medium text-fg dark:bg-white/[0.09]'
            : 'text-fg-2 hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.05]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[17px]', isActive ? 'text-accent' : 'text-fg-3 group-hover:text-fg-2')} strokeWidth={1.9} />
          <span className="flex-1 truncate">{label}</span>
          {!!count && (
            <span className={cn('text-[12px] tabular-nums', countTone === 'danger' ? 'font-medium text-danger' : 'text-fg-3')}>
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const today = todayKey();
  const { data: me } = useMe();
  const { data: goals = [] } = useGoals('active');
  const { data: todayTasks = [] } = useTasks(todayQuery());
  const { data: inbox = [] } = useTasks({ inbox: true, status: 'open' });
  const { theme, setTheme, setPaletteOpen, openNewGoal } = useUi();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const open = todayTasks.filter((t) => !t.completedAt);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;

  const signOut = async () => {
    await api.post('/auth/logout');
    qc.clear();
    navigate('/');
  };

  const themeIcon = { system: Monitor, light: Sun, dark: Moon };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[56px] items-center justify-between px-4">
        <Link to="/" className="rounded-md" title="GoalMate home page">
          <Logo />
        </Link>
        <Button size="icon-sm" variant="ghost" aria-label="New goal" title="New goal" onClick={() => openNewGoal('manual')}>
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="px-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface/70 px-2.5 text-[13px] text-fg-3 shadow-sm transition-colors hover:text-fg-2 dark:bg-surface-2"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>{modKey === '⌘' ? '⌘K' : 'Ctrl K'}</Kbd>
        </button>
      </div>

      <nav className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
        <div className="space-y-px">
          <NavItem
            to="/app/today"
            icon={Sun}
            label="Today"
            count={overdue || open.length}
            countTone={overdue ? 'danger' : undefined}
          />
          <NavItem to="/app/inbox" icon={Inbox} label="Inbox" count={inbox.length} />
          <NavItem to="/app/calendar" icon={CalendarDays} label="Calendar" />
          <NavItem to="/app/journal" icon={NotebookPen} label="Journal" />
          <NavItem to="/app/insights" icon={ChartNoAxesColumn} label="Insights" />
        </div>

        <div className="mt-5 mb-1 flex items-center justify-between pr-1 pl-2">
          <Link to="/app/goals" className="text-[11.5px] font-semibold tracking-wide text-fg-3 uppercase hover:text-fg-2">
            Goals
          </Link>
          <button
            onClick={() => openNewGoal('ai')}
            className="flex items-center gap-1 rounded px-1 text-[11.5px] text-fg-3 hover:text-accent"
            title="Plan a goal with AI"
          >
            <Sparkles className="size-3" /> Plan
          </button>
        </div>
        <div className="space-y-px">
          {goals.map((g) => (
            <NavLink
              key={g.id}
              to={`/app/goals/${g.id}`}
              className={({ isActive }) =>
                cn(
                  'flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[13.5px]',
                  isActive
                    ? 'bg-black/[0.07] font-medium text-fg dark:bg-white/[0.09]'
                    : 'text-fg-2 hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.05]',
                )
              }
            >
              <span className="grid size-[17px] place-items-center">
                <GoalDot color={g.color} size={10} />
              </span>
              <span className="flex-1 truncate">{g.title}</span>
              <span className="text-[12px] text-fg-3 tabular-nums">{g.taskCount - g.doneCount || ''}</span>
            </NavLink>
          ))}
          {goals.length === 0 && (
            <button
              onClick={() => openNewGoal('ai')}
              className="flex h-[30px] w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-3 hover:bg-black/[0.04] hover:text-fg-2"
            >
              <Plus className="size-[17px]" /> Create your first goal
            </button>
          )}
          <NavItem to="/app/goals" icon={Target} label="All goals" end />
        </div>
      </nav>

      <div className="border-t border-line p-3">
        {me?.isDemo && (
          <div className="mb-2.5 rounded-lg border border-line bg-surface/70 p-2.5 text-[12px] dark:bg-surface-2">
            <p className="font-medium">You’re in a demo workspace</p>
            <p className="mt-0.5 text-fg-3">Private to you. Deleted when you sign out or after 24 hours.</p>
            <Link to="/signup" className="mt-1.5 inline-block font-medium text-accent hover:underline">
              Create a real account →
            </Link>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Menu>
            <MenuTrigger asChild>
              <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#636366] text-[12px] font-semibold text-white">
                  {me?.name?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{me?.name}</span>
                  <span className="block truncate text-[11.5px] text-fg-3">{me?.isDemo ? 'Demo account' : me?.email}</span>
                </span>
              </button>
            </MenuTrigger>
            <MenuContent align="start" side="top" className="w-[220px]">
              <MenuLabel>Appearance</MenuLabel>
              {['system', 'light', 'dark'].map((t) => (
                <MenuItem key={t} icon={themeIcon[t]} onSelect={() => setTheme(t)} shortcut={theme === t ? '✓' : undefined}>
                  {t === 'system' ? 'Match system' : t === 'light' ? 'Light' : 'Dark'}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem icon={Settings} onSelect={() => navigate('/app/settings')}>
                Settings
              </MenuItem>
              <MenuItem icon={LogOut} onSelect={signOut}>
                {me?.isDemo ? 'Leave demo' : 'Sign out'}
              </MenuItem>
            </MenuContent>
          </Menu>
          <NavLink
            to="/app/trash"
            title="Trash"
            className={({ isActive }) =>
              cn(
                'grid size-8 place-items-center rounded-md text-fg-3 hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.05]',
                isActive && 'text-accent',
              )
            }
          >
            <Trash2 className="size-4" />
          </NavLink>
          <NavLink
            to="/app/settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'grid size-8 place-items-center rounded-md text-fg-3 hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.05]',
                isActive && 'text-accent',
              )
            }
          >
            <Settings className="size-4" />
          </NavLink>
        </div>
      </div>
    </div>
  );
}
