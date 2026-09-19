import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/misc';

export function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <EmptyState
        icon={Compass}
        title="This page doesn’t exist"
        description="The link may be old, or the item was deleted."
        action={
          <Link to="/" className="text-[13px] font-medium text-accent hover:underline">
            Go home
          </Link>
        }
      />
    </div>
  );
}
