import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupIssueStorageFiles } from '../attachments/cleanup-issue-storage.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { InviteMemberDto } from './dto/invite-member.dto.js';

@Injectable()
export class WorkspacesService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

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

  async remove(workspaceId: string, userId: string) {
    const workspace = await this.getWorkspace(workspaceId, userId);

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('Only the owner can delete a workspace');
    }

    const issues = await this.prisma.issue.findMany({
      where: { list: { project: { workspace_id: workspaceId } } },
      select: { id: true },
    });
    await cleanupIssueStorageFiles(
      this.supabase,
      this.bucket,
      issues.map((issue) => issue.id),
    );

    await this.prisma.workspace.delete({ where: { id: workspaceId } });

    return { message: 'Workspace deleted successfully' };
  }
}
