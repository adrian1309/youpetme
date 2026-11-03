import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageTitle } from '../../../components/PageTitle';
import { useTermsVersion } from './use-terms-version';

/** A paragraph, or a bulleted list, each item being one translation key. */
export type LegalBlock = { paragraph: string } | { list: string[] };

export interface LegalSection {
  /** Translation key of the section heading. */
  title: string;
  blocks: LegalBlock[];
}

interface LegalDocumentProps {
  titleKey: string;
  sections: LegalSection[];
}

function TermsVersion() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useTermsVersion();

  let text = t('legal.common.version.loading');
  if (isError) {
    text = t('legal.common.version.error');
  } else if (!isPending) {
    text = t('legal.common.version.current', { version: data });
  }

  return (
    <p aria-live="polite" className="mb-6 text-base text-text-muted">
      {text}
    </p>
  );
}

/**
 * Static legal text with the draft warning and the current terms version (SCRUM-47). The text
 * stays readable even when the version cannot be loaded.
 */
export function LegalDocument({ titleKey, sections }: LegalDocumentProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const title = t(titleKey);
  const draftTitleId = `${idPrefix}-draft`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <PageTitle title={title} />
      <h1 className="mb-2 text-3xl font-bold text-text">{title}</h1>
      <TermsVersion />
      <div
        role="note"
        aria-labelledby={draftTitleId}
        className="mb-8 rounded-control border-2 border-brand-primary bg-surface-muted p-4 text-base text-text"
      >
        <p id={draftTitleId} className="mb-1 font-bold">
          {t('legal.common.draft.title')}
        </p>
        <p>{t('legal.common.draft.body')}</p>
      </div>
      {sections.map((section, index) => {
        const headingId = `${idPrefix}-section-${index}`;
        return (
          <section key={section.title} aria-labelledby={headingId} className="mb-6">
            <h2 id={headingId} className="mb-2 text-xl font-bold text-text">
              {t(section.title)}
            </h2>
            {section.blocks.map((block) =>
              'paragraph' in block ? (
                <p key={block.paragraph} className="mb-2 text-base text-text">
                  {t(block.paragraph)}
                </p>
              ) : (
                <ul key={block.list.join()} className="mb-2 list-disc pl-6 text-base text-text">
                  {block.list.map((item) => (
                    <li key={item}>{t(item)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        );
      })}
      <Link to="/" className="font-medium text-brand-primary underline">
        {t('legal.common.back')}
      </Link>
    </div>
  );
}
