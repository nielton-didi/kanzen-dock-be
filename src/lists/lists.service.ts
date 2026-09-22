import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupIssueStorageFiles } from '../attachments/cleanup-issue-storage.util.js';
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

    return this.prisma.list.create({
      data: {
        name: dto.name,
        project_id: projectId,
      },
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

    return this.prisma.list.update({
      where: { id: listId },
      data: dto,
    });
  }

  async remove(listId: string, userId: string) {
    const list = await this.findListOrThrow(listId);
    await this.verifyAdminAccess(list.project_id, userId);

    const issues = await this.prisma.issue.findMany({
      where: { list_id: listId },
      select: { id: true },
    });
    await cleanupIssueStorageFiles(
      this.supabase,
      this.bucket,
      issues.map((issue) => issue.id),
    );

    await this.prisma.list.delete({ where: { id: listId } });

    return { message: 'List deleted successfully' };
  }

  private async findListOrThrow(listId: string): Promise<ListModel> {
    const list = await this.prisma.list.findUnique({ where: { id: listId } });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  /** Verifies the user is workspace owner/admin for the project's workspace. */
  private async verifyAdminAccess(projectId: string, userId: string) {
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
