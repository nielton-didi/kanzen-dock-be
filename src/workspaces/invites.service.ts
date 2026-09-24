import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../common/errors/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  UserModel,
  WorkspaceInviteModel,
} from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInviteDto } from './dto/create-invite.dto.js';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  isInviteExpired,
  MAX_PENDING_INVITES,
  normalizeEmail,
} from './invite-token.js';
import { canInviteAs, type AssignableRole } from './workspace-roles.js';
import { WorkspacesService } from './workspaces.service.js';

const INVITER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar_url: true,
} as const;

type InviteWithInviter = WorkspaceInviteModel & {
  inviter: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
};

/** API shape of an invite. Never includes the token hash. */
function toInviteResponse(invite: InviteWithInviter) {
  return {
    id: invite.id,
    workspace_id: invite.workspace_id,
    email: invite.email,
    role: invite.role,
    invited_by: invite.invited_by,
    inviter: invite.inviter,
    created_at: invite.created_at,
    expires_at: invite.expires_at,
    expired: isInviteExpired(invite),
  };
}

/** Admins invite (and resend/revoke invites) as member only. */
function assertCanInviteAs(actorRole: string, role: AssignableRole) {
  if (!canInviteAs(actorRole, role)) {
    throw new ForbiddenException('Only the owner can invite admins');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Pending invites by email (COLLAB-01). Delivery is a copyable link
 * (`/invite/<token>`) for now; invitees also see their pending invites in the
 * app. Accepting always requires being logged in as the invited email
 * (Supabase confirms emails before login, so that proves ownership).
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  // --- Workspace side (owner/admin) -----------------------------------------

  async list(workspaceId: string, userId: string) {
    await this.requireInviter(workspaceId, userId);

    const invites = await this.prisma.workspaceInvite.findMany({
      where: { workspace_id: workspaceId },
      include: { inviter: { select: INVITER_SELECT } },
      orderBy: { created_at: 'desc' },
    });

    return invites.map(toInviteResponse);
  }

  /** Returns the invite plus its `token` (only here and on resend). */
  async create(workspaceId: string, dto: CreateInviteDto, userId: string) {
    const role: AssignableRole = dto.role ?? 'member';
    assertCanInviteAs(await this.requireInviter(workspaceId, userId), role);
    const email = normalizeEmail(dto.email);

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspace_id: workspaceId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
    });
    if (member) {
      throw apiError(
        HttpStatus.CONFLICT,
        `${email} is already a member of this workspace`,
        'already_member',
      );
    }

    const existing = await this.prisma.workspaceInvite.findUnique({
      where: { workspace_id_email: { workspace_id: workspaceId, email } },
    });
    if (existing && !isInviteExpired(existing)) {
      throw apiError(
        HttpStatus.CONFLICT,
        `${email} already has a pending invite`,
        'invite_exists',
        { invite_id: existing.id },
      );
    }

    if (!existing) {
      const pending = await this.prisma.workspaceInvite.count({
        where: { workspace_id: workspaceId },
      });
      if (pending >= MAX_PENDING_INVITES) {
        throw apiError(
          HttpStatus.BAD_REQUEST,
          `A workspace can have at most ${MAX_PENDING_INVITES} pending invites`,
          'invite_limit',
        );
      }
    }

    const { token, tokenHash } = generateInviteToken();
    const data = {
      role,
      token_hash: tokenHash,
      invited_by: userId,
      created_at: new Date(),
      expires_at: inviteExpiry(),
    };

    try {
      // An expired invite for the same email is replaced in place.
      const invite = existing
        ? await this.prisma.workspaceInvite.update({
            where: { id: existing.id },
            data,
            include: { inviter: { select: INVITER_SELECT } },
          })
        : await this.prisma.workspaceInvite.create({
            data: { ...data, workspace_id: workspaceId, email },
            include: { inviter: { select: INVITER_SELECT } },
          });
      return { ...toInviteResponse(invite), token };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw apiError(
          HttpStatus.CONFLICT,
          `${email} already has a pending invite`,
          'invite_exists',
        );
      }
      throw error;
    }
  }

  /** New token (the old link stops working) and a fresh expiry. */
  async resend(workspaceId: string, inviteId: string, userId: string) {
    const actorRole = await this.requireInviter(workspaceId, userId);
    const invite = await this.findWorkspaceInviteOrThrow(workspaceId, inviteId);
    assertCanInviteAs(actorRole, invite.role as AssignableRole);

    const { token, tokenHash } = generateInviteToken();
    const updated = await this.prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { token_hash: tokenHash, expires_at: inviteExpiry() },
      include: { inviter: { select: INVITER_SELECT } },
    });

    return { ...toInviteResponse(updated), token };
  }

  async revoke(workspaceId: string, inviteId: string, userId: string) {
    const actorRole = await this.requireInviter(workspaceId, userId);
    const invite = await this.findWorkspaceInviteOrThrow(workspaceId, inviteId);
    assertCanInviteAs(actorRole, invite.role as AssignableRole);

    await this.prisma.workspaceInvite.deleteMany({ where: { id: invite.id } });

    return { message: 'Invite revoked' };
  }

  // --- Invitee side ------------------------------------------------------------

  /** Public preview for the `/invite/<token>` page. 404 for unknown or revoked links. */
  async preview(token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token_hash: hashInviteToken(token) },
      include: {
        workspace: { select: { id: true, name: true } },
        inviter: { select: { name: true, email: true } },
      },
    });
    if (!invite) {
      throw this.inviteNotFound();
    }

    return {
      workspace: invite.workspace,
      invited_by: invite.inviter
        ? { name: invite.inviter.name ?? invite.inviter.email }
        : null,
      email: invite.email,
      role: invite.role,
      expires_at: invite.expires_at,
      expired: isInviteExpired(invite),
    };
  }

  async acceptByToken(token: string, user: UserModel) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token_hash: hashInviteToken(token) },
    });
    if (!invite) {
      throw this.inviteNotFound();
    }

    return this.accept(invite, user);
  }

  /** Pending (unexpired) invites for the current user's email, for an in-app banner. */
  async listMine(user: UserModel) {
    const invites = await this.prisma.workspaceInvite.findMany({
      where: {
        email: normalizeEmail(user.email),
        expires_at: { gt: new Date() },
        workspace: { members: { none: { user_id: user.id } } },
      },
      include: {
        workspace: { select: { id: true, name: true } },
        inviter: { select: INVITER_SELECT },
      },
      orderBy: { created_at: 'desc' },
    });

    return invites.map((invite) => ({
      ...toInviteResponse(invite),
      workspace: invite.workspace,
    }));
  }

  async acceptMine(inviteId: string, user: UserModel) {
    return this.accept(await this.findMyInviteOrThrow(inviteId, user), user);
  }

  async declineMine(inviteId: string, user: UserModel) {
    const invite = await this.findMyInviteOrThrow(inviteId, user);
    await this.prisma.workspaceInvite.deleteMany({ where: { id: invite.id } });

    return { message: 'Invite declined' };
  }

  // --- Internals ---------------------------------------------------------------

  /**
   * Joins the workspace with the invite's role and deletes the invite.
   * Accepting when already a member just removes the invite (idempotent).
   */
  private async accept(invite: WorkspaceInviteModel, user: UserModel) {
    if (normalizeEmail(user.email) !== invite.email) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        `This invite was sent to ${invite.email}. Log in with that email to accept it.`,
        'email_mismatch',
      );
    }
    if (isInviteExpired(invite)) {
      throw apiError(
        HttpStatus.GONE,
        'This invite has expired. Ask for a new one.',
        'invite_expired',
      );
    }

    const join = () =>
      this.prisma.$transaction(async (tx) => {
        const existing = await tx.workspaceMember.findUnique({
          where: {
            workspace_id_user_id: {
              workspace_id: invite.workspace_id,
              user_id: user.id,
            },
          },
        });
        const member =
          existing ??
          (await tx.workspaceMember.create({
            data: {
              workspace_id: invite.workspace_id,
              user_id: user.id,
              role: invite.role,
              invited_by: invite.invited_by,
            },
          }));
        await tx.workspaceInvite.deleteMany({ where: { id: invite.id } });
        return { member, alreadyMember: Boolean(existing) };
      });

    let result: Awaited<ReturnType<typeof join>>;
    try {
      result = await join();
    } catch (error) {
      // Lost a race with a concurrent accept: the membership exists now.
      if (!isUniqueViolation(error)) throw error;
      result = await join();
    }

    return {
      workspace_id: invite.workspace_id,
      role: result.member.role,
      already_member: result.alreadyMember,
    };
  }

  /** The caller's role; 403 unless owner/admin. */
  private async requireInviter(workspaceId: string, userId: string) {
    const { role } = await this.workspacesService.requireAdmin(
      workspaceId,
      userId,
      'Only owner/admin can manage invites',
    );
    return role;
  }

  private async findWorkspaceInviteOrThrow(
    workspaceId: string,
    inviteId: string,
  ) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.workspace_id !== workspaceId) {
      throw this.inviteNotFound();
    }
    return invite;
  }

  /** Someone else's invite reads as not found. */
  private async findMyInviteOrThrow(inviteId: string, user: UserModel) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.email !== normalizeEmail(user.email)) {
      throw this.inviteNotFound();
    }
    return invite;
  }

  private inviteNotFound() {
    return apiError(
      HttpStatus.NOT_FOUND,
      'This invite is no longer valid',
      'invite_not_found',
    );
  }
}
