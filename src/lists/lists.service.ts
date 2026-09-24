import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupWorkItemStorageFiles } from '../attachments/cleanup-work-item-storage.util.js';
import type { ListModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { canManageList } from '../workspaces/workspace-roles.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { CreateListDto } from './dto/create-list.dto.js';
import type { UpdateListDto } from './dto/update-list.dto.js';
import {
  DEFAULT_TEMPLATE_KEY,
  findListTemplate,
  templateRows,
} from './list-templates.const.js';

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

  /** Any workspace member can create a list; they then manage it (§6.5). */
  async create(projectId: string, dto: CreateListDto, userId: string) {
    await this.projectsService.verifyAccess(projectId, userId);

    // The DTO already rejects unknown keys; this guards other callers.
    const templateKey = dto.template_key ?? DEFAULT_TEMPLATE_KEY;
    const template = findListTemplate(templateKey);
    if (!template) {
      throw new BadRequestException(`Unknown list template "${templateKey}"`);
    }
    const { statuses, fields } = templateRows(template);

    // Copy-on-create (D3): the list gets its own statuses and fields, with no
    // link back to the template.
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.list.create({
        data: {
          name: dto.name,
          project_id: projectId,
          created_by: userId,
        },
      });

      await tx.status.createMany({
        data: statuses.map((status) => ({ ...status, list_id: list.id })),
      });

      if (fields.length) {
        await tx.fieldDefinition.createMany({
          data: fields.map((field) => ({ ...field, list_id: list.id })),
        });
      }

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
    const list = await this.verifyListManageAccess(listId, userId);

    if (dto.project_id && dto.project_id !== list.project_id) {
      // Anyone who can manage the list may move it within its workspace
      // (members can create lists in any project).
      const destination = await this.projectsService.verifyAccess(
        dto.project_id,
        userId,
      );
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
    await this.verifyListManageAccess(listId, userId);

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

  /**
   * Verifies the user may manage the list (rename, move, delete, statuses,
   * fields): workspace owner/admin, or the member who created it. Returns the list.
   */
  async verifyListManageAccess(
    listId: string,
    userId: string,
  ): Promise<ListModel> {
    const list = await this.findListOrThrow(listId);
    const project = await this.projectsService.verifyAccess(
      list.project_id,
      userId,
    );
    const { role } = await this.workspacesService.getRole(
      project.workspace_id,
      userId,
    );

    if (!canManageList(role, userId, list.created_by)) {
      throw new ForbiddenException(
        'Only owner/admin or the list creator can manage this list',
      );
    }

    return list;
  }

  private async findListOrThrow(listId: string): Promise<ListModel> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }
}
