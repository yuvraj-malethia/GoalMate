import { lazy, Suspense } from 'react';
import { Skeleton } from '../ui/misc';

const PageEditor = lazy(() => import('./PageEditor'));

export function EditorSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/** Loads the editor code on demand, showing a skeleton meanwhile. */
export function LazyEditor(props) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <PageEditor {...props} />
    </Suspense>
  );
}
