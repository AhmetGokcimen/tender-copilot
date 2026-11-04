/**
 * Several stores keep per-user data in this browser's localStorage (tracked
 * tenders, drafts, company profile, ...). Without an owner mark, the next
 * account signed in on the same browser inherited all of it. The owner id is
 * stored next to the data; when a different user signs in, or on sign-out, the
 * user-bound keys are wiped before the app renders.
 */
const OWNER_KEY = 'licits-local-owner';

const USER_KEYS = [
  'ofera-pipeline',
  'ofera-company',
  'ofera-generator',
  'ofera-authorizations',
  'ofera-assistant',
  'licits-bid-inputs',
];

function wipe() {
  for (const k of USER_KEYS) window.localStorage.removeItem(k);
}

/** Returns true when stale data of another user was removed (the caller should reload). */
export function claimLocalData(userId: string): boolean {
  try {
    const owner = window.localStorage.getItem(OWNER_KEY);
    if (owner === userId) return false;
    // Legacy data (no owner yet) cannot be attributed to anyone, so it is dropped as well.
    const hadData = USER_KEYS.some((k) => window.localStorage.getItem(k) !== null);
    wipe();
    window.localStorage.setItem(OWNER_KEY, userId);
    return hadData;
  } catch {
    return false;
  }
}

export function releaseLocalData() {
  try {
    wipe();
    window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* blocked storage: nothing was kept */
  }
}
