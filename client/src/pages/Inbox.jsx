import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { PageHeader } from '@/components/AppShell';
import { QuickAdd, TaskRow } from '@/components/TaskRow';
import { Segmented } from '@/components/ui/Controls';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useTasks } from '@/lib/queries';

/** Loose tasks that don't belong to a goal yet — quick capture, sort later. */
export function InboxPage() {
  const [view, setView] = useState('open');
  const { data: tasks = [], isLoading } = useTasks({ inbox: true, status: view });

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Tasks that don’t belong to a goal yet"
        actions={
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'done', label: 'Completed' },
            ]}
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-8">
          {view === 'open' && <QuickAdd goalId={null} placeholder="Capture a task" className="-mx-2.5 mb-2" autoFocus />}
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={view === 'open' ? 'Inbox zero' : 'Nothing completed yet'}
              description={
                view === 'open'
                  ? 'Capture anything here, then move it to a goal from the task’s menu.'
                  : 'Completed inbox tasks show up here.'
              }
            />
          ) : (
            <div className="-mx-2.5">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
