import { useEffect, useRef, type ReactNode } from 'react';

interface NoticeProps {
  children: ReactNode;
  /** Move the focus here on mount so assistive technology reads the message. */
  focusOnMount?: boolean;
}

/**
 * Success confirmation (Design System — Feedback): a completed action, announced politely as a
 * status message. Errors use Alert instead.
 */
export function Notice({ children, focusOnMount = false }: NoticeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      ref.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <div
      ref={ref}
      role="status"
      // Focused by script only (tabIndex -1); its own border marks it, so no second ring.
      tabIndex={-1}
      className="flex focus:outline-none gap-2 rounded-control border-2 border-feedback-success bg-surface p-3 text-base text-feedback-success"
    >
      <span aria-hidden="true">✓</span>
      <div>{children}</div>
    </div>
  );
}
