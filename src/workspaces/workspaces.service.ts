import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupWorkItemStorageFiles } from '../attachments/cleanup-work-item-storage.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { isAdminRole } from './workspace-roles.js';

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

  /**
   * The user's role in the workspace (`owner` | `admin` | `member`), plus the
   * owner id. 404 if the workspace doesn't exist, 403 if the user isn't in it.
   * Every role check goes through here.
   */
  async getRole(
    workspaceId: string,
    userId: string,
  ): Promise<{ role: string; ownerId: string }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        owner_id: true,
        members: { where: { user_id: userId }, select: { role: true } },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // The owner always has an `owner` member row; owner_id is the fallback.
    const role =
      workspace.owner_id === userId ? 'owner' : workspace.members[0]?.role;
    if (!role) {
      throw new ForbiddenException('No access to this workspace');
    }

    return { role, ownerId: workspace.owner_id };
  }

  /** Throws 403 unless the user is the workspace owner or an admin; returns their role. */
  async requireAdmin(
    workspaceId: string,
    userId: string,
    message = 'Only owner/admin can do this',
  ): Promise<{ role: string; ownerId: string }> {
    const result = await this.getRole(workspaceId, userId);
    if (!isAdminRole(result.role)) {
      throw new ForbiddenException(message);
    }
    return result;
  }

  async rename(workspaceId: string, dto: UpdateWorkspaceDto, userId: string) {
    await this.requireAdmin(
      workspaceId,
      userId,
      'Only owner/admin can rename a workspace',
    );

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name },
    });
  }

  /**
   * Makes another member the owner (ACCT-07). The previous owner stays on as
   * an admin; lists they created stay theirs.
   */
  async transferOwnership(
    workspaceId: string,
    newOwnerId: string,
    userId: string,
  ) {
    const { role } = await this.getRole(workspaceId, userId);
    if (role !== 'owner') {
      throw new ForbiddenException('Only the owner can transfer ownership');
    }
    if (newOwnerId === userId) {
      throw new BadRequestException('You already own this workspace');
    }

    const target = await this.prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: newOwnerId,
        },
      },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { owner_id: newOwnerId },
      }),
      this.prisma.workspaceMember.update({
        where: { id: target.id },
        data: { role: 'owner' },
      }),
      this.prisma.workspaceMember.update({
        where: {
          workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
        },
        data: { role: 'admin' },
      }),
    ]);

    return this.getWorkspace(workspaceId, userId);
  }

  async remove(workspaceId: string, userId: string) {
    const workspace = await this.getWorkspace(workspaceId, userId);

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('Only the owner can delete a workspace');
    }

    const workItems = await this.prisma.workItem.findMany({
      where: { list: { project: { workspace_id: workspaceId } } },
      select: { id: true },
    });
    await cleanupWorkItemStorageFiles(
      this.supabase,
      this.bucket,
      workItems.map((workItem) => workItem.id),
    );

    await this.prisma.workspace.delete({ where: { id: workspaceId } });

    return { message: 'Workspace deleted successfully' };
  }
}
