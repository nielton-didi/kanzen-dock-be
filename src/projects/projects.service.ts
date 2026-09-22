import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProjectModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
  ) {}

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

  async create(workspaceId: string, dto: CreateProjectDto, userId: string) {
    await this.workspacesService.getWorkspace(workspaceId, userId);

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
}
