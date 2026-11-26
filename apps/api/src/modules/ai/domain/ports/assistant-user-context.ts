/** What Diango may know about the signed-in user (ADR-011, Option Y): no new data collected. */
export interface AssistantUserContext {
  firstName: string;
  /** UserProfile.matchingPreferences from the latest AI Matching run; null when there is none. */
  matchingPreferences: unknown;
}

export interface AssistantUserContextReader {
  find(userId: string): Promise<AssistantUserContext | null>;
}
