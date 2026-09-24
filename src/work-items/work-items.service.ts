import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupWorkItemStorageFiles } from '../attachments/cleanup-work-item-storage.util.js';
import type { WorkItemModel } from '../generated/prisma/models.js';
import { ListsService } from '../lists/lists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatusesService } from '../statuses/statuses.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreateWorkItemDto } from './dto/create-work-item.dto.js';
import type { FindWorkItemsQueryDto } from './dto/find-work-items-query.dto.js';
import type { UpdateWorkItemDto } from './dto/update-work-item.dto.js';
import { WorkItemHistoryService } from './work-item-history.service.js';

const WORK_ITEM_INCLUDE = {
  status: true,
  assignee: true,
  reporter: true,
  attachments: true,
} as const;

@Injectable()
export class WorkItemsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
    private readonly statusesService: StatusesService,
    private readonly workItemHistory: WorkItemHistoryService,
    private readonly supabase: SupabaseService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  /** Verifies the user has access to the work item (via its list's project/workspace) and returns it. */
  async verifyAccess(workItemId: string, userId: string): Promise<WorkItemModel> {
    const workItem = await this.prisma.workItem.findUnique({
      where: { id: workItemId },
    });

    if (!workItem) {
      throw new NotFoundException('Work item not found');
    }

    await this.listsService.verifyAccess(workItem.list_id, userId);

    return workItem;
  }

  async create(listId: string, dto: CreateWorkItemDto, userId: string) {
    await this.listsService.verifyAccess(listId, userId);

    if (dto.severity !== undefined && dto.type !== 'bug') {
      throw new BadRequestException('severity is only allowed on bug work items');
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

    const workItem = await this.prisma.workItem.create({
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
      include: WORK_ITEM_INCLUDE,
    });

    await this.workItemHistory.logChange(
      workItem.id,
      'created',
      null,
      JSON.stringify({ title: workItem.title, description: workItem.description }),
      userId,
    );

    return workItem;
  }

  async findAllByList(
    listId: string,
    userId: string,
    filters: FindWorkItemsQueryDto,
  ) {
    await this.listsService.verifyAccess(listId, userId);

    return this.prisma.workItem.findMany({
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
      include: WORK_ITEM_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(workItemId: string, userId: string) {
    const workItem = await this.prisma.workItem.findUnique({
      where: { id: workItemId },
      include: {
        ...WORK_ITEM_INCLUDE,
        list: { include: { project: { include: { workspace: true } } } },
        history: {
          include: { changer: true },
          orderBy: { changed_at: 'desc' },
        },
      },
    });

    if (!workItem) {
      throw new NotFoundException('Work item not found');
    }

    await this.listsService.verifyAccess(workItem.list_id, userId);

    return workItem;
  }

  async update(workItemId: string, dto: UpdateWorkItemDto, userId: string) {
    const workItem = await this.verifyAccess(workItemId, userId);

    const effectiveType = dto.type ?? workItem.type;
    if (dto.severity !== undefined && effectiveType !== 'bug') {
      throw new BadRequestException('severity is only allowed on bug work items');
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
      if (newValue !== undefined && newValue !== workItem[field]) {
        await this.workItemHistory.logChange(
          workItemId,
          field,
          workItem[field],
          newValue,
          userId,
        );
        fieldsToUpdate[field] = newValue;
      }
    }

    // status is tracked by id but logged by name (history stores plain-text labels, not ids).
    if (dto.status_id !== undefined && dto.status_id !== workItem.status_id) {
      const [oldStatus, newStatus] = await Promise.all([
        this.prisma.status.findUnique({ where: { id: workItem.status_id } }),
        this.prisma.status.findUnique({ where: { id: dto.status_id } }),
      ]);

      if (!newStatus || newStatus.list_id !== workItem.list_id) {
        throw new BadRequestException(
          'status_id must be a status belonging to this work item’s list',
        );
      }

      await this.workItemHistory.logChange(
        workItemId,
        'status',
        oldStatus?.name ?? null,
        newStatus.name,
        userId,
      );
      fieldsToUpdate.status_id = dto.status_id;
    }

    // Moving a work item away from "bug" clears any severity it was carrying.
    if (
      effectiveType !== 'bug' &&
      workItem.severity !== null &&
      dto.severity === undefined
    ) {
      await this.workItemHistory.logChange(
        workItemId,
        'severity',
        workItem.severity,
        null,
        userId,
      );
      fieldsToUpdate.severity = null;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return this.prisma.workItem.findUnique({
        where: { id: workItemId },
        include: WORK_ITEM_INCLUDE,
      });
    }

    return this.prisma.workItem.update({
      where: { id: workItemId },
      data: fieldsToUpdate,
      include: WORK_ITEM_INCLUDE,
    });
  }

  async getHistory(workItemId: string, userId: string) {
    await this.verifyAccess(workItemId, userId);

    return this.workItemHistory.getWorkItemHistory(workItemId);
  }

  async remove(workItemId: string, userId: string) {
    await this.verifyAccess(workItemId, userId);

    await cleanupWorkItemStorageFiles(this.supabase, this.bucket, [workItemId]);

    // Cascades attachments and history rows in the DB (see schema onDelete: Cascade).
    await this.prisma.workItem.delete({ where: { id: workItemId } });

    return { message: 'Work item deleted successfully' };
  }
}
