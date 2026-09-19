import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './misc';

const variants = {
  primary:
    'bg-accent text-white hover:bg-accent-hover shadow-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] active:brightness-95',
  secondary:
    'bg-surface text-fg border border-line-strong shadow-sm hover:bg-surface-2 active:bg-surface-3 dark:bg-surface-3 dark:hover:bg-[color-mix(in_srgb,var(--surface-3)_80%,white)]',
  ghost: 'text-fg-2 hover:bg-surface-3 hover:text-fg active:bg-line',
  subtle: 'bg-surface-3 text-fg hover:bg-line-strong/60',
  danger: 'bg-danger text-white hover:brightness-110 shadow-sm',
};

const sizes = {
  sm: 'h-7 px-2.5 text-[12.5px] rounded-md gap-1.5',
  md: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  lg: 'h-10 px-4 text-sm rounded-[10px] gap-2',
  icon: 'h-8 w-8 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md',
};

const base =
  'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,box-shadow,filter] duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0';

/** Button styles for non-button elements (e.g. a router <Link> that should look like a button). */
export const buttonClass = (variant = 'secondary', size = 'md', className) => cn(base, variants[variant], sizes[size], className);

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? <Spinner className="size-3.5" /> : null}
      {children}
    </button>
  );
});
