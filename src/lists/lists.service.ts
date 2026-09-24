import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupWorkItemStorageFiles } from '../attachments/cleanup-work-item-storage.util.js';
import { DEFAULT_STATUSES } from './default-statuses.const.js';
import type { ListModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { CreateListDto } from './dto/create-list.dto.js';
import type { UpdateListDto } from './dto/update-list.dto.js';

@Injectable()
export class ListsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly workspacesService: WorkspacesService,
    private readonly supabase: SupabaseService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  /** Verifies the user has access to the list (via its project's workspace) and returns it. */
  async verifyAccess(listId: string, userId: string): Promise<ListModel> {
    const list = await this.findListOrThrow(listId);

    await this.projectsService.verifyAccess(list.project_id, userId);

    return list;
  }

  async create(projectId: string, dto: CreateListDto, userId: string) {
    await this.verifyAdminAccess(projectId, userId);

    return this.prisma.$transaction(async (tx) => {
      const list = await tx.list.create({
        data: {
          name: dto.name,
          project_id: projectId,
        },
      });

      await tx.status.createMany({
        data: DEFAULT_STATUSES.map((status) => ({
          ...status,
          list_id: list.id,
        })),
      });

      return list;
    });
  }

  async findAllByProject(projectId: string, userId: string) {
    await this.projectsService.verifyAccess(projectId, userId);

    return this.prisma.list.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'asc' },
    });
  }

  async findOne(listId: string, userId: string) {
    return this.verifyAccess(listId, userId);
  }

  async update(listId: string, dto: UpdateListDto, userId: string) {
    const list = await this.findListOrThrow(listId);
    await this.verifyAdminAccess(list.project_id, userId);

    if (dto.project_id && dto.project_id !== list.project_id) {
      const destination = await this.projectsService.verifyAccess(
        dto.project_id,
        userId,
      );
      await this.verifyAdminAccess(dto.project_id, userId);

      const currentProject = await this.projectsService.verifyAccess(
        list.project_id,
        userId,
      );
      if (destination.workspace_id !== currentProject.workspace_id) {
        throw new BadRequestException(
          'Cannot move a list to a project in a different workspace',
        );
      }
    }

    return this.prisma.list.update({
      where: { id: listId },
      data: { name: dto.name, project_id: dto.project_id },
    });
  }

  async remove(listId: string, userId: string) {
    const list = await this.findListOrThrow(listId);
    await this.verifyAdminAccess(list.project_id, userId);

    const workItems = await this.prisma.workItem.findMany({
      where: { list_id: listId },
      select: { id: true },
    });
    await cleanupWorkItemStorageFiles(
      this.supabase,
      this.bucket,
      workItems.map((workItem) => workItem.id),
    );

    await this.prisma.list.delete({ where: { id: listId } });

    return { message: 'List deleted successfully' };
  }

  /** Verifies the user is workspace owner/admin for the list's project, and returns the list. */
  async verifyListAdminAccess(
    listId: string,
    userId: string,
  ): Promise<ListModel> {
    const list = await this.findListOrThrow(listId);
    await this.verifyAdminAccess(list.project_id, userId);

    return list;
  }

  private async findListOrThrow(listId: string): Promise<ListModel> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  /** Verifies the user is workspace owner/admin for the project's workspace. */
  async verifyAdminAccess(projectId: string, userId: string) {
    const project = await this.projectsService.verifyAccess(projectId, userId);
    const workspace = await this.workspacesService.getWorkspace(
      project.workspace_id,
      userId,
    );

    const member = workspace.members.find((m) => m.user_id === userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Only owner/admin can manage lists');
    }
  }
}
