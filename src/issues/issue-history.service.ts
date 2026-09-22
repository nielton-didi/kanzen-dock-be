import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IssueHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async logChange(
    issueId: string,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
    changedBy: string,
  ) {
    return this.prisma.issueHistory.create({
      data: {
        issue_id: issueId,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        changed_by: changedBy,
      },
    });
  }

  async getIssueHistory(issueId: string) {
    return this.prisma.issueHistory.findMany({
      where: { issue_id: issueId },
      include: { changer: true },
      orderBy: { changed_at: 'desc' },
    });
  }
}
