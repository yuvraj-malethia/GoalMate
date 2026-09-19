/**
 * Dialog, Sheet, Menu, Popover and Tooltip — thin wrappers around Radix UI
 * primitives (focus trapping, keyboard navigation and positioning come from
 * Radix), styled with the app's own tokens.
 */

import { Dialog, DropdownMenu, Popover as P, Tooltip } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------- Dialog ------------------------------- */

export function Modal({ open, onOpenChange, title, description, children, className, hideHeader }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-[var(--overlay)]" />
        <Dialog.Content
          className={cn(
            'fixed top-[8vh] left-1/2 z-50 flex max-h-[84vh] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 animate-pop-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg outline-none',
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          {hideHeader ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
              <div>
                <Dialog.Title className="text-[15px] font-semibold tracking-tight">{title}</Dialog.Title>
                {description && <Dialog.Description className="mt-0.5 text-[13px] text-fg-3">{description}</Dialog.Description>}
              </div>
              <Dialog.Close className="-mr-1.5 grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          )}
          {!description && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Right-hand panel (task details). */
export function Sheet({ open, onOpenChange, title, children, className }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-[var(--overlay)] sm:bg-black/10 dark:sm:bg-black/30" />
        <Dialog.Content
          className={cn(
            'fixed top-0 right-0 bottom-0 z-40 flex w-full animate-slide-in-right flex-col border-l border-line bg-surface shadow-lg outline-none sm:top-2 sm:right-2 sm:bottom-2 sm:w-[600px] sm:rounded-2xl sm:border',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">Task details</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;

/* -------------------------------- Menu -------------------------------- */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, className, align = 'end', ...rest }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'floating z-[60] min-w-[190px] animate-pop-in rounded-[10px] border border-line p-1 text-[13px] shadow-lg outline-none',
          className,
        )}
        {...rest}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ icon: Icon, children, shortcut, danger, className, ...rest }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'group flex h-7 cursor-default items-center gap-2 rounded-md px-2 outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-3',
        danger && 'text-danger',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className="size-[15px] opacity-70 group-data-[highlighted]:opacity-100" />}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-[11.5px] opacity-50">{shortcut}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line-strong" />;
}

export function MenuLabel({ children }) {
  return <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-[11.5px] font-medium text-fg-3">{children}</DropdownMenu.Label>;
}

/* ------------------------------- Popover ------------------------------ */

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ children, className, align = 'start', ...rest }) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn('floating z-[60] animate-pop-in rounded-xl border border-line p-2 shadow-lg outline-none', className)}
        {...rest}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}

/* ------------------------------- Tooltip ------------------------------ */

export const TooltipProvider = Tooltip.Provider;

export function Tip({ label, children, side = 'bottom' }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-[70] animate-fade-in rounded-md bg-fg px-2 py-1 text-[11.5px] font-medium text-bg shadow-md"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
