/**
 * Remembers where to send the user after they sign in, for the one case that
 * needs it: an AI assistant (claude.ai, ChatGPT) sent them to the consent
 * page while signed out. Only that page is ever remembered, so the value can
 * never become an open redirect.
 */
const KEY = 'licits-post-login';
const ALLOWED = /^\/(en|ro)\/auth\/authorize\?[^\s]*$/;

export function rememberPostLogin(pathWithQuery: string): void {
  try {
    if (ALLOWED.test(pathWithQuery)) window.sessionStorage.setItem(KEY, pathWithQuery);
  } catch {
    /* storage blocked: the user simply lands on the dashboard after login */
  }
}

/** The remembered page, once; null if none or not allowed. */
export function takePostLogin(): string | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return value && ALLOWED.test(value) ? value : null;
  } catch {
    return null;
  }
}
