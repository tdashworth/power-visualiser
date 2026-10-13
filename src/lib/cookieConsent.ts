export type CookieConsentChoice = "accept" | "reject";

export interface CookieConsent {
  choice: CookieConsentChoice;
  timestamp: string;
}

const STORAGE_KEY = "cookie-consent";

export function getCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.choice !== "accept" && parsed.choice !== "reject") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: CookieConsentChoice): CookieConsent {
  const record: CookieConsent = { choice, timestamp: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
  return record;
}
