import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupWorkItemStorageFiles } from '../attachments/cleanup-work-item-storage.util.js';
import { customFieldHistoryName } from '../custom-fields/custom-field-values.js';
import { CustomFieldsService } from '../custom-fields/custom-fields.service.js';
import type { WorkItemModel } from '../generated/prisma/models.js';
import { ListsService } from '../lists/lists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatusesService } from '../statuses/statuses.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreateWorkItemDto } from './dto/create-work-item.dto.js';
import type { FindWorkItemsQueryDto } from './dto/find-work-items-query.dto.js';
import type { UpdateWorkItemDto } from './dto/update-work-item.dto.js';
import { WorkItemHistoryService } from './work-item-history.service.js';
import { fromDateOnly, toDateOnly } from './work-item-fields.const.js';

/** Rejects a start date after the due date. Both are `YYYY-MM-DD`, so string order is date order. */
function assertDateRange(startDate: string | null, dueDate: string | null) {
  if (startDate && dueDate && startDate > dueDate) {
    throw new BadRequestException('start_date must not be after due_date');
  }
}

type HistoryEntry = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

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
    private readonly customFieldsService: CustomFieldsService,
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

    assertDateRange(dto.start_date ?? null, dto.due_date ?? null);

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

    const customFields = dto.custom_fields
      ? (await this.customFieldsService.validatePatch(listId, dto.custom_fields)).set
      : {};

    const workItem = await this.prisma.workItem.create({
      data: {
        title: dto.title,
        description: dto.description,
        list_id: listId,
        status_id: statusId,
        priority: dto.priority,
        start_date: dto.start_date ? fromDateOnly(dto.start_date) : null,
        due_date: dto.due_date ? fromDateOnly(dto.due_date) : null,
        custom_fields: customFields,
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

    const customFieldMatches = filters.cf?.length
      ? await this.customFieldsService.findMatchingWorkItemIds(listId, filters.cf)
      : undefined;

    return this.prisma.workItem.findMany({
      where: {
        list_id: listId,
        id: customFieldMatches ? { in: customFieldMatches } : undefined,
        status_id: filters.status_id?.length ? { in: filters.status_id } : undefined,
        priority: filters.priority?.length ? { in: filters.priority } : undefined,
        assigned_to: filters.assigned_to?.length
          ? { in: filters.assigned_to }
          : undefined,
        due_date:
          filters.due_from || filters.due_to
            ? {
                gte: filters.due_from ? fromDateOnly(filters.due_from) : undefined,
                lte: filters.due_to ? fromDateOnly(filters.due_to) : undefined,
              }
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

    // Compared and logged as `YYYY-MM-DD` strings; validated before anything is logged.
    const currentDates = {
      start_date: toDateOnly(workItem.start_date),
      due_date: toDateOnly(workItem.due_date),
    };
    assertDateRange(
      dto.start_date !== undefined ? dto.start_date : currentDates.start_date,
      dto.due_date !== undefined ? dto.due_date : currentDates.due_date,
    );

    const customFieldPatch = dto.custom_fields
      ? await this.customFieldsService.validatePatch(workItem.list_id, dto.custom_fields)
      : undefined;

    const fieldsToUpdate: Record<string, string | Date | null> = {};
    // Written in the same transaction as the update, so history never records a change that didn't apply.
    const history: HistoryEntry[] = [];

    const trackableFields = [
      'title',
      'description',
      'priority',
      'assigned_to',
    ] as const;

    for (const field of trackableFields) {
      const newValue = dto[field];
      if (newValue !== undefined && newValue !== workItem[field]) {
        history.push({ field, oldValue: workItem[field], newValue });
        fieldsToUpdate[field] = newValue;
      }
    }

    for (const field of ['start_date', 'due_date'] as const) {
      const newValue = dto[field];
      if (newValue !== undefined && newValue !== currentDates[field]) {
        history.push({ field, oldValue: currentDates[field], newValue });
        fieldsToUpdate[field] = newValue === null ? null : fromDateOnly(newValue);
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

      history.push({
        field: 'status',
        oldValue: oldStatus?.name ?? null,
        newValue: newStatus.name,
      });
      fieldsToUpdate.status_id = dto.status_id;
    }

    if (Object.keys(fieldsToUpdate).length === 0 && !customFieldPatch) {
      return this.prisma.workItem.findUnique({
        where: { id: workItemId },
        include: WORK_ITEM_INCLUDE,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (customFieldPatch) {
        // Custom fields are logged as JSON values (option ids, not labels), one row per changed key.
        const changes = await this.customFieldsService.applyPatch(
          tx,
          workItemId,
          customFieldPatch,
        );
        for (const change of changes) {
          history.push({
            field: customFieldHistoryName(change.fieldId),
            oldValue: change.oldValue === null ? null : JSON.stringify(change.oldValue),
            newValue: change.newValue === null ? null : JSON.stringify(change.newValue),
          });
        }
      }

      if (history.length) {
        await tx.workItemHistory.createMany({
          data: history.map((entry) => ({
            work_item_id: workItemId,
            field_name: entry.field,
            old_value: entry.oldValue,
            new_value: entry.newValue,
            changed_by: userId,
          })),
        });
      }

      return tx.workItem.update({
        where: { id: workItemId },
        data: fieldsToUpdate,
        include: WORK_ITEM_INCLUDE,
      });
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
