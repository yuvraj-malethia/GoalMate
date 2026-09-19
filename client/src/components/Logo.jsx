import { cn } from '@/lib/utils';

/** The GoalMate mark: a progress ring closing around a check. */
export function LogoMark({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="15" className="fill-[#1d1d1f] dark:fill-white" />
      <circle cx="32" cy="32" r="17" fill="none" strokeWidth="5" className="stroke-white/25 dark:stroke-black/20" />
      <circle
        cx="32"
        cy="32"
        r="17"
        fill="none"
        strokeWidth="5"
        strokeDasharray="80 107"
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        className="stroke-white dark:stroke-[#1d1d1f]"
      />
      <path
        d="M24.5 32.5l5 5 10-11"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, size = 22 }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">GoalMate</span>
    </span>
  );
}
