import type { LegalSection } from './LegalDocument';

const S = 'legal.privacy.sections';

/**
 * Provisional, academic Privacy Policy (SCRUM-47). It covers only what the platform does today
 * (registration); each statement comes from the cited document, and what no document decides
 * is shown as "[Pendiente de definir]". When this text changes, TERMS_VERSION on the API must
 * change with it (TS-IAM-001).
 */
export const PRIVACY_SECTIONS: LegalSection[] = [
  // Not defined by any document.
  { title: `${S}.controller.title`, blocks: [{ paragraph: `${S}.controller.p1` }] },
  // TS-IAM-001 (data model, confirmPassword never stored); Domain Model (User, UserProfile);
  // ADR-002 (Argon2id); ADR-011 (hasSeenWelcome).
  {
    title: `${S}.data.title`,
    blocks: [
      { paragraph: `${S}.data.p1` },
      {
        list: [
          `${S}.data.names`,
          `${S}.data.email`,
          `${S}.data.password`,
          `${S}.data.acceptance`,
          `${S}.data.welcome`,
          `${S}.data.timestamps`,
        ],
      },
    ],
  },
  // Domain Model — UserSession; ADR-002 (refresh token hashed, access token in memory).
  {
    title: `${S}.session.title`,
    blocks: [{ paragraph: `${S}.session.p1` }, { paragraph: `${S}.session.p2` }],
  },
  // ADR-002 and TS-IAM-001 (HttpOnly refresh cookie); ADR-011 (localStorage welcome key).
  {
    title: `${S}.browser.title`,
    blocks: [
      { paragraph: `${S}.browser.p1` },
      { list: [`${S}.browser.cookie`, `${S}.browser.welcome`] },
    ],
  },
  // TS-IAM-001 (purpose of registration).
  {
    title: `${S}.purpose.title`,
    blocks: [{ list: [`${S}.purpose.account`, `${S}.purpose.session`, `${S}.purpose.acceptance`] }],
  },
  // NFR — Privacy, Lawful basis ("consent"); pending legal validation.
  { title: `${S}.basis.title`, blocks: [{ paragraph: `${S}.basis.p1` }] },
  // NFR — Privacy, Data minimization.
  { title: `${S}.minimization.title`, blocks: [{ paragraph: `${S}.minimization.p1` }] },
  // Not defined, except the 7-day session (ADR-002).
  {
    title: `${S}.retention.title`,
    blocks: [{ paragraph: `${S}.retention.p1` }, { paragraph: `${S}.retention.p2` }],
  },
  // ARCH-002 — Deployment candidates (hosting not decided).
  { title: `${S}.recipients.title`, blocks: [{ paragraph: `${S}.recipients.p1` }] },
  // NFR — Privacy (erasure, access and portability not available yet).
  {
    title: `${S}.rights.title`,
    blocks: [{ paragraph: `${S}.rights.p1` }, { paragraph: `${S}.rights.p2` }],
  },
  // ADR-002; NFR — Security.
  {
    title: `${S}.security.title`,
    blocks: [{ list: [`${S}.security.hash`, `${S}.security.logs`, `${S}.security.cookie`] }],
  },
  // TS-IAM-001 (termsVersion); SCRUM-47.
  { title: `${S}.changes.title`, blocks: [{ paragraph: `${S}.changes.p1` }] },
];
