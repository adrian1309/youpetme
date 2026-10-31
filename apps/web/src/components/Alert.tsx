import { useEffect, useRef, type ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  /** Move the focus here on mount so assistive technology reads the message. */
  focusOnMount?: boolean;
}

/** Error banner announced as an alert (Design System — Feedback). */
export function Alert({ children, focusOnMount = false }: AlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      ref.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex gap-2 rounded-control border-2 border-feedback-error bg-surface-muted p-3 text-base text-feedback-error"
    >
      <span aria-hidden="true">⚠</span>
      <div>{children}</div>
    </div>
  );
}
