export const CONSENT_STORAGE_KEY = "cookie-consent";
export const CONSENT_CHANGED_EVENT = "pip:consent-changed";
export const ANALYTICS_SESSION_KEY = "pip-sid";
export const ANALYTICS_VISITOR_KEY = "pip-vid";

export interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export type ConsentRecord = ConsentPreferences & { timestamp: string };

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ConsentRecord>;
    if (
      value.necessary !== true ||
      typeof value.analytics !== "boolean" ||
      typeof value.marketing !== "boolean" ||
      typeof value.functional !== "boolean"
    ) {
      return null;
    }
    return value as ConsentRecord;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

export function clearAnalyticsIdentifiers(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANALYTICS_VISITOR_KEY);
  } catch {
    // Storage can be unavailable in private browsing; no identifier is readable then.
  }
  try {
    window.sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
  } catch {
    // Same best-effort cleanup for session storage.
  }
}

export function writeConsent(preferences: ConsentPreferences): void {
  if (typeof window === "undefined") return;
  const consent: ConsentRecord = { ...preferences, timestamp: new Date().toISOString() };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // The choice still applies to this page; the banner may reappear next visit.
  }
  if (!preferences.analytics) clearAnalyticsIdentifiers();
  if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
  }
}
