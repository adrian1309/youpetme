/**
 * GET /api/v1/legal/terms-version (TS-IAM-001, SCRUM-47). The version of the Terms of Service and
 * Privacy Policy currently recorded on registration, so the /terms and /privacy pages show the
 * same value the server stores in `termsVersion`.
 */
export interface TermsVersionResponse {
  version: string;
}
