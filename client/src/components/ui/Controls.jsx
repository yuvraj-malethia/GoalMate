import { forwardRef, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] text-fg shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent focus:ring-3 focus:ring-accent/20 disabled:opacity-60 dark:bg-surface-2';

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputClass, 'h-9', className)} {...rest} />;
});

/** Textarea that grows with its content. */
export const Textarea = forwardRef(function Textarea({ className, autoGrow = true, value, ...rest }, ref) {
  const inner = useRef(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, autoGrow]);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      value={value}
      className={cn(inputClass, 'resize-none py-2 leading-relaxed', className)}
      {...rest}
    />
  );
});

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-fg-3">{hint}</span>}
    </label>
  );
}

export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-lg border border-line bg-surface-3 p-[2px]', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-7 px-3 text-[12.5px]',
              active ? 'bg-surface text-fg shadow-sm dark:bg-[#3a3a3f]' : 'text-fg-2 hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, color = 'var(--accent)', className, marker }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      {marker != null && marker > 0 && marker < 1 && (
        <div
          className="absolute top-0 h-full w-0.5 bg-fg/40"
          style={{ left: `${marker * 100}%` }}
          title="Where the plan expects you to be today"
        />
      )}
    </div>
  );
}

export function ProgressRing({ value, size = 36, stroke = 3.5, color = 'var(--accent)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
