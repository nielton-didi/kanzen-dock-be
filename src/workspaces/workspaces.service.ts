import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { InviteMemberDto } from './dto/invite-member.dto.js';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkspaceDto, userId: string) {
    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        owner_id: userId,
        members: {
          create: {
            user_id: userId,
            role: 'owner',
          },
        },
      },
      include: { owner: true, members: { include: { user: true } } },
    });
  }

  async getUserWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        OR: [{ owner_id: userId }, { members: { some: { user_id: userId } } }],
      },
      include: {
        owner: true,
        members: { include: { user: true } },
        projects: true,
      },
    });
  }

  async getWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: true,
        members: { include: { user: true } },
        projects: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const hasAccess =
      workspace.owner_id === userId ||
      workspace.members.some((m) => m.user_id === userId);

    if (!hasAccess) {
      throw new ForbiddenException('No access to this workspace');
    }

    return workspace;
  }

  async inviteMember(
    workspaceId: string,
    dto: InviteMemberDto,
    userId: string,
  ) {
    const workspace = await this.getWorkspace(workspaceId, userId);

    const requester = workspace.members.find((m) => m.user_id === userId);
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new ForbiddenException('Only owner/admin can invite members');
    }

    const userToInvite = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!userToInvite) {
      throw new NotFoundException('User not found');
    }

    const alreadyMember = workspace.members.some(
      (m) => m.user_id === userToInvite.id,
    );
    if (alreadyMember) {
      throw new ForbiddenException('User already member of workspace');
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: userToInvite.id,
        role: dto.role ?? 'member',
        invited_by: userId,
      },
      include: { user: true },
    });
  }

  async removeMember(
    workspaceId: string,
    memberUserId: string,
    userId: string,
  ) {
    const workspace = await this.getWorkspace(workspaceId, userId);

    const requester = workspace.members.find((m) => m.user_id === userId);
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new ForbiddenException('Only owner/admin can remove members');
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: memberUserId,
        },
      },
    });

    return { message: 'Member removed successfully' };
  }
}
