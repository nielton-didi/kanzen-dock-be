import { createHash, randomBytes } from 'node:crypto';

/** How long an invite link stays valid; resend restarts it. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Pending invites per workspace, so a runaway client can't pile up rows. */
export const MAX_PENDING_INVITES = 100;

/** Emails are compared case-insensitively; invites store them lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Only the hash is stored, so a DB read doesn't leak usable links. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A new link token (256 bits, URL-safe) and the hash to store. */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function inviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

export function isInviteExpired(
  invite: { expires_at: Date },
  now = new Date(),
): boolean {
  return invite.expires_at.getTime() <= now.getTime();
}
