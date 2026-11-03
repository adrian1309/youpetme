import type { LegalSection } from './LegalDocument';

const S = 'legal.terms.sections';

/**
 * Provisional, academic Terms of Service (SCRUM-47). Each statement comes from the cited
 * document; what no document decides is shown as "[Pendiente de definir]". When this text
 * changes, TERMS_VERSION on the API must change with it (TS-IAM-001).
 */
export const TERMS_SECTIONS: LegalSection[] = [
  // Project Overview; AGENTS.md (Purpose: TFM).
  {
    title: `${S}.service.title`,
    blocks: [{ paragraph: `${S}.service.p1` }, { paragraph: `${S}.service.p2` }],
  },
  // Non Functional Requirements — Availability (academic prototype, no SLA).
  { title: `${S}.status.title`, blocks: [{ paragraph: `${S}.status.p1` }] },
  // TS-IAM-001 (input rules, unique email); ADR-002 (password policy); Domain Model — MVP roles.
  {
    title: `${S}.account.title`,
    blocks: [{ paragraph: `${S}.account.p1` }, { paragraph: `${S}.account.p2` }],
  },
  // TS-IAM-001 (authenticated after registering); ADR-002 (7-day refresh cookie).
  { title: `${S}.session.title`, blocks: [{ paragraph: `${S}.session.p1` }] },
  // TS-IAM-001 (termsAcceptedAt, termsVersion); NFR — Lawful basis; SCRUM-47.
  {
    title: `${S}.acceptance.title`,
    blocks: [{ paragraph: `${S}.acceptance.p1` }, { paragraph: `${S}.acceptance.p2` }],
  },
  // MVP (adoption and AI not implemented yet).
  { title: `${S}.future.title`, blocks: [{ paragraph: `${S}.future.p1` }] },
  // Not defined by any document.
  {
    title: `${S}.pending.title`,
    blocks: [
      { paragraph: `${S}.pending.p1` },
      { list: [`${S}.pending.owner`, `${S}.pending.closing`, `${S}.pending.law`] },
    ],
  },
];
