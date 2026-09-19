import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/AppShell';
import { PageIcon } from '@/components/PageIcon';
import { Button } from '@/components/ui/Button';
import { EmptyState, GoalDot, SectionTitle, Skeleton } from '@/components/ui/misc';
import { Modal } from '@/components/ui/Overlay';
import { api, errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/dates';
import { invalidatePages, invalidateWork, useTrash } from '@/lib/queries';
import { plural } from '@/lib/utils';

export function TrashPage() {
  const { data, isLoading } = useTrash();
  const qc = useQueryClient();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const count = (data?.goals.length ?? 0) + (data?.pages.length ?? 0);

  const refresh = () => {
    invalidateWork(qc);
    invalidatePages(qc);
  };
  const act = async (fn, message) => {
    try {
      await fn();
      refresh();
      toast.success(message);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Trash"
        subtitle="Items are deleted for good after 30 days"
        actions={
          count > 0 && (
            <Button variant="ghost" onClick={() => setConfirmEmpty(true)} className="text-danger">
              <Trash2 className="size-3.5" /> Empty Trash
            </Button>
          )
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-8">
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : count === 0 ? (
            <EmptyState
              icon={Trash2}
              title="Trash is empty"
              description="Deleted goals and pages land here first, so nothing disappears by accident."
            />
          ) : (
            <div className="space-y-8">
              {data.goals.length > 0 && (
                <section>
                  <SectionTitle>Goals</SectionTitle>
                  <div className="divide-y divide-line rounded-xl border border-line">
                    {data.goals.map((g) => (
                      <Row
                        key={g.id}
                        icon={<GoalDot color={g.color} size={10} />}
                        title={g.title}
                        meta={`${plural(g.taskCount, 'task')} · deleted ${relativeTime(g.deletedAt)}`}
                        onRestore={() => act(() => api.post(`/goals/${g.id}/restore`), `Restored “${g.title}”`)}
                        onDelete={() => act(() => api.del(`/goals/${g.id}/permanent`), 'Deleted permanently')}
                      />
                    ))}
                  </div>
                </section>
              )}
              {data.pages.length > 0 && (
                <section>
                  <SectionTitle>Journal pages</SectionTitle>
                  <div className="divide-y divide-line rounded-xl border border-line">
                    {data.pages.map((p) => (
                      <Row
                        key={p.id}
                        icon={<PageIcon icon={p.icon} kind={p.kind} className="size-4 text-fg-3" />}
                        title={p.title || 'Untitled'}
                        meta={`${plural(p.wordCount, 'word')} · deleted ${relativeTime(p.deletedAt)}`}
                        onRestore={() => act(() => api.post(`/pages/${p.id}/restore`), `Restored “${p.title || 'Untitled'}”`)}
                        onDelete={() => act(() => api.del(`/pages/${p.id}/permanent`), 'Deleted permanently')}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
      <Modal
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty the Trash?"
        description={`${plural(count, 'item')} will be deleted permanently.`}
      >
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button onClick={() => setConfirmEmpty(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmEmpty(false);
              act(() => api.del('/trash'), 'Trash emptied');
            }}
          >
            Empty Trash
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Row({ icon, title, meta, onRestore, onDelete }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-5 place-items-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{title}</p>
        <p className="text-[12px] text-fg-3">{meta}</p>
      </div>
      <Button size="sm" onClick={onRestore}>
        <RotateCcw className="size-3.5" /> Restore
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Delete permanently"
        title="Delete permanently"
        onClick={onDelete}
        className="hover:text-danger"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
