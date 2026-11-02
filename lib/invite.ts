import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * SHA-256 of the owner's private invite code. Only the hash is committed;
 * the code itself (24 random URL-safe characters) is not in the repo.
 */
const INVITE_SHA256 = 'd4639b5f7aa012869f0f75546f10ac1a39d0dbb79d526b9460c1a9d87af062c3';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time check against SIGNUP_INVITE_CODE if set, else the committed hash. */
export function inviteValid(invite: unknown): boolean {
  if (typeof invite !== 'string' || invite.length === 0 || invite.length > 200) return false;
  const override = process.env.SIGNUP_INVITE_CODE;
  const expected = override ? sha256(override) : Buffer.from(INVITE_SHA256, 'hex');
  return timingSafeEqual(sha256(invite), expected);
}
