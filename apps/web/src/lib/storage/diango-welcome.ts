/**
 * localStorage mark meaning "this guest already saw Diango's welcome" (ADR-011). Registration
 * sends `hasSeenWelcome: true` only when it holds exactly "true" (TS-IAM-001). The Diango story
 * (SCRUM-17) writes the mark when the welcome is closed.
 */
export const DIANGO_WELCOME_SEEN_KEY = 'youpetme:diango-welcome-seen';

/** False when the key is absent, holds anything but "true", or storage is unavailable. */
export function readDiangoWelcomeSeen(): boolean {
  try {
    return window.localStorage.getItem(DIANGO_WELCOME_SEEN_KEY) === 'true';
  } catch {
    // Private mode or blocked storage: treat as "not seen" and let registration proceed.
    return false;
  }
}

/** Marks the welcome as seen for this browser; ignored when storage is unavailable. */
export function writeDiangoWelcomeSeen(): void {
  try {
    window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, 'true');
  } catch {
    // Blocked storage: the guest may see the welcome again, which is harmless.
  }
}
