import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupIssueStorageFiles } from '../attachments/cleanup-issue-storage.util.js';
import type { IssueModel } from '../generated/prisma/models.js';
import { ListsService } from '../lists/lists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatusesService } from '../statuses/statuses.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreateIssueDto } from './dto/create-issue.dto.js';
import type { FindIssuesQueryDto } from './dto/find-issues-query.dto.js';
import type { UpdateIssueDto } from './dto/update-issue.dto.js';
import { IssueHistoryService } from './issue-history.service.js';

const ISSUE_INCLUDE = {
  status: true,
  assignee: true,
  reporter: true,
  attachments: true,
} as const;

@Injectable()
export class IssuesService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
    private readonly statusesService: StatusesService,
    private readonly issueHistory: IssueHistoryService,
    private readonly supabase: SupabaseService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  /** Verifies the user has access to the issue (via its list's project/workspace) and returns it. */
  async verifyAccess(issueId: string, userId: string): Promise<IssueModel> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    await this.listsService.verifyAccess(issue.list_id, userId);

    return issue;
  }

  async create(listId: string, dto: CreateIssueDto, userId: string) {
    await this.listsService.verifyAccess(listId, userId);

    if (dto.severity !== undefined && dto.type !== 'bug') {
      throw new BadRequestException('severity is only allowed on bug issues');
    }

    let statusId: string;
    if (dto.status_id !== undefined) {
      const status = await this.prisma.status.findUnique({
        where: { id: dto.status_id },
      });
      if (!status || status.list_id !== listId) {
        throw new BadRequestException(
          'status_id must be a status belonging to this list',
        );
      }
      statusId = status.id;
    } else {
      statusId = (await this.statusesService.getDefaultForList(listId)).id;
    }

    const issue = await this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        list_id: listId,
        type: dto.type,
        status_id: statusId,
        severity: dto.severity,
        priority: dto.priority,
        reported_by: userId,
      },
      include: ISSUE_INCLUDE,
    });

    await this.issueHistory.logChange(
      issue.id,
      'created',
      null,
      JSON.stringify({ title: issue.title, description: issue.description }),
      userId,
    );

    return issue;
  }

  async findAllByList(
    listId: string,
    userId: string,
    filters: FindIssuesQueryDto,
  ) {
    await this.listsService.verifyAccess(listId, userId);

    return this.prisma.issue.findMany({
      where: {
        list_id: listId,
        type: filters.type?.length ? { in: filters.type } : undefined,
        status_id: filters.status_id?.length ? { in: filters.status_id } : undefined,
        severity: filters.severity?.length ? { in: filters.severity } : undefined,
        priority: filters.priority?.length ? { in: filters.priority } : undefined,
        assigned_to: filters.assigned_to?.length
          ? { in: filters.assigned_to }
          : undefined,
      },
      include: ISSUE_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(issueId: string, userId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        ...ISSUE_INCLUDE,
        list: { include: { project: { include: { workspace: true } } } },
        history: {
          include: { changer: true },
          orderBy: { changed_at: 'desc' },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    await this.listsService.verifyAccess(issue.list_id, userId);

    return issue;
  }

  async update(issueId: string, dto: UpdateIssueDto, userId: string) {
    const issue = await this.verifyAccess(issueId, userId);

    const effectiveType = dto.type ?? issue.type;
    if (dto.severity !== undefined && effectiveType !== 'bug') {
      throw new BadRequestException('severity is only allowed on bug issues');
    }

    const fieldsToUpdate: Record<string, string | null> = {};

    const trackableFields = [
      'title',
      'description',
      'type',
      'priority',
      'severity',
      'assigned_to',
    ] as const;

    for (const field of trackableFields) {
      const newValue = dto[field];
      if (newValue !== undefined && newValue !== issue[field]) {
        await this.issueHistory.logChange(
          issueId,
          field,
          issue[field],
          newValue,
          userId,
        );
        fieldsToUpdate[field] = newValue;
      }
    }

    // status is tracked by id but logged by name (history stores plain-text labels, not ids).
    if (dto.status_id !== undefined && dto.status_id !== issue.status_id) {
      const [oldStatus, newStatus] = await Promise.all([
        this.prisma.status.findUnique({ where: { id: issue.status_id } }),
        this.prisma.status.findUnique({ where: { id: dto.status_id } }),
      ]);

      if (!newStatus || newStatus.list_id !== issue.list_id) {
        throw new BadRequestException(
          'status_id must be a status belonging to this issue’s list',
        );
      }

      await this.issueHistory.logChange(
        issueId,
        'status',
        oldStatus?.name ?? null,
        newStatus.name,
        userId,
      );
      fieldsToUpdate.status_id = dto.status_id;
    }

    // Moving an issue away from "bug" clears any severity it was carrying.
    if (
      effectiveType !== 'bug' &&
      issue.severity !== null &&
      dto.severity === undefined
    ) {
      await this.issueHistory.logChange(
        issueId,
        'severity',
        issue.severity,
        null,
        userId,
      );
      fieldsToUpdate.severity = null;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return this.prisma.issue.findUnique({
        where: { id: issueId },
        include: ISSUE_INCLUDE,
      });
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: fieldsToUpdate,
      include: ISSUE_INCLUDE,
    });
  }

  async getHistory(issueId: string, userId: string) {
    await this.verifyAccess(issueId, userId);

    return this.issueHistory.getIssueHistory(issueId);
  }

  async remove(issueId: string, userId: string) {
    await this.verifyAccess(issueId, userId);

    await cleanupIssueStorageFiles(this.supabase, this.bucket, [issueId]);

    // Cascades attachments and history rows in the DB (see schema onDelete: Cascade).
    await this.prisma.issue.delete({ where: { id: issueId } });

    return { message: 'Issue deleted successfully' };
  }
}
