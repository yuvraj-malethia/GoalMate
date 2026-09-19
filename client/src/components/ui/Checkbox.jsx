import { cn } from '@/lib/utils';

/**
 * Round checkbox: the ring takes the goal's
 * colour, and ticking fills it with an animated check mark.
 */
export function CheckCircle({ checked, onToggle, color = 'var(--accent)', size = 18, label, className }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'group/check relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-150 active:scale-90',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderColor: checked ? color : `color-mix(in srgb, ${color} 55%, var(--line-strong))`,
        background: checked ? color : 'transparent',
      }}
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="size-[70%]" aria-hidden>
          <path
            d="M2.8 6.3l2.1 2.1 4.3-4.7"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: 16, animation: 'check-draw 220ms ease-out' }}
          />
        </svg>
      ) : (
        <span
          className="size-[55%] rounded-full opacity-0 transition-opacity group-hover/check:opacity-25"
          style={{ background: color }}
        />
      )}
    </button>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}
