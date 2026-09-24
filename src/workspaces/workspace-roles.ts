/**
 * Workspace role rules (design-guidelines §6.5). Pure functions so the matrix
 * is unit-tested in one place; services call these and throw.
 *
 * - owner: everything; the only one who changes roles, invites as admin,
 *   removes admins, transfers ownership or deletes the workspace.
 * - admin: invites as member, removes members, manages projects and all lists.
 * - member: creates lists and manages the lists they created.
 */
export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be granted by invite or role change; ownership only moves by transfer. */
export const ASSIGNABLE_ROLES = ['admin', 'member'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export function isAdminRole(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

/** Owner invites as admin or member; admin invites as member only. */
export function canInviteAs(actor: string, role: AssignableRole): boolean {
  if (actor === 'owner') return true;
  return actor === 'admin' && role === 'member';
}

/** Owner removes admins and members; admin removes members. Nobody removes the owner. */
export function canRemoveMember(actor: string, target: string): boolean {
  if (target === 'owner') return false;
  if (actor === 'owner') return true;
  return actor === 'admin' && target === 'member';
}

/** Only the owner changes roles, and never their own (ownership moves by transfer). */
export function canChangeRole(actor: string, target: string): boolean {
  return actor === 'owner' && target !== 'owner';
}

/** Owner/admin manage every list; a member manages the lists they created. */
export function canManageList(
  role: string,
  userId: string,
  listCreatedBy: string | null,
): boolean {
  return isAdminRole(role) || listCreatedBy === userId;
}

/** Display order for member lists: owner, admins, members. */
export function roleRank(role: string): number {
  const index = (WORKSPACE_ROLES as readonly string[]).indexOf(role);
  return index === -1 ? WORKSPACE_ROLES.length : index;
}
