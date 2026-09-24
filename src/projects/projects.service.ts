import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupWorkItemStorageFiles } from '../attachments/cleanup-work-item-storage.util.js';
import type { ProjectModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';

@Injectable()
export class ProjectsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
    private readonly supabase: SupabaseService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  /** Verifies the user has access to the project (via its workspace) and returns it. */
  async verifyAccess(projectId: string, userId: string): Promise<ProjectModel> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.workspacesService.getWorkspace(project.workspace_id, userId);

    return project;
  }

  /** Projects are workspace structure: owner/admin only (§6.5). Members create lists. */
  async create(workspaceId: string, dto: CreateProjectDto, userId: string) {
    await this.workspacesService.requireAdmin(
      workspaceId,
      userId,
      'Only owner/admin can create a project',
    );

    return this.prisma.project.create({
      data: {
        name: dto.name,
        workspace_id: workspaceId,
        created_by: userId,
      },
      include: { creator: true },
    });
  }

  async findAllByWorkspace(workspaceId: string, userId: string) {
    await this.workspacesService.getWorkspace(workspaceId, userId);

    return this.prisma.project.findMany({
      where: { workspace_id: workspaceId },
      include: { creator: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async remove(projectId: string, userId: string) {
    const project = await this.verifyAccess(projectId, userId);
    await this.workspacesService.requireAdmin(
      project.workspace_id,
      userId,
      'Only owner/admin can delete a project',
    );

    const workItems = await this.prisma.workItem.findMany({
      where: { list: { project_id: projectId } },
      select: { id: true },
    });
    await cleanupWorkItemStorageFiles(
      this.supabase,
      this.bucket,
      workItems.map((workItem) => workItem.id),
    );

    await this.prisma.project.delete({ where: { id: projectId } });

    return { message: 'Project deleted successfully' };
  }
}
