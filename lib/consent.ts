/** Google Analytics measurement ID (G-XXXXXXXXXX). With no ID there is nothing to consent to, so no banner shows. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

export type Consent = 'unknown' | 'granted' | 'denied';

const KEY = 'licits_consent';
const EVENT = 'licits:consent';

/** Browser storage can be blocked, so every access is guarded and falls back to "not decided yet". */
export function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function writeConsent(value: Consent) {
  try {
    if (value === 'unknown') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    /* a blocked store just means the choice is not remembered */
  }
  if (value !== 'granted') clearAnalyticsCookies();
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeConsent(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Switches Google Analytics off for this page view and removes its cookies from licits.com. */
function clearAnalyticsCookies() {
  if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true;
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.replace(/^www\./, '')}`];
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (!name || !(name === '_ga' || name.startsWith('_ga_') || name === '_gid')) continue;
    for (const d of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
}
