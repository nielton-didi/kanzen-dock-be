import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { apiError } from '../common/errors/api-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  canChangeRole,
  canRemoveMember,
  roleRank,
  type AssignableRole,
} from './workspace-roles.js';
import { WorkspacesService } from './workspaces.service.js';

const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar_url: true,
} as const;

const MEMBER_INCLUDE = { user: { select: MEMBER_USER_SELECT } } as const;

/** Member list, role changes, removal and leaving (COLLAB-02, ACCT-08). */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  /** Every member can see the list (§6.5); owner first, then admins, then members by name. */
  async list(workspaceId: string, userId: string) {
    await this.workspacesService.getRole(workspaceId, userId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspace_id: workspaceId },
      include: MEMBER_INCLUDE,
    });

    return members.sort(
      (a, b) =>
        roleRank(a.role) - roleRank(b.role) ||
        (a.user.name ?? a.user.email).localeCompare(
          b.user.name ?? b.user.email,
        ),
    );
  }

  async updateRole(
    workspaceId: string,
    targetUserId: string,
    role: AssignableRole,
    userId: string,
  ) {
    const { role: actorRole } = await this.workspacesService.getRole(
      workspaceId,
      userId,
    );
    // Non-owners are refused before anything about the target is revealed.
    if (actorRole !== 'owner') {
      throw new ForbiddenException('Only the owner can change roles');
    }
    const target = await this.findMemberOrThrow(workspaceId, targetUserId);

    if (!canChangeRole(actorRole, target.role)) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        "The owner's role can't be changed; transfer ownership instead",
        'owner_role_locked',
      );
    }

    return this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role },
      include: MEMBER_INCLUDE,
    });
  }

  async remove(workspaceId: string, targetUserId: string, userId: string) {
    if (targetUserId === userId) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'Use leave to remove yourself from a workspace',
        'use_leave',
      );
    }

    const { role: actorRole, ownerId } = await this.workspacesService.getRole(
      workspaceId,
      userId,
    );
    const target = await this.findMemberOrThrow(workspaceId, targetUserId);

    if (!canRemoveMember(actorRole, target.role)) {
      throw new ForbiddenException(
        target.role === 'owner'
          ? "The workspace owner can't be removed"
          : actorRole === 'admin'
            ? 'Only the owner can remove admins'
            : 'Only owner/admin can remove members',
      );
    }

    await this.prisma.$transaction((tx) =>
      this.detach(tx, workspaceId, targetUserId, ownerId),
    );

    return { message: 'Member removed successfully' };
  }

  /** ACCT-08. The owner has to transfer ownership (or delete the workspace) first. */
  async leave(workspaceId: string, userId: string) {
    const { role, ownerId } = await this.workspacesService.getRole(
      workspaceId,
      userId,
    );
    if (role === 'owner') {
      throw apiError(
        HttpStatus.CONFLICT,
        'The owner can’t leave; transfer ownership or delete the workspace',
        'owner_cannot_leave',
      );
    }

    await this.prisma.$transaction((tx) =>
      this.detach(tx, workspaceId, userId, ownerId),
    );

    return { message: 'You left the workspace' };
  }

  /**
   * Takes a user out of a workspace: their membership, their personal list
   * preferences there, and hands the lists they created to the owner.
   * Assignments and person-field values are kept (clients show them as a
   * former member).
   */
  private async detach(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    userId: string,
    ownerId: string,
  ) {
    await tx.workspaceMember.delete({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
    });
    await tx.listUserPreference.deleteMany({
      where: {
        user_id: userId,
        list: { project: { workspace_id: workspaceId } },
      },
    });
    await tx.list.updateMany({
      where: { created_by: userId, project: { workspace_id: workspaceId } },
      data: { created_by: ownerId },
    });
  }

  private async findMemberOrThrow(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }
}
