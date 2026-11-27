import type { ComponentProps } from 'react';

import { buttonClass, type ButtonSize, type ButtonVariant } from './button-styles';

interface ButtonProps extends ComponentProps<'button'> {
  /** A request is in flight: ignore clicks (no duplicate submissions) but keep the focus. */
  pending?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Action button (primary: raspberry fill; secondary: raspberry outline; optional large size).
 * While pending it uses aria-disabled instead of `disabled`, so keyboard focus is not lost, and
 * it swallows clicks so a form cannot be submitted twice.
 */
export function Button({
  pending = false,
  variant = 'primary',
  size = 'md',
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
      className={`w-full ${buttonClass(variant, size)} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
