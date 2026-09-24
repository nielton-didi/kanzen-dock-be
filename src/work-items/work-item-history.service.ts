import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WorkItemHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async logChange(
    workItemId: string,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
    changedBy: string,
  ) {
    return this.prisma.workItemHistory.create({
      data: {
        work_item_id: workItemId,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        changed_by: changedBy,
      },
    });
  }

  async getWorkItemHistory(workItemId: string) {
    return this.prisma.workItemHistory.findMany({
      where: { work_item_id: workItemId },
      include: { changer: true },
      orderBy: { changed_at: 'desc' },
    });
  }
}
