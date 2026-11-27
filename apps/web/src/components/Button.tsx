import type { ComponentProps } from 'react';

/** Shared look of actions, also for links that read as buttons (Design System — Button). */
const baseButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-5 py-2 text-base font-semibold aria-disabled:cursor-wait aria-disabled:opacity-80';

export const primaryButtonClass = `${baseButtonClass} border-2 border-brand-primary bg-brand-primary text-on-brand hover:border-brand-primary-hover hover:bg-brand-primary-hover`;

export const secondaryButtonClass = `${baseButtonClass} border-2 border-brand-primary bg-surface text-brand-primary hover:bg-accent-soft hover:text-on-accent-soft`;

interface ButtonProps extends ComponentProps<'button'> {
  /** A request is in flight: ignore clicks (no duplicate submissions) but keep the focus. */
  pending?: boolean;
  variant?: 'primary' | 'secondary';
}

/**
 * Action button (primary: raspberry fill; secondary: raspberry outline). While pending it uses
 * aria-disabled instead of `disabled`, so keyboard focus is not lost, and it swallows clicks so a
 * form cannot be submitted twice.
 */
export function Button({
  pending = false,
  variant = 'primary',
  type = 'button',
  onClick,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={`w-full ${variant === 'primary' ? primaryButtonClass : secondaryButtonClass} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
