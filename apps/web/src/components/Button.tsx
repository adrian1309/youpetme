import type { ComponentProps } from 'react';

interface ButtonProps extends ComponentProps<'button'> {
  /** A request is in flight: ignore clicks (no duplicate submissions) but keep the focus. */
  pending?: boolean;
}

/**
 * Primary action button. While pending it uses aria-disabled instead of `disabled`, so keyboard
 * focus is not lost, and it swallows clicks so a form cannot be submitted twice.
 */
export function Button({
  pending = false,
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
      className={`min-h-11 w-full rounded-control bg-brand-primary px-4 py-2 text-base font-semibold text-on-brand hover:bg-brand-primary-hover aria-disabled:cursor-wait aria-disabled:opacity-80 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
