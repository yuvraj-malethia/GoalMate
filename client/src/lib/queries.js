/**
 * Server state lives in TanStack Query. Components read with the hooks below
 * and mutate through the mutation hooks, which keep every cached view (Today,
 * Calendar, goal page, task sheet) consistent — optimistically for the
 * interactions that must feel instant, like ticking a checkbox.
 */
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, ApiError, errorMessage, qs } from './api';
import { todayKey, tzOffset } from './dates';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

/* ------------------------------ queries ------------------------------ */

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    staleTime: Infinity,
  });
}

export const useGoals = (status = 'all') =>
  useQuery({
    queryKey: ['goals', status],
    queryFn: () => api.get(`/goals${qs({ status, today: todayKey() })}`),
  });

export const useGoal = (id) =>
  useQuery({
    queryKey: ['goal', id],
    queryFn: () => api.get(`/goals/${id}${qs({ today: todayKey() })}`),
    enabled: !!id,
  });

/** Everything the Today view needs: overdue + due today + finished today. Shared with the sidebar badge. */
export function todayQuery() {
  const today = todayKey();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return { from: today, to: today, overdueBefore: today, completedOn: midnight.toISOString() };
}

export const useTasks = (params, enabled = true) =>
  useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.get(`/tasks${qs({ ...params, inbox: params.inbox ? 1 : undefined })}`),
    enabled,
  });

export const useTask = (id) =>
  useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get(`/tasks/${id}`),
    enabled: !!id,
  });

export const usePages = (params = {}) =>
  useQuery({
    queryKey: ['pages', params],
    queryFn: () => api.get(`/pages${qs({ ...params })}`),
  });

export const usePage = (id) =>
  useQuery({
    queryKey: ['page', id],
    queryFn: () => api.get(`/pages/${id}`),
    enabled: !!id,
    staleTime: Infinity, // the editor owns the content while open
  });

export const useInsights = () =>
  useQuery({
    queryKey: ['insights'],
    queryFn: () => api.get(`/insights${qs({ today: todayKey(), tzOffset: tzOffset() })}`),
  });

export const useAiStatus = () => useQuery({ queryKey: ['ai-status'], queryFn: () => api.get('/ai/status'), staleTime: 60_000 });

export const useThread = (thread) =>
  useQuery({
    queryKey: ['thread', thread],
    queryFn: () => api.get(`/ai/threads/${thread}`),
    enabled: !!thread,
  });

export const useTrash = () =>
  useQuery({
    queryKey: ['trash'],
    queryFn: () => api.get('/trash'),
  });

/* ----------------------------- invalidation ----------------------------- */

export function invalidateWork(qc = queryClient) {
  for (const key of ['tasks', 'goal', 'goals', 'task', 'insights', 'trash']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
export function invalidatePages(qc = queryClient) {
  for (const key of ['pages', 'insights', 'trash', 'task']) qc.invalidateQueries({ queryKey: [key] });
}

/** Apply a patch to a task wherever it appears in the cache. */
function patchTaskEverywhere(qc, id, patch) {
  const apply = (t) => (t.id === id ? { ...t, ...patch } : t);
  qc.setQueriesData({ queryKey: ['tasks'] }, (list) => list?.map(apply));
  qc.setQueriesData({ queryKey: ['goal'] }, (g) => (g ? { ...g, tasks: g.tasks.map(apply) } : g));
  qc.setQueriesData({ queryKey: ['task'] }, (t) => (t ? { ...apply(t), subtasks: t.subtasks.map(apply) } : t));
}

/* ------------------------------ mutations ------------------------------ */

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/tasks/${id}`, body),
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const patch = { ...body };
      if ('completed' in body) patch.completedAt = body.completed ? new Date().toISOString() : null;
      delete patch.completed;
      patchTaskEverywhere(qc, id, patch);
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => invalidateWork(qc),
  });
}

/** Tick / untick with an optimistic update and an Undo toast when completing. */
export function useToggleTask() {
  const update = useUpdateTask();
  return (task) => {
    const completed = !task.completedAt;
    update.mutate({ id: task.id, completed });
    if (completed && !task.parentId) {
      toast.success(`Completed “${task.title}”`, {
        action: { label: 'Undo', onClick: () => update.mutate({ id: task.id, completed: false }) },
        duration: 3500,
      });
    }
  };
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/tasks', body),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => invalidateWork(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task) => api.del(`/tasks/${task.id}`),
    onSuccess: (_d, task) => {
      qc.removeQueries({ queryKey: ['task', task.id], exact: true });
      invalidateWork(qc);
      toast(`Deleted “${task.title}”`, {
        action: {
          label: 'Undo',
          onClick: () => api.post(`/tasks/${task.id}/restore`).then(() => invalidateWork(qc)),
        },
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/goals/${id}`, body),
    onMutate: ({ id, ...body }) => {
      qc.setQueryData(['goal', id], (g) => (g ? { ...g, ...body } : g));
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => invalidateWork(qc),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goal) => api.del(`/goals/${goal.id}`),
    onSuccess: (_d, goal) => {
      // Refresh everything except the deleted goal itself: its page can still be on screen for a
      // moment while the router moves to /app/goals, and refetching it would only 404. Unused, it
      // leaves the cache on its own.
      for (const key of ['tasks', 'goals', 'task', 'insights', 'trash', 'pages']) qc.invalidateQueries({ queryKey: [key] });
      qc.invalidateQueries({ queryKey: ['goal'], predicate: (q) => q.queryKey[1] !== goal.id });
      toast(`Moved “${goal.title}” to Trash`, {
        action: {
          label: 'Undo',
          onClick: () =>
            api.post(`/goals/${goal.id}/restore`).then(() => {
              invalidateWork(qc);
              invalidatePages(qc);
            }),
        },
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/pages/${id}`, body),
    onSuccess: (page) => {
      // Keep the open page's metadata fresh without resetting the editor content.
      qc.setQueryData(['page', page.id], (old) => (old ? { ...page, content: old.content } : page));
      qc.setQueriesData({ queryKey: ['pages'] }, (list) => list?.map((p) => (p.id === page.id ? { ...p, ...page } : p)));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
