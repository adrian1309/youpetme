import { APP_NAME } from '../lib/app-name';

/** Sets the document title (WCAG 2.4.2); React 19 hoists <title> into <head>. */
export function PageTitle({ title }: { title?: string }) {
  return <title>{title ? `${title} · ${APP_NAME}` : APP_NAME}</title>;
}
