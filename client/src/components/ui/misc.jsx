import { cn, goalColor } from '@/lib/utils';

export function Spinner({ className }) {
  return (
    <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-sans text-[11px] font-medium text-fg-3 shadow-[0_1px_0_var(--line-strong)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function GoalDot({ color, size = 10, className }) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size, background: goalColor(color) }}
    />
  );
}

export function Chip({ children, className, color, onClick, title }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex h-[22px] max-w-full items-center gap-1 truncate rounded-md px-1.5 text-[11.5px] font-medium whitespace-nowrap',
        !color && 'bg-surface-3 text-fg-2',
        onClick && 'hover:brightness-95',
        className,
      )}
      style={color ? { color, background: `color-mix(in srgb, ${color} 13%, transparent)` } : undefined}
    >
      {children}
    </Tag>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-surface text-fg-3 shadow-sm">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

export function SectionTitle({ children, right, className }) {
  return (
    <div className={cn('mb-2 flex items-center justify-between gap-2', className)}>
      <h2 className="text-[13px] font-semibold text-fg-2">{children}</h2>
      {right}
    </div>
  );
}
