import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StatusCategory } from '../generated/prisma/enums.js';
import type { StatusModel } from '../generated/prisma/models.js';
import { ListsService } from '../lists/lists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStatusDto } from './dto/create-status.dto.js';
import type { DeleteStatusDto } from './dto/delete-status.dto.js';
import { STATUS_COLORS } from './dto/update-status.dto.js';
import type { ReorderStatusesDto } from './dto/reorder-statuses.dto.js';
import type { UpdateStatusDto } from './dto/update-status.dto.js';

const CATEGORIES: StatusCategory[] = ['not_started', 'active', 'done', 'closed'];

@Injectable()
export class StatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
  ) {}

  async findAllByList(listId: string, userId: string) {
    await this.listsService.verifyAccess(listId, userId);

    return this.prisma.status.findMany({
      where: { list_id: listId },
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
    });
  }

  /** First status in category+position order for a list — the default status for new work items. */
  async getDefaultForList(listId: string): Promise<StatusModel> {
    const status = await this.prisma.status.findFirst({
      where: { list_id: listId },
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
    });

    if (!status) {
      throw new ConflictException('List has no statuses to default to');
    }

    return status;
  }

  async create(listId: string, dto: CreateStatusDto, userId: string) {
    await this.listsService.verifyListManageAccess(listId, userId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.status.findMany({ where: { list_id: listId } });

      const duplicate = existing.find((s) => s.name === dto.name);
      if (duplicate) {
        throw new BadRequestException(
          'A status with this name already exists in this list',
        );
      }

      const activeCount = existing.filter((s) => s.category === 'active').length;
      const color = STATUS_COLORS[existing.length % STATUS_COLORS.length];

      return tx.status.create({
        data: {
          list_id: listId,
          name: dto.name,
          color,
          category: 'active',
          position: activeCount,
        },
      });
    });
  }

  async update(statusId: string, dto: UpdateStatusDto, userId: string) {
    const status = await this.findStatusOrThrow(statusId);
    await this.listsService.verifyListManageAccess(status.list_id, userId);

    if (dto.name) {
      const duplicate = await this.prisma.status.findFirst({
        where: { list_id: status.list_id, name: dto.name, NOT: { id: statusId } },
      });
      if (duplicate) {
        throw new BadRequestException(
          'A status with this name already exists in this list',
        );
      }
    }

    return this.prisma.status.update({
      where: { id: statusId },
      data: { name: dto.name, color: dto.color },
    });
  }

  /** Drives both same-category drag-reorder and cross-category moves from one grouped payload. */
  async reorder(listId: string, dto: ReorderStatusesDto, userId: string) {
    await this.listsService.verifyListManageAccess(listId, userId);

    const grouped: Record<StatusCategory, string[]> = {
      not_started: dto.not_started,
      active: dto.active,
      done: dto.done,
      closed: dto.closed,
    };

    const allIds = CATEGORIES.flatMap((category) => grouped[category]);
    const existing = await this.prisma.status.findMany({
      where: { list_id: listId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((s) => s.id));

    const isValid =
      allIds.length === existingIds.size &&
      new Set(allIds).size === allIds.length &&
      allIds.every((id) => existingIds.has(id));

    if (!isValid) {
      throw new BadRequestException(
        "Reorder payload must contain exactly this list's current statuses",
      );
    }

    // Two-phase update: the (list_id, category, position) unique index is checked
    // per-statement (not deferred), so swapping positions directly can transiently
    // collide mid-transaction. Phase 1 parks every row at a distinct negative
    // position (guaranteed not to collide with any real or other temp value);
    // phase 2 then applies the real category+position with nothing left to collide with.
    await this.prisma.$transaction([
      ...allIds.map((id, index) =>
        this.prisma.status.update({
          where: { id },
          data: { position: -(index + 1) },
        }),
      ),
      ...CATEGORIES.flatMap((category) =>
        grouped[category].map((id, position) =>
          this.prisma.status.update({
            where: { id },
            data: { category, position },
          }),
        ),
      ),
    ]);

    return this.findAllByList(listId, userId);
  }

  async remove(statusId: string, dto: DeleteStatusDto, userId: string) {
    const status = await this.findStatusOrThrow(statusId);
    await this.listsService.verifyListManageAccess(status.list_id, userId);

    const workItemCount = await this.prisma.workItem.count({
      where: { status_id: statusId },
    });

    if (workItemCount === 0) {
      const totalInList = await this.prisma.status.count({
        where: { list_id: status.list_id },
      });
      if (totalInList <= 1) {
        throw new BadRequestException('Cannot delete the last status in a list');
      }

      await this.prisma.status.delete({ where: { id: statusId } });
      return { message: 'Status deleted successfully' };
    }

    if (!dto.reassign_to_status_id) {
      throw new ConflictException({
        message: `${workItemCount} work item(s) use this status`,
        workItemsCount: workItemCount,
      });
    }

    if (dto.reassign_to_status_id === statusId) {
      throw new BadRequestException('Cannot reassign a status to itself');
    }

    const target = await this.prisma.status.findUnique({
      where: { id: dto.reassign_to_status_id },
    });
    if (!target || target.list_id !== status.list_id) {
      throw new BadRequestException(
        'Reassignment target must be a status in the same list',
      );
    }

    await this.prisma.$transaction([
      this.prisma.workItem.updateMany({
        where: { status_id: statusId },
        data: { status_id: dto.reassign_to_status_id },
      }),
      this.prisma.status.delete({ where: { id: statusId } }),
    ]);

    return { message: 'Status deleted successfully' };
  }

  private async findStatusOrThrow(statusId: string): Promise<StatusModel> {
    const status = await this.prisma.status.findUnique({ where: { id: statusId } });
    if (!status) {
      throw new NotFoundException('Status not found');
    }
    return status;
  }
}
