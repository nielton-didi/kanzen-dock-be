import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TTL_MS,
  inviteExpiry,
  isInviteExpired,
  normalizeEmail,
} from './invite-token.js';
import {
  canChangeRole,
  canInviteAs,
  canManageList,
  canRemoveMember,
  isAdminRole,
  roleRank,
} from './workspace-roles.js';

describe('workspace roles (§6.5)', () => {
  it('owner invites as admin or member; admin as member only; member never', () => {
    expect(canInviteAs('owner', 'admin')).toBe(true);
    expect(canInviteAs('owner', 'member')).toBe(true);
    expect(canInviteAs('admin', 'member')).toBe(true);
    expect(canInviteAs('admin', 'admin')).toBe(false);
    expect(canInviteAs('member', 'member')).toBe(false);
  });

  it.each([
    ['owner', 'admin', true],
    ['owner', 'member', true],
    ['owner', 'owner', false],
    ['admin', 'member', true],
    ['admin', 'admin', false],
    ['admin', 'owner', false],
    ['member', 'member', false],
  ])('%s removing %s → %s', (actor, target, expected) => {
    expect(canRemoveMember(actor, target)).toBe(expected);
  });

  it('only the owner changes roles, and not the owner role', () => {
    expect(canChangeRole('owner', 'admin')).toBe(true);
    expect(canChangeRole('owner', 'member')).toBe(true);
    expect(canChangeRole('owner', 'owner')).toBe(false);
    expect(canChangeRole('admin', 'member')).toBe(false);
    expect(canChangeRole('member', 'member')).toBe(false);
  });

  it('owner/admin manage every list; members only lists they created', () => {
    expect(canManageList('owner', 'u1', 'u2')).toBe(true);
    expect(canManageList('admin', 'u1', null)).toBe(true);
    expect(canManageList('member', 'u1', 'u1')).toBe(true);
    expect(canManageList('member', 'u1', 'u2')).toBe(false);
    expect(canManageList('member', 'u1', null)).toBe(false);
  });

  it('ranks owner, admin, member, then unknown', () => {
    expect(
      ['member', 'bogus', 'owner', 'admin'].sort(
        (a, b) => roleRank(a) - roleRank(b),
      ),
    ).toEqual(['owner', 'admin', 'member', 'bogus']);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('member')).toBe(false);
  });
});

describe('invite tokens', () => {
  it('generates distinct URL-safe tokens and stores only their hash', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).not.toContain(a.token);
  });

  it('normalizes emails and expires after the TTL', () => {
    expect(normalizeEmail('  Bob@Example.COM ')).toBe('bob@example.com');
    const now = new Date('2026-09-25T00:00:00Z');
    const expires_at = inviteExpiry(now);
    expect(expires_at.getTime() - now.getTime()).toBe(INVITE_TTL_MS);
    expect(isInviteExpired({ expires_at }, now)).toBe(false);
    expect(isInviteExpired({ expires_at }, expires_at)).toBe(true);
  });
});
