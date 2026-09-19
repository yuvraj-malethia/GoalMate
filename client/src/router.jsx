import { createBrowserRouter, Navigate } from 'react-router';
import { AuthPage } from './pages/Auth';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';

/**
 * The landing and sign-in pages load immediately; everything behind sign-in is
 * code-split, so a first-time visitor only downloads what the home page needs.
 */
const lazy = (load, name) => async () => ({ Component: (await load())[name] });

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/signup', element: <AuthPage mode="signup" /> },
  {
    path: '/app',
    lazy: lazy(() => import('./components/AppShell'), 'AppShell'),
    children: [
      { index: true, element: <Navigate to="today" replace /> },
      { path: 'today', lazy: lazy(() => import('./pages/Today'), 'TodayPage') },
      { path: 'inbox', lazy: lazy(() => import('./pages/Inbox'), 'InboxPage') },
      { path: 'calendar', lazy: lazy(() => import('./pages/Calendar'), 'CalendarPage') },
      { path: 'goals', lazy: lazy(() => import('./pages/Goals'), 'GoalsPage') },
      { path: 'goals/:id', lazy: lazy(() => import('./pages/Goal'), 'GoalPage') },
      // One route with an optional id, so the page list stays mounted while switching pages.
      { path: 'journal/:pageId?', lazy: lazy(() => import('./pages/Journal'), 'default') },
      { path: 'insights', lazy: lazy(() => import('./pages/Insights'), 'default') },
      { path: 'settings', lazy: lazy(() => import('./pages/Settings'), 'SettingsPage') },
      { path: 'trash', lazy: lazy(() => import('./pages/Trash'), 'TrashPage') },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
